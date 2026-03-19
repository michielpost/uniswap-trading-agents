import { createConfig, http, injected } from 'wagmi'
import { mainnet, sepolia } from 'wagmi/chains'

export const chains = [mainnet, sepolia] as const

export const wagmiConfig = createConfig({
  chains,
  ssr: true,
  connectors: [injected()],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
})
