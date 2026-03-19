'use client'

import { useRouter } from 'next/navigation'
import { useDisconnect } from 'wagmi'
import { getAddress, clearAuth } from '@/lib/auth'

export default function Navbar() {
  const router = useRouter()
  const { disconnect } = useDisconnect()
  const address = getAddress()

  const handleLogout = () => {
    clearAuth()
    disconnect()
    router.push('/')
  }

  return (
    <nav className="bg-gray-800 border-b border-gray-700 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-white font-bold text-lg hover:text-blue-400 transition-colors"
        >
          ⚡ Uniswap Trading Agents
        </button>
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard/settings')}
            className="text-gray-400 hover:text-white text-sm transition-colors"
          >
            ⚙ Settings
          </button>
          {address && (
            <span className="text-gray-400 text-sm font-mono bg-gray-700 px-3 py-1 rounded-lg">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
          )}
          <button
            onClick={handleLogout}
            className="text-gray-400 hover:text-white text-sm transition-colors border border-gray-600 hover:border-gray-400 px-3 py-1 rounded-lg"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  )
}
