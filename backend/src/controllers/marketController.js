const { ethers } = require("ethers");
const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");

// Uniswap V3 QuoterV2 ABI (minimal)
const QUOTER_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

function getProvider() {
  return new ethers.JsonRpcProvider(process.env.RPC_URL);
}

/** GET /api/market/quote */
async function getQuote(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const { tokenIn, tokenOut, amountIn, fee = "3000" } = req.query;
    const provider = getProvider();
    const quoter = new ethers.Contract(
      process.env.UNISWAP_V3_QUOTER || "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6",
      QUOTER_ABI,
      provider
    );

    const params = {
      tokenIn,
      tokenOut,
      amountIn: BigInt(amountIn),
      fee: parseInt(fee),
      sqrtPriceLimitX96: 0n,
    };

    const [amountOut] = await quoter.quoteExactInputSingle.staticCall(params);

    res.json({
      tokenIn,
      tokenOut,
      amountIn,
      amountOut: amountOut.toString(),
      fee,
      priceImpact: null, // Calculate separately if needed
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/market/price/:address */
async function getTokenPrice(req, res, next) {
  try {
    // In production: fetch from Uniswap subgraph or CoinGecko
    res.json({
      address: req.params.address,
      priceUsd: null,
      message: "Price oracle not configured — connect to Uniswap subgraph or CoinGecko API",
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/market/pool/:address */
async function getPoolInfo(req, res, next) {
  try {
    const POOL_ABI = [
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function fee() view returns (uint24)",
      "function liquidity() view returns (uint128)",
      "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
    ];
    const provider = getProvider();
    const pool = new ethers.Contract(req.params.address, POOL_ABI, provider);
    const [token0, token1, fee, liquidity, slot0] = await Promise.all([
      pool.token0(),
      pool.token1(),
      pool.fee(),
      pool.liquidity(),
      pool.slot0(),
    ]);
    res.json({
      address: req.params.address,
      token0, token1,
      fee: fee.toString(),
      liquidity: liquidity.toString(),
      sqrtPriceX96: slot0[0].toString(),
      tick: slot0[1].toString(),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /api/market/pools/top */
async function getTopPools(req, res, next) {
  try {
    // In production: query Uniswap V3 subgraph
    res.json({
      pools: [],
      message: "Connect to Uniswap V3 subgraph: https://thegraph.com/hosted-service/subgraph/uniswap/uniswap-v3",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getQuote, getTokenPrice, getPoolInfo, getTopPools };
