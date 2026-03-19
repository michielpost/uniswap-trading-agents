# Makefile for Uniswap Trading Agents
# Run `make help` to see all available commands.

.PHONY: help setup dev build start stop clean test lint deploy-local deploy-sepolia health

## Show this help message
help:
	@echo ""
	@echo "Uniswap Trading Agents - Available Commands"
	@echo "============================================"
	@grep -E '^## ' Makefile | sed 's/## /  /'
	@echo ""
	@echo "Usage: make <command>"
	@echo ""

## Install all dependencies and copy env examples
setup:
	bash scripts/setup.sh

## Start backend + frontend in development mode (hot reload)
dev:
	bash scripts/start.sh

## Build frontend for production
build:
	cd frontend && npm run build

## Start backend in production mode
start:
	cd backend && npm start

## Run health checks against local backend
health:
	bash scripts/health-check.sh http://localhost:4000

## Run health checks against a custom URL (make health-url URL=https://api.example.com)
health-url:
	bash scripts/health-check.sh $(URL)

## Run linting (backend + frontend)
lint:
	cd backend && npm run lint 2>/dev/null || true
	cd frontend && npm run lint 2>/dev/null || true

## Type-check frontend TypeScript
typecheck:
	cd frontend && npm run type-check

## Deploy contracts to local Hardhat node
deploy-local:
	cd contracts && npx hardhat run scripts/deploy.js --network localhost

## Deploy contracts to Sepolia testnet
deploy-sepolia:
	cd contracts && npx hardhat run scripts/deploy.js --network sepolia

## Deploy contracts to mainnet (caution!)
deploy-mainnet:
	@echo "WARNING: Deploying to mainnet. Press Ctrl+C to cancel, or Enter to continue."
	@read confirm
	cd contracts && npx hardhat run scripts/deploy.js --network mainnet

## Start a local Hardhat blockchain node
hardhat-node:
	cd contracts && npx hardhat node

## Remove node_modules and build artifacts
clean:
	rm -rf node_modules backend/node_modules frontend/node_modules frontend/.next
	@echo "Cleaned all node_modules and build artifacts."

## Show git log (short)
log:
	git log --oneline --graph --decorate -20
