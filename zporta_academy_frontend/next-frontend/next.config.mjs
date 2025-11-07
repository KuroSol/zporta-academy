/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    // Allow images from production domains, placeholder, and local dev servers
    domains: [
      'zportaacademy.com',
      'www.zportaacademy.com',
      'placehold.co',
      '127.0.0.1',
      'localhost',
    ],
    // Explicit patterns for local Django media during development
    remotePatterns: [
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
    ],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/',
  },
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [process.env.DEV_HOST || 'http://localhost:3001'],
  }),
};

export default nextConfig;
