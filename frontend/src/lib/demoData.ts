import type { Agent, Trade, PortfolioMetrics, AgentMetrics } from '@/types'

const now = Date.now()
const h = (n: number) => now - n * 3_600_000

const demoMetrics: Record<string, AgentMetrics> = {
  'demo-1': { totalTrades: 47, successTrades: 31, failedTrades: 16, totalPnlPct: '12.40', lastTradeAt: new Date(h(1)).toISOString() },
  'demo-2': { totalTrades: 23, successTrades: 18, failedTrades: 5,  totalPnlPct: '8.75',  lastTradeAt: new Date(h(3)).toISOString() },
  'demo-3': { totalTrades: 8,  successTrades: 4,  failedTrades: 4,  totalPnlPct: '-2.10', lastTradeAt: new Date(h(8)).toISOString() },
  'demo-4': { totalTrades: 0,  successTrades: 0,  failedTrades: 0,  totalPnlPct: '0',     lastTradeAt: null },
}

export const DEMO_AGENTS: Agent[] = [
  {
    id: 'demo-1',
    name: 'ETH Momentum Bot',
    owner: '0xdemo',
    skills: `## Strategy
Trade WETH/USDC on Base Sepolia

## Triggers
- price_above: 3500
- price_below: 3000

## Risk
- maxTradeSizeEth: 0.001
- slippageBps: 100
- maxDailyTrades: 5`,
    status: 'running',
    contractAddress: null,
    vaultAddress: null,
    totalTrades: 47,
    totalPnl: '+0.0124',
    createdAt: new Date(h(72)).toISOString(),
    updatedAt: new Date(h(1)).toISOString(),
    metrics: demoMetrics['demo-1'],
  },
  {
    id: 'demo-2',
    name: 'DCA Accumulator',
    owner: '0xdemo',
    skills: `## Strategy
Dollar-cost average into WETH

## Triggers
- interval_minutes: 60

## Risk
- maxTradeSizeEth: 0.001
- slippageBps: 50
- maxDailyTrades: 3`,
    status: 'running',
    contractAddress: null,
    vaultAddress: null,
    totalTrades: 23,
    totalPnl: '+0.0088',
    createdAt: new Date(h(48)).toISOString(),
    updatedAt: new Date(h(3)).toISOString(),
    metrics: demoMetrics['demo-2'],
  },
  {
    id: 'demo-3',
    name: 'Mean Reversion',
    owner: '0xdemo',
    skills: `## Strategy
Buy dips, sell rips

## Triggers
- price_below: 2800
- price_above: 3800

## Risk
- maxTradeSizeEth: 0.002
- slippageBps: 150
- maxDailyTrades: 4`,
    status: 'stopped',
    contractAddress: null,
    vaultAddress: null,
    totalTrades: 8,
    totalPnl: '-0.0021',
    createdAt: new Date(h(120)).toISOString(),
    updatedAt: new Date(h(8)).toISOString(),
    metrics: demoMetrics['demo-3'],
  },
  {
    id: 'demo-4',
    name: 'Venice Scalper',
    owner: '0xdemo',
    skills: `## Strategy
Let Venice AI decide every tick

## Triggers
- interval_minutes: 5

## Risk
- maxTradeSizeEth: 0.001
- slippageBps: 100
- maxDailyTrades: 10`,
    status: 'stopped',
    contractAddress: null,
    vaultAddress: null,
    totalTrades: 0,
    totalPnl: '0',
    createdAt: new Date(h(2)).toISOString(),
    updatedAt: new Date(h(2)).toISOString(),
    metrics: demoMetrics['demo-4'],
  },
]

export const DEMO_METRICS: PortfolioMetrics = {
  totalAgents: 4,
  activeAgents: 2,
  totalTrades: 78,
  winRate: 67.9,
}

