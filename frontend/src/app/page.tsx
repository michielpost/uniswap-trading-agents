'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { getNonce, login } from '@/lib/api'
import { saveAuth, isAuthenticated } from '@/lib/auth'

export default function Home() {
  const router = useRouter()
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect()
  const { signMessageAsync } = useSignMessage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyAuthed, setAlreadyAuthed] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) {
      setAlreadyAuthed(true)
      router.push('/dashboard')
    }
  }, [router])

  const handleConnect = () => {
    const injected = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (!injected) {
      setError('No wallet detected. Please install MetaMask and reload the page.')
      return
    }
    connect({ connector: injected })
  }

  // Surface wagmi connection errors
  useEffect(() => {
    if (connectError) setError(connectError.message)
  }, [connectError])

  const signIn = async (addr: string, chain: number) => {
    setLoading(true)
    setError(null)
    try {
      const { nonce } = await getNonce(addr)
      const message = new SiweMessage({
        domain: window.location.host,
        address: addr,
        statement: 'Sign in with Ethereum to Uniswap Trading Agents',
        uri: window.location.origin,
        version: '1',
        chainId: chain,
        nonce,
      }).prepareMessage()
      const signature = await signMessageAsync({ message })
      const { token, address: loggedAddress } = await login(message, signature)
      saveAuth(token, loggedAddress)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Auto-trigger sign-in once wallet connects
  useEffect(() => {
    if (isConnected && address && !isAuthenticated() && !loading) {
      signIn(address, chainId ?? 1)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  if (alreadyAuthed) {
    return (
      <main className="min-h-screen bg-gray-900 flex items-center justify-center">
        <p className="text-gray-400">Redirecting…</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-900 flex flex-col items-center justify-center px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-900/20 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-2xl">
        <div className="text-6xl mb-6">⚡</div>
        <h1 className="text-5xl md:text-6xl font-bold text-white mb-4 tracking-tight">
          Uniswap Trading Agents
        </h1>
        <p className="text-xl text-gray-400 mb-3">
          AI-powered trading bots with skills-based strategies
        </p>
        <p className="text-gray-500 mb-10 text-sm">
          Deploy autonomous agents that trade on Uniswap V3 using customizable markdown-based skill sets.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-900/40 border border-red-600 rounded-xl text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {isAuthenticated() ? (
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-lg"
            >
              Go to Dashboard →
            </button>
          ) : (
            <>
              <button
                onClick={isConnected ? () => signIn(address!, chainId ?? 1) : handleConnect}
                disabled={loading || isConnecting}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-8 rounded-xl transition-colors shadow-lg flex items-center gap-2 justify-center"
              >
                {loading ? (
                  <><span className="animate-spin inline-block">⟳</span> Signing in…</>
                ) : isConnecting ? (
                  <><span className="animate-spin inline-block">⟳</span> Connecting…</>
                ) : isConnected ? (
                  'Sign In with Ethereum'
                ) : (
                  'Connect Wallet'
                )}
              </button>
              {!isConnected && typeof window !== 'undefined' && !(window as typeof window & { ethereum?: unknown }).ethereum && (
                <p className="mt-3 text-gray-500 text-xs text-center w-full">
                  No wallet detected.{' '}
                  <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    Install MetaMask
                  </a>
                </p>
              )}
            </>
          )}
        </div>

        {isConnected && address && !loading && (
          <p className="mt-4 text-gray-500 text-sm font-mono">
            Connected: {address.slice(0, 6)}…{address.slice(-4)}
          </p>
        )}
      </div>
    </main>
  )
}

