 import dynamic from 'next/dynamic';

 const Profile = dynamic(
   () => import('@/components/Profile').then(m => m.default || m),
   { ssr: false }
 );

 export default function ProfilePage() {
   return <Profile />;
 }
