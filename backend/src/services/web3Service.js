/**
 * web3Service.js
 * Provides ethers.js provider, signer, and contract instances.
 */

const { ethers } = require("ethers");

// AgentFactory ABI (minimal — matches AgentFactory.sol interface)
const AGENT_FACTORY_ABI = [
  "function createAgent(string name) external returns (address agentAddress, address vaultAddress)",
  "event AgentCreated(address indexed owner, address indexed agentAddress, address indexed vaultAddress, string name)",
];

// FundVault ABI (minimal)
const FUND_VAULT_ABI = [
  "function withdrawETH(uint256 amount, address to) external",
  "function withdraw(address token, uint256 amount, address to) external",
  "function executeSwap(address tokenIn, address tokenOut, uint24 fee, uint256 amountIn, uint256 amountOutMin) external returns (uint256 amountOut)",
  "function getBalance(address token) external view returns (uint256)",
];

let _provider = null;

function getProvider() {
  if (!_provider) {
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) throw new Error("RPC_URL environment variable not configured");
    _provider = new ethers.JsonRpcProvider(rpcUrl);
  }
  return _provider;
}

function getSigner() {
  const pk = process.env.EXECUTOR_PRIVATE_KEY;
  if (!pk || pk === "0x0000000000000000000000000000000000000000000000000000000000000001") {
    throw new Error("EXECUTOR_PRIVATE_KEY not configured — set it to a funded wallet private key");
  }
  return new ethers.Wallet(pk, getProvider());
}

function getFactoryContract(signerOrProvider) {
  const address = process.env.AGENT_FACTORY_ADDRESS;
  if (!address || address === "0x0000000000000000000000000000000000000000") {
    throw new Error("AGENT_FACTORY_ADDRESS not configured — deploy contracts first");
  }
  return new ethers.Contract(address, AGENT_FACTORY_ABI, signerOrProvider);
}

function getVaultContract(vaultAddress, signerOrProvider) {
  if (!vaultAddress) throw new Error("Vault address is required");
  return new ethers.Contract(vaultAddress, FUND_VAULT_ABI, signerOrProvider);
}

module.exports = { getProvider, getSigner, getFactoryContract, getVaultContract };
