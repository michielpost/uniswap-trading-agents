'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount, useConnect, useSignMessage } from 'wagmi'
import { getNonce, login } from '@/lib/api'
import { saveAuth, isAuthenticated } from '@/lib/auth'
import { enterDemoMode } from '@/lib/demoData'

function buildSiweMessage(domain: string, address: string, uri: string, chainId: number, nonce: string): string {
  const issuedAt = new Date().toISOString()
  return [
    `${domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in with Ethereum to Uniswap Trading Agents',
    '',
    `URI: ${uri}`,
    'Version: 1',
    `Chain ID: ${chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt}`,
  ].join('\n')
}

const FEATURES = [
  { icon: '✨', title: 'Natural Language Builder', desc: 'Describe your strategy in plain English — Venice AI instantly writes the full skills.md config for you.', color: 'purple' },
  { icon: '🧠', title: 'Venice AI Decisions', desc: 'Private, uncensored LLM inference (llama-3.3-70b). BUY/SELL/HOLD every 30 seconds. Your strategy stays confidential.', color: 'purple' },
  { icon: '🦄', title: 'Uniswap Trading API', desc: 'Official Uniswap API with Permit2, best-price routing across UniswapX PRIORITY + Classic V3 pools on Base.', color: 'pink' },
  { icon: '⛓️', title: 'Real On-Chain Swaps', desc: 'Every trade produces a real tx hash on Base Sepolia. No mocks, no simulations — verifiable on Basescan.', color: 'blue' },
  { icon: '📊', title: 'Live Activity Log', desc: 'See every Venice AI request, raw API response, and trade in real-time with expandable JSON payloads.', color: 'green' },
  { icon: '🔐', title: 'Sign-In with Ethereum', desc: 'MetaMask login via EIP-4361 (SIWE). JWT sessions. No passwords, no custodians, no emails.', color: 'blue' },
  { icon: '🔗', title: 'Shareable Agent Links', desc: 'Every agent has a public profile page. Share your strategy and stats with anyone — no login required.', color: 'gray' },
  { icon: '🎮', title: 'Demo Mode', desc: 'Explore the full dashboard with sample agents and trade history — no wallet or API key needed.', color: 'gray' },
]

const HOW_IT_WORKS = [
  { step: '1', title: 'Connect your wallet', desc: 'Sign in with MetaMask via SIWE — one signature, no passwords.' },
  { step: '2', title: 'Add your Venice API key', desc: 'Get a free key at venice.ai. Your key is stored server-side per user.' },
  { step: '3', title: 'Describe your strategy', desc: '"Buy ETH when it dips below $2800, sell at $3200" — Venice AI writes the config.' },
  { step: '4', title: 'Start the agent', desc: 'Engine queries Venice every 30s and fires real Uniswap swaps when triggered.' },
]

function featureCard(color: string) {
  switch (color) {
    case 'purple': return 'bg-purple-900/20 border-purple-700/40'
    case 'pink':   return 'bg-pink-900/20 border-pink-700/40'
    case 'blue':   return 'bg-blue-900/20 border-blue-700/40'
    case 'green':  return 'bg-green-900/20 border-green-700/40'
    default:       return 'bg-gray-800/40 border-gray-700/40'
  }
}

export default function Home() {
  const router = useRouter()
  const { address, isConnected, chainId } = useAccount()
  const { connect, connectors, error: connectError, isPending: isConnecting } = useConnect()
  const { signMessageAsync } = useSignMessage()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alreadyAuthed, setAlreadyAuthed] = useState(false)

  useEffect(() => {
    if (isAuthenticated()) { setAlreadyAuthed(true); router.push('/dashboard') }
  }, [router])

  const handleConnect = () => {
    const injected = connectors.find(c => c.id === 'injected') ?? connectors[0]
    if (!injected) { setError('No wallet detected. Please install MetaMask.'); return }
    connect({ connector: injected })
  }

  useEffect(() => { if (connectError) setError(connectError.message) }, [connectError])

  const signIn = async (addr: string, chain: number) => {
    setLoading(true); setError(null)
    try {
      const { nonce } = await getNonce(addr)
      const message = buildSiweMessage(window.location.host, addr, window.location.origin, chain, nonce)
      const signature = await signMessageAsync({ message })
      const { token, address: loggedAddress } = await login(message, signature)
      saveAuth(token, loggedAddress)
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Please try again.')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    if (isConnected && address && !isAuthenticated() && !loading) signIn(address, chainId ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected, address])

  if (alreadyAuthed) return (
    <main className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-gray-400">Redirecting…</p>
    </main>
  )

  const ctaButton = (secondary = false) => (
    <button
      onClick={isConnected ? () => signIn(address!, chainId ?? 1) : handleConnect}
      disabled={loading || isConnecting}
      className={`font-semibold py-3 px-8 rounded-xl transition-colors flex items-center gap-2 justify-center ${
        secondary
          ? 'bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-gray-500 text-gray-200'
          : 'bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white shadow-lg'
      }`}
    >
      {loading ? <><span className="animate-spin">⟳</span> Signing in…</>
       : isConnecting ? <><span className="animate-spin">⟳</span> Connecting…</>
       : isConnected ? 'Sign In with Ethereum'
       : 'Connect Wallet'}
    </button>
  )

  return (
    <main className="min-h-screen bg-gray-900 text-white">
      {/* Ambient glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-blue-900/20 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-purple-900/10 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-5xl mx-auto px-4 pt-20 pb-24">

        {/* ─── Hero ─── */}
        <section className="text-center mb-24">
          <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 text-blue-300 text-xs font-medium px-4 py-1.5 rounded-full mb-8">
            🏆 Built for The Synthesis Hackathon · March 2026
          </div>
          <h1 className="text-5xl md:text-7xl font-bold mb-5 tracking-tight bg-gradient-to-br from-white via-blue-100 to-purple-300 bg-clip-text text-transparent leading-tight">
            Uniswap<br />Trading Agents
          </h1>
          <p className="text-xl md:text-2xl text-gray-400 mb-3 max-w-2xl mx-auto leading-relaxed">
            Autonomous AI agents that trade on Uniswap.
          </p>
          <p className="text-gray-500 mb-8 max-w-xl mx-auto">
            Describe your strategy in plain English → Venice AI makes the calls → real swaps execute on-chain via the Uniswap Trading API.
          </p>

          {/* Tech badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-10">
            {[
              { label: '🧠 Venice AI', href: 'https://venice.ai', cls: 'bg-purple-900/40 border-purple-700 text-purple-300 hover:border-purple-500' },
              { label: '🦄 Uniswap Trading API', href: null, cls: 'bg-pink-900/30 border-pink-800 text-pink-300' },
              { label: '🔒 Permit2', href: null, cls: 'bg-blue-900/30 border-blue-800 text-blue-300' },
              { label: '⛓ Base Sepolia', href: null, cls: 'bg-gray-800 border-gray-700 text-gray-400' },
              { label: '🔐 SIWE', href: null, cls: 'bg-gray-800 border-gray-700 text-gray-400' },
            ].map(b => b.href ? (
              <a key={b.label} href={b.href} target="_blank" rel="noopener noreferrer"
                className={`border text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${b.cls}`}>{b.label}</a>
            ) : (
              <span key={b.label} className={`border text-xs font-medium px-3 py-1.5 rounded-full ${b.cls}`}>{b.label}</span>
            ))}
          </div>

          {error && (
            <div className="mb-6 max-w-sm mx-auto p-4 bg-red-900/40 border border-red-600 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
            {ctaButton()}
            <button
              onClick={() => { enterDemoMode(); router.push('/dashboard') }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 px-8 rounded-xl transition-colors border border-gray-600 hover:border-gray-500"
            >
              Try Demo →
            </button>
          </div>

          {isConnected && address && !loading && (
            <p className="mt-3 text-gray-600 text-sm font-mono">Connected: {address.slice(0, 6)}…{address.slice(-4)}</p>
          )}
          <p className="mt-5 text-gray-600 text-xs">
            Requires a free{' '}
            <a href="https://venice.ai/settings/api" target="_blank" rel="noopener noreferrer" className="text-purple-500 hover:text-purple-400 underline">
              Venice API key
            </a>
            {' '}to run agents · Private, no-data-retention inference
          </p>
        </section>

        {/* ─── How it works ─── */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-2">How it works</h2>
          <p className="text-gray-500 text-center text-sm mb-8">From idea to live on-chain trade in under 2 minutes</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className="relative bg-gray-800/50 border border-gray-700/60 rounded-xl p-5">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-9 -right-2 text-gray-600 text-lg z-10">→</div>
                )}
                <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm mb-3 shrink-0">
                  {s.step}
                </div>
                <h3 className="font-semibold text-white mb-1.5 text-sm">{s.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Features ─── */}
        <section className="mb-20">
          <h2 className="text-2xl font-bold text-center mb-2">Everything included</h2>
          <p className="text-gray-500 text-center text-sm mb-8">All the tools you need to build and run autonomous trading strategies</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className={`rounded-xl border p-5 ${featureCard(f.color)}`}>
                <div className="text-2xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-white text-sm mb-1.5">{f.title}</h3>
                <p className="text-gray-400 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── Tech stack ─── */}
        <section className="mb-20">
          <div className="bg-gray-800/30 border border-gray-700/50 rounded-2xl px-8 py-6">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest text-center mb-5">Built with</p>
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-gray-500 text-sm">
              {['Next.js 14', 'Venice AI (llama-3.3-70b)', 'Uniswap Trading API', 'Permit2', 'UniswapX', 'Base Sepolia', 'wagmi + viem', 'SIWE (EIP-4361)', 'Express.js', 'SQLite', 'WebSocket', 'ethers.js', 'Vercel', 'Railway'].map(t => (
                <span key={t} className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-gray-600 inline-block" />{t}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ─── Bottom CTA ─── */}
        <section className="text-center">
          <h2 className="text-2xl font-bold mb-2">Ready to deploy your first agent?</h2>
          <p className="text-gray-500 text-sm mb-8">Connect your wallet or explore with demo mode — no commitment required.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {ctaButton()}
            <button
              onClick={() => { enterDemoMode(); router.push('/dashboard') }}
              className="bg-gray-800 hover:bg-gray-700 text-gray-200 font-semibold py-3 px-8 rounded-xl transition-colors border border-gray-600"
            >
              Try Demo →
            </button>
            <a
              href="https://github.com/michielpost/uniswap-trading-agents"
              target="_blank" rel="noopener noreferrer"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold py-3 px-8 rounded-xl transition-colors border border-gray-600 flex items-center gap-2 justify-center"
            >
              View Source ↗
            </a>
          </div>
          <p className="mt-8 text-gray-700 text-xs">Open source · MIT License · The Synthesis Hackathon 2026</p>
        </section>

      </div>
    </main>
  )
}

