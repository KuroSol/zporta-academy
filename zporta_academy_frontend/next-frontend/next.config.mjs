/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  // Specify the pages directory location
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  // Disable ESLint during production builds (warnings become errors in prod)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Modern remotePatterns config (replaces deprecated domains)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zportaacademy.com',
      },
      {
        protocol: 'https',
        hostname: 'www.zportaacademy.com',
      },
      {
        protocol: 'https',
        hostname: 'placehold.co',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/media/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        port: '3001',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3001',
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/',
  },
  // Proxy sitemap.xml requests to Django backend
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/$/, '') || 'http://localhost:8000';
    return [
      {
        source: '/sitemap.xml',
        destination: `${backendUrl}/sitemap.xml`,
      },
      {
        source: '/robots.txt',
        destination: '/robots.txt', // Serve from Next.js public folder
      },
    ];
  },
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [process.env.DEV_HOST || 'http://localhost:3001'],
  }),
};

export default nextConfig;
