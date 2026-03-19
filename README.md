# Uniswap Trading Bot Dashboard with AI Agents

A full-stack platform for deploying, managing, and monitoring autonomous AI trading agents on Uniswap V3. Each agent has isolated on-chain funds, a skill definition file, and executes trades based on configurable strategies.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Next.js)                    │
│   MetaMask Login │ Agent Dashboard │ Trade Monitor       │
└────────────────────────┬────────────────────────────────┘
                         │ REST + WebSocket
┌────────────────────────▼────────────────────────────────┐
│                   Backend API (Express)                  │
│   Auth (SIWE) │ Agent Engine │ Uniswap Router │ WS Hub  │
└────────────────────────┬────────────────────────────────┘
                         │ ethers.js
┌────────────────────────▼────────────────────────────────┐
│                  Smart Contracts (Solidity)              │
│   AgentFactory │ AgentRegistry │ FundVault               │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                    Uniswap V3 Protocol                   │
│   SwapRouter │ QuoterV2 │ Pool │ PositionManager         │
└─────────────────────────────────────────────────────────┘
```

## Features

- **AI Agent Creation** — Deploy on-chain agents with isolated fund vaults
- **skills.md Strategy System** — Define trading triggers and strategies in Markdown
- **Uniswap V3 Integration** — Execute swaps, manage liquidity positions
- **MetaMask Authentication** — Sign-In with Ethereum (SIWE) for secure login
- **Real-time Dashboard** — WebSocket-powered live trade monitoring
- **Multi-agent Support** — Run multiple independent agents per wallet
- **Risk Controls** — Per-agent max trade size, daily loss limits, slippage guards

## Project Structure

```
uniswap-trading-agents/
├── contracts/           # Solidity smart contracts
│   ├── AgentFactory.sol     # Deploys new agent instances
│   ├── AgentRegistry.sol    # Tracks all agents per owner
│   ├── FundVault.sol        # Isolated treasury per agent
│   └── interfaces/          # Contract interfaces
├── backend/             # Node.js/Express API
│   ├── src/
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, validation, rate limiting
│   │   ├── routes/          # API route definitions
│   │   ├── services/        # Business logic & Uniswap integration
│   │   └── index.js         # Entry point
│   ├── package.json
│   └── .env.example
├── frontend/            # Next.js 14 dashboard
│   ├── src/
│   │   ├── app/             # App Router pages
│   │   ├── components/      # UI components
│   │   ├── hooks/           # Custom React hooks
│   │   └── lib/             # Utilities, wagmi config
│   ├── package.json
│   └── next.config.js
├── docs/                # Documentation
│   ├── skills.md            # Agent strategy template
│   ├── ARCHITECTURE.md      # Deep-dive architecture
│   └── DEPLOYMENT.md        # Deployment guide
├── scripts/             # Deployment & utility scripts
│   └── deploy.js
├── .gitignore
├── README.md
└── package.json         # Workspace root
```

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0
- MetaMask browser extension
- An Ethereum RPC endpoint (Alchemy, Infura, or local Hardhat node)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/uniswap-trading-agents.git
cd uniswap-trading-agents

# Install all workspace dependencies
npm install

# Set up environment variables
cp backend/.env.example backend/.env
# Edit/backend/.env with your RPC URL, private key, etc.
```

### Local Development

```bash
# Terminal 1: Start local Hardhat blockchain
cd contracts && npx hardhat node

# Terminal 2: Deploy contracts to local network
cd contracts && npx hardhat run scripts/deploy.js --network localhost

# Terminal 3: Start backend API
cd backend && npm run dev

# Terminal 4: Start frontend
cd frontend && npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Deploy to Testnet

```bash
# Deploy contracts to Sepolia testnet
cd contracts && npx hardhat run scripts/deploy.js --network sepolia

# Update backend/.env with deployed contract addresses
# Then start the backend and frontend as above
```

## Smart Contracts

### AgentFactory
Deploys new agent instances with associated FundVault contracts. Emits `AgentCreated` events picked up by the backend.

### AgentRegistry
Maintains a mapping of owner addresses to their deployed agents. Supports pagination and filtering.

### FundVault
Isolated treasury contract per agent. Only the owning agent contract can initiate withdrawals. Supports ETH and ERC-20 tokens.

## Agent Skills System

Agents are configured via `skills.md` files that define:

- **Triggers**: Price thresholds, time-based, on-chain events
- **Strategies**: Which tokens to swap, amounts, slippage tolerance
- **Risk Limits**: Max position size, daily loss limit, stop-loss

See [docs/skills.md](docs/skills.md) for the full template.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | SIWE authentication |
| GET | `/api/auth/nonce` | Get auth nonce |
| GET | `/api/agents` | List user's agents |
| POST | `/api/agents` | Create new agent |
| GET | `/api/agents/:id` | Get agent details |
| PUT | `/api/agents/:id/skills` | Update agent skills |
| POST | `/api/agents/:id/start` | Start agent execution |
| POST | `/api/agents/:id/stop` | Stop agent execution |
| GET | `/api/agents/:id/trades` | Get trade history |
| GET | `/api/market/quote` | Get Uniswap swap quote |
| WS | `/ws` | Real-time trade events |

## Environment Variables

See [backend/.env.example](backend/.env.example) for all required variables.

Key variables:
- `RPC_URL` — Ethereum JSON-RPC endpoint
- `CHAIN_ID` — Target chain (1=mainnet, 11155111=sepolia)
- `AGENT_FACTORY_ADDRESS` — Deployed AgentFactory contract
- `AGENT_REGISTRY_ADDRESS` — Deployed AgentRegistry contract
- `JWT_SECRET` — Secret for JWT token signing

## Security

- All agent funds are isolated in individual FundVault contracts
- Backend authenticates users via SIWE (EIP-4361)
- Rate limiting on all API endpoints
- Slippage protection on all Uniswap swaps
- Emergency stop mechanism per agent
- No private keys stored server-side (agents use pre-authorized EOAs)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Blockchain | Ethereum / EVM |
| Smart Contracts | Solidity 0.8.x, OpenZeppelin, Hardhat |
| Backend | Node.js, Express, ethers.js v6 |
| Frontend | Next.js 14, React 18, TypeScript |
| Web3 Frontend | wagmi v2, viem, RainbowKit |
| Styling | Tailwind CSS |
| DEX | Uniswap V3 |

## License

MIT License — see [LICENSE](LICENSE) for details.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request
