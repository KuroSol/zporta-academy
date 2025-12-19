import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import CourseDetail from "@/components/CourseDetail";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";

const ABS = (base, path) => {
  if (!path || typeof path !== "string") return null;
  return path.startsWith("http") ? path : `${base.replace(/\/$/, "")}${path}`;
};

export default function CourseDetailPage({
  initialCourse,
  initialLessons,
  initialSeo,
  siteUrl,
  permalink,
}) {
  const [course, setCourse] = useState(initialCourse || null);
  const [lessons, setLessons] = useState(initialLessons || []);
  const { user } = useContext(AuthContext);

  // If SSR couldn't load (draft), try client-side draft endpoint with auth
  useEffect(() => {
    if (course) return;
    (async () => {
      try {
        const r = await apiClient.get(`/courses/draft/${permalink}/`);
        setCourse(r.data.course);
        setLessons(r.data.lessons || []);
      } catch (_) {
        // leave as null if not creator/tester/staff
      }
    })();
  }, [course, permalink]);

  const title =
    (initialSeo?.title || course?.seo_title || course?.title) ?? "Course";
  const desc =
    (initialSeo?.description || course?.seo_description) ??
    "Learn this course on Zporta Academy.";
  const canon =
    initialSeo?.canonical_url ||
    (course?.permalink ? `${siteUrl}/courses/${course.permalink}/` : siteUrl);
  const ogImg =
    initialSeo?.og_image || course?.og_image_url || course?.cover_image_url;
  const focus = course?.focus_keyword || initialSeo?.focus_keyword;
  const ogUrl = canon;
  const [pUser, pDate, pSubject] = (
    (course?.permalink || permalink || "").split("/") || []
  ).slice(0, 3);

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canon} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={initialSeo?.og_title || title} />
        <meta
          property="og:description"
          content={initialSeo?.og_description || desc}
        />
        <meta property="og:url" content={ogUrl} />
        {ABS(siteUrl, ogImg) ? (
          <meta property="og:image" content={ABS(siteUrl, ogImg)} />
        ) : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={initialSeo?.og_title || title} />
        <meta
          name="twitter:description"
          content={initialSeo?.og_description || desc}
        />
        {ABS(siteUrl, ogImg) ? (
          <meta name="twitter:image" content={ABS(siteUrl, ogImg)} />
        ) : null}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        {focus ? <meta name="keywords" content={focus} /> : null}
        {/* JSON-LD: Course + Breadcrumb */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Course",
              name: course?.title || title,
              description: desc,
              url: ogUrl,
              provider: {
                "@type": "Organization",
                name: "Zporta Academy",
                url: siteUrl,
              },
              offers:
                course?.course_type === "premium" && course?.price
                  ? {
                      "@type": "Offer",
                      priceCurrency: "USD",
                      price: String(course.price),
                      availability: "https://schema.org/InStock",
                    }
                  : undefined,
            }),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              itemListElement: [
                {
                  "@type": "ListItem",
                  position: 1,
                  name: "Home",
                  item: siteUrl,
                },
                {
                  "@type": "ListItem",
                  position: 2,
                  name: "Courses",
                  item: `${siteUrl}/courses/`,
                },
                {
                  "@type": "ListItem",
                  position: 3,
                  name: course?.subject_name || "Subject",
                  item: `${siteUrl}/courses/${pUser || ""}/${pDate || ""}/${
                    pSubject || ""
                  }/`,
                },
                {
                  "@type": "ListItem",
                  position: 4,
                  name: course?.title || title,
                  item: ogUrl,
                },
              ],
            }),
          }}
        />
      </Head>
      {course ? (
        <CourseDetail initialCourse={course} initialLessons={lessons} />
      ) : (
        <div style={{ padding: 24 }}>Course not found or no permission.</div>
      )}
    </>
  );
}

export async function getServerSideProps(ctx) {
  const { username, date, subject, slug } = ctx.params;
  const permalink = `${username}/${date}/${subject}/${slug}`;

  // For SSR, ensure we use http://127.0.0.1 explicitly to force IPv4
  const apiBase = (
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000/api"
  )
    .replace(/\/$/, "")
    .replace(/localhost/g, "127.0.0.1");
  // Force non-www for canonical URLs
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://zportaacademy.com"
  ).replace("www.", "");

  // Conservative cache headers for public SSR responses
  try {
    ctx.res.setHeader(
      "Cache-Control",
      "public, s-maxage=300, stale-while-revalidate=120"
    );
  } catch (_) {}

  try {
    // Public fetch only. If draft, this returns 404; do NOT short-circuit to 404 page.
    const res = await fetch(
      `${apiBase}/courses/${encodeURIComponent(permalink)}/`,
      {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      }
    );
    if (!res.ok) {
      return {
        props: {
          initialCourse: null,
          initialLessons: [],
          initialSeo: null,
          siteUrl,
          permalink,
        },
      };
    }

    const data = await res.json(); // { course, lessons, seo, ... }
    return {
      props: {
        initialCourse: data.course || null,
        initialLessons: data.lessons || [],
        initialSeo: data.seo || null,
        siteUrl,
        permalink,
      },
    };
  } catch (error) {
    // If fetch fails (network error, timeout), return empty props to allow client-side retry
    console.error("SSR fetch error:", error.message);
    return {
      props: {
        initialCourse: null,
        initialLessons: [],
        initialSeo: null,
        siteUrl,
        permalink,
      },
    };
  }
}
