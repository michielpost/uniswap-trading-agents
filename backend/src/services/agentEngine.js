/**
 * agentEngine.js
 * Core execution engine: parses skills.md, evaluates triggers, executes trades.
 */

const { v4: uuidv4 } = require("uuid");
const { executeTrade: uniswapExecuteTrade, getQuote } = require("./uniswapService");
const db = require('../db');

// ─── Activity log ──────────────────────────────────────────────────────────────
function logActivity(agentId, type, summary, details = null) {
  try {
    db.prepare(
      'INSERT INTO activity_logs (agent_id, ts, type, summary, details) VALUES (?, ?, ?, ?, ?)'
    ).run(agentId, Date.now(), type, summary, details ? JSON.stringify(details) : null);
  } catch (err) {
    console.warn('[ActivityLog] Failed to write log:', err.message);
  }
}

function getActivityLogs(agentId, limit = 100) {
  try {
    return db.prepare(
      'SELECT * FROM activity_logs WHERE agent_id = ? ORDER BY ts DESC LIMIT ?'
    ).all(agentId, limit);
  } catch {
    return [];
  }
}

// ─── Venice AI helper ─────────────────────────────────────────────────────────
async function callVeniceAI(veniceApiKey, messages) {
  const resp = await fetch("https://api.venice.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${veniceApiKey}` },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      messages,
      max_tokens: 100,
      temperature: 0.2,
    }),
  });
  if (!resp.ok) throw new Error(`Venice API error: ${resp.status} ${await resp.text()}`);
  const data = await resp.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "";
}

// ─── CoinGecko ETH price ──────────────────────────────────────────────────────
async function getCurrentEthPrice() {
  const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
  if (!resp.ok) throw new Error("CoinGecko fetch failed");
  const data = await resp.json();
  return data.ethereum.usd;
}

// ─── Stores ───────────────────────────────────────────────────────────────────
const tradeHistory = new Map();   // agentId -> Trade[]
const agentTimers  = new Map();   // agentId -> intervalId
const agentMetrics = new Map();   // agentId -> Metrics

// ─── Parse skills.md ─────────────────────────────────────────────────────────
/**
 * Parses a skills.md markdown string into a structured config object.
 * Expected format (lenient — extra sections are ignored):
 *
 * ## Strategy
 * Trade WETH/USDC ...
 * - tokenIn: 0x...
 * - tokenOut: 0x...
 * - fee: 3000
 *
 * ## Triggers
 * - price_above: 2000
 * - price_below: 1800
 *
 * ## Risk
 * - maxTradeSizeEth: 0.05
 * - slippageBps: 50
 * - stopLossPct: 10
 * - maxDailyTrades: 5
 */
function parseSkillsMarkdown(markdown) {
  if (!markdown || typeof markdown !== "string") {
    throw new Error("skills must be a non-empty string");
  }

  const config = {
    strategy: {
      // Base Sepolia defaults — override via skills.md
      tokenIn:  process.env.WETH_ADDRESS  || "0x4200000000000000000000000000000000000006",
      tokenOut: process.env.USDC_ADDRESS  || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
      fee:      3000,
    },
    triggers: {},
    risk: {
      maxTradeSizeEth: 0.001,  // small for testnet
      slippageBps:     100,    // 1% slippage on testnet
      stopLossPct:     10,
      maxDailyTrades:  5,
    },
  };

  const lines = markdown.split("\n").map((l) => l.trim());
  let section = null;

  for (const line of lines) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim().toLowerCase();
      continue;
    }

    // Parse key-value pairs from "- key: value" or "key: value"
    const kvMatch = line.match(/^-?\s*(\w+)\s*:\s*(.+)$/);
    if (!kvMatch) continue;

    const [, key, rawVal] = kvMatch;
    const val = rawVal.trim();

    if (section === "strategy") {
      if (key === "tokenIn")  config.strategy.tokenIn  = val;
      if (key === "tokenOut") config.strategy.tokenOut = val;
      if (key === "fee")      config.strategy.fee      = parseInt(val);
    } else if (section === "triggers") {
      const num = parseFloat(val);
      config.triggers[key] = isNaN(num) ? val : num;
    } else if (section === "risk") {
      const num = parseFloat(val);
      config.risk[key] = isNaN(num) ? val : num;
    }
  }

  return config;
}

// ─── Metrics helpers ──────────────────────────────────────────────────────────
function getAgentMetrics(agentId) {
  if (!agentMetrics.has(agentId)) {
    agentMetrics.set(agentId, {
      totalTrades:   0,
      successTrades: 0,
      failedTrades:  0,
      totalPnlPct:   "0",
      lastTradeAt:   null,
    });
  }
  return agentMetrics.get(agentId);
}

