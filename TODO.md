# Uniswap Trading Agents - TODO & Finalization Checklist

**Created:** 2026-03-19  
**Repository:** https://github.com/michielpost/uniswap-trading-agents  
**Status:** Ready for deployment configuration  

---

## Priority Legend

| Priority | Description | Timeline |
|----------|-------------|----------|
| **P0** | Critical - Required for deployment | Immediate |
| **P1** | High - Required before public submission | Before launch |
| **P2** | Medium - Improvements and polish | Post-launch |

---

## P0 - Critical Deployment Tasks

### 1. Obtain API Tokens

- [ ] **Railway Token**
  - URL: https://railway.app/account/tokens
  - Action: Create token named `nebula-deploy`
  - Store in password manager
  - Add to environment as `RAILWAY_TOKEN`

- [ ] **Vercel Token**
  - URL: https://vercel.com/account/tokens
  - Action: Create token named `nebula-deploy`
  - Store in password manager
  - Add to environment as `VERCEL_TOKEN`

- [ ] **WalletConnect Project ID**
  - URL: https://cloud.walletconnect.com
  - Action: Create project, copy Project ID
  - Add to Vercel environment variables

### 2. Deploy Railway Backend

- [ ] Run deployment script:
  ```bash
  export RAILWAY_TOKEN=<token>
  export VERCEL_TOKEN=<token>
  bash deploy-all.sh
  ```

- [ ] Verify Railway deployment:
  - [ ] Backend service created in Railway dashboard
  - [ ] PostgreSQL plugin attached
  - [ ] Deployment URL obtained (e.g., `https://xxx.up.railway.app`)

- [ ] Configure Railway environment variables:
  - [ ] `JWT_SECRET` - Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
  - [ ] `ETH_RPC_URL` - Use: `https://eth.llamarpc.com` (or Alchemy/Infura)
  - [ ] `WALLET_PRIVATE_KEY` - Agent wallet private key
  - [ ] `NODE_ENV=production`
  - [ ] `PORT=4000`
  - [ ] `DOMAIN` - Railway deployment URL

- [ ] Run database migrations:
  ```bash
  railway run npx prisma migrate deploy
  railway run npx prisma generate
  ```

### 3. Deploy Vercel Frontend

- [ ] Configure Vercel environment variables:
  - [ ] `NEXT_PUBLIC_BACKEND_URL` - Railway URL + `/api`
  - [ ] `NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID` - From WalletConnect
  - [ ] `NEXT_PUBLIC_CHAIN_ID` - `1` (mainnet) or `11155111` (Sepolia)
  - [ ] `NEXT_PUBLIC_RPC_URL` - `https://eth.llamarpc.com`
  - [ ] `NEXT_PUBLIC_APP_NAME` - `Uniswap Trading Agents`

- [ ] Trigger Vercel deployment (automatic on git push or manual)

### 4. Post-Deployment Verification

- [ ] Backend health check:
  ```bash
  curl https://<railway-url>/api/health
  # Expected: {"status":"ok","timestamp":"..."}
  ```

- [ ] Database connection verified:
  ```bash
  railway run npx prisma migrate status
  ```

- [ ] Frontend loads at Vercel URL
- [ ] No CORS errors in browser console
- [ ] Wallet connection works (MetaMask / WalletConnect)
- [ ] SIWE authentication succeeds
- [ ] Dashboard renders without errors

---

## P1 - Pre-Submission Tasks

### 1. Security Hardening

- [ ] **CORS Configuration**
  - Update `backend/src/index.js` CORS origins to specific URLs only
  - Redeploy backend after changes

- [ ] **Rate Limiting Review**
  - Auth endpoints: stricter limits
  - Public endpoints: moderate limits
  - WebSocket: connection limits per IP

- [ ] **JWT Security**
  - Confirm JWT_SECRET is 32+ characters
  - Set appropriate session expiry (recommended: 7d)
  - Test token expiration and refresh

- [ ] **Sensitive Data Audit**
  - [ ] No `.env` files committed to git
  - [ ] No private keys in source code
  - [ ] API keys stored in Railway/Vercel environment only

### 2. Testing Checklist

- [ ] **Unit Tests**
  - [ ] Backend tests pass
  - [ ] Frontend tests pass

