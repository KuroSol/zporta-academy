/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  trailingSlash: true,
  images: {
    domains: ['zportaacademy.com', 'www.zportaacademy.com'],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000/api/',
  },
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [process.env.DEV_HOST || 'http://localhost:3001'],
  }),
};

export default nextConfig;
