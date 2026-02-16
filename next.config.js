/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable standalone output for Docker deployments
  output: 'standalone',

  // Use this project as the Turbopack root (fixes multi-lockfile warning)
  turbopack: {
    root: __dirname,
  },

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
}

module.exports = nextConfig
