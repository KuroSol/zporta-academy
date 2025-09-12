import dynamic from 'next/dynamic';

const StudyDashboard = dynamic(
  () => import('@/components/StudyDashboard').then(m => m.default || m),
  { ssr: false }
);

export default function StudyDashboardPage() {
  return <StudyDashboard />;
}
