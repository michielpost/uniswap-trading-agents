'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isAuthenticated } from '@/lib/auth'
import { getSettings, updateSettings } from '@/lib/api'
import Navbar from '@/components/Navbar'
import Toast from '@/components/Toast'

export default function SettingsPage() {
  const router = useRouter()
  const [veniceApiKey, setVeniceApiKey] = useState('')
  const [hasKey, setHasKey] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push('/')
      return
    }
    getSettings()
      .then((data) => setHasKey(data.hasVeniceApiKey))
      .catch(() => setHasKey(false))
      .finally(() => setLoading(false))
  }, [router])

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!veniceApiKey.trim()) return
    setSaving(true)
    try {
      const result = await updateSettings({ veniceApiKey: veniceApiKey.trim() })
      setHasKey(result.hasVeniceApiKey)
      setVeniceApiKey('')
      showToast('Venice API key saved successfully', 'success')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-900">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white text-sm mb-6 flex items-center gap-1 transition-colors"
        >
          ← Back to Dashboard
        </button>

        <h1 className="text-2xl font-bold text-white mb-8">Settings</h1>

        <div className="bg-gray-800 rounded-xl border border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-1">Venice AI</h2>
          <p className="text-gray-400 text-sm mb-6">
            Venice AI powers your agents&apos; trading decisions. Get your API key at{' '}
            <a
              href="https://venice.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              venice.ai
            </a>
            .
          </p>

          {!loading && hasKey && (
            <div className="mb-4 flex items-center gap-2 text-green-400 text-sm bg-green-900/30 border border-green-700 rounded-lg px-4 py-2">
              <span>✓</span>
              <span>Venice API key configured</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-gray-300 text-sm font-medium mb-2">
                {hasKey ? 'Replace Venice API Key' : 'Venice API Key'}
              </label>
              <input
                type="password"
                value={veniceApiKey}
                onChange={(e) => setVeniceApiKey(e.target.value)}
                placeholder={hasKey ? 'Enter new key to replace current…' : 'sk-...'}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={saving || !veniceApiKey.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              {saving ? 'Saving…' : 'Save Key'}
            </button>
          </form>
        </div>
      </main>

      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  )
}
