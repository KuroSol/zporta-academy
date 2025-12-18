// src/context/LanguageContext.js
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  loadTranslations,
  translate,
  resolveLocale,
  setLocaleCookie,
  setLocaleInStorage,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from "@/lib/i18n";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";

const LanguageContext = createContext();

export function LanguageProvider({ children, initialLocale }) {
  const { user, token } = useContext(AuthContext);
  const [locale, setLocaleState] = useState(initialLocale || DEFAULT_LOCALE);
  const [translations, setTranslations] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Load translations when locale changes
  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        setIsLoading(true);
        const data = await loadTranslations(locale);
        if (isMounted) {
          setTranslations(data);
        }
      } catch (error) {
        console.error("Failed to load translations:", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, [locale]);

  // Sync locale with user profile on login
  useEffect(() => {
    if (user?.locale && SUPPORTED_LOCALES.includes(user.locale)) {
      if (user.locale !== locale) {
        setLocaleState(user.locale);
        setLocaleCookie(user.locale);
        setLocaleInStorage(user.locale);
      }
    }
  }, [user]);

  // Initialize locale on mount (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Resolve locale based on priority
    const resolved = resolveLocale({
      userLocale: user?.locale,
      cookieString: document.cookie,
      acceptLanguage: navigator.language,
    });

    if (resolved !== locale) {
      setLocaleState(resolved);
    }
  }, []);

  /**
   * Change the current locale
   * @param {string} newLocale - New locale to set
   * @param {boolean} persist - Whether to persist to backend (for logged-in users)
   */
  const changeLocale = useCallback(
    async (newLocale, persist = true) => {
      if (!SUPPORTED_LOCALES.includes(newLocale)) {
        console.warn(`Unsupported locale: ${newLocale}`);
        return;
      }

      // Update UI immediately
      setLocaleState(newLocale);
      setLocaleCookie(newLocale);
      setLocaleInStorage(newLocale);

      // Persist to backend if logged in and persist flag is true
      if (token && persist) {
        try {
          await apiClient.patch("/users/profile/", { locale: newLocale });
        } catch (error) {
          console.error("Failed to update locale on server:", error);
        }
      }
    },
    [token]
  );

  /**
   * Translation function with interpolation support
   * @param {string} key - Translation key (dot notation)
   * @param {Object} params - Interpolation parameters
   * @returns {string} Translated string
   */
  const t = useCallback(
    (key, params = {}) => {
      return translate(key, params, locale);
    },
    [locale, translations]
  );

  const value = {
    locale,
    setLocale: changeLocale,
    t,
    isLoading,
    supportedLocales: SUPPORTED_LOCALES,
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

/**
 * Hook to access language context
 * @returns {Object} Language context value
 */
export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}

/**
 * Hook that returns just the translation function
 * Convenience hook for components that only need t()
 * @returns {Function} Translation function
 */
export function useT() {
  const { t } = useLanguage();
  return t;
}

export default LanguageContext;
