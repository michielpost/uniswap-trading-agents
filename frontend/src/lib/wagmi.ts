import { defaultWagmiConfig } from '@web3modal/wagmi/react/config'
import { mainnet, sepolia } from 'wagmi/chains'

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || ''

const metadata = {
  name: process.env.NEXT_PUBLIC_APP_NAME || 'Uniswap Trading Agents',
  description: 'AI-powered trading bots with skills-based strategies',
  url: typeof window !== 'undefined' ? window.location.origin : 'https://localhost',
  icons: [],
}

export const chains = [mainnet, sepolia] as const

export const wagmiConfig = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
})
