# Uniswap Trading Agents Dashboard

AI-powered trading bot dashboard with skill-based agents, MetaMask authentication, and Uniswap V3 integration.

🏗️ **Built for The Synthesis Hackathon** | 🚀 **[Live Demo](https://frontend-mailpost-1109s-projects.vercel.app)**

## Live Deployment

| Service | URL |
|---------|-----|
| **Frontend** | https://frontend-mailpost-1109s-projects.vercel.app |
| **Backend API** | https://backend-production-65de.up.railway.app |
| **Health Check** | https://backend-production-65de.up.railway.app/health |

## Features

- 🤖 **AI Trading Agents** - Create custom trading bots with natural language strategies
- 📝 **Skills.md** - Define trading logic, triggers, and risk management in markdown
- 🔐 **MetaMask Login** - Secure authentication with Sign-In with Ethereum (SIWE)
- 💰 **Isolated Funds** - Each agent has its own Ethereum address and fund vault
- 📊 **Real-time Dashboard** - Track performance, trades, and agent activity
- 🔗 **Uniswap V3** - Direct integration for token swaps on Ethereum

## Architecture

### Smart Contracts (Solidity)
- `AgentFactory.sol` - Creates new trading agents
- `AgentRegistry.sol` - Tracks all registered agents  
- `FundVault.sol` - Isolated fund custody per agent

### Backend (Node.js/Express)
- 40+ REST API endpoints
- Web3 authentication
- Agent execution engine
- Uniswap integration

### Frontend (Next.js)
- MetaMask login with wagmi/viem
- Agent creation wizard
- Performance dashboards
- Real-time WebSocket updates

## Quick Start

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/uniswap-trading-agents.git
cd uniswap-trading-agents

# Install dependencies
make install

# Configure environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp contracts/.env.example contracts/.env

# Deploy contracts (testnet)
cd contracts
npx hardhat run scripts/deploy.js --network sepolia

# Start backend
cd ../backend
npm run dev

# Start frontend
cd ../frontend  
npm run dev
```

Open http://localhost:3000 and connect your MetaMask wallet!

## Documentation

- [Skills.md Template](docs/skills.md) - Define trading strategies
- [Triggers Reference](docs/TRIGGERS.md) - Available trigger types
- [Architecture](docs/ARCHITECTURE.md) - System overview
- [Deployment Guide](docs/DEPLOYMENT.md) - Production deployment
- [Quickstart](docs/QUICKSTART.md) - 15-minute setup guide

## Hackathon

This project was built for **The Synthesis Hackathon** (March 2026).

**Participant ID:** `0ebb1a075bcd4fdcb5563bd8ae37d97b`

## License

MIT