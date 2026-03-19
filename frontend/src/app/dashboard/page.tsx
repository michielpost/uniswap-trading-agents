'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import {
  listAgents,
  createAgent,
  startAgent,
  stopAgent,
  deleteAgent,
  getPortfolioMetrics,
  getSettings,
} from '@/lib/api'
import type { Agent, PortfolioMetrics } from '@/types'
import Navbar from '@/components/Navbar'
import AgentCard from '@/components/AgentCard'
import CreateAgentModal from '@/components/CreateAgentModal'
import Toast from '@/components/Toast'
import { useWebSocket } from '@/hooks/useWebSocket'

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <p className="text-gray-400 text-sm font-medium">{label}</p>
      <p className="text-white text-3xl font-bold mt-1">{value ?? '—'}</p>
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error'; action?: { label: string; onClick: () => void } } | null>(null)
  const [hasVeniceKey, setHasVeniceKey] = useState<boolean | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/')
      return
    }
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [agentsData, metricsData, settingsData] = await Promise.all([
        listAgents(),
        getPortfolioMetrics().catch(() => null),
        getSettings().catch(() => null),
      ])
      setAgents(agentsData)
      if (metricsData) setMetrics(metricsData)
      if (settingsData) setHasVeniceKey(settingsData.hasVeniceApiKey)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  // Refresh on live WebSocket events
  useWebSocket((data: unknown) => {
    const event = data as { type?: string }
    if (event?.type === 'trade' || event?.type === 'agent_update') {
      loadData()
    }
  })

  const handleCreateAgent = async (name: string, skills: string) => {
    await createAgent(name, skills)
    setShowCreateModal(false)
    showToast('Agent created successfully', 'success')
    loadData()
  }

  const handleStart = async (id: string) => {
    setActionLoading(id)
    try {
      await startAgent(id)
      showToast('Agent started — querying Venice AI now…', 'success')
      loadData()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to start agent'
      if (msg.toLowerCase().includes('venice')) {
        setToast({
          message: 'Venice API key required to start agents.',
          type: 'error',
          action: { label: 'Go to Settings →', onClick: () => router.push('/dashboard/settings') },
        })
        setTimeout(() => setToast(null), 6000)
      } else {
        showToast(msg, 'error')
      }
    } finally {
      setActionLoading(null)
    }
  }

  const handleStop = async (id: string) => {
    setActionLoading(id)
    try {
      await stopAgent(id)
      showToast('Agent stopped', 'success')
      loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to stop agent', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agent? This cannot be undone.')) return
    setActionLoading(id)
    try {
      await deleteAgent(id)
      showToast('Agent deleted', 'success')
      loadData()
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete agent', 'error')
    } finally {
      setActionLoading(null)
    }
  }

  const activeAgents = agents.filter((a) => a.status === 'running').length
  const totalTrades = agents.reduce((sum, a) => sum + (a.totalTrades || 0), 0)
  const computedMetrics = metrics ?? {
    totalAgents: agents.length,
    activeAgents,
    totalTrades,
    winRate: 0,
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Venice API key warning */}
        {hasVeniceKey === false && (
          <div className="mb-6 p-4 bg-yellow-900/40 border border-yellow-600 rounded-xl flex items-center justify-between">
            <div>
              <p className="text-yellow-300 font-semibold">⚠️ Venice API key not configured</p>
              <p className="text-yellow-400 text-sm mt-1">Agents cannot run without a Venice API key. Add yours in Settings.</p>
            </div>
            <button onClick={() => router.push('/dashboard/settings')} className="bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 px-4 rounded-lg text-sm">
              Go to Settings
            </button>
          </div>
        )}

        {/* Portfolio Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard label="Total Agents" value={computedMetrics.totalAgents} />
          <StatCard label="Active Agents" value={computedMetrics.activeAgents} />
          <StatCard label="Total Trades" value={computedMetrics.totalTrades} />
          <StatCard
            label="Win Rate"
            value={
              computedMetrics.winRate != null
                ? `${Number(computedMetrics.winRate).toFixed(1)}%`
                : '—'
            }
          />
        </div>

        {/* Header row */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">My Agents</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-5 rounded-xl transition-colors shadow-lg"
          >
            + Create Agent
          </button>
        </div>

        {/* Agents Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400 flex flex-col items-center gap-3">
              <span className="text-3xl animate-spin">⟳</span>
              <p>Loading agents…</p>
            </div>
          </div>
        ) : agents.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🤖</div>
            <p className="text-gray-400 text-lg mb-2">No agents yet</p>
            <p className="text-gray-500 text-sm">
              Create your first trading agent to get started
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agents.map((agent) => (
              <div
                key={agent.id}
                className={actionLoading === agent.id ? 'opacity-60 pointer-events-none' : ''}
              >
                <AgentCard
                  agent={agent}
                  onStart={handleStart}
                  onStop={handleStop}
                  onDelete={handleDelete}
                  onEditSkills={(id) => router.push(`/dashboard/agents/${id}`)}
                  onShare={(id) => {
                    navigator.clipboard.writeText(`${window.location.origin}/agent/${id}`)
                    showToast('Shareable link copied!', 'success')
                  }}
                />
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreateModal && (
        <CreateAgentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateAgent}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} action={toast.action} />}
    </div>
  )
}
