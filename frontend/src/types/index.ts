export interface AgentMetrics {
  totalTrades: number
  successTrades: number
  failedTrades: number
  totalPnlPct: string
  lastTradeAt: string | null
}

export interface Agent {
  id: string
  name: string
  owner: string
  skills: string
  status: 'stopped' | 'running' | 'error'
  contractAddress: string | null
  vaultAddress: string | null
  totalTrades: number
  totalPnl: string
  createdAt: string
  updatedAt: string
  metrics: AgentMetrics
}

export interface Trade {
  id: string
  agentId: string
  timestamp: string
  direction: string
  tokenIn: string
  tokenOut: string
  amount: string
  status: string
  txHash: string | null
  pnl?: string
}

export interface PortfolioMetrics {
  totalAgents: number
  activeAgents: number
  totalTrades: number
  winRate: number
}
