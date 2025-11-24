import dynamic from 'next/dynamic';

const TeacherMailMagazine = dynamic(
  () => import('@/components/TeacherMailMagazine').then(m => m.default || m),
  { ssr: false }
);

export default function MailMagazinePage() {
  return <TeacherMailMagazine />;
}
