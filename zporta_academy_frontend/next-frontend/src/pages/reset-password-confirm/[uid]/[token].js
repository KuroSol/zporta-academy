import { useRouter } from 'next/router';
import ResetPasswordConfirm from '@/components/auth/ResetPasswordConfirm';

export default function Page() {
  const router = useRouter();
  const { uid, token } = router.query;

  if (!uid || !token) return null; // wait for params

  return (
    <ResetPasswordConfirm
      uid={uid}
      token={token}
      onSuccess={() => router.push('/login')}
    />
  );
}
