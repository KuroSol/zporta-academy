// src/pages/login.js
import dynamic from 'next/dynamic';

const Login = dynamic(
  () => import('@/components/Login').then((m) => m.default || m),
  { ssr: false } // uses window/document and Google script
);

export default function LoginPage() {
  return <Login />;
}
