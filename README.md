# Uniswap Trading Agents

AI-powered autonomous trading agents with MetaMask authentication, Venice AI decisions, and **real Uniswap V3 swaps via the official Uniswap Trading API on Base Sepolia**.

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
- ✨ **Natural Language Builder** — Describe your strategy in plain English; Venice AI generates the `skills.md` instantly
- 🧠 **Venice AI Decisions** — Private LLM inference (llama-3.3-70b) for BUY/SELL/HOLD signals every 30s
- 🦄 **Uniswap Trading API** — Official Uniswap API (`trade-api.gateway.uniswap.org/v1`) with Permit2, best-price routing across UniswapX + Classic V3/V4
- 🔐 **MetaMask / SIWE Auth** — Sign-In with Ethereum, JWT sessions
- 📊 **Live Dashboard** — Real-time trade history, PnL, agent status via WebSocket
- ⛓️ **Real On-Chain Swaps** — Real tx hashes on Base Sepolia (no mocks, no simulations)
- 💹 **Live ETH Prices** — CoinGecko integration with 60s cache
- 🔗 **Shareable Agent Links** — Public agent profile pages (no login required)
- ⚙️ **Settings Page** — Venice API key management + live wallet balance display
- 🎮 **Demo Mode** — Try the dashboard with sample agents, no wallet needed

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
│  Agent Engine · Venice AI · Uniswap Trading API · JWT    │
└────────────────────────┬─────────────────────────────────┘
                         │ Uniswap Trading API calls
┌────────────────────────▼─────────────────────────────────┐
│  Uniswap Trading API (trade-api.gateway.uniswap.org/v1)  │
│  /check_approval · /quote · /swap · /order               │
│  Best-price routing: UniswapX PRIORITY + Classic V3      │
└────────────────────────┬─────────────────────────────────┘
                         │ on-chain txs (Permit2 signed)
┌────────────────────────▼─────────────────────────────────┐
│  Base Sepolia Testnet                                    │
│  Permit2 · Universal Router · WETH/USDC pool             │
└──────────────────────────────────────────────────────────┘
```

### Key Components

| Layer | Tech | Notes |
|---|---|---|
| Frontend | Next.js 14 App Router | wagmi v2, SIWE, no web3modal |
| Backend | Express 4 + WS | JWT auth, rate limiting, Helmet |
| Agent Engine | `agentEngine.js` | 30s tick, Venice AI + CoinGecko |
| **Swap Execution** | **Uniswap Trading API** | **`/check_approval` → `/quote` → `/swap`/`/order`, Permit2** |
| AI Decisions | Venice AI API | llama-3.3-70b, private inference |
| NL Builder | Venice AI | Plain-English → skills.md generation |
| Persistence | SQLite (better-sqlite3) | Agents, trades, activity logs |

---

## Uniswap Trading API Integration

Every swap goes through the official [Uniswap Trading API](https://api-docs.uniswap.org):

```
1. POST /check_approval  →  check Permit2 allowance; broadcast approval tx if needed
2. POST /quote           →  best-price route (UniswapX PRIORITY on Base, or Classic V3)
                             returns Permit2 EIP-712 typed data
3. sign permitData       →  executor wallet signs with signTypedData (EIP-712)
4. POST /swap            →  get calldata for CLASSIC routing → broadcast tx
   POST /order           →  submit gasless UniswapX order (filler pays gas)
```

**Routing:** On Base, the API returns `PRIORITY` (UniswapX) for competitive quotes, or `CLASSIC` for V3 pool routing. Both produce real on-chain execution with verifiable tx hashes.

**Fallback:** If the API returns "No quotes available" (sparse testnet liquidity), the engine falls back to direct SwapRouter02 calls to ensure reliability.

---

## How It Works

1. **Connect Wallet** — MetaMask login via SIWE (EIP-4361)
2. **Add Venice Key** — Settings page (`venice.ai/settings/api`), used for private AI inference
3. **Create Agent** — Describe strategy in plain English → Venice AI generates `skills.md`, or edit manually
4. **Start Agent** — Engine polls every 30s:
   - Fetches live ETH price from CoinGecko
   - Sends price + strategy to Venice AI → BUY/SELL/HOLD decision
   - If BUY/SELL: calls Uniswap Trading API (`/check_approval` → `/quote` → `/swap`)
   - Signs Permit2 typed data, broadcasts real on-chain tx
   - Records tx hash in SQLite, visible in activity log
5. **Watch Live** — Dashboard updates in real-time via WebSocket; activity log shows every Venice request and Uniswap API call

### skills.md Format

```markdown
## Strategy
Buy ETH when price dips, sell on recovery

## Triggers
- price_above: 3200
- price_below: 2800

## Risk
- maxTradeSizeEth: 0.001
- slippageBps: 100
- maxDailyTrades: 3
```

---

## Trading Wallet (Base Sepolia)

The executor wallet performs on-chain Uniswap swaps via the Trading API:

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

## Environment Variables

| Variable | Description |
|---|---|
| `UNISWAP_API_KEY` | Uniswap Developer Platform API key |
| `EXECUTOR_PRIVATE_KEY` | Hex private key of the executor wallet |
| `RPC_URL` | Base Sepolia RPC (default: `https://sepolia.base.org`) |
| `CHAIN_ID` | Chain ID (default: `84532`) |
| `JWT_SECRET` | Secret for JWT session tokens |

---

## Local Development

```bash
git clone https://github.com/michielpost/uniswap-trading-agents.git
cd uniswap-trading-agents

# Backend
cd backend
cp .env.example .env
# Fill in: JWT_SECRET, EXECUTOR_PRIVATE_KEY, UNISWAP_API_KEY, RPC_URL
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
- [Uniswap Trading API Docs](https://api-docs.uniswap.org) — Official API reference

---

## Hackathon Tracks

| Track | Notes |
|-------|-------|
| **Agentic Finance (Uniswap API)** | Uses official Uniswap Trading API with real API key, Permit2, best-price routing |
| **Autonomous Trading Agent** | Real on-chain swaps, Venice AI strategy engine, SQLite trade history |
| **Private Agents, Trusted Actions (Venice)** | Venice AI for private BUY/SELL/HOLD inference + NL strategy generation |
| **Agent Services on Base** | Agents operate on Base Sepolia |
| **Synthesis Open Track** | Full-stack AI trading platform |

**Participant ID:** `0ebb1a075bcd4fdcb5563bd8ae37d97b`

---

## License

MIT

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