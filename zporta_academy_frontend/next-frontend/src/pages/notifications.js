import dynamic from 'next/dynamic';

const Notifications = dynamic(
  () => import('@/components/Notifications').then(m => m.default || m),
  { ssr: false }
);

export default function NotificationsPage() {
  return <Notifications />;
}
