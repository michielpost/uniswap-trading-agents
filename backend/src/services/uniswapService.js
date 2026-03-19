/**
 * uniswapService.js
 * Wraps Uniswap V3 swap execution and quoting.
 */

const { ethers } = require("ethers");

// Minimal Uniswap V3 SwapRouter ABI
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)",
];

// Minimal Quoter ABI (V1)
const QUOTER_ABI = [
  "function quoteExactInputSingle(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint160 sqrtPriceLimitX96) external returns (uint256 amountOut)",
];

// ERC-20 approve ABI
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
];

function getProvider() {
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) throw new Error("RPC_URL environment variable not configured");
  return new ethers.JsonRpcProvider(rpcUrl);
}

function getSigner() {
  const pk = process.env.EXECUTOR_PRIVATE_KEY;
  if (!pk || pk === "0x0000000000000000000000000000000000000000000000000000000000000001") {
    throw new Error("EXECUTOR_PRIVATE_KEY not configured");
  }
  return new ethers.Wallet(pk, getProvider());
}

/**
 * Get a quote for an exact-input single swap.
 * @returns {{ amountOut: string, gasEstimate: string }}
 */
async function getQuote(tokenIn, tokenOut, amountIn, fee = 3000) {
  const provider = getProvider();
  const quoterAddress = process.env.UNISWAP_V3_QUOTER || "0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6";
  const quoter = new ethers.Contract(quoterAddress, QUOTER_ABI, provider);

  const amountOut = await quoter.quoteExactInputSingle.staticCall(
    tokenIn,
    tokenOut,
    fee,
    BigInt(amountIn),
    0n
  );

  return { tokenIn, tokenOut, amountIn, amountOut: amountOut.toString(), fee };
}

/**
 * Apply slippage tolerance to an amountOut value.
 * @param {string} amountOut - Raw amountOut string
 * @param {number} slippageBps - Slippage in basis points (e.g. 50 = 0.5%)
 * @returns {string}
 */
function applySlippage(amountOut, slippageBps = 50) {
  const amount = BigInt(amountOut);
  const slippage = BigInt(slippageBps);
  const minAmount = (amount * (10000n - slippage)) / 10000n;
  return minAmount.toString();
}

/**
 * Execute an exactInputSingle swap via the SwapRouter.
 * Falls back to a simulation stub if contracts are not configured.
 */
async function executeTrade(trade, riskConfig = {}) {
  const routerAddress = process.env.UNISWAP_V3_ROUTER || "0xE592427A0AEce92De3Edee1F18E0157C05861564";
  const slippageBps   = riskConfig.slippageBps || 50;

  // If no real RPC / private key configured → simulation mode
  if (!process.env.RPC_URL || !process.env.EXECUTOR_PRIVATE_KEY ||
      process.env.EXECUTOR_PRIVATE_KEY === "0x0000000000000000000000000000000000000000000000000000000000000001") {
    return simulateTrade(trade);
  }

  try {
    const signer = getSigner();
    const amountIn = ethers.parseEther(trade.amountIn.toString());

    // Get quote for minimum output
    const quote = await getQuote(trade.tokenIn, trade.tokenOut, amountIn.toString(), trade.fee);
    const amountOutMin = applySlippage(quote.amountOut, slippageBps);

    // Approve if tokenIn is not native ETH/WETH
    const WETH = (process.env.WETH_ADDRESS || "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2").toLowerCase();
    if (trade.tokenIn.toLowerCase() !== WETH) {
      const token = new ethers.Contract(trade.tokenIn, ERC20_ABI, signer);
      const allowance = await token.allowance(signer.address, routerAddress);
      if (allowance < amountIn) {
        const approveTx = await token.approve(routerAddress, ethers.MaxUint256);
        await approveTx.wait();
      }
    }

    const router = new ethers.Contract(routerAddress, SWAP_ROUTER_ABI, signer);
    const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

    const tx = await router.exactInputSingle({
      tokenIn:              trade.tokenIn,
      tokenOut:             trade.tokenOut,
      fee:                  trade.fee || 3000,
      recipient:            signer.address,
      deadline,
      amountIn,
      amountOutMinimum:     BigInt(amountOutMin),
      sqrtPriceLimitX96:    0n,
    }, {
      value: trade.tokenIn.toLowerCase() === WETH ? amountIn : 0n,
    });

    const receipt = await tx.wait();
    return { txHash: receipt.hash, amountOut: quote.amountOut };
  } catch (err) {
    throw new Error(`Swap execution failed: ${err.message}`);
  }
}

/**
 * Simulate a trade when on-chain execution is not configured.
 * Returns a plausible stub result so the UI works in demo mode.
 */
function simulateTrade(trade) {
  // Simulate ~2000 USDC per ETH with ±5% noise
  const noise = 0.95 + Math.random() * 0.1;
  const baseRate = 2000 * 1e6; // USDC has 6 decimals
  const amountIn = parseFloat(trade.amountIn || "0.05");
  const simulatedAmountOut = Math.floor(amountIn * baseRate * noise).toString();

  return {
    txHash:    null, // No real tx in simulation
    amountOut: simulatedAmountOut,
    simulated: true,
  };
}

module.exports = { getQuote, applySlippage, executeTrade, simulateTrade };
