'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { getAgent, updateAgentSkills, startAgent, stopAgent, getAgentTrades } from '@/lib/api'
import type { Agent, Trade } from '@/types'
import Navbar from '@/components/Navbar'
import StatusBadge from '@/components/StatusBadge'
import Toast from '@/components/Toast'
import { useWebSocket } from '@/hooks/useWebSocket'

const SKILLS_TEMPLATE = `## Strategy
Trade WETH/USDC on Uniswap V3

## Triggers
- price_above: 2000
- price_below: 1800

## Risk
- maxTradeSizeEth: 0.05
- slippageBps: 50
- stopLossPct: 10
- maxDailyTrades: 5`

const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '1')
const ETHERSCAN_BASE =
  CHAIN_ID === 11155111 ? 'https://sepolia.etherscan.io' : 'https://etherscan.io'

function MetricRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-gray-700/50 last:border-0">
      <span className="text-gray-400 text-sm">{label}</span>
      <span className="text-white font-medium">{value}</span>
    </div>
  )
}

export default function AgentDetailPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [agent, setAgent] = useState<Agent | null>(null)
  const [trades, setTrades] = useState<Trade[]>([])
  const [skills, setSkills] = useState('')
  const [skillsDirty, setSkillsDirty] = useState(false)
  const [loading, setLoading] = useState(true)
  const [savingSkills, setSavingSkills] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/')
      return
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentData, tradesData] = await Promise.all([
        getAgent(id),
        getAgentTrades(id).catch(() => [] as Trade[]),
      ])
      setAgent(agentData)
      setSkills(agentData.skills || SKILLS_TEMPLATE)
      setSkillsDirty(false)
      setTrades(tradesData)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load agent', 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useWebSocket((data: unknown) => {
    const event = data as { type?: string; agentId?: string }
    if (event?.type === 'trade' && event?.agentId === id) {
      getAgentTrades(id)
        .then(setTrades)
        .catch(() => {})
    }
  })

  const handleSaveSkills = async () => {
    if (!agent) return
    setSavingSkills(true)
    try {
      const updated = await updateAgentSkills(agent.id, skills)
      setAgent(updated)
      setSkillsDirty(false)
      showToast('Skills saved successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save skills', 'error')
    } finally {
      setSavingSkills(false)
    }
  }

  const handleToggleStatus = async () => {
    if (!agent) return
    setTogglingStatus(true)
    try {
      if (agent.status === 'running') {
        await stopAgent(agent.id)
        showToast('Agent stopped', 'success')
      } else {
        await startAgent(agent.id)
        showToast('Agent started', 'success')
      }
      await loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to toggle agent status', 'error')
    } finally {
      setTogglingStatus(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-400 flex flex-col items-center gap-3">
            <span className="text-3xl animate-spin">⟳</span>
            <p>Loading agent…</p>
          </div>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gray-900">
        <Navbar />
        <div className="flex flex-col items-center justify-center h-64 gap-4">
          <p className="text-gray-400">Agent not found</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Back */}
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1.5 transition-colors"
        >
          ← Back to Dashboard
        </button>

        {/* Agent Header Card */}
        <div className="bg-gray-800 rounded-2xl p-6 mb-6 border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                <StatusBadge status={agent.status} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                {agent.contractAddress && (
                  <div className="flex gap-1.5">
                    <span className="text-gray-400">Contract:</span>
                    <a
                      href={`${ETHERSCAN_BASE}/address/${agent.contractAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono"
                    >
                      {agent.contractAddress.slice(0, 10)}…{agent.contractAddress.slice(-6)}
                    </a>
                  </div>
                )}
                {agent.vaultAddress && (
                  <div className="flex gap-1.5">
                    <span className="text-gray-400">Vault:</span>
                    <a
                      href={`${ETHERSCAN_BASE}/address/${agent.vaultAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 font-mono"
                    >
                      {agent.vaultAddress.slice(0, 10)}…{agent.vaultAddress.slice(-6)}
                    </a>
                  </div>
                )}
                <div className="flex gap-1.5">
                  <span className="text-gray-400">Created:</span>
                  <span className="text-gray-300">{new Date(agent.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleToggleStatus}
              disabled={togglingStatus}
              className={`shrink-0 py-2.5 px-6 rounded-xl font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                agent.status === 'running'
                  ? 'bg-yellow-700 hover:bg-yellow-600 text-white'
                  : 'bg-green-700 hover:bg-green-600 text-white'
              }`}
            >
              {togglingStatus
                ? '…'
                : agent.status === 'running'
                ? '⏹ Stop Agent'
                : '▶ Start Agent'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Skills Editor */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700 h-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-white font-semibold text-lg">
                  Skills.md
                  {skillsDirty && (
                    <span className="ml-2 text-xs text-yellow-400 font-normal">● unsaved</span>
                  )}
                </h2>
                <button
                  onClick={handleSaveSkills}
                  disabled={savingSkills || !skillsDirty}
                  className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white text-sm py-1.5 px-4 rounded-lg transition-colors font-medium"
                >
                  {savingSkills ? 'Saving…' : 'Save'}
                </button>
              </div>
              <textarea
                value={skills}
                onChange={(e) => {
                  setSkills(e.target.value)
                  setSkillsDirty(true)
                }}
                rows={18}
                spellCheck={false}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors resize-y leading-relaxed"
              />
            </div>
          </div>

          {/* Metrics Panel */}
          <div>
            <div className="bg-gray-800 rounded-2xl p-6 border border-gray-700">
              <h2 className="text-white font-semibold text-lg mb-4">Metrics</h2>
              <div>
                <MetricRow label="Total Trades" value={agent.metrics?.totalTrades ?? 0} />
                <MetricRow label="Successful" value={agent.metrics?.successTrades ?? 0} />
                <MetricRow label="Failed" value={agent.metrics?.failedTrades ?? 0} />
                <MetricRow
                  label="Total PnL %"
                  value={`${Number(agent.metrics?.totalPnlPct ?? 0).toFixed(2)}%`}
                />
                <MetricRow label="Total PnL" value={agent.totalPnl ?? '0'} />
                <MetricRow
                  label="Last Trade"
                  value={
                    agent.metrics?.lastTradeAt
                      ? new Date(agent.metrics.lastTradeAt).toLocaleDateString()
                      : '—'
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Trade History */}
        <div className="mt-6 bg-gray-800 rounded-2xl p-6 border border-gray-700">
          <h2 className="text-white font-semibold text-lg mb-5">Trade History</h2>
          {trades.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">📊</div>
              <p className="text-gray-400">No trades yet</p>
              <p className="text-gray-500 text-sm mt-1">Trades will appear here once the agent starts</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="text-left py-3 pr-4 font-medium">Timestamp</th>
                    <th className="text-left py-3 pr-4 font-medium">Direction</th>
                    <th className="text-left py-3 pr-4 font-medium">Pair</th>
                    <th className="text-left py-3 pr-4 font-medium">Amount</th>
                    <th className="text-left py-3 pr-4 font-medium">Status</th>
                    <th className="text-left py-3 font-medium">Tx Hash</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade) => (
                    <tr
                      key={trade.id}
                      className="border-b border-gray-700/50 text-gray-300 hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="py-3 pr-4 whitespace-nowrap text-gray-400">
                        {new Date(trade.timestamp).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4">
                        <span
                          className={`font-semibold ${
                            trade.direction?.toLowerCase() === 'buy'
                              ? 'text-green-400'
                              : 'text-red-400'
                          }`}
                        >
                          {trade.direction?.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs">
                        {trade.tokenIn} → {trade.tokenOut}
                      </td>
                      <td className="py-3 pr-4">{trade.amount}</td>
                      <td className="py-3 pr-4">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                            trade.status === 'success'
                              ? 'bg-green-900/50 text-green-300 border border-green-700'
                              : trade.status === 'pending'
                              ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-700'
                              : 'bg-red-900/50 text-red-300 border border-red-700'
                          }`}
                        >
                          {trade.status}
                        </span>
                      </td>
                      <td className="py-3">
                        {trade.txHash ? (
                          <a
                            href={`${ETHERSCAN_BASE}/tx/${trade.txHash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 font-mono text-xs transition-colors"
                          >
                            {trade.txHash.slice(0, 8)}…{trade.txHash.slice(-6)}
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
