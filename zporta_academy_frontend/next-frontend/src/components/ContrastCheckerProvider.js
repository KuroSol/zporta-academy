/**
 * Global Contrast Checker Initialization
 * Add this to your _app.js or main app component
 * Ensures contrast is checked on page load and after all DOM updates
 * RESPECTS user customizations - won't override user-set colors
 */

import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { scanAndFixContrast, setupContrastObserver, hasUserSetColors } from '../utils/contrastChecker';

export const ContrastCheckerProvider = ({ children }) => {
  const router = useRouter();

  useEffect(() => {
    // Initial scan on page load
    const initialScanTimer = setTimeout(() => {
      scanAndFixContrast();
    }, 500);

    // Setup observer for dynamic changes
    const observer = setupContrastObserver();

    // Rescan when route changes
    const handleRouteChange = () => {
      setTimeout(() => {
        scanAndFixContrast();
      }, 300);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      clearTimeout(initialScanTimer);
      observer.disconnect();
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);

  return children;
};

/**
 * Alternative: Use this hook in your _app.js
 * Usage: useGlobalContrastChecker() in _app.js useEffect
 */
export const useGlobalContrastChecker = () => {
  const router = useRouter();

  useEffect(() => {
    // Initial scan
    const timer = setTimeout(() => {
      scanAndFixContrast();
    }, 500);

    // Setup observer
    const observer = setupContrastObserver();

    // Rescan on route change
    const handleRouteChange = () => {
      setTimeout(() => {
        scanAndFixContrast();
      }, 300);
    };

    router.events.on('routeChangeComplete', handleRouteChange);

    return () => {
      clearTimeout(timer);
      observer?.disconnect?.();
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router]);
};

export default ContrastCheckerProvider;
