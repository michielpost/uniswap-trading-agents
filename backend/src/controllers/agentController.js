/**
 * agentController.js
 * Agent CRUD operations + lifecycle management (start/stop).
 * Wires HTTP requests to the agentEngine execution loop.
 */

const { validationResult } = require("express-validator");
const { v4: uuidv4 } = require("uuid");
const { AppError } = require("../middleware/errorHandler");
const {
  startAgentEngine,
  stopAgentEngine,
  getAgentMetrics,
  getTradeHistory,
  parseSkillsMarkdown,
} = require("../services/agentEngine");
const { getSettingsForAddress } = require("./settingsController");

const db = require('../db');

// ─── agentStore backed by SQLite ──────────────────────────────────────────────
// Provides Map-like interface to existing code while persisting to SQLite.
const agentStore = {
  _cache: new Map(),

  _fromRow(row) {
    if (!row) return undefined;
    return {
      id: row.id,
      name: row.name,
      owner: row.owner,
      skills: row.skills || '',
      status: row.status,
      contractAddress: row.contract_address || null,
      vaultAddress: row.vault_address || null,
      totalTrades: row.total_trades || 0,
      totalPnl: row.total_pnl || '0',
      lastPrice: row.last_price || null,
      txHash: row.tx_hash || null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  },

  get(id) {
    if (this._cache.has(id)) return this._cache.get(id);
    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id);
    const agent = this._fromRow(row);
    if (agent) this._cache.set(id, agent);
    return agent;
  },

  set(id, agent) {
    this._cache.set(id, agent);
    db.prepare(`
      INSERT INTO agents (id, name, owner, skills, status, contract_address, vault_address,
        total_trades, total_pnl, last_price, tx_hash, created_at, updated_at)
      VALUES (@id, @name, @owner, @skills, @status, @contractAddress, @vaultAddress,
        @totalTrades, @totalPnl, @lastPrice, @txHash, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name, owner=excluded.owner, skills=excluded.skills, status=excluded.status,
        contract_address=excluded.contract_address, vault_address=excluded.vault_address,
        total_trades=excluded.total_trades, total_pnl=excluded.total_pnl,
        last_price=excluded.last_price, tx_hash=excluded.tx_hash, updated_at=excluded.updated_at
    `).run({
      id: agent.id,
      name: agent.name,
      owner: agent.owner,
      skills: agent.skills || '',
      status: agent.status,
      contractAddress: agent.contractAddress || null,
      vaultAddress: agent.vaultAddress || null,
      totalTrades: agent.totalTrades || 0,
      totalPnl: agent.totalPnl || '0',
      lastPrice: agent.lastPrice || null,
      txHash: agent.txHash || null,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    });
  },

  has(id) {
    return !!this.get(id);
  },

  delete(id) {
    this._cache.delete(id);
    db.prepare('DELETE FROM agents WHERE id = ?').run(id);
  },

  values() {
    const rows = db.prepare('SELECT * FROM agents').all();
    return rows.map(r => {
      const agent = this._fromRow(r);
      this._cache.set(agent.id, agent);
      return agent;
    });
  },
};

function ownsAgent(agent, userAddress) {
  return agent.owner.toLowerCase() === userAddress.toLowerCase();
}

// ─── GET /api/agents ──────────────────────────────────────────────────────────
async function listAgents(req, res, next) {
  try {
    const agents = [...agentStore.values()]
      .filter((a) => a.owner.toLowerCase() === req.user.address.toLowerCase())
      .map((a) => ({ ...a, metrics: getAgentMetrics(a.id) }));
    res.json({ agents, total: agents.length });
  } catch (err) { next(err); }
}

// ─── POST /api/agents ─────────────────────────────────────────────────────────
async function createAgent(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const { name, skills = "" } = req.body;

    // Validate skills.md if provided
    if (skills) {
      try {
        parseSkillsMarkdown(skills);
      } catch (parseErr) {
        throw new AppError(`Invalid skills.md: ${parseErr.message}`, 400);
      }
    }

    const id = uuidv4();
    const agent = {
      id,
      name,
      owner:           req.user.address,
      skills,
      status:          "stopped",
      contractAddress: null,
      vaultAddress:    null,
      totalTrades:     0,
      totalPnl:        "0",
      lastPrice:       null,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };

    agentStore.set(id, agent);
    res.status(201).json({ agent });
  } catch (err) { next(err); }
}

// ─── GET /api/agents/:id ──────────────────────────────────────────────────────
async function getAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    const metrics = getAgentMetrics(agent.id);
    res.json({ agent: { ...agent, metrics } });
  } catch (err) { next(err); }
}

