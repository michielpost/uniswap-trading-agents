/**
 * admin.js — Protected admin endpoints for direct trade execution.
 * Requires `x-admin-secret` header matching ADMIN_SECRET env var.
 */

const express = require("express");
const router = express.Router();
const { v4: uuidv4 } = require("uuid");
const { executeTrade } = require("../services/uniswapService");
const db = require("../db");

// ─── Admin secret guard ───────────────────────────────────────────────────────
function requireAdminSecret(req, res, next) {
  const secret = process.env.ADMIN_SECRET || "synthesis-hackathon-admin-2026";
  if (req.headers["x-admin-secret"] !== secret) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// ─── POST /api/admin/execute-trade ───────────────────────────────────────────
// Body: { direction: "buy"|"sell", agentId?: string, label?: string }
router.post("/execute-trade", requireAdminSecret, async (req, res) => {
  const { direction = "buy", agentId, label } = req.body;

  if (!["buy", "sell"].includes(direction)) {
    return res.status(400).json({ error: "direction must be buy or sell" });
  }

  // Trade object (matches executeTradeViaApi / executeTradeDirectly expectations)
  const trade = {
    direction,
    tokenIn:  process.env.WETH_ADDRESS  || "0x4200000000000000000000000000000000000006",
    tokenOut: process.env.USDC_ADDRESS  || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    fee: 3000,
    amountIn: 0.00003, // ~$0.10 — tiny so we don't exhaust the 0.0001 ETH balance
  };
  const riskConfig = { maxTradeSizeEth: 0.00003, slippageBps: 300 };

  try {
    const result = await executeTrade(trade, riskConfig);
    const tradeRecord = {
      id:        uuidv4(),
      agentId:   agentId || "admin",
      direction,
      status:    "success",
      txHash:    result.txHash || null,
      amountIn:  trade.amountIn,
      amountOut: result.amountOut,
      timestamp: Date.now(),
      label:     label || `Admin ${direction.toUpperCase()} trade`,
      routing:   result.routing || "UNKNOWN",
    };

    // Persist to activity log if agentId provided
    if (agentId) {
      try {
        db.prepare(
          "INSERT INTO activity_logs (agent_id, ts, type, summary, details) VALUES (?, ?, ?, ?, ?)"
        ).run(
          agentId,
          Date.now(),
          "trade_success",
          `Admin trade: ${direction.toUpperCase()} — ${result.txHash || "simulated"}`,
          JSON.stringify({ txHash: result.txHash, direction, amountIn: trade.amountIn, amountOut: result.amountOut })
        );
      } catch (dbErr) {
        console.warn("[Admin] DB log failed:", dbErr.message);
      }
    }

    res.json({ ok: true, trade: tradeRecord });
  } catch (err) {
    console.error("[Admin] execute-trade error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── GET /api/admin/wallet ────────────────────────────────────────────────────
router.get("/wallet", requireAdminSecret, async (req, res) => {
  try {
    const { getExecutorBalances } = require("../services/uniswapService");
    const balances = await getExecutorBalances();
    res.json(balances || { error: "Wallet not configured" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
