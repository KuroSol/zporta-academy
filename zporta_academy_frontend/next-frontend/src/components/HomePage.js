import React, {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { AuthContext } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import apiClient from "@/api";
import Footer from "@/components/layout/Footer";
import styles from "@/styles/HomePage.module.css";
import { quizPermalinkToUrl } from "@/utils/urls";
import LoginModal from "@/components/LoginModal";
import LanguageSwitcher from "@/components/LanguageSwitcher";

import {
  FaRocket,
  FaChalkboardTeacher,
  FaNewspaper,
  FaGraduationCap,
  FaCheckCircle,
  FaTimesCircle,
  FaEllipsisH,
  FaBookOpen,
  FaSearch,
  FaBrain,
  FaBook,
  FaPencilAlt,
  FaUserFriends,
  FaClipboardList,
  FaFilter,
} from "react-icons/fa";

// --- Helper Components ---
const LoadingPlaceholder = ({ message = "Loading..." }) => (
  <div className={styles.loadingPlaceholder}>
    <FaSpinner className={styles.spinner} size={24} />
    {message}
  </div>
);
const ErrorMessage = ({ message }) => (
  <p className={styles.errorMessage}>{message}</p>
);
const EmptyState = ({ message }) => (
  <p className={styles.emptyStateMessage}>{message}</p>
);
const FaSpinner = ({ className, ...props }) => (
  <svg
    className={`${styles.spinner} ${className || ""}`}
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    {...props}
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    ></circle>
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    ></path>
  </svg>
);

// --- Main HomePage Component ---
const HomePage = () => {
  const router = useRouter();
  const { user, token, logout } = useContext(AuthContext);
  const t = useT();
  const hexagonSectionRef = useRef(null);
  const searchHexagonRef = useRef(null);

  const [isSearchExpanded, setSearchExpanded] = useState(false);
  const [heroExpanded, setHeroExpanded] = useState(false);

  // --- Search State (from Explorer logic) ---
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);
  const [loginModalOpen, setLoginModalOpen] = useState(false);

  // Marketing content for non-authenticated users
  const [publicCourses, setPublicCourses] = useState([]);
  const [publicLessons, setPublicLessons] = useState([]);
  const [publicQuizzes, setPublicQuizzes] = useState([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  // Do not redirect unauthenticated users; show marketing homepage

  // --- Dynamic Spotlight Effect ---
  useEffect(() => {
    // Only add mouse effect if authenticated (hexagon nav mode)
    if (!user) return;

    const handleMouseMove = (e) => {
      if (hexagonSectionRef.current) {
        const rect = hexagonSectionRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        hexagonSectionRef.current.style.setProperty("--mouse-x", `${x}px`);
        hexagonSectionRef.current.style.setProperty("--mouse-y", `${y}px`);
      }
    };
    const currentRef = hexagonSectionRef.current;
    if (currentRef) currentRef.addEventListener("mousemove", handleMouseMove);
    return () => {
      if (currentRef)
        currentRef.removeEventListener("mousemove", handleMouseMove);
    };
  }, [user]);

  // --- Close search on outside click/escape ---
  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        searchHexagonRef.current &&
        !searchHexagonRef.current.contains(event.target)
      ) {
        setSearchExpanded(false);
        setSearchTerm("");
        setSearchResults(null);
      }
    };
    const handleEscapeKey = (event) => {
      if (event.key === "Escape") {
        setSearchExpanded(false);
        setSearchTerm("");
        setSearchResults(null);
      }
    };

    if (isSearchExpanded) {
      document.addEventListener("mousedown", handleOutsideClick);
      document.addEventListener("keydown", handleEscapeKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [isSearchExpanded]);

  // --- Debounced Search Logic (from Explorer.js) ---
  useEffect(() => {
    if (searchTerm.trim() === "") {
      setSearchResults(null);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsSearching(true);
      try {
        const [explorerRes, tagsRes] = await Promise.all([
          apiClient.get("/explorer/search/", {
            params: { q: searchTerm, limit: 8 },
          }),
          apiClient
            .get("/tags/", { params: { search: searchTerm, limit: 8 } })
            .catch(() => null),
        ]);
        const explorerData = explorerRes?.data || {
          courses: [],
          lessons: [],
          quizzes: [],
          guides: [],
          users: [],
        };
        const tagsData = tagsRes
          ? Array.isArray(tagsRes.data)
            ? tagsRes.data
            : tagsRes.data?.results || []
          : [];
        setSearchResults({ ...explorerData, tags: tagsData });
      } catch (error) {
        console.error("Homepage search error:", error);
        setSearchResults({
          courses: [],
          lessons: [],
          quizzes: [],
          guides: [],
          users: [],
          tags: [],
        });
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, token]);

  // --- State Declarations ---
  const [latestPosts, setLatestPosts] = useState([]);
  const [randomCourses, setRandomCourses] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [errorDiscover, setErrorDiscover] = useState("");

  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState(true);
  const [errorEnrolled, setErrorEnrolled] = useState("");

  const [latestQuizAttempts, setLatestQuizAttempts] = useState([]);
  const [loadingQuizAttempts, setLoadingQuizAttempts] = useState(true);
  const [errorQuizAttempts, setErrorQuizAttempts] = useState("");

  const [latestLessons, setLatestLessons] = useState([]);
  const [loadingLessons, setLoadingLessons] = useState(true);
  const [errorLessons, setErrorLessons] = useState("");

  // --- Data Fetching Effects ---
  const handleApiError = useCallback(
    (err, setErrorState, defaultMessage) => {
      console.error(
        "API Error:",
        err.response ? err.response.data : err.message
      );
      let message = defaultMessage;
      if (err.response) {
        if (err.response.status === 401 || err.response.status === 403) {
          message = "Session expired. Please log in again.";
          logout();
        } else if (err.response.data?.detail) {
          message = err.response.data.detail;
        } else if (
          typeof err.response.data === "string" &&
          err.response.data.length < 100
        ) {
          message = err.response.data;
        }
      } else if (err.message) {
        message = err.message;
      }
      setErrorState(message);
    },
    [logout]
  );

  // Fetch public content for non-authenticated users
  useEffect(() => {
    if (token) return; // Skip if authenticated
    const fetchPublicContent = async () => {
      setLoadingPublic(true);
      try {
        const [coursesRes, lessonsRes, quizzesRes] = await Promise.all([
          apiClient.get("/courses/?random=6").catch(() => ({ data: [] })),
          apiClient
            .get("/lessons/?ordering=-created_at&limit=6")
            .catch(() => ({ data: [] })),
          apiClient
            .get("/quizzes/?ordering=-created_at&limit=6")
            .catch(() => ({ data: [] })),
        ]);
        setPublicCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
        setPublicLessons(Array.isArray(lessonsRes.data) ? lessonsRes.data : []);
        setPublicQuizzes(Array.isArray(quizzesRes.data) ? quizzesRes.data : []);
      } catch (err) {
        console.error("Error fetching public content:", err);
      } finally {
        setLoadingPublic(false);
      }
    };
    fetchPublicContent();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const fetchDiscoverContent = async () => {
      setLoadingDiscover(true);
      setErrorDiscover("");
      try {
        const [postsRes, coursesRes] = await Promise.all([
          apiClient.get("/posts/?ordering=-created_at&limit=4"),
          apiClient.get("/courses/?random=4"),
        ]);
        setLatestPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
        setRandomCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
      } catch (err) {
        handleApiError(
          err,
          setErrorDiscover,
          "Could not load discover content."
        );
        setLatestPosts([]);
        setRandomCourses([]);
      } finally {
        setLoadingDiscover(false);
      }
    };
    fetchDiscoverContent();
  }, [token, handleApiError]);

  useEffect(() => {
    if (!token) return;
    const fetchEnrolledCourses = async () => {
      setLoadingEnrolled(true);
      setErrorEnrolled("");
      try {
        const response = await apiClient.get(
          "/enrollment/user/?ordering=-enrollment_date&limit=3"
        );
        if (Array.isArray(response.data)) {
          setEnrolledCourses(response.data);
        } else {
          setEnrolledCourses([]);
          setErrorEnrolled("Unexpected data format for enrolled courses.");
        }
      } catch (err) {
        handleApiError(
          err,
          setErrorEnrolled,
          "Failed to load enrolled courses preview."
        );
        setEnrolledCourses([]);
      } finally {
        setLoadingEnrolled(false);
      }
    };
    fetchEnrolledCourses();
  }, [token, handleApiError]);

  useEffect(() => {
    if (!token) return;
    const fetchQuizAttempts = async () => {
      setLoadingQuizAttempts(true);
      setErrorQuizAttempts("");
      try {
        // TEMPORARILY DISABLED: /api/events/ endpoint not implemented yet
        // const res = await apiClient.get(
        //   "/events/?event_type=quiz_answer_submitted&ordering=-timestamp"
        // );
        // if (!Array.isArray(res.data)) {
        //   setErrorQuizAttempts("Unexpected data format for quiz attempts.");
        //   setLatestQuizAttempts([]);
        //   return;
        // }

        // Mock empty response for now
        setLatestQuizAttempts([]);
        setLoadingQuizAttempts(false);
        return;
        const grouped = res.data.reduce((acc, event) => {
          const quizId = event.object_id;
          if (!quizId) return acc;
          if (!acc[quizId]) {
            acc[quizId] = {
              events: [],
              quiz_title: event.quiz_title || `Quiz ${quizId}`,
              quizId,
            };
          }
          acc[quizId].events.push(event);
          return acc;
        }, {});
        let aggregated = Object.values(grouped).map(
          ({ events, quiz_title, quizId }) => {
            const total = events.length;
            const correct = events.filter((e) => e.metadata?.is_correct).length;
            const latestTimestamp = events
              .map((e) => new Date(e.timestamp))
              .sort((a, b) => b - a)[0]
              .toISOString();
            return {
              quizId,
              quiz_title,
              total,
              correct,
              wrong: total - correct,
              timestamp: latestTimestamp,
            };
          }
        );
        aggregated = aggregated
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, 3);
        const withPermalinks = await Promise.all(
          aggregated.map(async (item) => {
            try {
              const quizRes = await apiClient.get(`/quizzes/${item.quizId}/`);
              return { ...item, permalink: quizRes.data.permalink };
            } catch {
              return { ...item, permalink: null };
            }
          })
        );
        setLatestQuizAttempts(withPermalinks);
      } catch (err) {
        handleApiError(
          err,
          setErrorQuizAttempts,
          "Failed to fetch quiz attempts."
        );
        setLatestQuizAttempts([]);
      } finally {
        setLoadingQuizAttempts(false);
      }
    };
    fetchQuizAttempts();
  }, [token, handleApiError]);

  useEffect(() => {
    if (!token) return;
    const fetchRecentLessonCompletions = async () => {
      setLoadingLessons(true);
      setErrorLessons("");
      try {
        const response = await apiClient.get("/lessons/completed/recent/");
        if (Array.isArray(response.data)) {
          const lessons = response.data
            .map((completion) => completion.lesson)
            .filter((lesson) => lesson)
            .slice(0, 3);
          setLatestLessons(lessons);
        } else {
          setLatestLessons([]);
          setErrorLessons("Unexpected data format for completed lessons.");
        }
      } catch (err) {
        handleApiError(err, setErrorLessons, "Failed to load recent lessons.");
        setLatestLessons([]);
      } finally {
        setLoadingLessons(false);
      }
    };
    fetchRecentLessonCompletions();
  }, [token, handleApiError]);

  // --- Render Logic ---
  if (!user && token) {
    return (
      <div className={styles.pageContainer}>
        <div className={styles.fullPageLoader}>
          <LoadingPlaceholder message="Initializing Dashboard..." />
        </div>
      </div>
    );
  }

  // Marketing homepage for non-authenticated users
  if (!user) {
    return (
      <div className={styles.marketingContainer}>
        <LoginModal
          open={loginModalOpen}
          onClose={() => setLoginModalOpen(false)}
        />

        {/* Language Switcher - Top Right */}
        <div className={styles.languageSwitcherWrapper}>
          <LanguageSwitcher />
        </div>

        {/* NEW HERO: Expandable Center Hexagon */}
        <section className={styles.landingHeroSection}>
          <div className={styles.landingHeroContent}>
            {/* Text & CTA - Fades out when expanded */}
            <div
              className={`${styles.landingIntroText} ${
                heroExpanded ? styles.heroFaded : ""
              }`}
            >
              <h1 className={styles.landingHeroTitle}>
                {t("landing.heroTitle")}
              </h1>
              <p className={styles.landingHeroSubtitle}>
                {t("landing.heroSubtitle")}
              </p>

              {/* CTA Buttons */}
              <div className={styles.landingCtaButtons}>
                <button
                  className={styles.landingCtaPrimary}
                  onClick={() => router.push("/register")}
                >
                  {t("landing.getStarted")}
                </button>
                <button
                  className={styles.landingCtaSecondary}
                  onClick={() => router.push("/login")}
                >
                  {t("landing.loginButton")}
                </button>
              </div>
            </div>

            {/* Center Expandable Hexagon - Moves to center/overlays when expanded */}
            <div
              className={`${styles.landingHexagonWrapper} ${
                heroExpanded ? styles.wrapperExpanded : ""
              }`}
            >
              {heroExpanded && (
                <svg className={styles.connectionSvg} viewBox="0 0 600 450">
                  <defs>
                    <linearGradient
                      id="grad1"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="0%"
                    >
                      <stop
                        offset="0%"
                        style={{
                          stopColor: "var(--zporta-gold)",
                          stopOpacity: 0.2,
                        }}
                      />
                      <stop
                        offset="100%"
                        style={{
                          stopColor: "var(--zporta-gold)",
                          stopOpacity: 0.8,
                        }}
                      />
                    </linearGradient>
                  </defs>
                  {/* Circuit-style paths connecting center (300,225) to nodes */}
                  {/* Top (Mentorship) */}
                  <path
                    d="M300,225 L300,25"
                    className={styles.connectionPath}
                  />
                  {/* Top Right (Study) */}
                  <path
                    d="M300,225 L515,105"
                    className={styles.connectionPath}
                    style={{ animationDelay: "0.1s" }}
                  />
                  {/* Bottom Right (Compare) */}
                  <path
                    d="M300,225 L515,345"
                    className={styles.connectionPath}
                    style={{ animationDelay: "0.2s" }}
                  />
                  {/* Bottom (Community) */}
                  <path
                    d="M300,225 L300,425"
                    className={styles.connectionPath}
                    style={{ animationDelay: "0.3s" }}
                  />
                  {/* Bottom Left (Progress) */}
                  <path
                    d="M300,225 L85,345"
                    className={styles.connectionPath}
                    style={{ animationDelay: "0.4s" }}
                  />
                  {/* Top Left (Certificates) */}
                  <path
                    d="M300,225 L85,105"
                    className={styles.connectionPath}
                    style={{ animationDelay: "0.5s" }}
                  />
                </svg>
              )}

              <button
                className={`${styles.landingCenterHexagon} ${
                  heroExpanded ? styles.landingHexagonExpanded : ""
                }`}
                onClick={() => setHeroExpanded(!heroExpanded)}
                aria-label="Explore learning features"
                aria-expanded={heroExpanded}
              >
                <FaBrain
                  size="3em"
                  className={`${styles.landingHexIcon} ${
                    heroExpanded ? styles.landingHexIconActive : ""
                  }`}
                />
                <span className={styles.landingHexLabel}>Explore</span>
              </button>

              {/* 6 Surrounding Feature Hexagons (appear when expanded) */}
              {heroExpanded && (
                <>
                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex1}`}
                    onClick={() => router.push("/register/mentorship")}
                    aria-label={t("nav.mentorship")}
                  >
                    <FaUserFriends
                      size="2em"
                      className={styles.landingHexIcon}
                    />
                    <span className={styles.landingHexLabel}>
                      {t("nav.mentorship")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.mentorship.title")}</h4>
                      <p>{t("landing.features.mentorship.description")}</p>
                    </div>
                  </button>

                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex2}`}
                    onClick={() => router.push("/register/study-track")}
                    aria-label={t("nav.studyTrack")}
                  >
                    <FaBook size="2em" className={styles.landingHexIcon} />
                    <span className={styles.landingHexLabel}>
                      {t("nav.studyTrack")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.studyTrack.title")}</h4>
                      <p>{t("landing.features.studyTrack.description")}</p>
                    </div>
                  </button>

                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex3}`}
                    onClick={() => router.push("/register/compare-skills")}
                    aria-label={t("nav.compareSkills")}
                  >
                    <FaFilter size="2em" className={styles.landingHexIcon} />
                    <span className={styles.landingHexLabel}>
                      {t("nav.compareSkills")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.compareSkills.title")}</h4>
                      <p>{t("landing.features.compareSkills.description")}</p>
                    </div>
                  </button>

                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex4}`}
                    onClick={() => router.push("/register/community")}
                    aria-label={t("nav.community")}
                  >
                    <FaRocket size="2em" className={styles.landingHexIcon} />
                    <span className={styles.landingHexLabel}>
                      {t("nav.community")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.community.title")}</h4>
                      <p>{t("landing.features.community.description")}</p>
                    </div>
                  </button>

                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex5}`}
                    onClick={() => router.push("/register/progress")}
                    aria-label={t("nav.progress")}
                  >
                    <FaCheckCircle
                      size="2em"
                      className={styles.landingHexIcon}
                    />
                    <span className={styles.landingHexLabel}>
                      {t("nav.progress")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.progress.title")}</h4>
                      <p>{t("landing.features.progress.description")}</p>
                    </div>
                  </button>

                  <button
                    className={`${styles.landingFeatureHexagon} ${styles.landingFeatureHex6}`}
                    onClick={() => router.push("/register/certificates")}
                    aria-label={t("nav.certificates")}
                  >
                    <FaGraduationCap
                      size="2em"
                      className={styles.landingHexIcon}
                    />
                    <span className={styles.landingHexLabel}>
                      {t("nav.certificates")}
                    </span>
                    <div className={styles.hexPopover}>
                      <h4>{t("landing.features.certificates.title")}</h4>
                      <p>{t("landing.features.certificates.description")}</p>
                    </div>
                  </button>
                </>
              )}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS Section */}
        <section className={styles.landingHowItWorks}>
          <h2>{t("landing.howItWorks.title")}</h2>
          <div className={styles.landingStepsGrid}>
            <div className={styles.landingStep}>
              <div className={styles.landingStepNumber}>1</div>
              <h3>{t("landing.howItWorks.step1Title")}</h3>
              <p>{t("landing.howItWorks.step1Desc")}</p>
            </div>
            <div className={styles.landingStep}>
              <div className={styles.landingStepNumber}>2</div>
              <h3>{t("landing.howItWorks.step2Title")}</h3>
              <p>{t("landing.howItWorks.step2Desc")}</p>
            </div>
            <div className={styles.landingStep}>
              <div className={styles.landingStepNumber}>3</div>
              <h3>{t("landing.howItWorks.step3Title")}</h3>
              <p>{t("landing.howItWorks.step3Desc")}</p>
            </div>
          </div>
        </section>

        {/* FEATURED CONTENT Preview */}
        <section className={styles.landingFeaturedSection}>
          <h2>{t("landing.whatYouWillLearn.title")}</h2>
          <div className={styles.landingFeaturePreviewGrid}>
            {/* Sample Lesson Card */}
            <div className={styles.landingPreviewCard}>
              <div className={styles.landingPreviewHeader}>
                <FaBook className={styles.landingPreviewIcon} />
                <span className={styles.landingPreviewBadge}>
                  {t("landing.whatYouWillLearn.lessonLabel")}
                </span>
              </div>
              <h3>{t("samples.jsPatterns.title")}</h3>
              <p className={styles.landingPreviewDes}>
                {t("samples.jsPatterns.description")}
              </p>
              <div className={styles.landingPreviewMeta}>
                <span>
                  {t("landing.whatYouWillLearn.minRead", { minutes: 12 })}
                </span>
                <span>{t("landing.whatYouWillLearn.intermediate")}</span>
              </div>
            </div>

            {/* Sample Quiz Card */}
            <div className={styles.landingPreviewCard}>
              <div className={styles.landingPreviewHeader}>
                <FaBrain className={styles.landingPreviewIcon} />
                <span className={styles.landingPreviewBadge}>
                  {t("landing.whatYouWillLearn.quizLabel")}
                </span>
              </div>
              <h3>{t("samples.reactHooks.title")}</h3>
              <p className={styles.landingPreviewDes}>
                {t("samples.reactHooks.description")}
              </p>
              <div className={styles.landingPreviewMeta}>
                <span>
                  {t("landing.whatYouWillLearn.questionsCount", { count: 15 })}
                </span>
                <span>{t("landing.whatYouWillLearn.advanced")}</span>
              </div>
            </div>

            {/* Sample Path Card */}
            <div className={styles.landingPreviewCard}>
              <div className={styles.landingPreviewHeader}>
                <FaRocket className={styles.landingPreviewIcon} />
                <span className={styles.landingPreviewBadge}>
                  {t("landing.whatYouWillLearn.pathLabel")}
                </span>
              </div>
              <h3>{t("samples.fullStack.title")}</h3>
              <p className={styles.landingPreviewDes}>
                {t("samples.fullStack.description")}
              </p>
              <div className={styles.landingPreviewMeta}>
                <span>
                  {t("landing.whatYouWillLearn.lessonsCount", { count: 24 })}
                </span>
                <span>{t("landing.whatYouWillLearn.beginnerFriendly")}</span>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST SIGNALS Section */}
        <section className={styles.landingTrustSection}>
          <h2>{t("landing.whyJoin.title")}</h2>
          <div className={styles.landingTrustGrid}>
            <div className={styles.landingTrustItem}>
              <div className={styles.landingTrustIcon}>🔒</div>
              <h3>{t("landing.whyJoin.securePrivateTitle")}</h3>
              <p>{t("landing.whyJoin.securePrivateDesc")}</p>
            </div>
            <div className={styles.landingTrustItem}>
              <div className={styles.landingTrustIcon}>👥</div>
              <h3>{t("landing.whyJoin.vibrantCommunityTitle")}</h3>
              <p>{t("landing.whyJoin.vibrantCommunityDesc")}</p>
            </div>
            <div className={styles.landingTrustItem}>
              <div className={styles.landingTrustIcon}>🏆</div>
              <h3>{t("landing.whyJoin.verifiedCertificatesTitle")}</h3>
              <p>{t("landing.whyJoin.verifiedCertificatesDesc")}</p>
            </div>
            <div className={styles.landingTrustItem}>
              <div className={styles.landingTrustIcon}>⚡</div>
              <h3>{t("landing.whyJoin.learnAtYourPaceTitle")}</h3>
              <p>{t("landing.whyJoin.learnAtYourPaceDesc")}</p>
            </div>
          </div>
        </section>

        {/* FINAL CTA Section */}
        <section className={styles.landingFinalCta}>
          <h2>{t("landing.ctaTitle")}</h2>
          <p>{t("landing.ctaSubtitle")}</p>
          <button
            className={styles.landingCtaPrimary}
            onClick={() => router.push("/register")}
          >
            {t("landing.createFreeAccount")}
          </button>
        </section>
      </div>
    );
  }

  const userRole = user.profile?.role || "explorer";
  const showStudentSections = userRole === "explorer" || userRole === "both";
  const showTeacherSections = userRole === "guide" || userRole === "both";

  const hasAnyResults =
    searchResults &&
    Object.values(searchResults).some(
      (arr) => Array.isArray(arr) && arr.length > 0
    );

  return (
    <div className={styles.pageContainer}>
      <section className={styles.hexagonSection} ref={hexagonSectionRef}>
        <div
          className={`${styles.hexagonContainer} ${
            isSearchExpanded ? styles.searchExpanded : ""
          }`}
        >
          <Link
            href="/study/dashboard"
            className={`${styles.hexagon} ${styles.hex1}`}
          >
            <FaRocket size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.aiDashboard")}</span>
          </Link>

          <Link href="/setup" className={`${styles.hexagon} ${styles.hex2}`}>
            <FaFilter size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.setup")}</span>
          </Link>

          <Link href="/learn" className={`${styles.hexagon} ${styles.hex3}`}>
            <FaBook size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.coursesLessons")}</span>
          </Link>

          <div
            ref={searchHexagonRef}
            className={`${styles.hexagon} ${styles.hex4} ${
              styles.searchHexagon
            } ${isSearchExpanded ? styles.expanded : ""}`}
            onClick={() => !isSearchExpanded && setSearchExpanded(true)}
          >
            <div className={styles.searchInputWrapper}>
              <FaSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder={t("search.searchPlaceholder")}
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchExpanded(true)}
              />
            </div>
            {isSearchExpanded && searchTerm.trim() && (
              <div className={styles.searchDropdown}>
                {isSearching && (
                  <LoadingPlaceholder message={t("common.loading")} />
                )}
                {!isSearching && !hasAnyResults && (
                  <EmptyState
                    message={`${t("search.noResults")} "${searchTerm}"`}
                  />
                )}
                {!isSearching &&
                  hasAnyResults &&
                  Object.entries(searchResults).map(
                    ([category, results]) =>
                      results.length > 0 && (
                        <SearchBlock
                          key={category}
                          title={category}
                          items={results}
                        />
                      )
                  )}
              </div>
            )}
          </div>
          <Link
            href="/learn/?tab=quizzes"
            className={`${styles.hexagon} ${styles.hex5}`}
          >
            <FaBrain size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.quizzes")}</span>
          </Link>
          <Link
            href="/learn/?tab=guides"
            className={`${styles.hexagon} ${styles.hex6}`}
          >
            <FaClipboardList size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.guides")}</span>
          </Link>
          <Link href="/posts" className={`${styles.hexagon} ${styles.hex7}`}>
            <FaNewspaper size="2em" className={styles.icon} />
            <span className={styles.label}>{t("nav.posts")}</span>
          </Link>
        </div>
      </section>

      <div className={styles.homeWrapper}>
        <header className={styles.homeHeader}>
          <button
            className={styles.startPlanButton}
            onClick={() => router.push("/analytics")}
          >
            <span className={styles.startPlanIcon}>
              <FaRocket />
            </span>
            {showTeacherSections && !showStudentSections
              ? t("dashboard.teacherDashboard")
              : t("dashboard.studyPlan")}
          </button>
        </header>

        <main className={styles.homeContentGrid}>
          {showStudentSections && (
            <>
              <div className={styles.dashboardCard}>
                <h2>{t("dashboard.yourCourses")}</h2>
                {loadingEnrolled ? (
                  <LoadingPlaceholder />
                ) : errorEnrolled ? (
                  <ErrorMessage message={errorEnrolled} />
                ) : enrolledCourses.length > 0 ? (
                  <div className={styles.enrolledPreviewList}>
                    {enrolledCourses.map(
                      (enrollment) =>
                        enrollment?.course && (
                          <div
                            key={enrollment.id}
                            className={styles.enrolledPreviewItem}
                            onClick={() =>
                              router.push(`/courses/enrolled/${enrollment.id}`)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ")
                                router.push(
                                  `/courses/enrolled/${enrollment.id}`
                                );
                            }}
                            aria-label={`Go to course: ${
                              enrollment.course.title || "Untitled Course"
                            }`}
                          >
                            {enrollment.course.cover_image ? (
                              <img
                                src={enrollment.course.cover_image}
                                alt=""
                                className={styles.enrolledPreviewThumb}
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                }}
                              />
                            ) : (
                              <div
                                className={`${styles.enrolledPreviewThumb} ${styles.placeholderThumb}`}
                              >
                                <FaChalkboardTeacher />
                              </div>
                            )}
                            <div className={styles.enrolledPreviewDetails}>
                              <h3>
                                {enrollment.course.title || "Untitled Course"}
                              </h3>
                              {enrollment.progress !== null &&
                                enrollment.progress >= 0 && (
                                  <div className={styles.progressWrapper}>
                                    <div
                                      className={styles.progressBarContainer}
                                    >
                                      <div
                                        className={styles.progressBar}
                                        style={{
                                          width: `${enrollment.progress}%`,
                                        }}
                                        aria-valuenow={enrollment.progress}
                                        aria-valuemin="0"
                                        aria-valuemax="100"
                                      ></div>
                                    </div>
                                    <span className={styles.progressText}>
                                      {enrollment.progress}%
                                    </span>
                                  </div>
                                )}
                            </div>
                          </div>
                        )
                    )}
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noCourses")} />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/enrolled-courses")}
                >
                  {t("dashboard.seeAllCourses")}
                </button>
              </div>

              <div className={styles.dashboardCard}>
                <h2>{t("dashboard.yourLessons")}</h2>
                {loadingLessons ? (
                  <LoadingPlaceholder />
                ) : errorLessons ? (
                  <ErrorMessage message={errorLessons} />
                ) : latestLessons.length > 0 ? (
                  <div className={styles.lessonHistoryPreview}>
                    {latestLessons.map(
                      (lesson) =>
                        lesson?.id &&
                        lesson?.permalink && (
                          <div
                            key={lesson.id}
                            className={styles.lessonHistoryItem}
                            onClick={() =>
                              router.push(`/lessons/${lesson.permalink}`)
                            }
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) =>
                              (e.key === "Enter" || e.key === " ") &&
                              router.push(`/lessons/${lesson.permalink}`)
                            }
                            aria-label={`Go to lesson: ${
                              lesson.title || "Untitled Lesson"
                            }`}
                          >
                            <div className={styles.lessonHistoryIcon}>
                              <FaBookOpen />
                            </div>
                            <div className={styles.lessonHistoryDetails}>
                              <h3>{lesson.title || "Untitled Lesson"}</h3>
                              {lesson.course_title && (
                                <p className={styles.lessonCourseContext}>
                                  {lesson.course_title}
                                </p>
                              )}
                            </div>
                          </div>
                        )
                    )}
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noRecentLessons")} />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/lessons/completed")}
                >
                  {t("common.viewMore")}
                </button>
              </div>

              <div className={styles.dashboardCard}>
                <h2>{t("dashboard.yourQuizzes")}</h2>
                {loadingQuizAttempts ? (
                  <LoadingPlaceholder />
                ) : errorQuizAttempts ? (
                  <ErrorMessage message={errorQuizAttempts} />
                ) : latestQuizAttempts.length > 0 ? (
                  <div className={styles.quizAttemptsPreview}>
                    {latestQuizAttempts.map(
                      (attempt) =>
                        attempt?.quizId && (
                          <Link
                            key={attempt.quizId}
                            className={styles.quizAttemptItem}
                            href={
                              attempt.permalink
                                ? quizPermalinkToUrl(attempt.permalink)
                                : "#"
                            }
                            aria-label={`View quiz: ${
                              attempt.quiz_title || `Quiz ${attempt.quizId}`
                            }`}
                          >
                            <div className={styles.attemptInfo}>
                              <span className={styles.attemptQuiz}>
                                {attempt.quiz_title || `Quiz ${attempt.quizId}`}
                              </span>
                              <span className={styles.attemptDate}>
                                {new Date(
                                  attempt.timestamp
                                ).toLocaleDateString()}
                              </span>
                            </div>
                            <div className={styles.attemptStats}>
                              <span title={`${attempt.correct} Correct`}>
                                <FaCheckCircle
                                  className={styles.statIconCorrect}
                                />{" "}
                                {attempt.correct}
                              </span>
                              <span title={`${attempt.wrong} Incorrect`}>
                                <FaTimesCircle
                                  className={styles.statIconIncorrect}
                                />{" "}
                                {attempt.wrong}
                              </span>
                              <span title={`${attempt.total} Total Questions`}>
                                <FaEllipsisH /> {attempt.total}
                              </span>
                            </div>
                          </Link>
                        )
                    )}
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noRecentQuizzes")} />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/analytics")}
                >
                  {t("dashboard.seeAllAnalytics")}
                </button>
              </div>
            </>
          )}

          {showTeacherSections && (
            <>
              <div className={styles.dashboardCard}>
                <h2>{t("dashboard.teacherDashboardTitle")}</h2>
                <p>{t("dashboard.teacherDashboardDesc")}</p>
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/teacher-dashboard")}
                >
                  {t("dashboard.teacherDashboard")}
                </button>
              </div>
              <div className={styles.dashboardCard}>
                <h2>{t("dashboard.studentInquiries")}</h2>
                {inquiriesLoading ? (
                  <LoadingPlaceholder
                    message={t("dashboard.loadingInquiries")}
                  />
                ) : inquiries && inquiries.length > 0 ? (
                  <div className={styles.inquiryList}>
                    {inquiries.map((inquiry) => (
                      <div key={inquiry.id} className={styles.inquiryItem}>
                        <h4>{inquiry.title}</h4>
                        <p>{inquiry.message}</p>
                        <small>{formatDate(inquiry.created_at)}</small>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState message={t("dashboard.noInquiries")} />
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
};

// Helper for the dropdown
const SearchBlock = ({ title, items }) => {
  const [expanded, setExpanded] = useState(false);
  if (!items || items.length === 0) return null;

  // Sort by newest first (created_at, or fallback to id)
  const sortedItems = [...items].sort((a, b) => {
    const dateA = a.created_at ? new Date(a.created_at) : new Date(0);
    const dateB = b.created_at ? new Date(b.created_at) : new Date(0);
    return dateB - dateA;
  });

  const displayLimit = expanded ? sortedItems.length : 4;
  const displayItems = sortedItems.slice(0, displayLimit);
  const hasMore = sortedItems.length > 4;

  const makeHref = (item) => {
    const type = title.toLowerCase();
    switch (type) {
      case "quizzes":
        return item.permalink ? quizPermalinkToUrl(item.permalink) : "#";
      case "guides":
      case "users":
        return item.username ? `/users/${item.username}` : "#";
      case "tags":
        return item.slug ? `/tags/${item.slug}` : "#";
      default:
        return `/${type}/${item.permalink || item.id}`;
    }
  };
  const seeAllHref = () => {
    const type = title.toLowerCase();
    if (type === "tags") return "/tags";
    if (type === "users" || type === "guides") return "/explorer";
    return `/learn?tab=${type}`;
  };

  return (
    <div className={styles.searchBlock}>
      <div className={styles.searchBlockHeaderRow}>
        <h4 className={styles.searchBlockHeader}>
          {title} ({sortedItems.length})
        </h4>
        <Link href={seeAllHref()} className={styles.seeAllLink}>
          See all
        </Link>
      </div>
      <ul className={styles.searchBlockList}>
        {displayItems.map((item) => (
          <li key={`${title}-${item.id || item.slug || item.username}`}>
            <Link href={makeHref(item)} className={styles.searchBlockLink}>
              <span className={styles.typeBadge}>{title}</span>
              <span>
                {item.title ||
                  item.name ||
                  item.full_name ||
                  item.username ||
                  `Item #${item.id}`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          className={styles.showMoreButton}
          onClick={(e) => {
            e.preventDefault();
            setExpanded(!expanded);
          }}
        >
          {expanded ? "Show less" : `Show ${sortedItems.length - 4} more`}
        </button>
      )}
      <Footer />
    </div>
  );
};

export default HomePage;
