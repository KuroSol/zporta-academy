/**
 * Dynamic Sitemap Generator
 * Generates XML sitemap for all public routes
 * Called via: https://zportaacademy.com/api/sitemap.xml
 */

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://zportaacademy.com";

// Define all static routes that should be indexed
const STATIC_ROUTES = [
  { path: "/", priority: 1.0, changefreq: "daily" },
  { path: "/explore", priority: 0.9, changefreq: "weekly" },
  { path: "/quizzes", priority: 0.9, changefreq: "weekly" },
  { path: "/posts", priority: 0.8, changefreq: "weekly" },
  { path: "/lessons", priority: 0.9, changefreq: "weekly" },
  { path: "/courses", priority: 0.9, changefreq: "weekly" },
  { path: "/guide", priority: 0.7, changefreq: "monthly" },
  { path: "/tags", priority: 0.6, changefreq: "weekly" },
  { path: "/legal/privacy-policy", priority: 0.5, changefreq: "monthly" },
  { path: "/legal/terms-of-service", priority: 0.5, changefreq: "monthly" },
];

// Fetch dynamic routes from backend API
async function getDynamicRoutes() {
  try {
    // If you have a backend API endpoint that returns all dynamic routes, call it here
    // For now, returning empty array - update with your actual API
    const backendUrl =
      process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    const routes = [];

    // Example: Fetch courses
    try {
      const coursesRes = await fetch(`${backendUrl}/api/courses/?limit=10000`, {
        timeout: 5000,
      }).catch(() => null);

      if (coursesRes?.ok) {
        const coursesData = await coursesRes.json();
        const courses = coursesData.results || [];

        courses.forEach((course) => {
          if (course.username && course.date && course.subject && course.slug) {
            routes.push({
              path: `/courses/${course.username}/${course.date}/${course.subject}/${course.slug}`,
              priority: 0.7,
              changefreq: "weekly",
            });
          }
        });
      }
    } catch (err) {
      console.warn("Failed to fetch courses for sitemap:", err.message);
    }

    // Example: Fetch quizzes
    try {
      const quizzesRes = await fetch(`${backendUrl}/api/quizzes/?limit=10000`, {
        timeout: 5000,
      }).catch(() => null);

      if (quizzesRes?.ok) {
        const quizzesData = await quizzesRes.json();
        const quizzes = quizzesData.results || [];

        quizzes.forEach((quiz) => {
          if (quiz.username && quiz.subject && quiz.date && quiz.slug) {
            routes.push({
              path: `/quizzes/${quiz.username}/${quiz.subject}/${quiz.date}/${quiz.slug}`,
              priority: 0.6,
              changefreq: "weekly",
            });
          }
        });
      }
    } catch (err) {
      console.warn("Failed to fetch quizzes for sitemap:", err.message);
    }

    // Example: Fetch posts (guide profiles)
    try {
      const postsRes = await fetch(`${backendUrl}/api/guides/?limit=10000`, {
        timeout: 5000,
      }).catch(() => null);

      if (postsRes?.ok) {
        const postsData = await postsRes.json();
        const posts = postsData.results || [];

        posts.forEach((post) => {
          if (post.username) {
            routes.push({
              path: `/guide/${post.username}`,
              priority: 0.6,
              changefreq: "weekly",
            });
          }
        });
      }
    } catch (err) {
      console.warn("Failed to fetch guides for sitemap:", err.message);
    }

    return routes;
  } catch (err) {
    console.error("Error fetching dynamic routes for sitemap:", err);
    return [];
  }
}

function generateSitemapXML(routes) {
  const sitemapEntries = routes
    .map(
      (route) => `
  <url>
    <loc>${SITE_URL}${route.path}</loc>
    <lastmod>${new Date().toISOString().split("T")[0]}</lastmod>
    <changefreq>${route.changefreq || "weekly"}</changefreq>
    <priority>${route.priority || 0.5}</priority>
  </url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:mobile="http://www.google.com/schemas/sitemap-mobile/1.0"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${sitemapEntries}
</urlset>`;
}

export default async function handler(req, res) {
  try {
    // Allow only GET requests
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    // Get all routes
    const dynamicRoutes = await getDynamicRoutes();
    const allRoutes = [...STATIC_ROUTES, ...dynamicRoutes];

    // Remove duplicates
    const uniqueRoutes = Array.from(
      new Map(allRoutes.map((r) => [r.path, r])).values()
    );

    // Generate XML
    const sitemapXML = generateSitemapXML(uniqueRoutes);

    // Return as XML
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400"
    );
    res.write(sitemapXML);
    res.end();
  } catch (err) {
    console.error("Sitemap generation error:", err);
    res.status(500).json({ error: "Failed to generate sitemap" });
  }
}
