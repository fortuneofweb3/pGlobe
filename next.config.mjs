/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // instrumentationHook disabled - backend operations moved to render-api-server.ts
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
        pathname: '/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 86400, // Cache for 24 hours
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Add fallbacks for Node.js modules (for MapLibre GL and other libraries)
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;

