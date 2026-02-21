/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Server-side packages that should not be bundled
  // Required for zkFetch (Reclaim Protocol) to work properly
  serverExternalPackages: ['koffi', '@reclaimprotocol/zk-fetch'],

  // Turbopack config for Next.js 16
  turbopack: {
    root: process.cwd(),
  },

  webpack: config => {
    config.resolve.fallback = { fs: false, net: false, tls: false };
    config.externals.push('pino-pretty', 'lokijs', 'encoding');
    return config;
  },

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.squarespace-cdn.com',
        port: '',
        pathname: '/content/v1/**',
      },
    ],
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self "https://*.plaid.com"), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Scripts: unsafe-inline needed for Next.js inline scripts (use nonces to remove)
              "script-src 'self' 'unsafe-inline' https://cdn.plaid.com",
              // Styles: unsafe-inline needed for styled-components/emotion/tailwind
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https://*.supabase.co https://images.squarespace-cdn.com",
              "font-src 'self' data: https://fonts.gstatic.com",
              // Connections: Privy (auth + RPC), WalletConnect, Plaid, app services
              "connect-src 'self' https://auth.privy.io https://*.rpc.privy.systems wss://relay.walletconnect.com wss://relay.walletconnect.org wss://www.walletlink.org https://explorer-api.walletconnect.com https://*.supabase.co wss://*.supabase.co https://*.alchemy.com wss://*.alchemy.com https://*.arbitrum.io https://*.plaid.com https://api.circle.com",
              // Iframes: Privy auth, WalletConnect verify, Plaid Link
              "child-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org",
              "frame-src https://auth.privy.io https://verify.walletconnect.com https://verify.walletconnect.org https://cdn.plaid.com https://*.plaid.com",
              "frame-ancestors 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "worker-src 'self'",
              "manifest-src 'self'",
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
