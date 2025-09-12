import dynamic from 'next/dynamic';

const CreateLesson = dynamic(
  () => import('@/components/admin/CreateLesson').then(m => m.default || m),
  { ssr: false }
);

export default function AdminCreateLessonPage() {
  return <CreateLesson />;
}
