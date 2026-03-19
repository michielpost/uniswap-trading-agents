'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PublicAgent {
  id: string
  name: string
  status: 'stopped' | 'running' | 'error'
  totalTrades: number
  totalPnl: string
  skillHeadings: string[]
  createdAt: string
  metrics: {
    winRate: number
    totalTrades: number
    totalPnl: string
  }
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL?.replace('/api', '') || 'http://localhost:4000'

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-green-500/20 text-green-400 border-green-700',
  stopped: 'bg-gray-500/20 text-gray-400 border-gray-600',
  error:   'bg-red-500/20 text-red-400 border-red-700',
}

export default function PublicAgentPage() {
  const params = useParams()
  const id = params?.id as string
  const [agent, setAgent] = useState<PublicAgent | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    fetch(`${BACKEND_URL}/api/agents/${id}/public`)
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 404 ? 'Agent not found' : 'Failed to load agent')
        return r.json()
      })
      .then(setAgent)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <span className="text-gray-400 text-3xl animate-spin">⟳</span>
      </div>
    )
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">🤖</p>
          <p className="text-white text-xl font-semibold mb-2">{error ?? 'Agent not found'}</p>
          <a href="/" className="text-blue-400 hover:text-blue-300 text-sm">← Back to app</a>
        </div>
      </div>
    )
  }

  const pnl = parseFloat(agent.totalPnl || '0')
  const winRate = agent.metrics.winRate ?? 0

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <span className="text-white font-bold text-lg">⚡ Uniswap Trading Agents</span>
          <a
            href="/"
            className="text-blue-400 hover:text-blue-300 text-sm border border-blue-700 hover:border-blue-500 px-3 py-1 rounded-lg transition-colors"
          >
            Try it free →
          </a>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 max-w-2xl mx-auto px-4 py-12 w-full">
        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6 mb-6">
          {/* Name + status */}
          <div className="flex justify-between items-start mb-6">
            <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
            <span className={`text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${STATUS_COLORS[agent.status] ?? STATUS_COLORS.stopped}`}>
              {agent.status}
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Total Trades</p>
              <p className="text-white font-bold text-xl">{agent.metrics.totalTrades}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Win Rate</p>
              <p className="text-white font-bold text-xl">{Number(winRate).toFixed(1)}%</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Total PnL</p>
              <p className={`font-bold text-xl ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {pnl >= 0 ? '+' : ''}{agent.totalPnl}
              </p>
            </div>
          </div>

          {/* Skill headings */}
          {agent.skillHeadings.length > 0 && (
            <div className="mb-6">
              <p className="text-gray-400 text-sm font-medium mb-3">Strategy Sections</p>
              <div className="flex flex-wrap gap-2">
                {agent.skillHeadings.map((h) => (
                  <span key={h} className="bg-blue-900/40 text-blue-300 border border-blue-800 text-xs px-2.5 py-1 rounded-full">
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          <p className="text-gray-500 text-xs">
            Created {new Date(agent.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-gray-500 text-sm">
            This agent was created with{' '}
            <a href="/" className="text-blue-400 hover:text-blue-300 underline">
              Uniswap Trading Agents
            </a>
            {' '}— build your own AI trading agents powered by Venice AI
          </p>
        </div>
      </footer>
    </div>
  )
}