- [ ] **Integration Tests**
  - [ ] Agent creation flow
  - [ ] Backtest execution
  - [ ] Trade history retrieval
  - [ ] WebSocket real-time updates

- [ ] **End-to-End Tests**
  - [ ] Connect wallet (MetaMask)
  - [ ] Sign SIWE message
  - [ ] Navigate to dashboard
  - [ ] Create new agent
  - [ ] Configure agent skills
  - [ ] Run backtest
  - [ ] View trade history
  - [ ] Check performance charts

- [ ] **Browser Compatibility**
  - [ ] Chrome (latest)
  - [ ] Firefox (latest)
  - [ ] Safari (latest)
  - [ ] Mobile browsers (iOS/Android)

### 3. Documentation Review

- [ ] **README.md** - Update with deployment URLs and screenshots
- [ ] **API_REFERENCE.md** - Verify endpoints and examples
- [ ] **DEPLOYMENT_GUIDE.md** - Add troubleshooting section
- [ ] **CONTRIBUTING.md** - Review guidelines
- [ ] **Create CHANGELOG.md** - Document version history

### 4. Repository Cleanup

- [ ] **Git History** - Verify clean, tag v1.0.0
- [ ] **Branch Protection** - Enable on GitHub
- [ ] **Issue Templates** - Create bug_report.md and feature_request.md
- [ ] **Pull Request Template** - Create pull_request_template.md

### 5. Monitoring Setup

- [ ] **Backend Monitoring** - Railway notifications, uptime monitoring
- [ ] **Frontend Monitoring** - Vercel Analytics, Web Vitals
- [ ] **Database Monitoring** - PostgreSQL metrics, backups

---

## P2 - Post-Launch Improvements

### 1. Performance Optimization

- [ ] **Backend** - Compression, Redis caching, query optimization
- [ ] **Frontend** - React Query, code splitting, image optimization
- [ ] **Smart Contracts** - Gas audit, Layer 2 deployment

### 2. Feature Enhancements

- [ ] **Agent Features** - Templates, copy-trading, leaderboards
- [ ] **Dashboard** - Mobile improvements, dark mode, widgets
- [ ] **Notifications** - Email alerts, Discord/Telegram bots

### 3. Documentation Enhancements

- [ ] Video tutorials
- [ ] Postman collection
- [ ] Architecture diagrams

### 4. Production Readiness

- [ ] Scalability planning
- [ ] Disaster recovery procedures
- [ ] Compliance documentation

### 5. Community Building

- [ ] Social media presence
- [ ] Product Hunt launch
- [ ] Blog content

---

## Quick Reference Commands

### Deployment
```bash
# Full deployment
bash deploy-all.sh

# Backend only
bash deploy-all.sh --backend-only

# Frontend only
bash deploy-all.sh --frontend-only

# Dry run (preview)
bash deploy-all.sh --dry-run
```

### Environment Verification
```bash
# Check Railway auth
export RAILWAY_TOKEN=<token>
railway whoami

# Check Vercel auth
export VERCEL_TOKEN=<token>
curl -H "Authorization: Bearer $VERCEL_TOKEN" https://api.vercel.com/v2/user
```

### Database Operations
```bash
# Apply migrations
railway run npx prisma migrate deploy

# Check migration status
railway run npx prisma migrate status

# Open Prisma Studio
npx prisma studio

# Generate Prisma client
npx prisma generate
```

### Health Checks
```bash
# Backend health
curl https://<railway-url>/api/health

# Frontend load
curl https://<vercel-url>

# WebSocket test
npx wscat -c wss://<railway-url>/ws
```

---

## Submission Checklist

Before final submission, verify:

- [ ] All P0 tasks completed
- [ ] Deployment URLs obtained and documented
- [ ] Environment variables properly secured
- [ ] All tests passing
- [ ] Documentation reviewed and updated
- [ ] Git repository clean (no uncommitted sensitive files)
- [ ] Git tag created for v1.0.0
- [ ] Repository README includes live demo links
- [ ] Contact information available for support

---

## Contact & Support

**Issues:** https://github.com/michielpost/uniswap-trading-agents/issues  
**Documentation:** See /docs folder and DEPLOYMENT_GUIDE.md  

---

*Last updated: 2026-03-19*