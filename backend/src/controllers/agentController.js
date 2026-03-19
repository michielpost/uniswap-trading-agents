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

// ─── In-memory stores (export agentStore for tradeController) ─────────────────
const agentStore = new Map();   // agentId -> agent object

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

    agent.status    = "running";
    agent.updatedAt = new Date().toISOString();

    // Start the execution engine loop
    const broadcast = req.app.locals.broadcast;
    startAgentEngine(agent, agentStore, broadcast);

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

module.exports = {
  agentStore,          // exported for tradeController
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
};
