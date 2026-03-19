# Uniswap Trading Agents

AI-powered autonomous trading agents with MetaMask authentication, Venice AI decisions, and **real Uniswap V3 swaps on Base Sepolia**.

🏗️ **Built for [The Synthesis Hackathon](https://synthesis.devfolio.co)** (March 2026) &nbsp;|&nbsp; 🚀 **[Live Demo](https://frontend-beta-self-40.vercel.app)**

---

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://frontend-beta-self-40.vercel.app |
| **Backend API** | https://backend-production-65de.up.railway.app |
| **Health Check** | https://backend-production-65de.up.railway.app/health |
| **GitHub** | https://github.com/michielpost/uniswap-trading-agents |

---

## Features

- 🤖 **Autonomous AI Agents** — Create trading bots with natural-language `skills.md` strategies
- 🧠 **Venice AI Decisions** — Private LLM inference (llama-3.3-70b) for BUY/SELL/HOLD signals
- 🔐 **MetaMask / SIWE Auth** — Sign-In with Ethereum, JWT sessions
- 📊 **Live Dashboard** — Real-time trade history, PnL, agent status via WebSocket
- ⛓️ **Real On-Chain Swaps** — Uniswap V3 SwapRouter02 on Base Sepolia (real tx hashes)
- 💹 **Live ETH Prices** — CoinGecko integration with 60s cache
- 🔗 **Shareable Agent Links** — Public agent profile pages (no login required)
- ⚙️ **Settings Page** — Venice API key management + live wallet balance display

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Next.js 14 Frontend (Vercel)                            │
│  wagmi · viem · TailwindCSS · MetaMask SIWE              │
└────────────────────────┬─────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼─────────────────────────────────┐
│  Node.js / Express Backend (Railway)                     │
│  Agent Engine · Venice AI · Uniswap V3 · JWT Auth        │
└────────────────────────┬─────────────────────────────────┘
                         │ on-chain swaps
┌────────────────────────▼─────────────────────────────────┐
│  Base Sepolia Testnet                                    │
│  Uniswap V3 SwapRouter02 · QuoterV2 · WETH/USDC pool    │
└──────────────────────────────────────────────────────────┘
```

### Key Components

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Next.js 14 App Router | wagmi v2, SIWE, no web3modal |
| Backend | Express 4 + WS | JWT auth, rate limiting, Helmet |
| Agent Engine | `agentEngine.js` | 30s tick, Venice AI + CoinGecko |
| Swap Execution | `uniswapService.js` | SwapRouter02 + QuoterV2, real txs |
| AI Decisions | Venice AI API | llama-3.3-70b, OpenAI-compatible |

---

## Trading Wallet (Base Sepolia)

The executor wallet performs on-chain Uniswap V3 swaps:

```
Address:  0xa955929469693b389460BFEaB2c47E3e4362DD01
Network:  Base Sepolia (chain ID 84532)
RPC:      https://sepolia.base.org
```

**Token addresses (Base Sepolia):**

| Token | Address |
|-------|---------|
| WETH  | `0x4200000000000000000000000000000000000006` |
| USDC  | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

**Fund the wallet (free testnet ETH):**
- [Alchemy Base Sepolia Faucet](https://basefaucet.com/)
- [Coinbase CDP Faucet](https://portal.cdp.coinbase.com/products/faucet) — 0.1 ETH/day
- [Bware Labs Faucet](https://bwarelabs.com/faucets) — no registration
- [thirdweb Faucet](https://thirdweb.com/base-sepolia-testnet)

---

## Uniswap V3 Contracts (Base Sepolia)

| Contract | Address |
|----------|---------|
| SwapRouter02 | `0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4` |
| QuoterV2     | `0xC5290058841028F1614F3A6F0F5816cAd0df5E27` |
| Factory      | `0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24` |

---

## How It Works

1. **Connect Wallet** — MetaMask login via SIWE (EIP-4361)
2. **Add Venice Key** — Settings page, used for private AI inference
3. **Create Agent** — Name it and write a `skills.md` strategy
4. **Start Agent** — Engine polls every 30s:
   - Fetches live ETH price from CoinGecko
   - Sends price + strategy to Venice AI → gets BUY/SELL/HOLD
   - If BUY/SELL: wraps ETH→WETH if needed, approves router, executes `exactInputSingle` swap
   - Records real tx hash in trade history
5. **Watch Live** — Dashboard updates in real-time via WebSocket

### skills.md Format

```markdown
## Strategy
Trade WETH/USDC on Base Sepolia
- tokenIn: 0x4200000000000000000000000000000000000006
- tokenOut: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- fee: 3000

## Triggers
- price_above: 2200
- price_below: 1800

## Risk
- maxTradeSizeEth: 0.001
- slippageBps: 100
- maxDailyTrades: 3
```

---

## Local Development

```bash
git clone https://github.com/michielpost/uniswap-trading-agents.git
cd uniswap-trading-agents

# Backend
cd backend
cp .env.example .env
# Fill in: JWT_SECRET, EXECUTOR_PRIVATE_KEY, RPC_URL (https://sepolia.base.org)
npm install
npm run dev

# Frontend (new terminal)
cd frontend
cp .env.example .env.local
# Set: NEXT_PUBLIC_BACKEND_URL=http://localhost:4000/api
npm install
npm run dev
```

Open http://localhost:3000 and connect MetaMask.

---

## Documentation

- [Development Log](CONVERSATION_LOG.md) — Full build history
- [Skills.md Template](docs/skills.md) — Trading strategy format
- [Triggers Reference](docs/TRIGGERS.md) — Available trigger types
- [Architecture](docs/ARCHITECTURE.md) — System design
- [Deployment Guide](docs/DEPLOYMENT.md) — Production deployment

---

## Hackathon Tracks

| Track | Prize Pool |
|-------|-----------|
| Autonomous Trading Agent | $5,000+ |
| Agent Services on Base | $3,000+ |
| Private Agents, Trusted Actions (Venice) | $5,750 VVV |
| Agentic Finance (Uniswap API) | $2,500+ |

**Participant ID:** `0ebb1a075bcd4fdcb5563bd8ae37d97b`

---

## License

MIT