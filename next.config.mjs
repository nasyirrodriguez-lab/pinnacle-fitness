/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@chakra-ui/react'],
  },
  async redirects() {
    return [
      {
        source: '/solutions',
        destination: '/spaces',
        permanent: true,
      },
      {
        source: '/pricing',
        destination: '/spaces',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
