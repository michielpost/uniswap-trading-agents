/**
 * agentEngine.js
 * Core execution engine: parses skills.md, evaluates triggers, executes trades.
 */

const { v4: uuidv4 } = require("uuid");
const { executeTrade: uniswapExecuteTrade, getQuote } = require("./uniswapService");

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
      tokenIn:  process.env.WETH_ADDRESS  || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      tokenOut: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet
      fee:      3000,
    },
    triggers: {},
    risk: {
      maxTradeSizeEth: 0.05,
      slippageBps:     50,
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
    const result = await uniswapExecuteTrade(trade, config.risk);
    trade.txHash   = result.txHash;
    trade.amountOut = result.amountOut;
    trade.status    = "success";
  } catch (err) {
    console.warn(`[AgentEngine] Trade failed for agent ${agent.id}:`, err.message);
    trade.status = "failed";
    trade.error  = err.message;
  }

  recordTrade(agent.id, trade);

  // Broadcast WebSocket event
  if (broadcast) {
    broadcast(agent.owner, { type: "trade", agentId: agent.id, trade });
  }

  return trade;
}

// ─── Trigger evaluation ───────────────────────────────────────────────────────
async function evaluateTriggers(agent, config, broadcast) {
  const { triggers } = config;
  if (!triggers || Object.keys(triggers).length === 0) return;

  const tickMs = parseInt(process.env.ENGINE_TICK_MS || "5000");
  const maxDaily = config.risk.maxDailyTrades || 5;

  const m = getAgentMetrics(agent.id);
  if (m.totalTrades >= maxDaily) {
    console.log(`[AgentEngine] Agent ${agent.id} reached daily trade limit (${maxDaily})`);
    return;
  }

  // Periodic trigger (fire every tick if no price trigger)
  if (triggers.interval_minutes) {
    // Handled by the tick interval itself
    await executeTrade(agent, config, "buy", broadcast);
    return;
  }

  // Price triggers via Uniswap quoter
  if ((triggers.price_above || triggers.price_below) && process.env.RPC_URL) {
    try {
      const quote = await getQuote(
        config.strategy.tokenIn,
        config.strategy.tokenOut,
        // 1 WETH in wei
        "1000000000000000000",
        config.strategy.fee
      );
      // amountOut in USDC (6 decimals) → price in USD
      const price = parseFloat(quote.amountOut) / 1e6;

      if (triggers.price_above && price > triggers.price_above) {
        console.log(`[AgentEngine] Agent ${agent.id}: price ${price} > ${triggers.price_above} — selling`);
        await executeTrade(agent, config, "sell", broadcast);
      } else if (triggers.price_below && price < triggers.price_below) {
        console.log(`[AgentEngine] Agent ${agent.id}: price ${price} < ${triggers.price_below} — buying`);
        await executeTrade(agent, config, "buy", broadcast);
      }
    } catch (err) {
      console.warn(`[AgentEngine] Price fetch failed for agent ${agent.id}:`, err.message);
    }
  }
}

// ─── Agent lifecycle ──────────────────────────────────────────────────────────
function startAgentEngine(agent, agentStore, broadcast) {
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
    await evaluateTriggers(currentAgent, config, broadcast);
  }, tickMs);

  agentTimers.set(agent.id, timer);
  console.log(`[AgentEngine] Started agent ${agent.id} (tick: ${tickMs}ms)`);
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
  tradeHistory,
};
