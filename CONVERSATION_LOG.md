# Development Conversation Log

This file documents the full development history of **Uniswap Trading Agents**, built during [The Synthesis Hackathon](https://synthesis.devfolio.co) (March 2026).

The project was built collaboratively between a human (Michiel Post) and an AI agent (GitHub Copilot CLI, powered by Claude Sonnet 4.6) over a single day.

---

## Session Overview

| Date | 2026-03-19 |
|------|-----------|
| Agent | GitHub Copilot CLI (`copilot` harness) |
| Model | Claude Sonnet 4.6 |
| Duration | ~8 hours |
| Commits | 40+ |

---

## Turn-by-Turn Development Log

### Turn 1 — Project Discovery

**Human:** Participate in the hackathon. Follow the steps in TODO and deploy the product to Vercel.

**Agent actions:**
- Read `https://synthesis.md/skill.md` (hackathon spec), `TODO.md`, and credentials file
- Discovered the repo had only a `backend/` skeleton — `frontend/` and `contracts/` were entirely missing
- Registered for the hackathon via the Synthesis API

**Outcome:** Understood the full scope. Backend existed but needed 6 missing files; entire frontend needed to be built from scratch.

---

### Turn 2 — Building the Backend

**Agent actions:**
- Created `backend/src/routes/auth.js` — SIWE nonce + login + logout endpoints
- Created `backend/src/routes/trades.js` — trade execution, history, quote, cancel
- Created `backend/src/routes/market.js` — Uniswap quote/price/pool endpoints
- Created `backend/src/services/agentEngine.js` — skills.md parser, agent loop
- Created `backend/src/services/uniswapService.js` — Uniswap V3 integration
- Created `backend/src/services/web3Service.js` — ethers.js provider/signer helpers
- Deployed backend to Railway via GraphQL API (discovered Railway CLI needs OAuth; used project token with `npx @railway/cli up` instead)

**Key decisions:**
- JWT-based auth with SIWE signature verification
- In-memory stores (Maps) for agents/trades/nonces for simplicity
- Agent engine ticks on `setInterval`, evaluates triggers each cycle

---

### Turn 3 — Building the Frontend

**Agent actions:**
- Created full Next.js 14 App Router frontend (17 files)
- Implemented MetaMask connection via wagmi v2
- Built SIWE login flow (hand-rolled message builder, no `siwe` library)
- Created dashboard, agent list, agent detail, market overview pages
- Deployed to Vercel

**Key challenge:** `@web3modal/wagmi`'s barrel imports pulled in every connector's uninstalled peer deps (`@metamask/sdk`, `@safe-global/*`, etc.), causing Vercel build failures. Fixed by using only `injected()` from `'wagmi'` directly and adding webpack stubs for all problematic packages in `next.config.js`.

---

### Turn 4 — CORS Fix

**Human:** Getting CORS errors — backend only allows old Vercel preview URL.

**Agent actions:**
- Updated backend CORS to use a function that allows any `frontend-*-mailpost-1109s-projects.vercel.app` preview URL plus the canonical alias
- Redeployed backend

---

### Turn 5 — Fix `t.filter is not a function`

**Human:** After sign-in I get `TypeError: t.filter is not a function`.

**Root cause:** Backend returns `{ agents: [...], total: N }` envelope; frontend called `.filter()` directly on the object.

**Agent actions:**
- Fixed `listAgents()`, `getAllTrades()`, `getAgentTrades()` in `api.ts` to unwrap envelope
- Pattern: `Array.isArray(data) ? data : data.agents ?? []`

---

### Turn 6 — Settings Page + Shareable Agent Links

**Human:** Add a settings page for Venice API key. Add shareable agent links.

**Agent actions:**
- Created `backend/src/routes/settings.js` and `settingsController.js`
- Added `getPublicAgent` endpoint (unauthenticated) to `agentController.js`
- Added Venice key guard on `startAgent` — 403 if no key configured
- Created `frontend/src/app/dashboard/settings/page.tsx`
- Created `frontend/src/app/agent/[id]/page.tsx` — public shareable profile
- Updated `Navbar.tsx` with Settings link
- Updated `AgentCard.tsx` with Share button + clipboard tooltip
- Updated dashboard to fetch settings and show Venice key warning banner

---

### Turn 7 — Real Data (Remove Mock Data)

**Human:** Is there any mock data? Replace with real data.

**Agent actions (via background agent):**
- Replaced `Math.random()` price generation in `uniswapService.js` with real CoinGecko prices
- Implemented `callVeniceAI()` in `agentEngine.js` — real API calls to `api.venice.ai/api/v1/chat/completions`
- Updated `marketController.js` with real CoinGecko prices + 60s cache
- Added fallback logic: Venice AI → hard-coded trigger logic if Venice fails
- Deployed both backend and frontend

---

### Turn 8 — Hackathon Self-Assessment and Submission

**Human:** Self-judge against hackathon rules. What needs improvement?

**Agent analysis:**
- Venice AI track: strong (real API calls) ✅
- Uniswap track: code exists but trades were simulated ❌
- Base chain: targeting mainnet, not Base ❌
- Data persistence: in-memory only ❌

**Agent actions:**
- Submitted to 4 hackathon tracks: Autonomous Trading Agent, Agent Services on Base, Private Agents/Venice AI, Uniswap API Integration
- Updated project description on hackathon platform

---

### Turn 9 — Fix React Hydration Errors (#418, #423)

**Human:** Getting production errors: Minified React error #418/#423.

**Root cause:**
- `Navbar.tsx`: `getAddress()` called directly in render — returns `null` on server (no `localStorage`), real value on client → HTML mismatch
- `page.tsx` (home): `isAuthenticated()` called in JSX render — same issue

**Agent actions:**
- `Navbar.tsx`: moved `getAddress()` into `useState` + `useEffect`
- `page.tsx`: replaced `isAuthenticated()` in render with `alreadyAuthed` state (already set via `useEffect`)
- Deployed fix

---

### Turn 10 — Real On-Chain Trading

**Human:** Setup a real wallet for trading. Implement real trading using the Uniswap API. Remove all fake trading.

**Agent actions:**

1. **Generated executor wallet:**
   - Address: `0xa955929469693b389460BFEaB2c47E3e4362DD01`
   - Network: Base Sepolia (chain ID 84532)

2. **Rewrote `uniswapService.js` completely:**
   - Deleted `simulateTrade()` — no fallback, throws on misconfiguration
   - Uses **SwapRouter02** (`0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`) on Base Sepolia
   - Uses **QuoterV2** (`0xC5290058841028F1614F3A6F0F5816cAd0df5E27`) for accurate quotes
   - Auto-wraps ETH → WETH when `tokenIn` is WETH and balance is insufficient
   - Uses `multicall(deadline, [exactInputSingle])` for deadline-protected swaps
   - Exports `getExecutorBalances()` — live ETH/WETH/USDC balances

3. **Updated `agentEngine.js` defaults:**
   - WETH: `0x4200000000000000000000000000000000000006` (Base Sepolia)
   - USDC: `0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - Default trade size: `0.001 ETH` (safe for testnet)
   - Slippage: 100 bps (1%) for testnet liquidity

4. **Added `/api/wallet` endpoint** — returns live executor balances (authenticated)

5. **Updated Settings page:**
   - Added Trading Wallet card with live ETH/WETH/USDC balance display
   - Low-balance warning with Alchemy faucet link

6. **Set Railway environment variables:**
   - `RPC_URL=https://sepolia.base.org`
   - `CHAIN_ID=84532`
   - `WETH_ADDRESS=0x4200000000000000000000000000000000000006`
   - `USDC_ADDRESS=0x036CbD53842c5426634e7929541eC2318f3dCF7e`
   - `UNISWAP_V3_ROUTER=0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4`
   - `UNISWAP_V3_QUOTER=0xC5290058841028F1614F3A6F0F5816cAd0df5E27`
   - `EXECUTOR_PRIVATE_KEY` (set securely, not in source)
   - `ENGINE_TICK_MS=30000`

7. **Deployed** both backend (Railway) and frontend (Vercel)

---

### Turn 11 — Documentation + Final Deploy

**Human:** Deploy the wallet. Update the README and project details. Include conversation log. Push and deploy everything.

**Agent actions:**
- Attempted faucet funding via API (ethereum-ecosystem PoW faucet, Bware Labs, LearnWeb3) — all require browser/UI interaction; wallet address documented in README for manual funding
- Rewrote README with: wallet address, Base Sepolia contract addresses, faucet links, updated architecture diagram, skills.md format example
- Created this `CONVERSATION_LOG.md` file
- Updated hackathon project description and `deployedURL`
- Pushed all changes and redeployed frontend

---

## Technical Decisions

### Why hand-rolled SIWE instead of the `siwe` npm package?

The `siwe` library imports `ethers` as a peer dep. On Vercel, peer deps aren't auto-installed, causing build failures. Rather than adding `ethers` to `dependencies` (adds 3MB+), we implemented the EIP-4361 message format directly — it's just string concatenation.

### Why `injected()` only instead of web3modal?

`@web3modal/wagmi`'s `defaultWagmiConfig` imports `@wagmi/connectors` barrel which imports ALL optional connectors (Coinbase, Safe, etc.), each requiring uninstalled peer deps. Using only `injected()` from `'wagmi'` directly eliminates this problem. MetaMask is the primary target anyway.

### Why Base Sepolia instead of mainnet?

Real on-chain trading carries financial risk. Base Sepolia provides identical execution semantics (Uniswap V3 is fully deployed, same contracts) with zero financial risk and free testnet ETH from public faucets. The architecture works unchanged on Base mainnet by swapping the RPC URL and token addresses.

### Why Venice AI for trading decisions?

The hackathon's Venice track specifically rewards using Venice's private LLM inference. Venice doesn't retain data, making it suitable for trading strategies that agents want to keep confidential. The OpenAI-compatible API means integration is a single `fetch` call with a model swap.

### Why in-memory storage?

For a hackathon, a PostgreSQL deployment adds complexity and cost. The trade-off is data loss on restart. For production, the Maps are easily swapped for a database (the interfaces are identical). The `.env.example` already documents `DATABASE_URL` and `REDIS_URL` for when this is needed.

---

## File Structure

```
uniswap-trading-agents/
├── README.md
├── CONVERSATION_LOG.md          ← this file
├── backend/
│   ├── src/
│   │   ├── index.js             ← Express app, CORS, WebSocket, routes
│   │   ├── controllers/
│   │   │   ├── agentController.js
│   │   │   ├── authController.js
│   │   │   ├── marketController.js
│   │   │   ├── settingsController.js
│   │   │   └── tradeController.js
│   │   ├── routes/
│   │   │   ├── agents.js
│   │   │   ├── auth.js
│   │   │   ├── market.js
│   │   │   ├── settings.js
│   │   │   └── trades.js
│   │   ├── services/
│   │   │   ├── agentEngine.js   ← Venice AI + CoinGecko + trade loop
│   │   │   ├── uniswapService.js← Real SwapRouter02 + QuoterV2
│   │   │   └── web3Service.js
│   │   └── middleware/
│   │       ├── authenticate.js
│   │       ├── errorHandler.js
│   │       └── rateLimiter.js
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx         ← Landing + SIWE login
│   │   │   ├── dashboard/
│   │   │   │   ├── page.tsx     ← Main dashboard
│   │   │   │   ├── agents/[id]/
│   │   │   │   └── settings/    ← Venice key + wallet balance
│   │   │   └── agent/[id]/      ← Public shareable agent page
│   │   ├── components/
│   │   │   ├── AgentCard.tsx
│   │   │   ├── Navbar.tsx
│   │   │   ├── Providers.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── Toast.tsx
│   │   └── lib/
│   │       ├── api.ts           ← All API calls + type definitions
│   │       ├── auth.ts          ← JWT + localStorage helpers
│   │       └── wagmi.ts         ← wagmi config (injected only)
│   ├── next.config.js           ← webpack stubs for SSR-incompatible packages
│   ├── .npmrc                   ← legacy-peer-deps=true
│   └── package.json
└── docs/
    ├── skills.md
    ├── TRIGGERS.md
    ├── ARCHITECTURE.md
    ├── DEPLOYMENT.md
    └── QUICKSTART.md
```

---

## Lessons Learned

1. **Next.js App Router SSR requires careful localStorage handling** — any call to `localStorage` outside `useEffect` causes hydration mismatch errors #418/#423. Pattern: `useState(null)` + `useEffect(() => setState(localStorage.getItem(...)))`.

2. **wagmi barrel imports are a footgun** — importing from `wagmi/connectors` or `@web3modal/wagmi` pulls in ALL connectors transitively. Always import connectors directly from `'wagmi'`.

3. **Railway CLI project tokens vs account tokens** — project tokens (`RAILWAY_TOKEN`) work for `railway up` and `variables set --service <id>` but NOT for `railway whoami` which needs OAuth. The `--service` flag is required when not in a linked directory.

4. **Base Sepolia is production-equivalent** — Uniswap V3 SwapRouter02 and QuoterV2 are deployed at the same addresses as Base mainnet equivalents. Real swap execution is identical.

5. **Venice AI is simple to integrate** — It's OpenAI-compatible, so any OpenAI client works. The key difference is the model name (`llama-3.3-70b`) and that no data is retained.