export const DEMO_TRADES: Record<string, Trade[]> = {
  'demo-1': [
    { id: 'dt-1', agentId: 'demo-1', timestamp: new Date(h(1)).toISOString(),  direction: 'buy',  tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x3a7f2c8e1b4d9a0f6c3e5d7b2a4f8e1c3b5d7a9f2c4e6b8d0a2c4e6b8d0a2c4' },
    { id: 'dt-2', agentId: 'demo-1', timestamp: new Date(h(3)).toISOString(),  direction: 'sell', tokenIn: 'USDC', tokenOut: 'WETH', amount: '0.001', status: 'success', txHash: '0x7b2a4f8e1c3b5d7a9f2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6' },
    { id: 'dt-3', agentId: 'demo-1', timestamp: new Date(h(5)).toISOString(),  direction: 'buy',  tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x9f2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2' },
    { id: 'dt-4', agentId: 'demo-1', timestamp: new Date(h(8)).toISOString(),  direction: 'buy',  tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'failed',  txHash: null },
    { id: 'dt-5', agentId: 'demo-1', timestamp: new Date(h(12)).toISOString(), direction: 'sell', tokenIn: 'USDC', tokenOut: 'WETH', amount: '0.001', status: 'success', txHash: '0x1c3b5d7a9f2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4' },
    { id: 'dt-6', agentId: 'demo-1', timestamp: new Date(h(24)).toISOString(), direction: 'buy',  tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x5d7a9f2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8' },
  ],
  'demo-2': [
    { id: 'dt-7',  agentId: 'demo-2', timestamp: new Date(h(3)).toISOString(),  direction: 'buy', tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6' },
    { id: 'dt-8',  agentId: 'demo-2', timestamp: new Date(h(4)).toISOString(),  direction: 'buy', tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0' },
    { id: 'dt-9',  agentId: 'demo-2', timestamp: new Date(h(5)).toISOString(),  direction: 'buy', tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'success', txHash: '0x2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4' },
    { id: 'dt-10', agentId: 'demo-2', timestamp: new Date(h(6)).toISOString(),  direction: 'buy', tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.001', status: 'failed',  txHash: null },
  ],
  'demo-3': [
    { id: 'dt-11', agentId: 'demo-3', timestamp: new Date(h(8)).toISOString(),  direction: 'sell', tokenIn: 'USDC', tokenOut: 'WETH', amount: '0.002', status: 'success', txHash: '0x6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8d0a2c4e6b8' },
    { id: 'dt-12', agentId: 'demo-3', timestamp: new Date(h(16)).toISOString(), direction: 'buy',  tokenIn: 'WETH', tokenOut: 'USDC', amount: '0.002', status: 'failed',  txHash: null },
  ],
  'demo-4': [],
}

export const DEMO_ACTIVITY_LOGS: Record<string, Array<{
  id: number; agent_id: string; ts: number; type: string; summary: string; details: string | null
}>> = {
  'demo-1': [
    { id: 1, agent_id: 'demo-1', ts: h(1),        type: 'trade_success', summary: 'Trade successful: 0x3a7f2c…',      details: JSON.stringify({ txHash: '0x3a7f2c8e1b4d9a0f6c3e5d7b2a4f8e1c3b5d7a9f2c4e6b8d0a2c4e6b8d0a2c4', amountOut: '3421000000', direction: 'buy' }) },
    { id: 2, agent_id: 'demo-1', ts: h(1) + 2000, type: 'trade_start',   summary: 'BUY trade starting: 0.001 ETH',   details: JSON.stringify({ direction: 'buy', amountIn: '0.001' }) },
    { id: 3, agent_id: 'demo-1', ts: h(1) + 1000, type: 'venice_res',    summary: 'Venice AI decision: BUY',         details: JSON.stringify({ decision: 'BUY', raw: 'BUY', price: 3421.50 }) },
    { id: 4, agent_id: 'demo-1', ts: h(1) + 500,  type: 'venice_req',    summary: 'Venice AI request (ETH: $3421.50)', details: JSON.stringify({ model: 'llama-3.3-70b', prompt: 'Current ETH price: $3421.50\n\nAgent skills:\n## Strategy\nTrade WETH/USDC on Base Sepolia\n\n## Triggers\n- price_above: 3500\n- price_below: 3000\n\nBased on this, should the agent BUY, SELL, or HOLD right now?' }) },
    { id: 5, agent_id: 'demo-1', ts: h(1) + 100,  type: 'price',         summary: 'ETH price: $3421.50',             details: JSON.stringify({ price: 3421.50 }) },
  ],
  'demo-2': [
    { id: 6, agent_id: 'demo-2', ts: h(3),        type: 'trade_success', summary: 'Trade successful: 0x4e6b8d…',    details: JSON.stringify({ txHash: '0x4e6b8d0a2c4e6b8d', amountOut: '3398000000', direction: 'buy' }) },
    { id: 7, agent_id: 'demo-2', ts: h(3) + 100,  type: 'price',         summary: 'ETH price: $3398.10',            details: JSON.stringify({ price: 3398.10 }) },
  ],
  'demo-3': [],
  'demo-4': [],
}

export function isDemoMode(): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem('demo_mode') === '1'
}

export function enterDemoMode(): void {
  sessionStorage.setItem('demo_mode', '1')
}

export function exitDemoMode(): void {
  sessionStorage.removeItem('demo_mode')
}
