import dynamic from 'next/dynamic';

 const Explorer = dynamic(
   () => import('@/components/Explorer').then(m => m.default || m),
   { ssr: false }
 );

export default function LearnPage() {
  return <Explorer />;
}