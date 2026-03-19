/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http',  hostname: '**' },
    ],
  },
  webpack: (config, { isServer }) => {
    // Stub out optional wallet connector dependencies that aren't needed
    config.resolve.fallback = {
      ...config.resolve.fallback,
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
