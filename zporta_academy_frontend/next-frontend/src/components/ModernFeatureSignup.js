// src/components/ModernFeatureSignup.js
import React, { useState, useEffect, useContext } from "react";
import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";
import { AuthContext } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import apiClient from "@/api";
import GoogleSignupButton from "@/components/auth/GoogleSignupButton";
import styles from "@/styles/ModernFeatureSignup.module.css";
import { FaCheckCircle, FaArrowRight } from "react-icons/fa";

export default function ModernFeatureSignup({
  pageKey, // 'certificates', 'mentorship', etc.
  dataEndpoint,
  dataType = "default", // 'courses', 'lessons', 'quizzes', 'guides', 'posts'
  seoTitle,
  seoDesc,
}) {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const t = useT();

  // Build translations from pageKey
  const title = pageKey ? t(`register.${pageKey}.title`) : "";
  const subtitle = pageKey ? t(`register.${pageKey}.subtitle`) : "";

  // Build bullets array from translations
  const getBullets = () => {
    if (!pageKey) return [];
    const pageConfig = {
      explore: ["personalizedDiscovery", "interactiveLearning", "curatedPaths"],
      certificates: ["verifiedCredentials", "resumeReady", "projectBased"],
      mentorship: ["expertGuidance", "careerRoadmapping", "codeReviews"],
      studyTrack: ["smartAnalytics", "dailyStreaks", "focusTimer"],
      community: ["globalNetwork", "peerSupport", "showcaseWork"],
      compareSkills: ["adaptiveQuizzes", "globalPercentiles", "skillRadar"],
      progress: ["learningVelocity", "retentionTracking", "goalSetting"],
    };
    const keys = pageConfig[pageKey] || [];
    return keys.map((key) => ({
      title: t(`register.${pageKey}.${key}`),
      desc: t(`register.${pageKey}.${key}Desc`),
    }));
  };
  const bullets = getBullets();

  // Data State
  const [previewData, setPreviewData] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Preview Data
  useEffect(() => {
    if (!dataEndpoint) {
      setLoadingData(false);
      return;
    }

    const fetchData = async () => {
      try {
        const res = await apiClient.get(dataEndpoint);
        let data = [];
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (res.data?.results) {
          data = res.data.results;
        }
        setPreviewData(data.slice(0, 6)); // Limit to 6 items
      } catch (err) {
        console.error("Failed to fetch preview data", err);
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();
  }, [dataEndpoint]);

  // Handle Registration
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      // 1. Register
      await apiClient.post("/users/register/", {
        ...formData,
        role: "explorer", // Default role
      });

      // 2. Login
      const loginRes = await apiClient.post("/users/login/", {
        username: formData.username,
        password: formData.password,
      });

      if (loginRes.data.token) {
        login(loginRes.data.user, loginRes.data.token);
        // Redirect handled by AuthContext or we can force it
        // router.push('/home');
      } else {
        router.push("/login");
      }
    } catch (err) {
      const msg =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        (typeof err.response?.data === "object"
          ? Object.values(err.response.data).flat().join(", ")
          : "Registration failed.");
      setError(msg);
      setIsSubmitting(false);
    }
  };

  // Render Card Item based on type
  const renderCard = (item) => {
    const defaultImg = "https://placehold.co/600x400/2a2a2a/e0b050?text=Zporta";
    let img =
      item.cover_image || item.image || item.profile_image_url || defaultImg;
    let title = item.title || item.username || item.full_name || "Untitled";
    let meta = "";
    let link = "#";

    switch (dataType) {
      case "courses":
        meta = `${item.lessons_count || 0} Lessons • ${
          item.level || "All Levels"
        }`;
        link = `/courses/${item.permalink}`;
        break;
      case "lessons":
        meta = `${item.duration || 10} min read`;
        link = `/lessons/${item.permalink}`;
        break;
      case "quizzes":
        meta = `${item.questions_count || 5} Questions`;
        link = `/quizzes/${item.permalink}`; // Assuming permalink exists
        break;
      case "guides":
        meta = item.bio ? item.bio.substring(0, 30) + "..." : "Expert Guide";
        link = `/guide/${item.username}`;
        break;
      case "posts":
        meta = new Date(item.created_at).toLocaleDateString();
        link = `/posts/${item.id}`;
        break;
      default:
        meta = "Zporta Academy";
    }

    return (
      <Link
        href={link}
        key={item.id || item.username}
        className={styles.previewCard}
      >
        <img
          src={img}
          alt={title}
          className={styles.cardImage}
          onError={(e) => (e.target.src = defaultImg)}
        />
        <div className={styles.cardContent}>
          <h3 className={styles.cardTitle}>{title}</h3>
          <span className={styles.cardMeta}>{meta}</span>
        </div>
      </Link>
    );
  };

  return (
    <div className={styles.container}>
      <Head>
        <title>{seoTitle || `${title} | Zporta Academy`}</title>
        <meta name="description" content={seoDesc || subtitle} />
      </Head>

      <div className={styles.contentWrapper}>
        {/* Left Column */}
        <div className={styles.heroSection}>
          <div className={styles.header}>
            <h1 className={styles.title}>{title}</h1>
            <p className={styles.subtitle}>{subtitle}</p>
          </div>

          <div className={styles.bullets}>
            {bullets.map((b, i) => (
              <div key={i} className={styles.bulletItem}>
                <div className={styles.bulletTitle}>
                  <FaCheckCircle /> {b.title}
                </div>
                <p className={styles.bulletDesc}>{b.desc}</p>
              </div>
            ))}
          </div>

          {/* Live Data Preview */}
          {dataEndpoint && (
            <div className={styles.previewSection}>
              <h2 className={styles.previewTitle}>
                {t("register.popularIn")} {title}{" "}
                <FaArrowRight
                  size={16}
                  style={{ marginLeft: "auto", opacity: 0.5 }}
                />
              </h2>

              {loadingData ? (
                <div className={styles.loadingGrid}>
                  {[1, 2, 3].map((n) => (
                    <div key={n} className={styles.skeleton} />
                  ))}
                </div>
              ) : (
                <div className={styles.previewGrid}>
                  {previewData.map(renderCard)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column: Registration */}
        <div className={styles.formColumn}>
          <div className={styles.authCard}>
            <div className={styles.authHeader}>
              <h2 className={styles.authTitle}>{t("register.getStarted")}</h2>
              <p className={styles.authSubtitle}>{t("register.joinFree")}</p>
            </div>

            <div className={styles.googleWrapper}>
              <GoogleSignupButton />
            </div>

            <div className={styles.divider}>{t("register.orContinue")}</div>

            {error && <div className={styles.errorMsg}>{error}</div>}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.inputGroup}>
                <input
                  type="text"
                  name="username"
                  placeholder={t("register.username")}
                  className={styles.input}
                  value={formData.username}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="email"
                  name="email"
                  placeholder={t("register.emailAddress")}
                  className={styles.input}
                  value={formData.email}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className={styles.inputGroup}>
                <input
                  type="password"
                  name="password"
                  placeholder={t("register.password")}
                  className={styles.input}
                  value={formData.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <button
                type="submit"
                className={styles.submitBtn}
                disabled={isSubmitting}
              >
                {isSubmitting
                  ? t("register.creatingAccount")
                  : t("register.createAccount")}
              </button>
            </form>

            <div className={styles.loginLink}>
              {t("register.alreadyAccount")}{" "}
              <Link href="/login">{t("register.logIn")}</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