function recordTrade(agentId, trade) {
  if (!tradeHistory.has(agentId)) tradeHistory.set(agentId, []);
  tradeHistory.get(agentId).unshift(trade);

  const m = getAgentMetrics(agentId);
  m.totalTrades += 1;
  m.lastTradeAt  = trade.timestamp;

  if (trade.status === "success") {
    m.successTrades += 1;
    // Rough PnL: (amountOut - amountIn) / amountIn * 100
    if (trade.amountIn && trade.amountOut) {
      const pnl = ((parseFloat(trade.amountOut) - parseFloat(trade.amountIn)) / parseFloat(trade.amountIn)) * 100;
      m.totalPnlPct = (parseFloat(m.totalPnlPct) + pnl).toFixed(4);
    }
  } else {
    m.failedTrades += 1;
  }
}

// ─── Trade history retrieval ──────────────────────────────────────────────────
function getTradeHistory(agentId, { limit = 50, offset = 0 } = {}) {
  const all = tradeHistory.get(agentId) || [];
  return { trades: all.slice(offset, offset + limit), total: all.length };
}

// ─── Execute a single trade ───────────────────────────────────────────────────
async function executeTrade(agent, config, direction = "buy", broadcast) {
  const trade = {
    id:        uuidv4(),
    agentId:   agent.id,
    direction,
    tokenIn:   direction === "buy" ? config.strategy.tokenIn  : config.strategy.tokenOut,
    tokenOut:  direction === "buy" ? config.strategy.tokenOut : config.strategy.tokenIn,
    amountIn:  config.risk.maxTradeSizeEth?.toString() || "0.05",
    amountOut: null,
    fee:       config.strategy.fee,
    status:    "pending",
    txHash:    null,
    timestamp: Date.now(),
  };

  try {
    logActivity(agent.id, 'trade_start', `${direction.toUpperCase()} trade starting: ${trade.amountIn} ETH`, {
      direction,
      tokenIn: trade.tokenIn,
      tokenOut: trade.tokenOut,
      amountIn: trade.amountIn,
      fee: trade.fee,
    });
    const result = await uniswapExecuteTrade(trade, config.risk);
    trade.txHash   = result.txHash;
    trade.amountOut = result.amountOut;
    trade.status    = "success";
    logActivity(agent.id, 'trade_success', `Trade successful: ${result.txHash || 'simulated'}`, {
      txHash: result.txHash,
      amountOut: result.amountOut,
      direction,
    });
  } catch (err) {
    console.warn(`[AgentEngine] Trade failed for agent ${agent.id}:`, err.message);
    trade.status = "failed";
    trade.error  = err.message;
    logActivity(agent.id, 'trade_error', `Trade failed: ${err.message}`, {
      error: err.message,
      direction,
    });
  }

  recordTrade(agent.id, trade);

  // Broadcast WebSocket event
  if (broadcast) {
    broadcast(agent.owner, { type: "trade", agentId: agent.id, trade });
  }

  return trade;
}

