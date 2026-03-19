const express = require("express");
const { query, param } = require("express-validator");
const { getQuote, getTokenPrice, getPoolInfo, getTopPools } = require("../controllers/marketController");

const router = express.Router();

// GET /api/market/quote
router.get(
  "/quote",
  [
    query("tokenIn").notEmpty().withMessage("tokenIn is required"),
    query("tokenOut").notEmpty().withMessage("tokenOut is required"),
    query("amountIn").notEmpty().withMessage("amountIn is required"),
  ],
  getQuote
);

// GET /api/market/price/:address
router.get("/price/:address", param("address").notEmpty(), getTokenPrice);

// GET /api/market/pool/:address
router.get("/pool/:address", param("address").notEmpty(), getPoolInfo);

// GET /api/market/pools/top
router.get("/pools/top", getTopPools);

module.exports = router;
