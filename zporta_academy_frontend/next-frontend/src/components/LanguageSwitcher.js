// src/components/LanguageSwitcher.js
import React from "react";
import { useLanguage } from "@/context/LanguageContext";
import styles from "@/styles/LanguageSwitcher.module.css";

const LanguageSwitcher = () => {
  const { locale, setLocale, supportedLocales } = useLanguage();

  const languageLabels = {
    en: "English",
    ja: "日本語",
  };

  const handleChange = (newLocale) => {
    if (newLocale !== locale) {
      setLocale(newLocale);
    }
  };

  return (
    <div className={styles.languageSwitcher}>
      {supportedLocales.map((lang) => (
        <button
          key={lang}
          className={`${styles.langButton} ${
            locale === lang ? styles.active : ""
          }`}
          onClick={() => handleChange(lang)}
          aria-label={`Switch to ${languageLabels[lang]}`}
        >
          {languageLabels[lang]}
        </button>
      ))}
    </div>
  );
};

export default LanguageSwitcher;
