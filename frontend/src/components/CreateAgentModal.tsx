'use client'

import { useState } from 'react'
import { generateSkills } from '@/lib/api'

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

const EXAMPLE_PROMPTS = [
  'Buy ETH when it drops below $2800 and sell when it recovers above $3200',
  'DCA into ETH every hour with small amounts',
  'Aggressive momentum — buy breakouts above $3500, stop-loss at 5%',
]

interface CreateAgentModalProps {
  onClose: () => void
  onCreate: (name: string, skills: string) => Promise<void>
}

export default function CreateAgentModal({ onClose, onCreate }: CreateAgentModalProps) {
  const [tab, setTab] = useState<'ai' | 'manual'>('ai')
  const [name, setName] = useState('')
  const [skills, setSkills] = useState(SKILLS_TEMPLATE)

  // AI tab state
  const [description, setDescription] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generated, setGenerated] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    if (!description.trim()) return
    setGenerating(true)
    setGenError(null)
    setGenerated(false)
    try {
      const result = await generateSkills(description.trim())
      setSkills(result)
      setGenerated(true)
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) { setError('Agent name is required'); return }
    if (tab === 'ai' && !generated) { setError('Generate a strategy first, or switch to Manual to edit directly'); return }
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
      <div className="bg-gray-800 rounded-2xl w-full max-w-xl border border-gray-700 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 pt-5 pb-4">
          <h2 className="text-white font-bold text-xl">Create New Agent</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl leading-none transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 px-6">
          <button
            onClick={() => setTab('ai')}
            className={`pb-2.5 mr-6 text-sm font-medium border-b-2 transition-colors ${
              tab === 'ai' ? 'border-purple-500 text-purple-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ✨ Describe with AI
          </button>
          <button
            onClick={() => setTab('manual')}
            className={`pb-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === 'manual' ? 'border-blue-500 text-blue-300' : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            ✏️ Manual
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Agent Name */}
          <div>
            <label className="block text-gray-300 text-sm font-medium mb-1.5">Agent Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Trading Agent"
              autoFocus
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {/* AI Tab */}
          {tab === 'ai' && (
            <div className="space-y-3">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-1.5">
                  Describe your strategy in plain English
                </label>
                <textarea
                  value={description}
                  onChange={(e) => { setDescription(e.target.value); setGenerated(false) }}
                  rows={3}
                  placeholder="e.g. Buy ETH when it dips below $2800 and sell when it recovers above $3200"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors resize-none text-sm"
                />
                {/* Example prompts */}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {EXAMPLE_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => { setDescription(p); setGenerated(false) }}
                      className="text-xs text-purple-400 hover:text-purple-200 bg-purple-900/30 hover:bg-purple-900/50 border border-purple-800 rounded-full px-2.5 py-0.5 transition-colors"
                    >
                      {p.length > 45 ? p.slice(0, 45) + '…' : p}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerate}
                disabled={!description.trim() || generating}
                className="w-full bg-purple-700 hover:bg-purple-600 disabled:bg-purple-900 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {generating ? (
                  <><span className="animate-spin inline-block">⟳</span> Venice AI is generating…</>
                ) : generated ? (
                  <>✨ Regenerate</>
                ) : (
                  <>✨ Generate with Venice AI</>
                )}
              </button>

              {genError && (
                <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
                  {genError}
                </div>
              )}

              {/* Generated result */}
              {(generated || tab === 'ai') && skills !== SKILLS_TEMPLATE && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-gray-300 text-sm font-medium">
                      {generated ? '✅ Generated skills.md — review & edit' : 'Skills.md preview'}
                    </label>
                    <button
                      type="button"
                      onClick={() => setTab('manual')}
                      className="text-xs text-blue-400 hover:text-blue-200 transition-colors"
                    >
                      Switch to manual editor →
                    </button>
                  </div>
                  <textarea
                    value={skills}
                    onChange={(e) => setSkills(e.target.value)}
                    rows={10}
                    className="w-full bg-gray-900 border border-purple-700/50 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-purple-500 transition-colors resize-y"
                  />
                </div>
              )}
            </div>
          )}

          {/* Manual Tab */}
          {tab === 'manual' && (
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-1.5">Skills.md</label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                rows={11}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors resize-y"
              />
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-900/50 border border-red-600 rounded-lg text-red-200 text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-1">
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
