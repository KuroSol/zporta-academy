// src/pages/_app.js
import '@/styles/globals.css';

import React, { useContext, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import Head from 'next/head';

import { AuthProvider, AuthContext } from '@/context/AuthContext';
import { AuthModalProvider } from '@/context/AuthModalContext';
import AppLayout from '@/components/layout/AppLayout';
// Note: avoid importing CSS Modules globally here; import them in components instead.
// client-only
const BottomMenu = dynamic(() => import('@/components/common/BottomMenu'), { ssr: false });

function Chrome({ children, enabled }) {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const isLoggedIn = !!token;

  const path = router.asPath || '/';
  const noHeaderPaths = ['/login', '/register', '/password-reset'];
  const startsWith = (list) => list.some((p) => path.startsWith(p));

  const showBottomMenu =
    isLoggedIn &&
    !startsWith(['/lessons/']) &&
    !startsWith(['/courses/enrolled/']) &&
    !noHeaderPaths.includes(path) &&
    !startsWith(['/reset-password-confirm/']);

  const permissions = useMemo(
    () =>
      typeof window !== 'undefined'
        ? (localStorage.getItem('permissions')?.split(',') || [])
        : [],
    [isLoggedIn]
  );

  // IMPORTANT: Chrome no longer wraps with AppLayout.
  return (
    <>
      {children}
      {showBottomMenu && <BottomMenu permissions={permissions} position="rightEdge" />}
    </>
  );
}

export default function MyApp({ Component, pageProps }) {
  const enabled = Component.hideChrome ? false : true;

  // Apply AppLayout exactly once.
  const applyLayout =
    Component.getLayout ||
    ((page) => <AppLayout enabled={enabled}>{page}</AppLayout>);

  return (
    <AuthProvider>
      <AuthModalProvider>
        <Head>
          {/* Global sitemap reference */}
          <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
        </Head>
        <Chrome enabled={enabled}>
          {applyLayout(<Component {...pageProps} />)}
        </Chrome>
      </AuthModalProvider>
    </AuthProvider>
  );
}