// ─── PUT /api/agents/:id/skills ───────────────────────────────────────────────
async function updateAgentSkills(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "running") throw new AppError("Stop agent before updating skills", 409);

    // Validate parseable
    let parsedConfig;
    try {
      parsedConfig = parseSkillsMarkdown(req.body.skills);
    } catch (parseErr) {
      throw new AppError(`Invalid skills.md: ${parseErr.message}`, 400);
    }

    agent.skills    = req.body.skills;
    agent.updatedAt = new Date().toISOString();

    res.json({ agent, parsedConfig });
  } catch (err) { next(err); }
}

// ─── POST /api/agents/:id/start ───────────────────────────────────────────────
async function startAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "running") throw new AppError("Agent already running", 409);
    if (!agent.skills || agent.skills.trim() === "") {
      throw new AppError("Agent has no skills configured — upload a skills.md first", 400);
    }

    // Require Venice API key
    const settings = getSettingsForAddress(req.user.address);
    if (!settings.veniceApiKey) {
      throw new AppError("Venice API key required — configure it in Settings before starting agents", 403);
    }

    agent.status    = "running";
    agent.updatedAt = new Date().toISOString();

    // Start the execution engine loop
    const broadcast = req.app.locals.broadcast;
    startAgentEngine(agent, agentStore, broadcast, settings.veniceApiKey);

    res.json({ agent, message: "Agent started successfully" });
  } catch (err) { next(err); }
}

// ─── POST /api/agents/:id/stop ────────────────────────────────────────────────
async function stopAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "stopped") throw new AppError("Agent already stopped", 409);

    agent.status    = "stopped";
    agent.updatedAt = new Date().toISOString();

    const broadcast = req.app.locals.broadcast;
    stopAgentEngine(agent.id, agent.owner, broadcast);

    res.json({ agent, message: "Agent stopped successfully" });
  } catch (err) { next(err); }
}

// ─── GET /api/agents/:id/trades ───────────────────────────────────────────────
async function getAgentTrades(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);

    const limit  = parseInt(req.query.limit  || "50");
    const offset = parseInt(req.query.offset || "0");
    const { trades, total } = getTradeHistory(agent.id, { limit, offset });
    const metrics = getAgentMetrics(agent.id);

    res.json({ trades, total, limit, offset, metrics });
  } catch (err) { next(err); }
}

// ─── GET /api/agents/:id/metrics ─────────────────────────────────────────────
async function getAgentStats(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    res.json({ metrics: getAgentMetrics(agent.id) });
  } catch (err) { next(err); }
}

// ─── POST /api/agents/:id/deploy ─────────────────────────────────────────────
async function deployAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);

    // On-chain deployment via AgentFactory contract
    try {
      const { getFactoryContract, getSigner } = require("../services/web3Service");
      const signer  = getSigner();
      const factory = getFactoryContract(signer);
      const tx = await factory.createAgent(agent.name);
      const receipt = await tx.wait();

      // Parse AgentCreated event
      const iface = factory.interface;
      const event = receipt.logs
        .map((log) => { try { return iface.parseLog(log); } catch { return null; } })
        .find((e) => e && e.name === "AgentCreated");

      if (event) {
        agent.contractAddress = event.args.agentAddress;
        agent.vaultAddress    = event.args.vaultAddress;
      }
      agent.txHash    = receipt.hash;
      agent.updatedAt = new Date().toISOString();

      res.json({ agent, txHash: receipt.hash, message: "Agent deployed on-chain" });
    } catch (onChainErr) {
      // Return stub if contracts not deployed (dev mode)
      console.warn("[AgentController] On-chain deploy failed (contracts not deployed?):", onChainErr.message);
      res.json({
        agent,
        message: "On-chain deployment skipped — configure AGENT_FACTORY_ADDRESS to deploy",
        warning: onChainErr.message,
      });
    }
  } catch (err) { next(err); }
}

// ─── POST /api/agents/:id/deposit ────────────────────────────────────────────
async function depositFunds(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (!agent.vaultAddress) {
      throw new AppError("Agent not deployed on-chain — deploy first to get a vault address", 400);
    }
    // The actual deposit is a client-side tx (user sends ETH/ERC20 to vaultAddress)
    res.json({
      message: "Send funds directly to the vault address",
      vaultAddress: agent.vaultAddress,
      amount:       req.body.amount,
      agentId:      agent.id,
    });
  } catch (err) { next(err); }
}

