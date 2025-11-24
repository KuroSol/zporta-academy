import dynamic from 'next/dynamic';

const MailMagazine = dynamic(
  () => import('@/components/MailMagazine').then(m => m.default || m),
  { ssr: false }
);

export default function MailMagazinePage() {
  return <MailMagazine />;
}
