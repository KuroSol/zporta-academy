// src/pages/_app.js
import "@/styles/globals.css";

import React, { useContext, useMemo } from "react";
import App from "next/app";
import dynamic from "next/dynamic";
import { useRouter } from "next/router";
import Head from "next/head";

import { AuthProvider, AuthContext } from "@/context/AuthContext";
import { AuthModalProvider } from "@/context/AuthModalContext";
import { LanguageProvider } from "@/context/LanguageContext";
import AppLayout from "@/components/layout/AppLayout";
import ErrorBoundary from "@/components/common/ErrorBoundary";
// Note: avoid importing CSS Modules globally here; import them in components instead.
// client-only
const BottomMenu = dynamic(() => import("@/components/common/BottomMenu"), {
  ssr: false,
});

function Chrome({ children, enabled }) {
  const router = useRouter();
  const { token } = useContext(AuthContext);
  const isLoggedIn = !!token;

  const path = router.asPath || "/";
  const noHeaderPaths = ["/login", "/register", "/password-reset"];
  const startsWith = (list) => list.some((p) => path.startsWith(p));

  const showBottomMenu =
    isLoggedIn &&
    !startsWith(["/lessons/"]) &&
    !startsWith(["/courses/enrolled/"]) &&
    !noHeaderPaths.includes(path) &&
    !startsWith(["/reset-password-confirm/"]);

  const permissions = useMemo(
    () =>
      typeof window !== "undefined"
        ? localStorage.getItem("permissions")?.split(",") || []
        : [],
    [isLoggedIn]
  );

  // IMPORTANT: Chrome no longer wraps with AppLayout.
  return (
    <>
      {children}
      {showBottomMenu && (
        <BottomMenu permissions={permissions} position="rightEdge" />
      )}
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
      <LanguageProvider initialLocale={pageProps.initialLocale}>
        <AuthModalProvider>
          <Head>
            {/* Global sitemap reference */}
            <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
          </Head>
          <Chrome enabled={enabled}>
            <ErrorBoundary>
              {applyLayout(<Component {...pageProps} />)}
            </ErrorBoundary>
          </Chrome>
        </AuthModalProvider>
      </LanguageProvider>
    </AuthProvider>
  );
}

// Ensure SSR picks the best initial locale (cookie or Accept-Language)
MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  const req = appContext.ctx?.req;
  let initialLocale = undefined;

  if (req) {
    try {
      // Resolve from cookie first, then Accept-Language
      const { resolveLocale } = require("@/lib/i18n");
      initialLocale = resolveLocale({
        cookieString: req.headers?.cookie || "",
        acceptLanguage: req.headers?.["accept-language"] || "",
      });
    } catch (_) {
      // no-op; default will be used client-side
    }
  }

  return {
    ...appProps,
    pageProps: {
      ...appProps.pageProps,
      initialLocale,
    },
  };
};
