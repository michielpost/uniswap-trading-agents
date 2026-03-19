# Contributing to Uniswap Trading Agents

Thank you for your interest in contributing! This document covers how to set up
a development environment, project conventions, and the pull request process.

---

## Development Setup

1. Fork and clone the repository
2. Run setup: `make setup` (or `bash scripts/setup.sh`)
3. Edit `backend/.env` with your RPC URL and a test private key
4. Start a local Hardhat node: `make hardhat-node`
5. Deploy contracts locally: `make deploy-local`
6. Start dev servers: `make dev`

---

## Project Structure

    uniswap-trading-agents/
    |-- contracts/          Solidity smart contracts (Hardhat)
    |-- backend/            Node.js API server
    |   |-- src/
    |   |   |-- controllers/    Route handlers
    |   |   |-- middleware/     Auth, error handling
    |   |   |-- routes/         Express route definitions
    |   |   |-- services/       agentEngine, uniswapService, web3Service
    |-- frontend/           Next.js 14 dashboard
    |   |-- src/
    |   |   |-- app/            Next.js App Router pages
    |   |   |-- components/     React components
    |   |   |-- hooks/          Custom React hooks
    |   |   |-- lib/            Types, API client, wagmi config
    |-- docs/               Documentation and skills templates
    |-- scripts/            Setup, start, deploy, health-check scripts

---

## Code Conventions

### General
- Use 2-space indentation throughout
- Prefer `const` over `let`; avoid `var`
- All async functions must handle errors (try/catch or `.catch()`)
- No `console.log` in production paths -- use structured logging

### Backend (JavaScript)
- CommonJS modules (`require` / `module.exports`)
- JSDoc comments on all exported functions
- Error responses: `{ error: { message: string, code?: string } }`
- Auth endpoints require JWT in `Authorization: Bearer <token>` header

### Frontend (TypeScript)
- Strict TypeScript (`strict: true` in tsconfig)
- React Server Components where possible; `"use client"` only when needed
- TanStack Query for all server state; no raw `useEffect` for data fetching
- Tailwind CSS for styling; no inline styles
- Component files: PascalCase (e.g. `AgentCard.tsx`)
- Hook files: camelCase prefixed with `use` (e.g. `useAgent.ts`)

### Smart Contracts (Solidity)
- Solidity `^0.8.20`
- NatSpec comments on all public/external functions
- Reentrancy guards on all state-modifying vault functions
- Events emitted for every state change
- No floating pragma

---

## skills.md Format

Agent strategies are defined in `skills.md` markdown files. See
`docs/skills-format.md` for the complete specification and
`docs/skills-templates/` for ready-to-use examples.

Key rules:
- `tokenIn` and `tokenOut` must be valid checksummed Ethereum addresses
- `fee` must be 500, 3000, or 10000
- `check_interval` minimum is 5 seconds
- `max_daily_trades` maximum is 100

---

## Pull Request Process

1. Branch from `main`: `git checkout -b feat/your-feature`
2. Make focused, atomic commits (one logical change per commit)
3. Run linting: `make lint`
4. Run type-check: `make typecheck`
5. Update docs if you change the skills.md format or API
6. Open a PR with a clear description of what changed and why
7. PRs require at least one review before merging

### Commit Message Format

    type(scope): short description

    Types: feat | fix | docs | refactor | test | chore
    Scope: contracts | backend | frontend | scripts | docs

    Examples:
      feat(backend): add volume_spike trigger evaluator
      fix(frontend): correct slippage BPS display in TradeTable
      docs(skills): add momentum trading template

---

## Security

- Never commit private keys, mnemonics, or API secrets
- The `.gitignore` blocks `.env` files -- double-check before committing
- Report security vulnerabilities privately via email, not as public issues
- All vault functions must be audited before mainnet deployment

---

## License

By contributing, you agree your contributions will be licensed under the MIT
License that covers this project.
