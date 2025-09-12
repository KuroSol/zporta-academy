import dynamic from 'next/dynamic';
const DiaryManagement = dynamic(
  () => import('@/components/diary/DiaryManagement').then(m => m.default || m),
  { ssr: false }
);
export default function Page() { return <DiaryManagement />; }