// ─── Trigger evaluation ───────────────────────────────────────────────────────
async function evaluateTriggers(agent, config, broadcast, veniceApiKey) {
  const { triggers } = config;
  if (!triggers || Object.keys(triggers).length === 0) return;

  const maxDaily = config.risk.maxDailyTrades || 5;

  const m = getAgentMetrics(agent.id);
  if (m.totalTrades >= maxDaily) {
    console.log(`[AgentEngine] Agent ${agent.id} reached daily trade limit (${maxDaily})`);
    return;
  }

  // ── Get current ETH price ───────────────────────────────────────────────────
  let price = null;
  try {
    price = await getCurrentEthPrice();
    logActivity(agent.id, 'price', `ETH price: $${price.toFixed(2)}`, { price });
  } catch (cgErr) {
    // Fallback: try Uniswap quoter if RPC_URL is available
    if (process.env.RPC_URL) {
      try {
        const quote = await getQuote(
          config.strategy.tokenIn,
          config.strategy.tokenOut,
          "1000000000000000000",
          config.strategy.fee
        );
        price = parseFloat(quote.amountOut) / 1e6;
        logActivity(agent.id, 'price', `ETH price (RPC fallback): $${price.toFixed(2)}`, { price });
      } catch (rpcErr) {
        console.warn(`[AgentEngine] Price fetch failed for agent ${agent.id}:`, rpcErr.message);
      }
    } else {
      console.warn(`[AgentEngine] CoinGecko failed for agent ${agent.id}:`, cgErr.message);
    }
  }

  // ── Venice AI decision ──────────────────────────────────────────────────────
  if (veniceApiKey) {
    try {
      const recentTrades = (tradeHistory.get(agent.id) || []).slice(0, 3);
      const tradesSummary = recentTrades.length
        ? recentTrades.map((t) => `${t.direction.toUpperCase()} ${t.status} at ${new Date(t.timestamp).toISOString()}`).join("; ")
        : "No recent trades";

      const messages = [
        {
          role: "system",
          content: "You are a trading decision engine. Analyse the provided context and reply with exactly one word: BUY, SELL, or HOLD.",
        },
        {
          role: "user",
          content: `Current ETH price: $${price ?? "unknown"}\n\nAgent skills:\n${agent.skills || "(no skills configured)"}\n\nRecent trades (last 3): ${tradesSummary}\n\nBased on this, should the agent BUY, SELL, or HOLD right now? Reply with exactly one word.`,
        },
      ];

      logActivity(agent.id, 'venice_req', `Venice AI request (ETH: $${price ?? 'unknown'})`, {
        model: 'llama-3.3-70b',
        prompt: messages[1].content,
      });
      const rawDecision = await callVeniceAI(veniceApiKey, messages);
      const decision = rawDecision.toUpperCase().replace(/[^A-Z]/g, "");

      logActivity(agent.id, 'venice_res', `Venice AI decision: ${decision}`, {
        raw: rawDecision,
        decision,
        price,
      });

      console.log(`[AgentEngine] Venice decision for agent ${agent.id}: ${decision} (ETH: $${price ?? "unknown"})`);

      if (decision === "BUY") {
        await executeTrade(agent, config, "buy", broadcast);
      } else if (decision === "SELL") {
        await executeTrade(agent, config, "sell", broadcast);
      }
      // HOLD → do nothing
      return;
    } catch (veniceErr) {
      console.warn(`[AgentEngine] Venice AI failed for agent ${agent.id}:`, veniceErr.message);
      // Fall through to hard-coded logic
    }
  }

  // ── Fallback: hard-coded trigger logic ─────────────────────────────────────
  // Periodic trigger (fire every tick)
  if (triggers.interval_minutes) {
    await executeTrade(agent, config, "buy", broadcast);
    return;
  }

  // Price triggers
  if (price !== null && (triggers.price_above || triggers.price_below)) {
    if (triggers.price_above && price > triggers.price_above) {
      console.log(`[AgentEngine] Agent ${agent.id}: price ${price} > ${triggers.price_above} — selling`);
      await executeTrade(agent, config, "sell", broadcast);
    } else if (triggers.price_below && price < triggers.price_below) {
      console.log(`[AgentEngine] Agent ${agent.id}: price ${price} < ${triggers.price_below} — buying`);
      await executeTrade(agent, config, "buy", broadcast);
    }
  } else if ((triggers.price_above || triggers.price_below) && process.env.RPC_URL && price === null) {
    // Legacy: try RPC quoter as last resort
    try {
      const quote = await getQuote(
        config.strategy.tokenIn,
        config.strategy.tokenOut,
        "1000000000000000000",
        config.strategy.fee
      );
      const rpcPrice = parseFloat(quote.amountOut) / 1e6;
      if (triggers.price_above && rpcPrice > triggers.price_above) {
        await executeTrade(agent, config, "sell", broadcast);
      } else if (triggers.price_below && rpcPrice < triggers.price_below) {
        await executeTrade(agent, config, "buy", broadcast);
      }
    } catch (err) {
      console.warn(`[AgentEngine] RPC price fetch failed for agent ${agent.id}:`, err.message);
    }
  }
}

// ─── Agent lifecycle ──────────────────────────────────────────────────────────
function startAgentEngine(agent, agentStore, broadcast, veniceApiKey) {
  if (agentTimers.has(agent.id)) return; // Already running

  let config;
  try {
    config = parseSkillsMarkdown(agent.skills);
  } catch (err) {
    console.error(`[AgentEngine] Failed to parse skills for agent ${agent.id}:`, err.message);
    return;
  }

  const tickMs = parseInt(process.env.ENGINE_TICK_MS || "5000");

  const timer = setInterval(async () => {
    // Re-fetch from store in case it was updated
    const currentAgent = agentStore.get(agent.id);
    if (!currentAgent || currentAgent.status !== "running") {
      stopAgentEngine(agent.id, agent.owner, broadcast);
      return;
    }
    await evaluateTriggers(currentAgent, config, broadcast, veniceApiKey);
  }, tickMs);

  agentTimers.set(agent.id, timer);
  console.log(`[AgentEngine] Started agent ${agent.id} (tick: ${tickMs}ms)`);

  // Fire an immediate evaluation so the first Venice AI check happens now
  // instead of waiting for the first interval tick
  evaluateTriggers(agent, config, broadcast, veniceApiKey).catch((err) => {
    console.warn(`[AgentEngine] Initial tick failed for agent ${agent.id}:`, err.message);
  });
}

function stopAgentEngine(agentId, ownerAddress, broadcast) {
  const timer = agentTimers.get(agentId);
  if (timer) {
    clearInterval(timer);
    agentTimers.delete(agentId);
    console.log(`[AgentEngine] Stopped agent ${agentId}`);
  }

  if (broadcast) {
    broadcast(ownerAddress, { type: "agent_stopped", agentId });
  }
}

module.exports = {
  parseSkillsMarkdown,
  startAgentEngine,
  stopAgentEngine,
  executeTrade,
  getTradeHistory,
  getAgentMetrics,
  getActivityLogs,
  tradeHistory,
};
