const { ethers } = require("ethers");
const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");

// ─── Price cache (60 second TTL) ─────────────────────────────────────────────
const priceCache = new Map(); // address -> { price, expiresAt }
const CACHE_TTL_MS = 60_000;

const WETH_ADDRESSES = new Set([
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "0x4200000000000000000000000000000000000006", // Base WETH
]);
const USDC_ADDRESSES = new Set([
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913", // Base USDC
]);

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

    if (process.env.RPC_URL) {
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
      return res.json({ tokenIn, tokenOut, amountIn, amountOut: amountOut.toString(), fee, priceImpact: null });
    }

    // Fallback: estimate from CoinGecko
    try {
      const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      if (!resp.ok) throw new Error("CoinGecko unavailable");
      const data = await resp.json();
      const ethPrice = data.ethereum.usd;
      const amountInEth = parseFloat(amountIn) / 1e18;
      const estimatedUsdc = Math.round(amountInEth * ethPrice * 1e6);
      return res.json({
        tokenIn, tokenOut, amountIn,
        amountOut: estimatedUsdc.toString(),
        fee,
        priceImpact: null,
        estimated: true,
        note: "Estimated via CoinGecko — set RPC_URL for on-chain quotes",
      });
    } catch (cgErr) {
      throw new AppError("Quote unavailable: set RPC_URL for on-chain quotes", 503);
    }
  } catch (err) {
    next(err);
  }
}

/** GET /api/market/price/:address */
async function getTokenPrice(req, res, next) {
  try {
    const address = req.params.address.toLowerCase();

    // Check cache
    const cached = priceCache.get(address);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ address: req.params.address, priceUsd: cached.price, cached: true });
    }

    let price = null;

    if (USDC_ADDRESSES.has(address)) {
      price = 1.0;
    } else if (WETH_ADDRESSES.has(address)) {
      const resp = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd");
      if (!resp.ok) throw new AppError("CoinGecko unavailable", 503);
      const data = await resp.json();
      price = data.ethereum.usd;
    } else {
      const resp = await fetch(
        `https://api.coingecko.com/api/v3/simple/token_price/ethereum?contract_addresses=${address}&vs_currencies=usd`
      );
      if (resp.ok) {
        const data = await resp.json();
        price = data[address]?.usd ?? null;
      }
    }

    // Cache result
    priceCache.set(address, { price, expiresAt: Date.now() + CACHE_TTL_MS });

    res.json({ address: req.params.address, priceUsd: price });
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
    res.json({
      pools: [
        {
          address: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640",
          token0: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
          token1: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
          fee: 500,
          feePct: "0.05%",
          tvlUsd: 180_000_000,
          volume24hUsd: 320_000_000,
        },
        {
          address: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8",
          token0: { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
          token1: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
          fee: 3000,
          feePct: "0.3%",
          tvlUsd: 90_000_000,
          volume24hUsd: 150_000_000,
        },
        {
          address: "0xCBCdF9626bC03E24f779434178A73a0B4bad62eD",
          token0: { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
          token1: { address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", symbol: "WETH", decimals: 18 },
          fee: 3000,
          feePct: "0.3%",
          tvlUsd: 65_000_000,
          volume24hUsd: 80_000_000,
        },
      ],
      source: "static",
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getQuote, getTokenPrice, getPoolInfo, getTopPools };
