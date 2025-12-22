/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Disable x-powered-by header for security
  poweredByHeader: false,

  // Server-side packages that should not be bundled
  // Required for zkFetch (Reclaim Protocol) to work properly
  serverExternalPackages: ['koffi', '@reclaimprotocol/zk-fetch'],

  // Turbopack config for Next.js 16
  turbopack: {},

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
              // Default restrictive policy
              "default-src 'self'",
              // Scripts: unsafe-eval needed for Next.js dev, unsafe-inline for inline event handlers
              // TODO: Consider using nonces for stricter CSP in production
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://cdn.plaid.com https://*.privy.io",
              "script-src-elem 'self' 'unsafe-inline' https://cdn.plaid.com https://*.privy.io",
              // Styles: unsafe-inline needed for styled-components/emotion/tailwind
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              // Images: restrict to known sources (removed https: wildcard)
              "img-src 'self' data: blob: https://*.supabase.co https://images.squarespace-cdn.com",
              // Fonts
              "font-src 'self' data: https://fonts.gstatic.com",
              // API connections - explicit allowlist
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.alchemy.com wss://*.alchemy.com https://*.walletconnect.com wss://*.walletconnect.com https://*.walletconnect.org wss://*.walletconnect.org https://pulse.walletconnect.org https://api.web3modal.org https://arb1.arbitrum.io https://*.arbitrum.io https://*.privy.io wss://*.privy.io https://*.plaid.com https://api.circle.com",
              // Iframes - restrict to auth/wallet providers
              "frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://verify.walletconnect.org https://auth.turnkey.com https://*.privy.io https://cdn.plaid.com https://*.plaid.com",
              // Prevent embedding this site in iframes (clickjacking protection)
              "frame-ancestors 'none'",
              // Block plugins (Flash, Java, etc.)
              "object-src 'none'",
              // Restrict base URI to prevent base tag injection
              "base-uri 'self'",
              // Restrict form submissions to same origin
              "form-action 'self'",
              // Upgrade insecure requests in production
              "upgrade-insecure-requests",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
