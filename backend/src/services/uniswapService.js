/**
 * uniswapService.js
 * Real Uniswap V3 swap execution on Base Sepolia via SwapRouter02.
 * No simulation fallback — throws on misconfiguration.
 */

const { ethers } = require("ethers");

// SwapRouter02 ABI (no deadline in params — use multicall for deadline)
const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)",
];

// QuoterV2 ABI (struct-based, more accurate than V1)
const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

const WETH_ABI = [
  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
  "function balanceOf(address) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

// Base Sepolia defaults (override via env vars for other networks)
function getNetworkConfig() {
  return {
    rpcUrl:        process.env.RPC_URL        || "https://sepolia.base.org",
    wethAddress:   process.env.WETH_ADDRESS   || "0x4200000000000000000000000000000000000006",
    usdcAddress:   process.env.USDC_ADDRESS   || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    routerAddress: process.env.UNISWAP_V3_ROUTER || "0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4",
    quoterAddress: process.env.UNISWAP_V3_QUOTER || "0xC5290058841028F1614F3A6F0F5816cAd0df5E27",
  };
}

function getProvider() {
  return new ethers.JsonRpcProvider(getNetworkConfig().rpcUrl);
}

function getSigner() {
  const pk = process.env.EXECUTOR_PRIVATE_KEY;
  if (!pk) throw new Error("EXECUTOR_PRIVATE_KEY not set — trading wallet not configured");
  return new ethers.Wallet(pk, getProvider());
}

/**
 * Get an on-chain quote via QuoterV2 staticCall.
 */
async function getQuote(tokenIn, tokenOut, amountIn, fee = 3000) {
  const cfg = getNetworkConfig();
  const provider = getProvider();
  const quoter = new ethers.Contract(cfg.quoterAddress, QUOTER_V2_ABI, provider);

  const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
    tokenIn,
    tokenOut,
    amountIn:          BigInt(amountIn),
    fee,
    sqrtPriceLimitX96: 0n,
  });

  return { tokenIn, tokenOut, amountIn, amountOut: amountOut.toString(), fee };
}

function applySlippage(amountOut, slippageBps = 50) {
  const amount   = BigInt(amountOut);
  const minAmount = (amount * (10000n - BigInt(slippageBps))) / 10000n;
  return minAmount.toString();
}

/**
 * Execute a real exactInputSingle swap via Uniswap V3 SwapRouter02.
 * Wraps ETH → WETH automatically when tokenIn is WETH.
 * Throws on any failure — no simulation fallback.
 */
async function executeTrade(trade, riskConfig = {}) {
  const pk = process.env.EXECUTOR_PRIVATE_KEY;
  if (!pk) {
    throw new Error("Trading wallet not configured. Set EXECUTOR_PRIVATE_KEY.");
  }

  const cfg          = getNetworkConfig();
  const slippageBps  = riskConfig.slippageBps || 50;
  const signer       = getSigner();
  const provider     = getProvider();
  const amountIn     = ethers.parseEther(trade.amountIn.toString());
  const isWethIn     = trade.tokenIn.toLowerCase() === cfg.wethAddress.toLowerCase();

  // Auto-wrap ETH → WETH when needed
  if (isWethIn) {
    const weth = new ethers.Contract(cfg.wethAddress, WETH_ABI, signer);
    const wethBal = await weth.balanceOf(signer.address);
    if (wethBal < amountIn) {
      const toWrap   = amountIn - wethBal;
      const ethBal   = await provider.getBalance(signer.address);
      if (ethBal < toWrap + ethers.parseEther("0.002")) {
        // Keep 0.002 ETH for gas
        throw new Error(
          `Insufficient ETH. Have ${ethers.formatEther(ethBal)} ETH, need ${ethers.formatEther(toWrap)} + gas`
        );
      }
      const wrapTx = await weth.deposit({ value: toWrap });
      await wrapTx.wait();
      console.log(`[Uniswap] Wrapped ${ethers.formatEther(toWrap)} ETH → WETH`);
    }
  }

  // Approve router
  const tokenContract = new ethers.Contract(trade.tokenIn, ERC20_ABI, signer);
  const allowance = await tokenContract.allowance(signer.address, cfg.routerAddress);
  if (allowance < amountIn) {
    const approveTx = await tokenContract.approve(cfg.routerAddress, ethers.MaxUint256);
    await approveTx.wait();
    console.log(`[Uniswap] Approved ${cfg.routerAddress} to spend token ${trade.tokenIn}`);
  }

  // Quote to compute minimum output
  const quote        = await getQuote(trade.tokenIn, trade.tokenOut, amountIn.toString(), trade.fee || 3000);
  const amountOutMin = applySlippage(quote.amountOut, slippageBps);

  // Submit swap via multicall (wraps deadline around exactInputSingle)
  const router       = new ethers.Contract(cfg.routerAddress, SWAP_ROUTER_ABI, signer);
  const deadline     = Math.floor(Date.now() / 1000) + 300;

  const swapCalldata = router.interface.encodeFunctionData("exactInputSingle", [{
    tokenIn:           trade.tokenIn,
    tokenOut:          trade.tokenOut,
    fee:               trade.fee || 3000,
    recipient:         signer.address,
    amountIn,
    amountOutMinimum:  BigInt(amountOutMin),
    sqrtPriceLimitX96: 0n,
  }]);

  const tx      = await router.multicall(deadline, [swapCalldata]);
  const receipt = await tx.wait();

  console.log(`[Uniswap] Swap confirmed: ${receipt.hash}`);
  return {
    txHash:    receipt.hash,
    amountOut: quote.amountOut,
    simulated: false,
  };
}

/**
 * Return executor wallet balances (ETH + WETH + USDC).
 */
async function getExecutorBalances() {
  const pk = process.env.EXECUTOR_PRIVATE_KEY;
  if (!pk) return null;

  const cfg      = getNetworkConfig();
  const provider = getProvider();
  const signer   = getSigner();

  const [ethBal, wethBal, usdcBal] = await Promise.all([
    provider.getBalance(signer.address),
    new ethers.Contract(cfg.wethAddress, ERC20_ABI, provider).balanceOf(signer.address),
    new ethers.Contract(cfg.usdcAddress, ERC20_ABI, provider).balanceOf(signer.address),
  ]);

  return {
    address: signer.address,
    eth:     ethers.formatEther(ethBal),
    weth:    ethers.formatEther(wethBal),
    usdc:    (Number(usdcBal) / 1e6).toFixed(2),
    network: cfg.rpcUrl.includes("sepolia") ? "Base Sepolia" : "Base Mainnet",
  };
}

module.exports = { getQuote, applySlippage, executeTrade, getExecutorBalances };
