import dynamic from 'next/dynamic';

const CreateCourse = dynamic(
  () => import('@/components/admin/CreateCourse').then(m => m.default || m),
  { ssr: false }
);

export default function CreateCoursePage() {
  return <CreateCourse />;
}
