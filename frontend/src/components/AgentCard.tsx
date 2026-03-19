'use client'

import { useRouter } from 'next/navigation'
import type { Agent } from '@/types'
import StatusBadge from './StatusBadge'

interface AgentCardProps {
  agent: Agent
  onStart: (id: string) => void
  onStop: (id: string) => void
  onDelete: (id: string) => void
  onEditSkills: (id: string) => void
}

export default function AgentCard({ agent, onStart, onStop, onDelete, onEditSkills }: AgentCardProps) {
  const router = useRouter()
  const pnl = parseFloat(agent.totalPnl || '0')

  return (
    <div
      className="bg-gray-800 rounded-xl p-5 border border-gray-700 hover:border-gray-500 transition-colors cursor-pointer group"
      onClick={() => router.push(`/dashboard/agents/${agent.id}`)}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-white font-semibold text-lg group-hover:text-blue-300 transition-colors truncate pr-2">
          {agent.name}
        </h3>
        <StatusBadge status={agent.status} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <div className="bg-gray-700/50 rounded-lg p-2.5">
          <p className="text-gray-400 text-xs mb-0.5">Total Trades</p>
          <p className="text-white font-semibold">{agent.totalTrades}</p>
        </div>
        <div className="bg-gray-700/50 rounded-lg p-2.5">
          <p className="text-gray-400 text-xs mb-0.5">Total PnL</p>
          <p className={`font-semibold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pnl >= 0 ? '+' : ''}{agent.totalPnl ?? '0'}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
        {agent.status === 'running' ? (
          <button
            onClick={() => onStop(agent.id)}
            className="flex-1 bg-yellow-700 hover:bg-yellow-600 text-white text-sm py-1.5 px-3 rounded-lg transition-colors font-medium"
          >
            ⏹ Stop
          </button>
        ) : (
          <button
            onClick={() => onStart(agent.id)}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white text-sm py-1.5 px-3 rounded-lg transition-colors font-medium"
          >
            ▶ Start
          </button>
        )}
        <button
          onClick={() => onEditSkills(agent.id)}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 px-3 rounded-lg transition-colors"
        >
          ✏ Skills
        </button>
        <button
          onClick={() => onDelete(agent.id)}
          className="bg-red-900/60 hover:bg-red-800 text-red-300 hover:text-red-200 text-sm py-1.5 px-3 rounded-lg transition-colors"
          title="Delete agent"
        >
          🗑
        </button>
      </div>
    </div>
  )
}
