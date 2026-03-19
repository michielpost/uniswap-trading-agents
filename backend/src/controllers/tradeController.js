/**
 * tradeController.js
 * Handles manual trade execution, trade history, and trade cancellation.
 */

const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");
const {
  executeTrade,
  getTradeHistory,
  getAgentMetrics,
  parseSkillsMarkdown,
  tradeHistory,
} = require("../services/agentEngine");
const { getQuote, applySlippage } = require("../services/uniswapService");

// Lazy reference to agentStore to avoid circular require issues
let _agentStore = null;
function getAgentStore() {
  if (!_agentStore) {
    _agentStore = require("./agentController").agentStore;
  }
  return _agentStore;
}

function ownsAgent(agent, userAddress) {
  return agent.owner.toLowerCase() === userAddress.toLowerCase();
}

// ─── GET /api/trades ──────────────────────────────────────────────────────────
async function getAllTrades(req, res, next) {
  try {
    const store = getAgentStore();
    const userAgents = [...store.values()].filter(
      (a) => a.owner.toLowerCase() === req.user.address.toLowerCase()
    );

    const limit  = parseInt(req.query.limit  || "50");
    const offset = parseInt(req.query.offset || "0");
    const statusFilter = req.query.status;

    let allTrades = [];
    for (const agent of userAgents) {
      const agentTrades = tradeHistory.get(agent.id) || [];
      allTrades.push(...agentTrades.map((t) => ({ ...t, agentName: agent.name })));
    }

    if (statusFilter) allTrades = allTrades.filter((t) => t.status === statusFilter);
    allTrades.sort((a, b) => b.timestamp - a.timestamp);

    const paginated = allTrades.slice(offset, offset + limit);
    res.json({ trades: paginated, total: allTrades.length, limit, offset });
  } catch (err) { next(err); }
}

// ─── GET /api/trades/metrics ──────────────────────────────────────────────────
async function getPortfolioMetrics(req, res, next) {
  try {
    const store = getAgentStore();
    const userAgents = [...store.values()].filter(
      (a) => a.owner.toLowerCase() === req.user.address.toLowerCase()
    );

    let totalTrades   = 0;
    let successTrades = 0;
    let failedTrades  = 0;
    let totalPnlPct   = 0;

    const agentMetrics = [];
    for (const agent of userAgents) {
      const m = getAgentMetrics(agent.id);
      totalTrades   += m.totalTrades;
      successTrades += m.successTrades;
      failedTrades  += m.failedTrades;
      totalPnlPct   += parseFloat(m.totalPnlPct || 0);
      agentMetrics.push({ agentId: agent.id, agentName: agent.name, ...m });
    }

    res.json({
      portfolio: {
        totalAgents:  userAgents.length,
        activeAgents: userAgents.filter((a) => a.status === "running").length,
        totalTrades,
        successTrades,
        failedTrades,
        winRate:     totalTrades > 0 ? ((successTrades / totalTrades) * 100).toFixed(1) : "0",
        totalPnlPct: totalPnlPct.toFixed(4),
      },
      agents: agentMetrics,
    });
  } catch (err) { next(err); }
}

// ─── GET /api/trades/quote ────────────────────────────────────────────────────
async function getTradeQuote(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const { tokenIn, tokenOut, amountIn, fee = "3000", slippageBps = "50" } = req.query;

    const quote = await getQuote(tokenIn, tokenOut, amountIn, parseInt(fee));
    const amountOutMin = applySlippage(quote.amountOut, parseInt(slippageBps));

    res.json({
      ...quote,
      amountOutMin,
      slippageBps: parseInt(slippageBps),
      priceImpactWarning: parseInt(slippageBps) > 100
        ? "High slippage tolerance — consider reducing"
        : null,
    });
  } catch (err) { next(err); }
}

// ─── GET /api/trades/agent/:agentId ──────────────────────────────────────────
async function getAgentTradeHistory(req, res, next) {
  try {
    const store = getAgentStore();
    const agent = store.get(req.params.agentId);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);

    const limit  = parseInt(req.query.limit  || "50");
    const offset = parseInt(req.query.offset || "0");

    const { trades, total } = getTradeHistory(agent.id, { limit, offset });
    const metrics = getAgentMetrics(agent.id);

    res.json({ trades, total, limit, offset, metrics });
  } catch (err) { next(err); }
}

// ─── POST /api/trades/execute ─────────────────────────────────────────────────
async function executeTradeHandler(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const store = getAgentStore();
    const { agentId, direction, amountIn, tokenIn, tokenOut, fee, slippageBps } = req.body;

    const agent = store.get(agentId);
    if (!agent) throw new AppError("Agent not found", 404);
    if (!ownsAgent(agent, req.user.address)) throw new AppError("Forbidden", 403);
    if (agent.status === "stopped") throw new AppError("Start agent before executing trades", 409);

    // Build trade config — start from agent skills, then apply overrides
    let baseConfig = {
      strategy: { fee: 3000 },
      risk: { slippageBps: 50, maxTradeSizeEth: 0.05, stopLossPct: 10, maxDailyTrades: 5 },
      triggers: {},
    };
    try {
      baseConfig = parseSkillsMarkdown(agent.skills || "");
    } catch (_) {}

    if (tokenIn)    baseConfig.strategy.tokenIn       = tokenIn;
    if (tokenOut)   baseConfig.strategy.tokenOut      = tokenOut;
    if (fee)        baseConfig.strategy.fee           = parseInt(fee);
    if (amountIn)   baseConfig.risk.maxTradeSizeEth   = parseFloat(amountIn);
    if (slippageBps) baseConfig.risk.slippageBps      = parseInt(slippageBps);

    if (!baseConfig.strategy.tokenIn || !baseConfig.strategy.tokenOut) {
      throw new AppError("tokenIn and tokenOut are required (set in skills or request body)", 400);
    }

    const broadcast = req.app.locals.broadcast;
    const trade = await executeTrade(agent, baseConfig, direction, broadcast);

    res.status(trade.status === "success" ? 200 : 422).json({ trade });
  } catch (err) { next(err); }
}

// ─── DELETE /api/trades/:tradeId ──────────────────────────────────────────────
async function cancelTrade(req, res, next) {
  try {
    const store = getAgentStore();
    const { tradeId } = req.params;

    const userAgents = [...store.values()].filter(
      (a) => a.owner.toLowerCase() === req.user.address.toLowerCase()
    );

    let foundTrade = null;

    for (const agent of userAgents) {
      const trades = tradeHistory.get(agent.id) || [];
      const trade = trades.find((t) => t.id === tradeId);
      if (trade) { foundTrade = trade; break; }
    }

    if (!foundTrade) throw new AppError("Trade not found", 404);
    if (foundTrade.status !== "pending") {
      throw new AppError(
        `Cannot cancel a trade with status '${foundTrade.status}' — only pending trades can be cancelled`,
        409
      );
    }

    foundTrade.status      = "cancelled";
    foundTrade.cancelledAt = Date.now();

    res.json({ trade: foundTrade, message: "Trade cancelled successfully" });
  } catch (err) { next(err); }
}

module.exports = {
  getAllTrades,
  getPortfolioMetrics,
  getTradeQuote,
  getAgentTradeHistory,
  executeTrade: executeTradeHandler,
  cancelTrade,
};