// ─── POST /api/agents/:id/withdraw ───────────────────────────────────────────
async function withdrawFunds(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "running") throw new AppError("Stop agent before withdrawing", 409);
    if (!agent.vaultAddress) throw new AppError("Agent not deployed on-chain", 400);

    try {
      const { getVaultContract, getSigner } = require("../services/web3Service");
      const { ethers } = require("ethers");
      const { amount, token, to } = req.body;
      const signer = getSigner();
      const vault  = getVaultContract(agent.vaultAddress, signer);

      let tx;
      if (!token || token === "ETH") {
        tx = await vault.withdrawETH(ethers.parseEther(amount.toString()), to || req.user.address);
      } else {
        const decimals = 18; // caller should provide; default 18
        tx = await vault.withdraw(token, ethers.parseUnits(amount.toString(), decimals), to || req.user.address);
      }
      const receipt = await tx.wait();
      res.json({ message: "Withdrawal submitted", txHash: receipt.hash, agentId: agent.id });
    } catch (onChainErr) {
      throw new AppError(`Withdrawal failed: ${onChainErr.message}`, 500);
    }
  } catch (err) { next(err); }
}

// ─── DELETE /api/agents/:id ───────────────────────────────────────────────────
async function deleteAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "running") throw new AppError("Stop agent before deleting", 409);

    agentStore.delete(req.params.id);
    res.json({ message: "Agent deleted successfully", agentId: req.params.id });
  } catch (err) { next(err); }
}

// ─── GET /api/agents/:id/logs ────────────────────────────────────────────────
async function getAgentLogs(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError('Agent not found', 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError('Forbidden', 403);
    const { getActivityLogs } = require('../services/agentEngine');
    const limit = parseInt(req.query.limit || '100');
    const logs = getActivityLogs(agent.id, limit);
    res.json({ logs });
  } catch (err) { next(err); }
}

// ─── GET /api/agents/:id/public (no auth — shareable) ────────────────────────
async function getPublicAgent(req, res, next) {
  try {
    const agent = agentStore.get(req.params.id);
    if (!agent) throw new AppError("Agent not found", 404);
    const metrics = getAgentMetrics(agent.id);

    // Extract skill headings only (don't expose full strategy details)
    const skillHeadings = (agent.skills || "")
      .split("\n")
      .filter((l) => l.startsWith("#"))
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .slice(0, 8);

    res.json({
      id:           agent.id,
      name:         agent.name,
      status:       agent.status,
      totalTrades:  agent.totalTrades || 0,
      totalPnl:     agent.totalPnl || "0",
      skillHeadings,
      createdAt:    agent.createdAt,
      metrics: {
        winRate:    metrics?.winRate    ?? 0,
        totalTrades: metrics?.totalTrades ?? 0,
        totalPnl:   metrics?.totalPnl   ?? "0",
      },
    });
  } catch (err) { next(err); }
}

// ─── POST /api/agents/generate-skills ────────────────────────────────────────
// Calls Venice AI to convert a plain-English strategy description into skills.md
async function generateSkills(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const { description } = req.body;

    const settings = getSettingsForAddress(req.user.address);
    if (!settings.veniceApiKey) {
      throw new AppError("Venice API key required — configure it in Settings before using AI generation", 403);
    }

    const systemPrompt = `You are an expert Uniswap V3 trading strategy designer for the Uniswap Trading Agents platform.
Given a plain-English strategy description, output ONLY a skills.md file in this exact format — no explanations, no code fences, just the raw markdown:

## Strategy
[1-2 sentence description of what the agent does]

## Triggers
- price_above: [ETH price in USD to trigger a sell/take-profit, realistic ~2000-5000]
- price_below: [ETH price in USD to trigger a buy/entry, realistic ~1500-4000]

## Risk
- maxTradeSizeEth: [max ETH per trade. Use 0.001 for safety on testnet]
- slippageBps: [slippage in basis points. 50-200 is reasonable]
- stopLossPct: [stop loss %, e.g. 10. Omit if not relevant]
- maxDailyTrades: [max trades per day, 1-10]

Rules:
- Only include trigger keys relevant to the strategy (omit price_above if buying only, etc.)
- price_above and price_below must be realistic ETH/USD values (not percentages)
- Output ONLY the markdown — no preamble, no explanation, no code blocks`;

    const userPrompt = `Strategy description: ${description}`;

    const veniceRes = await fetch("https://api.venice.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${settings.veniceApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user",   content: userPrompt },
        ],
        max_tokens: 400,
        temperature: 0.5,
      }),
    });

    if (!veniceRes.ok) {
      const errText = await veniceRes.text().catch(() => "");
      throw new AppError(`Venice AI request failed (${veniceRes.status}): ${errText}`, 502);
    }

    const data = await veniceRes.json();
    const skills = data.choices?.[0]?.message?.content?.trim();
    if (!skills) throw new AppError("Venice AI returned an empty response", 502);

    res.json({ skills });
  } catch (err) { next(err); }
}

module.exports = {
  agentStore,
  listAgents,
  createAgent,
  getAgent,
  updateAgentSkills,
  startAgent,
  stopAgent,
  getAgentTrades,
  getAgentStats,
  deployAgent,
  depositFunds,
  withdrawFunds,
  deleteAgent,
  getPublicAgent,
  getAgentLogs,
  generateSkills,
};
