// src/pages/register.js
import dynamic from 'next/dynamic';

const Register = dynamic(
  () => import('@/components/Register').then((m) => m.default || m),
  { ssr: false } // uses window/document for Google script
);

export default function RegisterPage() {
  return <Register />;
}

// Disable global chrome (header/sidebar) for a clean auth layout
RegisterPage.hideChrome = true;
// Do not wrap with AppLayout
RegisterPage.getLayout = (page) => page;
