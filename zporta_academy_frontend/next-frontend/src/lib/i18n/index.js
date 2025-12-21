// lib/i18n/index.js
// Custom minimal i18n implementation for Zporta Academy

const SUPPORTED_LOCALES = ["en", "ja"];
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE_NAME = "zporta_locale";

// Load translation files
let translations = {};
if (typeof window !== "undefined") {
  // Client-side: dynamically loaded via fetch
  translations = {};
} else {
  // Server-side: load from public/locales
  try {
    const fs = require("fs");
    const path = require("path");
    const cwd = process.cwd && process.cwd();

    if (!cwd || typeof cwd !== "string") {
      console.warn(
        "process.cwd() is not available, skipping i18n load on server"
      );
      translations = {};
    } else {
      translations = {
        en: JSON.parse(
          fs.readFileSync(path.join(cwd, "public/locales/en.json"), "utf-8")
        ),
        ja: JSON.parse(
          fs.readFileSync(path.join(cwd, "public/locales/ja.json"), "utf-8")
        ),
      };
    }
  } catch (e) {
    console.warn("Failed to load translations on server:", e);
    translations = { en: {}, ja: {} };
  }
}

/**
 * Get nested value from object using dot notation
 * @param {Object} obj - The object to search
 * @param {string} path - Dot notation path (e.g., "common.loading")
 * @returns {any} The value or undefined
 */
function getNestedValue(obj, path) {
  return path.split(".").reduce((curr, key) => curr?.[key], obj);
}

/**
 * Translate a key with optional interpolation
 * @param {string} key - Translation key in dot notation
 * @param {Object} params - Parameters for interpolation
 * @param {string} locale - Target locale
 * @returns {string} Translated string
 */
export function translate(key, params = {}, locale = DEFAULT_LOCALE) {
  const messages = translations[locale] || translations[DEFAULT_LOCALE];
  let message = getNestedValue(messages, key);

  if (!message) {
    console.warn(`Translation missing for key: ${key} (locale: ${locale})`);
    return key;
  }

  // Simple interpolation: replace {key} with params[key]
  if (typeof message === "string" && Object.keys(params).length > 0) {
    Object.keys(params).forEach((paramKey) => {
      message = message.replace(
        new RegExp(`\\{${paramKey}\\}`, "g"),
        params[paramKey]
      );
    });
  }

  return message;
}

/**
 * Load translation data for client-side
 * @param {string} locale - Locale to load
 */
export async function loadTranslations(locale) {
  if (!SUPPORTED_LOCALES.includes(locale)) {
    locale = DEFAULT_LOCALE;
  }

  if (!translations[locale]) {
    try {
      const response = await fetch(`/locales/${locale}.json`);
      translations[locale] = await response.json();
    } catch (error) {
      console.error(`Failed to load translations for ${locale}:`, error);
      translations[locale] = translations[DEFAULT_LOCALE] || {};
    }
  }

  return translations[locale];
}

/**
 * Get locale from cookie (works on server and client)
 * @param {string} cookieString - Cookie string from request or document.cookie
 * @returns {string|null} Locale or null
 */
export function getLocaleFromCookie(cookieString) {
  if (!cookieString) return null;

  const match = cookieString.match(new RegExp(`${LOCALE_COOKIE_NAME}=([^;]+)`));
  return match ? match[1] : null;
}

/**
 * Set locale cookie (client-side only)
 * @param {string} locale - Locale to set
 */
export function setLocaleCookie(locale) {
  if (typeof document === "undefined") return;

  // Set cookie with 1 year expiration
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);

  document.cookie = `${LOCALE_COOKIE_NAME}=${locale}; expires=${expires.toUTCString()}; path=/; SameSite=Lax`;
}

/**
 * Get locale from localStorage (client-side only)
 * @returns {string|null}
 */
export function getLocaleFromStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("locale");
}

/**
 * Set locale in localStorage (client-side only)
 * @param {string} locale
 */
export function setLocaleInStorage(locale) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("locale", locale);
}

/**
 * Detect browser language and map to supported locale
 * @param {string} acceptLanguage - Accept-Language header or navigator.language
 * @returns {string} Mapped locale
 */
export function detectBrowserLocale(acceptLanguage) {
  if (!acceptLanguage) return DEFAULT_LOCALE;

  // Parse Accept-Language header or navigator.language
  const browserLang = acceptLanguage.toLowerCase().split(/[,;-]/)[0];

  // Map ja, ja-jp, ja-* to 'ja'
  if (browserLang.startsWith("ja")) {
    return "ja";
  }

  // Default to English
  return "en";
}

/**
 * Resolve locale based on priority:
 * 1. Logged-in user profile locale (passed as parameter)
 * 2. Guest persisted selection (cookie)
 * 3. Browser language (Accept-Language on SSR / navigator.language on client)
 * 4. Fallback to 'en'
 *
 * @param {Object} options
 * @param {string} options.userLocale - User's saved locale from profile
 * @param {string} options.cookieString - Cookie string (for SSR)
 * @param {string} options.acceptLanguage - Accept-Language header (for SSR)
 * @returns {string} Resolved locale
 */
export function resolveLocale({
  userLocale,
  cookieString,
  acceptLanguage,
} = {}) {
  // Priority 1: Logged-in user preference
  if (userLocale && SUPPORTED_LOCALES.includes(userLocale)) {
    return userLocale;
  }

  // Priority 2: Cookie (guest persistence)
  const cookieLocale = getLocaleFromCookie(
    cookieString || (typeof document !== "undefined" ? document.cookie : "")
  );
  if (cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale)) {
    return cookieLocale;
  }

  // Priority 3: Browser language detection
  const browserLang =
    acceptLanguage ||
    (typeof navigator !== "undefined" ? navigator.language : "");
  const detectedLocale = detectBrowserLocale(browserLang);
  if (SUPPORTED_LOCALES.includes(detectedLocale)) {
    return detectedLocale;
  }

  // Priority 4: Fallback
  return DEFAULT_LOCALE;
}

export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_COOKIE_NAME };
