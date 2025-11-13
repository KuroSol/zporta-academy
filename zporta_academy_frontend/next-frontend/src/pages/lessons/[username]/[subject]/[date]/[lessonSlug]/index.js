import LessonDetail from '@/components/LessonDetail';

export default function LessonDetailPage({ initialData, permalink }) {
  return <LessonDetail initialData={initialData} initialPermalink={permalink} />;
}

export async function getServerSideProps(ctx) {
  const { username, subject, date, lessonSlug } = ctx.params;
  const permalink = `${username}/${subject}/${date}/${lessonSlug}`;
  const apiBase = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://127.0.0.1:8000/api').replace(/\/$/, '');
  let initialData = null;
  try {
    const res = await fetch(`${apiBase}/lessons/${encodeURIComponent(permalink)}/`, {
      headers: { Accept: 'application/json' },
      // Do not forward cookies/tokens here; lesson API handles public content and gating
    });
    if (res.ok) {
      initialData = await res.json();
    }
  } catch (_) {
    // SSR can fail quietly; component will fetch client-side
  }
  return { props: { initialData, permalink } };
}
