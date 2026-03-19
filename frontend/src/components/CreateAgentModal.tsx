'use client'

import { useState } from 'react'

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

interface CreateAgentModalProps {
  onClose: () => void
  onCreate: (name: string, skills: string) => Promise<void>
}

export default function CreateAgentModal({ onClose, onCreate }: CreateAgentModalProps) {
  const [name, setName] = useState('')
  const [skills, setSkills] = useState(SKILLS_TEMPLATE)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Agent name is required')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await onCreate(name.trim(), skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create agent')
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-lg border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-bold text-xl">Create New Agent</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-xl leading-none transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
              Agent Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Trading Agent"
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="mb-5">
            <label className="block text-gray-300 text-sm font-medium mb-1.5">
              Skills.md
            </label>
            <textarea
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              rows={11}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors resize-y"
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-lg transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white py-2.5 rounded-lg transition-colors font-medium"
            >
              {loading ? 'Creating…' : 'Create Agent'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
