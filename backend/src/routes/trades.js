const express = require("express");
const { body, param, query } = require("express-validator");
const {
  getAllTrades,
  getPortfolioMetrics,
  getTradeQuote,
  getAgentTradeHistory,
  executeTrade,
  cancelTrade,
} = require("../controllers/tradeController");

const router = express.Router();

// GET /api/trades
router.get("/", getAllTrades);

// GET /api/trades/metrics
router.get("/metrics", getPortfolioMetrics);

// GET /api/trades/quote
router.get(
  "/quote",
  [
    query("tokenIn").notEmpty().withMessage("tokenIn is required"),
    query("tokenOut").notEmpty().withMessage("tokenOut is required"),
    query("amountIn").notEmpty().withMessage("amountIn is required"),
  ],
  getTradeQuote
);

// GET /api/trades/agent/:agentId
router.get("/agent/:agentId", param("agentId").notEmpty(), getAgentTradeHistory);

// POST /api/trades/execute
router.post(
  "/execute",
  [
    body("agentId").notEmpty().withMessage("agentId is required"),
    body("direction").isIn(["buy", "sell"]).withMessage("direction must be buy or sell"),
    body("amountIn").isNumeric().withMessage("amountIn must be numeric"),
  ],
  executeTrade
);

// DELETE /api/trades/:tradeId
router.delete("/:tradeId", param("tradeId").notEmpty(), cancelTrade);

module.exports = router;
