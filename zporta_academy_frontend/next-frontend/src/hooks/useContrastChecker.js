/**
 * React Hook for Color Contrast Management
 * Automatically ensures proper text contrast throughout components
 */

import { useEffect, useRef } from 'react';
import {
  ensureTextContrast,
  scanAndFixContrast,
  getOptimalTextColor,
  getContrastRatio
} from '../utils/contrastChecker';

/**
 * Hook to automatically fix contrast on component mount and updates
 * Usage: useContrastFix(elementRef)
 */
export const useContrastFix = (elementRef, dependencies = []) => {
  useEffect(() => {
    if (elementRef?.current) {
      ensureTextContrast(elementRef.current);
    }
  }, [elementRef, ...dependencies]);
};

/**
 * Hook to scan entire page for contrast issues
 * Usage: usePageContrast() - call once in main app component
 */
export const usePageContrast = () => {
  useEffect(() => {
    // Initial scan
    scanAndFixContrast();
    
    // Setup observer for dynamic content
    const timer = setTimeout(() => {
      scanAndFixContrast();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);
};

/**
 * Hook to get and use optimal text color
 * Usage: const textColor = useOptimalTextColor(backgroundColor)
 */
export const useOptimalTextColor = (backgroundColor) => {
  return getOptimalTextColor(backgroundColor);
};

/**
 * Hook to check contrast ratio between colors
 * Returns ratio and whether it meets WCAG AA standard
 */
export const useCheckContrast = (textColor, backgroundColor) => {
  const ratio = getContrastRatio(textColor, backgroundColor);
  const meetsAA = ratio >= 4.5;
  
  return { ratio, meetsAA };
};

/**
 * HOC to wrap components and ensure contrast
 * Usage: const SafeComponent = withContrastFix(MyComponent)
 */
export const withContrastFix = (Component) => {
  return function ContrastFixComponent(props) {
    usePageContrast();
    return <Component {...props} />;
  };
};

export default {
  useContrastFix,
  usePageContrast,
  useOptimalTextColor,
  useCheckContrast,
  withContrastFix
};
