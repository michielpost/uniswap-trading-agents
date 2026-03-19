/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
  webpack: (config) => {
    // Stub optional wallet SDK peer deps that @wagmi/connectors barrel-exports
    // but we don't actually use in this app.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@metamask/sdk':                   false,
      '@coinbase/wallet-sdk':            false,
      '@safe-global/safe-apps-sdk':      false,
      '@safe-global/safe-apps-provider': false,
      'pino-pretty':                     false,
      'lokijs':                          false,
      encoding:                          false,
    }
    return config
  },
}

module.exports = nextConfig
