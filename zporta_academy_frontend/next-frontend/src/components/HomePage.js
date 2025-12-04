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
import apiClient from "@/api";
import styles from "@/styles/HomePage.module.css";
import { quizPermalinkToUrl } from "@/utils/urls";
import LoginModal from "@/components/LoginModal";

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
  const hexagonSectionRef = useRef(null);
  const searchHexagonRef = useRef(null);

  const [isSearchExpanded, setSearchExpanded] = useState(false);

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
  }, []);

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
        const res = await apiClient.get(
          "/events/?event_type=quiz_answer_submitted&ordering=-timestamp"
        );
        if (!Array.isArray(res.data)) {
          setErrorQuizAttempts("Unexpected data format for quiz attempts.");
          setLatestQuizAttempts([]);
          return;
        }
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

        <section className={styles.heroSection}>
          <h1 className={styles.heroTitle}>Welcome to Zporta Academy</h1>
          <p className={styles.heroSubtitle}>
            Learn anything, anywhere. Start your journey today.
          </p>
          <div className={styles.heroCta}>
            <button
              className={styles.ctaPrimary}
              onClick={() => setLoginModalOpen(true)}
            >
              Get Started
            </button>
            <button
              className={styles.ctaSecondary}
              onClick={() => setLoginModalOpen(true)}
            >
              Sign In
            </button>
          </div>
        </section>

        {loadingPublic ? (
          <div className={styles.loadingSection}>
            <LoadingPlaceholder message="Loading content..." />
          </div>
        ) : (
          <>
            {publicCourses.length > 0 && (
              <section className={styles.contentSection}>
                <h2 className={styles.sectionTitle}>
                  <FaBook /> Explore Courses
                </h2>
                <div className={styles.cardGrid}>
                  {publicCourses.map((course) => (
                    <div
                      key={course.id}
                      className={styles.contentCard}
                      onClick={() => setLoginModalOpen(true)}
                    >
                      {course.cover_image && (
                        <div className={styles.cardImage}>
                          <img src={course.cover_image} alt={course.title} />
                        </div>
                      )}
                      <div className={styles.cardBody}>
                        <h3>{course.title}</h3>
                        <p className={styles.cardMeta}>
                          {course.created_by && `By ${course.created_by}`}
                        </p>
                        <button className={styles.cardBtn}>View Course</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {publicLessons.length > 0 && (
              <section className={styles.contentSection}>
                <h2 className={styles.sectionTitle}>
                  <FaGraduationCap /> Recent Lessons
                </h2>
                <div className={styles.cardGrid}>
                  {publicLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className={styles.contentCard}
                      onClick={() => setLoginModalOpen(true)}
                    >
                      <div className={styles.cardBody}>
                        <h3>{lesson.title}</h3>
                        <p className={styles.cardMeta}>
                          {lesson.created_by && `By ${lesson.created_by}`}
                        </p>
                        {lesson.is_premium && (
                          <span className={styles.premiumBadge}>Premium</span>
                        )}
                        <button className={styles.cardBtn}>
                          Start Learning
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {publicQuizzes.length > 0 && (
              <section className={styles.contentSection}>
                <h2 className={styles.sectionTitle}>
                  <FaBrain /> Practice Quizzes
                </h2>
                <div className={styles.cardGrid}>
                  {publicQuizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className={styles.contentCard}
                      onClick={() => setLoginModalOpen(true)}
                    >
                      <div className={styles.cardBody}>
                        <h3>{quiz.title}</h3>
                        <p className={styles.cardMeta}>
                          {quiz.created_by && `By ${quiz.created_by}`}
                        </p>
                        <button className={styles.cardBtn}>Take Quiz</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section className={styles.ctaSection}>
          <h2>Ready to start learning?</h2>
          <button
            className={styles.ctaPrimary}
            onClick={() => setLoginModalOpen(true)}
          >
            Join Zporta Academy
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
            <span className={styles.label}>AI Dashboard</span>
          </Link>

          <Link href="/setup" className={`${styles.hexagon} ${styles.hex2}`}>
            <FaFilter size="2em" className={styles.icon} />
            <span className={styles.label}>Setup</span>
          </Link>

          <Link href="/learn" className={`${styles.hexagon} ${styles.hex3}`}>
            <FaBook size="2em" className={styles.icon} />
            <span className={styles.label}>Courses / Lessons</span>
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
                placeholder="Search..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onFocus={() => setSearchExpanded(true)}
              />
            </div>
            {isSearchExpanded && searchTerm.trim() && (
              <div className={styles.searchDropdown}>
                {isSearching && <LoadingPlaceholder message="Searching..." />}
                {!isSearching && !hasAnyResults && (
                  <EmptyState message={`No results for "${searchTerm}"`} />
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
            <span className={styles.label}>Quizzes</span>
          </Link>
          <Link
            href="/learn/?tab=guides"
            className={`${styles.hexagon} ${styles.hex6}`}
          >
            <FaClipboardList size="2em" className={styles.icon} />
            <span className={styles.label}>Guides</span>
          </Link>
          <Link href="/posts" className={`${styles.hexagon} ${styles.hex7}`}>
            <FaNewspaper size="2em" className={styles.icon} />
            <span className={styles.label}>Posts</span>
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
              ? "Go to Teacher Dashboard"
              : "Review Your Study Plan"}
          </button>
        </header>

        <main className={styles.homeContentGrid}>
          {showStudentSections && (
            <>
              <div className={styles.dashboardCard}>
                <h2>Your Courses</h2>
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
                  <EmptyState message="You haven't enrolled in any courses yet. Explore some now!" />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/enrolled-courses")}
                >
                  See All Your Courses
                </button>
              </div>

              <div className={styles.dashboardCard}>
                <h2>Recently Completed Lessons</h2>
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
                  <EmptyState message="No recently completed lessons to show." />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/lessons/completed")}
                >
                  View All Completed
                </button>
              </div>

              <div className={styles.dashboardCard}>
                <h2>Recent Quizzes</h2>
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
                  <EmptyState message="No recent quiz attempts found." />
                )}
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/analytics")}
                >
                  See All Analytics & Statistics
                </button>
              </div>
            </>
          )}

          {showTeacherSections && (
            <>
              <div className={styles.dashboardCard}>
                <h2>Teacher Dashboard</h2>
                <p>
                  Access tools to manage your courses, lessons, and student
                  interactions.
                </p>
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/teacher-dashboard")}
                >
                  Go to Teacher Dashboard
                </button>
              </div>
              <div className={styles.dashboardCard}>
                <h2>Student Inquiries</h2>
                <p>Review and respond to questions from your students.</p>
                <button
                  className={styles.cardActionButton}
                  onClick={() => router.push("/teacher-questions")}
                >
                  View Student Questions
                </button>
              </div>
            </>
          )}

          {loadingDiscover ? (
            <div
              className={`${styles.discoverSection} ${styles.discoverSectionLoading}`}
            >
              {" "}
              <LoadingPlaceholder message="Loading new content..." />{" "}
            </div>
          ) : errorDiscover ? (
            <div
              className={`${styles.discoverSection} ${styles.discoverSectionError}`}
            >
              {" "}
              <ErrorMessage message={errorDiscover} />{" "}
            </div>
          ) : latestPosts.length > 0 || randomCourses.length > 0 ? (
            <>
              {latestPosts.length > 0 && (
                <section className={styles.discoverSection}>
                  <div className={styles.discoverHeader}>
                    <h3>Recent Posts from Zporta</h3>
                    <Link href="/posts" className={styles.discoverSeeAllBtn}>
                      See All Posts
                    </Link>
                  </div>
                  <div className={styles.discoverGrid}>
                    {latestPosts.map(
                      (post) =>
                        post && (
                          <Link
                            href={
                              post.permalink ? `/posts/${post.permalink}` : "#"
                            }
                            key={post.id}
                            className={styles.discoverCardLink}
                          >
                            {post.og_image_url ? (
                              <img
                                src={post.og_image_url}
                                alt=""
                                className={styles.discoverImage}
                                loading="lazy"
                                onError={(e) =>
                                  (e.target.style.display = "none")
                                }
                              />
                            ) : (
                              <div className={styles.discoverPlaceholder}>
                                <FaNewspaper />
                              </div>
                            )}
                            <div className={styles.discoverInfo}>
                              <h4>{post.title || "Untitled Post"}</h4>
                              <p>
                                {post.created_at
                                  ? new Date(
                                      post.created_at
                                    ).toLocaleDateString()
                                  : ""}
                              </p>
                            </div>
                          </Link>
                        )
                    )}
                  </div>
                </section>
              )}
              {randomCourses.length > 0 && (
                <section className={styles.discoverSection}>
                  <div className={styles.discoverHeader}>
                    <h3>Explore New Courses</h3>
                    <Link
                      href="/learn?tab=courses"
                      className={styles.discoverSeeAllBtn}
                    >
                      Explore All
                    </Link>
                  </div>
                  <div className={styles.discoverGrid}>
                    {randomCourses.map(
                      (course) =>
                        course && (
                          <Link
                            href={
                              course.permalink
                                ? `/courses/${course.permalink}`
                                : "#"
                            }
                            key={course.id}
                            className={styles.discoverCardLink}
                          >
                            {course.cover_image ? (
                              <img
                                src={course.cover_image}
                                alt=""
                                className={styles.discoverImage}
                                loading="lazy"
                                onError={(e) =>
                                  (e.target.style.display = "none")
                                }
                              />
                            ) : (
                              <div className={styles.discoverPlaceholder}>
                                <FaGraduationCap />
                              </div>
                            )}
                            <div className={styles.discoverInfo}>
                              <h4>{course.title || "Untitled Course"}</h4>
                              <p className={styles.courseTypeLabel}>
                                {course.course_type
                                  ? course.course_type.charAt(0).toUpperCase() +
                                    course.course_type.slice(1)
                                  : "Standard"}
                              </p>
                            </div>
                          </Link>
                        )
                    )}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div
              className={`${styles.discoverSection} ${styles.discoverSectionEmpty}`}
            >
              <EmptyState message="Nothing new to discover right now. Check back later!" />
            </div>
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
    </div>
  );
};

export default HomePage;
