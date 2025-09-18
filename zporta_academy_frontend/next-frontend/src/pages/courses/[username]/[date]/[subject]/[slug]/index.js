import Head from "next/head";
import { useEffect, useState, useContext } from "react";
import CourseDetail from "@/components/CourseDetail";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";

const ABS = (base, path) => (path?.startsWith("http") ? path : `${base.replace(/\/$/,"")}${path}`);

export default function CourseDetailPage({ initialCourse, initialLessons, initialSeo, siteUrl, permalink }) {
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

  const title = (initialSeo?.title || course?.seo_title || course?.title) ?? "Course";
  const desc  = (initialSeo?.description || course?.seo_description) ?? "Learn this course on Zporta Academy.";
  const canon = (initialSeo?.canonical_url || (course?.permalink ? `${siteUrl}/courses/${course.permalink}/` : siteUrl));
  const ogImg = initialSeo?.og_image || course?.og_image_url || course?.cover_image_url;


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
      {course
        ? <CourseDetail initialCourse={course} initialLessons={lessons} />
        : <div style={{ padding: 24 }}>Course not found or no permission.</div>}
    </>
  );
}

export async function getServerSideProps(ctx) {
  const { username, date, subject, slug } = ctx.params;
  const permalink = `${username}/${date}/${subject}/${slug}`;
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/,"") || "http://127.0.0.1:8000/api";
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/,"") || "https://zportaacademy.com";

  // Public fetch only. If draft, this returns 404; do NOT short-circuit to 404 page.
  const res = await fetch(`${apiBase}/courses/${encodeURIComponent(permalink)}/`, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    return { props: { initialCourse: null, initialLessons: [], initialSeo: null, siteUrl, permalink } };
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
}
