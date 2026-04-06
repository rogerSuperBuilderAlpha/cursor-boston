/** @type {import('next').NextConfig} */
const nextConfig = {
  // Standalone output is only for Docker builds (see docker/Dockerfile). Omit on Vercel.
  ...(process.env.DOCKER_BUILD === '1' ? { output: 'standalone' } : {}),

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        pathname: '/**',
      },
    ],
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              // Firebase/Google OAuth popup flows load Google-hosted scripts.
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://embed.lu.ma https://apis.google.com https://accounts.google.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://*.googleusercontent.com https://lh3.googleusercontent.com https://avatars.githubusercontent.com https://*.cartocdn.com https://unpkg.com",
              "font-src 'self'",
              "connect-src 'self' https://*.firebaseio.com https://*.firebaseapp.com https://*.googleapis.com https://accounts.google.com https://*.cartocdn.com https://unpkg.com",
              "frame-src https://lu.ma https://luma.com https://accounts.google.com https://*.firebaseapp.com",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join('; '),
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '0',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
