/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // trailingSlash removed to avoid static html resolution issues for dynamic pages
  // Enable source maps in production temporarily to debug minified ReferenceError (sC before initialization)
  productionBrowserSourceMaps: true,
  // Specify the pages directory location
  pageExtensions: ["js", "jsx", "ts", "tsx"],
  // Disable ESLint during production builds (warnings become errors in prod)
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Disable optimization for backend media URLs; direct load avoids /_next/image 500 errors
    unoptimized: true,
    // Modern remotePatterns config (replaces deprecated domains)
    remotePatterns: [
      {
        protocol: "https",
        hostname: "zportaacademy.com",
      },
      {
        protocol: "https",
        hostname: "www.zportaacademy.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "8000",
        pathname: "/api/media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/media/**",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/api/media/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "3000",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "3000",
      },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  env: {
    // Prefer explicit production base URL fallback; keeps localhost for dev
    NEXT_PUBLIC_API_BASE_URL:
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://www.zportaacademy.com/api/"
        : "http://127.0.0.1:8000/api/"),
  },
  // Proxy sitemap and robots.txt requests
  async rewrites() {
    return [
      {
        source: "/sitemap.xml",
        destination: "/api/sitemap.xml", // Use Next.js sitemap API
      },
      {
        source: "/robots.txt",
        destination: "/robots.txt", // Serve from Next.js public folder
      },
    ];
  },
  ...(process.env.NODE_ENV === "development" && {
    allowedDevOrigins: [process.env.DEV_HOST || "http://127.0.0.1:3000"],
  }),
};

export default nextConfig;
