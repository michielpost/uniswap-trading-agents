/**
 * uniswapService.js
 * Uniswap V3 swap execution using the official Uniswap Trading API.
 * Flow: check_approval → quote (Permit2 sign) → swap/order → broadcast tx
 * Falls back to direct SwapRouter02 if the API returns no route.
 */

const { ethers } = require("ethers");

// ─── Uniswap Trading API ──────────────────────────────────────────────────────
const UNISWAP_API_URL = "https://trade-api.gateway.uniswap.org/v1";

function getApiKey() {
  const key = process.env.UNISWAP_API_KEY;
  if (!key) throw new Error("UNISWAP_API_KEY not configured");
  return key;
}

function apiHeaders() {
  return {
    "x-api-key": getApiKey(),
    "accept": "application/json",
    "content-type": "application/json",
  };
}

async function apiPost(path, body) {
  const res = await fetch(`${UNISWAP_API_URL}${path}`, {
    method: "POST",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Uniswap API ${path} (${res.status}): ${text}`);
  }
  return res.json();
}

// ─── Network / wallet helpers ─────────────────────────────────────────────────
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
];

const WETH_ABI = [
  ...ERC20_ABI,
  "function deposit() external payable",
  "function withdraw(uint256 amount) external",
];

function getNetworkConfig() {
  return {
    rpcUrl:      process.env.RPC_URL        || "https://sepolia.base.org",
    chainId:     parseInt(process.env.CHAIN_ID || "84532"),
    wethAddress: process.env.WETH_ADDRESS   || "0x4200000000000000000000000000000000000006",
    usdcAddress: process.env.USDC_ADDRESS   || "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    // Direct router fallback (kept for no-route cases)
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

// ─── Uniswap API swap (primary path) ─────────────────────────────────────────
async function executeTradeViaApi(trade, riskConfig = {}) {
  const cfg           = getNetworkConfig();
  const signer        = getSigner();
  const walletAddress = signer.address;
  const amountIn      = ethers.parseEther(trade.amountIn.toString()).toString();
  const slippage      = ((riskConfig.slippageBps || 100) / 10000); // bps → fraction

  console.log(`[Uniswap API] Starting swap: ${trade.tokenIn} → ${trade.tokenOut}, amount=${trade.amountIn} ETH`);

  // 1. Check / send Permit2 approval
  const approvalRes = await apiPost("/check_approval", {
    walletAddress,
    amount:          amountIn,
    token:           trade.tokenIn,
    chainId:         cfg.chainId,
    tokenOut:        trade.tokenOut,
    tokenOutChainId: cfg.chainId,
  });

  if (approvalRes.approval) {
    console.log("[Uniswap API] Sending Permit2 approval tx...");
    const approveTx = await signer.sendTransaction(approvalRes.approval);
    await approveTx.wait();
    console.log(`[Uniswap API] Approval confirmed: ${approveTx.hash}`);
  } else {
    console.log("[Uniswap API] Permit2 approval already in place");
  }

  // 2. Get quote
  const quoteRes = await apiPost("/quote", {
    swapper:          walletAddress,
    tokenInChainId:   cfg.chainId,
    tokenOutChainId:  cfg.chainId,
    tokenIn:          trade.tokenIn,
    tokenOut:         trade.tokenOut,
    amount:           amountIn,
    routingPreference: "BEST_PRICE",
    type:             "EXACT_INPUT",
    slippage,
  });

  const { quote, permitData, routing } = quoteRes;
  const amountOut = quote?.output?.amount ?? quote?.outputAmount ?? "0";
  console.log(`[Uniswap API] Quote received: routing=${routing}, amountOut=${amountOut}`);

  // 3. Sign Permit2 typed data if present
  let signature = null;
  if (permitData) {
    signature = await signer.signTypedData(
      permitData.domain,
      permitData.types,
      permitData.values
    );
    console.log("[Uniswap API] Permit2 signature created");
  }

  // 4. Submit swap or UniswapX order
  let txHash;
  if (routing === "CLASSIC" || routing === "WRAP" || routing === "UNWRAP" || routing === "BRIDGE") {
    const swapRes = await apiPost("/swap", { signature, quote, permitData });
    const tx      = await signer.sendTransaction(swapRes.swap);
    const receipt = await tx.wait();
    txHash = receipt.hash;
    console.log(`[Uniswap API] Swap confirmed on-chain: ${txHash}`);
  } else {
    // UniswapX (DUTCH_V2, DUTCH_V3, PRIORITY) — gasless, filler pays gas
    const orderRes = await apiPost("/order", { signature, quote });
    txHash = orderRes.hash || orderRes.orderId || "uniswapx-order-submitted";
    console.log(`[Uniswap API] UniswapX order submitted: ${txHash}`);
  }

  return { txHash, amountOut, routing, simulated: false };
}

// ─── Direct SwapRouter02 fallback ─────────────────────────────────────────────
// Used when the Uniswap API cannot find a route (common on testnet with limited liquidity).

const SWAP_ROUTER_ABI = [
  "function exactInputSingle((address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96) params) external payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] calldata data) external payable returns (bytes[] memory results)",
];

const QUOTER_V2_ABI = [
  "function quoteExactInputSingle((address tokenIn, address tokenOut, uint256 amountIn, uint24 fee, uint160 sqrtPriceLimitX96) params) external returns (uint256 amountOut, uint160 sqrtPriceX96After, uint32 initializedTicksCrossed, uint256 gasEstimate)",
];

async function executeTradeDirectly(trade, riskConfig = {}) {
  const cfg         = getNetworkConfig();
  const slippageBps = riskConfig.slippageBps || 100;
  const signer      = getSigner();
  const provider    = getProvider();
  const amountIn    = ethers.parseEther(trade.amountIn.toString());
  const isWethIn    = trade.tokenIn.toLowerCase() === cfg.wethAddress.toLowerCase();

  // Auto-wrap ETH → WETH when needed
  if (isWethIn) {
    const weth    = new ethers.Contract(cfg.wethAddress, WETH_ABI, signer);
    const wethBal = await weth.balanceOf(signer.address);
    if (wethBal < amountIn) {
      const toWrap = amountIn - wethBal;
      const ethBal = await provider.getBalance(signer.address);
      if (ethBal < toWrap + ethers.parseEther("0.002")) {
        throw new Error(`Insufficient ETH. Have ${ethers.formatEther(ethBal)} ETH, need ${ethers.formatEther(toWrap)} + gas`);
      }
      const wrapTx = await (new ethers.Contract(cfg.wethAddress, WETH_ABI, signer)).deposit({ value: toWrap });
      await wrapTx.wait();
      console.log(`[Uniswap Direct] Wrapped ${ethers.formatEther(toWrap)} ETH → WETH`);
    }
  }

  // Approve router
  const tokenContract = new ethers.Contract(trade.tokenIn, ERC20_ABI, signer);
  const allowance     = await tokenContract.allowance(signer.address, cfg.routerAddress);
  if (allowance < amountIn) {
    const approveTx = await tokenContract.approve(cfg.routerAddress, ethers.MaxUint256);
    await approveTx.wait();
  }

  // Quote via QuoterV2
  const quoter    = new ethers.Contract(cfg.quoterAddress, QUOTER_V2_ABI, provider);
  const [rawOut]  = await quoter.quoteExactInputSingle.staticCall({
    tokenIn: trade.tokenIn, tokenOut: trade.tokenOut,
    amountIn: amountIn, fee: trade.fee || 3000, sqrtPriceLimitX96: 0n,
  });
  const amountOutMin = (rawOut * (10000n - BigInt(slippageBps))) / 10000n;

  // Swap via multicall (deadline protection)
  const router       = new ethers.Contract(cfg.routerAddress, SWAP_ROUTER_ABI, signer);
  const deadline     = Math.floor(Date.now() / 1000) + 300;
  const swapCalldata = router.interface.encodeFunctionData("exactInputSingle", [{
    tokenIn: trade.tokenIn, tokenOut: trade.tokenOut,
    fee: trade.fee || 3000, recipient: signer.address,
    amountIn, amountOutMinimum: amountOutMin, sqrtPriceLimitX96: 0n,
  }]);

  const tx      = await router.multicall(deadline, [swapCalldata]);
  const receipt = await tx.wait();
  console.log(`[Uniswap Direct] Swap confirmed: ${receipt.hash}`);
  return { txHash: receipt.hash, amountOut: rawOut.toString(), routing: "CLASSIC_DIRECT", simulated: false };
}

// ─── Public executeTrade — tries API first, falls back to direct ──────────────
async function executeTrade(trade, riskConfig = {}) {
  if (!process.env.EXECUTOR_PRIVATE_KEY) {
    throw new Error("Trading wallet not configured. Set EXECUTOR_PRIVATE_KEY.");
  }

  if (process.env.UNISWAP_API_KEY) {
    try {
      return await executeTradeViaApi(trade, riskConfig);
    } catch (apiErr) {
      const msg = apiErr.message || "";
      // Only fall back on routing/liquidity failures, not auth errors
      if (msg.includes("No quotes") || msg.includes("no route") || msg.includes("INSUFFICIENT_LIQUIDITY")) {
        console.warn(`[Uniswap API] No route found, falling back to direct SwapRouter02: ${msg}`);
        return await executeTradeDirectly(trade, riskConfig);
      }
      throw apiErr; // auth errors, network errors etc. propagate
    }
  }

  // No API key — use direct approach
  console.warn("[Uniswap] UNISWAP_API_KEY not set, using direct SwapRouter02");
  return await executeTradeDirectly(trade, riskConfig);
}

// ─── Executor wallet balances ─────────────────────────────────────────────────
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

// ─── getQuote helper (used by agentEngine for logging) ───────────────────────
async function getQuote(tokenIn, tokenOut, amountIn, fee = 3000) {
  const cfg      = getNetworkConfig();
  const provider = getProvider();
  const quoter   = new ethers.Contract(cfg.quoterAddress, QUOTER_V2_ABI, provider);
  const [amountOut] = await quoter.quoteExactInputSingle.staticCall({
    tokenIn, tokenOut, amountIn: BigInt(amountIn), fee, sqrtPriceLimitX96: 0n,
  });
  return { tokenIn, tokenOut, amountIn, amountOut: amountOut.toString(), fee };
}

function applySlippage(amountOut, slippageBps = 50) {
  const amount    = BigInt(amountOut);
  const minAmount = (amount * (10000n - BigInt(slippageBps))) / 10000n;
  return minAmount.toString();
}

module.exports = { getQuote, applySlippage, executeTrade, getExecutorBalances };


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
