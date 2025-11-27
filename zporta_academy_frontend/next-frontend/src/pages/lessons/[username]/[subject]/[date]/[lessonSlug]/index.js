import LessonDetail from '@/components/LessonDetail';

export default function LessonDetailPage({ initialData, permalink }) {
  return <LessonDetail initialData={initialData} initialPermalink={permalink} />;
}

export async function getServerSideProps(ctx) {
  const { username, subject, date, lessonSlug } = ctx.params;
  const permalink = `${username}/${subject}/${date}/${lessonSlug}`;
  // Replace localhost with 127.0.0.1 for Windows SSR compatibility
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '').replace('localhost', '127.0.0.1');
  // Conservative cache headers for public SSR responses
  try { ctx.res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120'); } catch (_) {}
  let initialData = null;
  try {
    const res = await fetch(`${apiBase}/lessons/${encodeURIComponent(permalink)}/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000)
      // Do not forward cookies/tokens here; lesson API handles public content and gating
    });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (error) {
    // SSR can fail quietly; component will fetch client-side
    console.error('SSR lesson fetch error:', error.message);
  }
  return { props: { initialData, permalink } };
}
