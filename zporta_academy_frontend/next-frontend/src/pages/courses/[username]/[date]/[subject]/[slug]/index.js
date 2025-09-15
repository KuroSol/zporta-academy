import Head from "next/head";
import CourseDetail from "@/components/CourseDetail";

const ABS = (base, path) => (path?.startsWith("http") ? path : `${base.replace(/\/$/,"")}${path}`);

export default function CourseDetailPage({ initialCourse, initialLessons, initialSeo, siteUrl }) {
  const title = initialSeo?.title || initialCourse?.seo_title || initialCourse?.title;
  const desc  = initialSeo?.description || initialCourse?.seo_description || "Learn this course on Zporta Academy.";
  const canon = initialSeo?.canonical_url || `${siteUrl}/courses/${initialCourse?.permalink}/`;
  const ogImg = initialSeo?.og_image || initialCourse?.og_image_url || initialCourse?.cover_image_url;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={canon} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={initialSeo?.og_title || title} />
        <meta property="og:description" content={initialSeo?.og_description || desc} />
        {ogImg ? <meta property="og:image" content={ABS(siteUrl, ogImg)} /> : null}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={initialSeo?.og_title || title} />
        <meta name="twitter:description" content={initialSeo?.og_description || desc} />
        {ogImg ? <meta name="twitter:image" content={ABS(siteUrl, ogImg)} /> : null}
      </Head>
      <CourseDetail initialCourse={initialCourse} initialLessons={initialLessons} />
    </>
  );
}

export async function getServerSideProps(ctx) {
  const { username, date, subject, slug } = ctx.params;
  const permalink = `${username}/${date}/${subject}/${slug}`;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"") || "http://127.0.0.1:8000/api";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,"") || "https://zportaacademy.com";

  const res = await fetch(`${apiBase}/courses/${encodeURIComponent(permalink)}/`, { headers: { Accept: "application/json" } });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) return { props: { initialCourse: null, initialLessons: [], initialSeo: null, siteUrl } };

  const data = await res.json(); // { course, lessons, seo, ... }
  return {
    props: {
      initialCourse: data.course || null,
      initialLessons: data.lessons || [],
      initialSeo: data.seo || null,
      siteUrl,
    },
  };
}
