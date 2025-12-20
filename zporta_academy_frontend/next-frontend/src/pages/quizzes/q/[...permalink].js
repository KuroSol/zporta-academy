// Individual Question Page - SEO-friendly permalink URL
import { useRouter } from "next/router";
import { useEffect, useState, useMemo, useRef } from "react";
import Image from "next/image";
import apiClient from "@/api";
import QuizContent from "@/components/common/QuizContent";
import AppHeader from "@/components/AppHeader/AppHeader";
import Link from "next/link";
import QuizTimer from "@/components/common/QuizTimer";
import {
  Share2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  CheckCircle,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import styles from "@/styles/QuestionDetail.module.css";
import { quizPermalinkToUrl } from "@/utils/urls";
import ReportQuizModal from "@/components/ReportQuizModal";
import ShareQuizModal from "@/components/ShareQuizModal";
import ErrorState from "@/components/common/ErrorState";

function ImgWithFallback({
  src,
  alt,
  fallbackSrc,
  width,
  height,
  className,
  style,
  hideOnError = false,
}) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setImgSrc(src);
    setHidden(false);
  }, [src]);

  if (hidden) return null;

  return (
    <Image
      src={imgSrc || fallbackSrc || src || ""}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      onError={() => {
        if (hideOnError) {
          setHidden(true);
        } else if (fallbackSrc && imgSrc !== fallbackSrc) {
          setImgSrc(fallbackSrc);
        }
      }}
    />
  );
}

function QuestionDetailPage() {
  const router = useRouter();
  const { permalink } = router.query;

  const [question, setQuestion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizStartTime, setQuizStartTime] = useState(Date.now());
  const [hintsUsed, setHintsUsed] = useState([]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showCorrectUsers, setShowCorrectUsers] = useState(false);
  const [correctUsers, setCorrectUsers] = useState([]);
  const [isLoadingCorrectUsers, setIsLoadingCorrectUsers] = useState(false);
  const [cuPage, setCuPage] = useState(1);
  const [cuHasNext, setCuHasNext] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);
  const [explorerNextPermalink, setExplorerNextPermalink] = useState(null);
  const [explorerPrevPermalink, setExplorerPrevPermalink] = useState(null);
  const [historyPrevPermalink, setHistoryPrevPermalink] = useState(null);
  const [backendNextPermalink, setBackendNextPermalink] = useState(null);
  const [wheelDelta, setWheelDelta] = useState(0);
  const [transitionDir, setTransitionDir] = useState(null);
  const [prefetchQueue, setPrefetchQueue] = useState([]);
  const [isPrefetching, setIsPrefetching] = useState(false);
  const containerRef = useRef(null);
  const prefetchAbortRef = useRef(null);
  const prefetchRequestCountRef = useRef(0);

  const DEFAULT_AVATAR =
    "https://zportaacademy.com/media/managed_images/zpacademy.png";

  const normalizePermalink = (val) => {
    if (!val) return null;
    let s = String(val).trim();
    try {
      if (s.startsWith("http")) {
        const u = new URL(s);
        s = u.pathname + (u.search || "");
      }
    } catch (_) {}
    if (s.startsWith("/")) s = s.slice(1);
    if (s.startsWith("quizzes/q/")) s = s.slice("quizzes/q/".length);
    if (s.startsWith("/quizzes/q/")) s = s.slice("/quizzes/q/".length);
    const qIdx = s.indexOf("?");
    if (qIdx >= 0) s = s.slice(0, qIdx);
    const hIdx = s.indexOf("#");
    if (hIdx >= 0) s = s.slice(0, hIdx);
    return s;
  };

  // Resolve media URLs for question content (images, audio)
  const resolveMediaUrl = (url) => {
    if (!url) return "";
    let normalized = url;

    // If already a full URL, fix any /api/media/ to /media/
    if (normalized.startsWith("http")) {
      return normalized
        .replace("localhost:8000/api/media/", "localhost:8000/media/")
        .replace("127.0.0.1:8000/api/media/", "127.0.0.1:8000/media/")
        .replace("localhost:8000/api/", "localhost:8000/")
        .replace("127.0.0.1:8000/api/", "127.0.0.1:8000/");
    }

    // Strip /api/ prefix from paths
    normalized = normalized.replace(/^\/api\/media\//, "/media/");
    normalized = normalized.replace(/^\/api\//, "/");

    // If path starts with /media/, use base without /api/
    if (normalized.startsWith("/media/")) {
      const base = (process.env.NEXT_PUBLIC_API_BASE_URL || "").replace(
        /\/api\/?$/,
        ""
      );
      return `${base}${normalized}`;
    }

    // For other paths, use full base URL
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    return `${base}${normalized}`;
  };

  // Resolve avatar URLs (for user profiles)
  const resolveAvatarUrl = (url) => {
    if (!url) return DEFAULT_AVATAR;
    let normalized = url.trim();
    if (normalized.startsWith("http")) return normalized;
    const base = process.env.NEXT_PUBLIC_API_BASE_URL || "";
    return `${base}${normalized}`;
  };

  const getDisplayName = (u) =>
    (u?.display_name && u.display_name.trim()) ||
    (u?.user_display_name && u.user_display_name.trim()) ||
    (u?.user?.display_name && u.user.display_name.trim()) ||
    u?.username ||
    u?.user_username ||
    u?.user?.username ||
    "guest";

  // Derive AI difficulty from quiz (preferred) or question fallback
  const difficulty =
    (question?.quiz && question.quiz.difficulty_explanation) ||
    question?.difficulty_explanation ||
    null;

  // Collapse multiple correct answers by the same user into one row with a count
  const groupedCorrectUsers = useMemo(() => {
    if (!Array.isArray(correctUsers)) return [];
    const map = correctUsers.reduce((acc, u) => {
      const key =
        u.user_id || u.user?.id || u.id || u.username || u.user_username;
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = { ...u, answers: [] };
      }
      acc[key].answers.push(u.answer_text || u.selected_answer_text || "");
      return acc;
    }, {});
    return Object.values(map);
  }, [correctUsers]);

  useEffect(() => {
    if (!permalink) return;

    const fetchQuestion = async () => {
      let active = true;
      try {
        setLoading(true);
        const permalinkString = Array.isArray(permalink)
          ? permalink.join("/")
          : permalink;
        const response = await apiClient.get(`/quizzes/q/${permalinkString}/`);
        if (!active) return;
        setQuestion(response.data);
        setQuizStartTime(Date.now());
        // Reset form state for new question
        if (active) {
          setSelectedAnswer(null);
          setShowFeedback(false);
          setHintsUsed([]);
          setShowCorrectUsers(false);
          setCorrectUsers([]);
        }
      } catch (err) {
        console.error("Error fetching question:", err);
        const msg =
          err?.message ||
          err?.response?.data?.detail ||
          "Failed to load question";
        setError(msg);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchQuestion();
    return () => {
      /* prevent setState after unmount */
    };
  }, [permalink]);

  // Reset transition state when question changes
  useEffect(() => {
    setTransitionDir(null);
    setWheelDelta(0);
  }, [question?.id]);

  // Track quiz visit history (quiz-level, not question-level) for proper up arrow behavior
  // Up arrow should only be enabled after viewing at least 2 different quizzes
  useEffect(() => {
    if (!question?.quiz?.id) return;
    const currentQuizId = question.quiz.id;
    try {
      // CLEAR OLD BROKEN HISTORY
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("quizHistory");
      }

      const raw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("quizVisitHistory")
          : null;
      const hist = raw ? JSON.parse(raw) : [];

      // ONLY KEEP NUMERIC IDS
      const filtered = Array.isArray(hist)
        ? hist.filter(
            (id) =>
              id !== currentQuizId &&
              (typeof id === "number" || /^\d+$/.test(String(id)))
          )
        : [];

      const updated = [...filtered, currentQuizId].slice(-50);

      if (typeof window !== "undefined") {
        sessionStorage.setItem("quizVisitHistory", JSON.stringify(updated));
      }

      // Only set previous permalink if we have at least 2 quizzes in history
      // This ensures up arrow is disabled on first quiz visit
      if (updated.length >= 2) {
        const prevQuizId = updated[updated.length - 2];
        // We need to find the first question permalink for this quiz
        // For now, just enable the button - we'll fetch it when clicked
        setHistoryPrevPermalink(prevQuizId);
      } else {
        setHistoryPrevPermalink(null);
      }
    } catch (e) {
      setHistoryPrevPermalink(null);
    }
  }, [question?.quiz?.id]);

  // Compute next quiz (first question permalink) from Explorer order stored in sessionStorage
  useEffect(() => {
    if (!question) return;
    try {
      let next = null;
      let prev = null;

      const normalizePermalink = (val) => {
        if (!val) return null;
        let s = String(val).trim();
        try {
          if (s.startsWith("http")) {
            const u = new URL(s);
            s = u.pathname + (u.search || "");
          }
        } catch (_) {}
        if (s.startsWith("/")) s = s.slice(1);
        if (s.startsWith("quizzes/q/")) s = s.slice("quizzes/q/".length);
        if (s.startsWith("/quizzes/q/")) s = s.slice("/quizzes/q/".length);
        // strip any query/hash
        const qIdx = s.indexOf("?");
        if (qIdx >= 0) s = s.slice(0, qIdx);
        const hIdx = s.indexOf("#");
        if (hIdx >= 0) s = s.slice(0, hIdx);
        return s;
      };

      const currentQuestionPermalink =
        question.permalink ||
        (Array.isArray(permalink) ? permalink.join("/") : permalink);
      const currentNorm = normalizePermalink(currentQuestionPermalink);

      // 1) Exact question permalinks order
      const orderQuestionsRaw =
        typeof window !== "undefined"
          ? sessionStorage.getItem("explorerOrderQuestionPermalinks")
          : null;
      if (orderQuestionsRaw) {
        const arr = JSON.parse(orderQuestionsRaw);
        if (Array.isArray(arr) && arr.length) {
          const mapped = arr.map((v) => ({
            raw: v,
            norm: normalizePermalink(v),
          }));
          const idx = mapped.findIndex((x) => x.norm === currentNorm);
          if (idx >= 0) {
            if (idx < mapped.length - 1) next = mapped[idx + 1].raw;
            if (idx > 0) prev = mapped[idx - 1].raw;
          }
        }
      }

      // 2) Quizzes array with first question permalink
      if (!next) {
        const orderQuizzesRaw =
          typeof window !== "undefined"
            ? sessionStorage.getItem("explorerOrderQuizzes")
            : null;
        if (orderQuizzesRaw) {
          const arr = JSON.parse(orderQuizzesRaw);
          if (Array.isArray(arr) && arr.length) {
            const qid = question?.quiz?.id;
            const idx = arr.findIndex((x) => {
              const vid = x.quizId ?? x.quiz_id ?? x.id;
              return String(vid) === String(qid);
            });
            if (idx >= 0) {
              if (idx < arr.length - 1) {
                const n = arr[idx + 1];
                next =
                  n.firstQuestionPermalink ||
                  n.first_question_permalink ||
                  n.permalink ||
                  n.first_question ||
                  null;
              }
              if (idx > 0) {
                const p = arr[idx - 1];
                prev =
                  p.firstQuestionPermalink ||
                  p.first_question_permalink ||
                  p.permalink ||
                  p.first_question ||
                  null;
              }
            }
          }
        }
      }

      // 3) Optional: generic paths array (e.g., '/quizzes/q/...' strings)
      if (!next) {
        const orderPathsRaw =
          typeof window !== "undefined"
            ? sessionStorage.getItem("explorerOrderPaths")
            : null;
        if (orderPathsRaw) {
          const arr = JSON.parse(orderPathsRaw);
          if (Array.isArray(arr) && arr.length) {
            const mapped = arr.map((v) => ({
              raw: v,
              norm: normalizePermalink(v),
            }));
            const idx = mapped.findIndex((x) => x.norm === currentNorm);
            if (idx >= 0) {
              if (idx < mapped.length - 1) next = mapped[idx + 1].raw;
              if (idx > 0) prev = mapped[idx - 1].raw;
            }
          }
        }
      }

      setExplorerNextPermalink(next || null);
      setExplorerPrevPermalink(prev || null);
    } catch (e) {
      console.warn("Failed to parse Explorer order from sessionStorage", e);
      setExplorerNextPermalink(null);
      setExplorerPrevPermalink(null);
    }
  }, [question, permalink]);

  // Continuous prefetch of next 3 quizzes to avoid "End of Content"
  // Refills queue whenever it drops below 2 items
  useEffect(() => {
    if (!question) return;
    let active = true;

    const doPrefetch = async () => {
      // Only prefetch if queue is low
      if (prefetchQueue.length > 2) return;

      setIsPrefetching(true);
      try {
        // Abort previous prefetch
        if (prefetchAbortRef.current) {
          prefetchAbortRef.current.abort();
        }
        prefetchAbortRef.current = new AbortController();
        const signal = prefetchAbortRef.current.signal;
        const requestId = ++prefetchRequestCountRef.current;

        const current =
          question.permalink ||
          (Array.isArray(permalink) ? permalink.join("/") : permalink);
        let excludeIds = [];
        try {
          const historyData = sessionStorage.getItem("quizVisitHistory");
          if (historyData) {
            const history = JSON.parse(historyData);
            excludeIds = Array.isArray(history)
              ? history.filter(
                  (id) => typeof id === "number" || /^\d+$/.test(String(id))
                )
              : [];
          }
        } catch (e) {}
        const allExcludeIds = new Set(
          [...(excludeIds || []), question?.quiz?.id].filter(Boolean)
        );

        const resp = await apiClient.get(`/feed/next/`, {
          params: {
            current_question: current,
            current_quiz_id: question?.quiz?.id,
            limit: 20,
            exclude:
              allExcludeIds.size > 0
                ? Array.from(allExcludeIds).join(",")
                : undefined,
          },
          signal,
        });

        if (!active || requestId !== prefetchRequestCountRef.current) return;

        const items = resp?.data?.items;
        if (Array.isArray(items) && items.length) {
          // Prefetch the next 3 quizzes' detail pages
          const candidates = items
            .map((it) => ({
              permalink: it?.first_question_permalink || it?.first_question_url,
              quizId: it?.id,
            }))
            .filter((it) => it.permalink)
            .slice(0, 3);

          const newItems = [];
          for (const cand of candidates) {
            // Skip if already in queue
            if (prefetchQueue.some((q) => q.permalink === cand.permalink)) {
              newItems.push(cand);
              continue;
            }
            try {
              const norm = cand.permalink.split("/").filter(Boolean).join("/");
              const detail = await apiClient.get(`/quizzes/q/${norm}/`, {
                signal,
                timeout: 15000,
              });
              if (!active || requestId !== prefetchRequestCountRef.current)
                return;
              newItems.push({
                permalink: cand.permalink,
                quizId: cand.quizId,
                data: detail.data, // cache the quiz data
              });
            } catch (e) {
              if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError")
                return;
              // Log but don't fail the whole prefetch
              console.warn("Prefetch item failed:", cand.permalink, e?.message);
            }
          }
          if (active && requestId === prefetchRequestCountRef.current) {
            setPrefetchQueue((prev) => [...prev, ...newItems].slice(0, 5));
          }
        }
      } catch (e) {
        if (e?.code === "ERR_CANCELED" || e?.name === "CanceledError") return;
        console.warn("Prefetch error:", e?.message);
      } finally {
        if (active) {
          setIsPrefetching(false);
        }
      }
    };

    doPrefetch();
    return () => {
      active = false;
    };
  }, [question?.quiz?.id]);

  // Fetch backend-personalized next quiz first-question permalink ONLY when quiz changes
  // (not on horizontal navigation to different questions in same quiz)
  useEffect(() => {
    if (!question) return;
    const fetchNext = async () => {
      try {
        const current =
          question.permalink ||
          (Array.isArray(permalink) ? permalink.join("/") : permalink);

        // Build exclude list from quiz visit history (quiz IDs only, not permalinks)
        // Use quizVisitHistory which stores only quiz IDs (numbers)
        let excludeIds = [];
        try {
          const historyData = sessionStorage.getItem("quizVisitHistory");
          if (historyData) {
            const history = JSON.parse(historyData);
            // This history contains only quiz IDs (numbers)
            excludeIds = Array.isArray(history)
              ? history.filter(
                  (id) => typeof id === "number" || /^\d+$/.test(String(id))
                )
              : [];
          }
        } catch (e) {
          console.warn("Failed to parse quiz visit history", e);
        }

        // Add current quiz to exclude list before sending request
        const allExcludeIds = new Set(
          [...(excludeIds || []), question?.quiz?.id].filter(Boolean)
        );

        const resp = await apiClient.get(`/feed/next/`, {
          params: {
            current_question: current,
            current_quiz_id: question?.quiz?.id,
            limit: 20,
            exclude:
              allExcludeIds.size > 0
                ? Array.from(allExcludeIds).join(",")
                : undefined,
          },
        });
        const items = resp?.data?.items;
        if (Array.isArray(items) && items.length) {
          const first = items[0];
          const p =
            first?.first_question_permalink || first?.first_question_url;
          setBackendNextPermalink(p || null);
        } else {
          const p = resp?.data?.first_question_permalink;
          setBackendNextPermalink(p || null);
        }
      } catch (e) {
        setBackendNextPermalink(null);
      }
    };
    fetchNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question?.quiz?.id]);

  // OLD duplicate history tracking removed - now using quizVisitHistory only (see earlier useEffect)

  const handleAnswerSelect = (optionIndex) => {
    if (showFeedback) return; // lock after first choice
    setSelectedAnswer(optionIndex);
    setShowFeedback(true); // auto-submit on select
  };

  const handleHintUsed = (hintNumber) => {
    if (!hintsUsed.includes(hintNumber)) {
      setHintsUsed([...hintsUsed, hintNumber]);
    }
  };

  // Horizontal swipe: left/right between questions
  useEffect(() => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    const nextPermalink =
      question?.next_question_permalink ||
      question?.navigation?.next?.permalink;
    const prevPermalink =
      question?.previous_question_permalink ||
      question?.navigation?.prev?.permalink;

    if (isLeftSwipe && nextPermalink) {
      directNavigate(nextPermalink);
    }
    if (isRightSwipe && prevPermalink) {
      directNavigate(prevPermalink);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchEnd, touchStart, question]);

  const toPath = (val) => {
    if (!val) return null;
    if (typeof val !== "string") return null;
    if (val.startsWith("http")) return val;
    if (val.startsWith("/quizzes/q/")) return val;
    const cleaned = val.startsWith("/") ? val.slice(1) : val;
    return `/quizzes/q/${cleaned}`;
  };

  // Direct navigation for horizontal (question) navigation - no animation
  const directNavigate = (target) => {
    const path = toPath(target);
    if (!path) return;
    router.push(path);
  };

  // Smooth transition for vertical (quiz) navigation with slide animation
  const navigateWithTransition = (target, dir = "up") => {
    const path = toPath(target);
    if (!path) return;
    setTransitionDir(dir === "down" ? "slideDown" : "slideUp");
    setTimeout(() => {
      router.push(path);
    }, 120);
  };

  // Handle vertical swipe (up/down) to navigate quizzes
  useEffect(() => {
    if (touchStartY == null || touchEndY == null) return;
    const deltaY = touchStartY - touchEndY;
    if (Math.abs(deltaY) < 70) return;
    const nextPath = explorerNextPermalink || backendNextPermalink;
    if (deltaY > 0 && nextPath) {
      navigateWithTransition(nextPath, "up");
    } else if (deltaY < 0) {
      const backTarget =
        historyPrevPermalink ||
        explorerPrevPermalink ||
        question?.previous_question_permalink ||
        question?.navigation?.prev?.permalink;
      if (backTarget) navigateWithTransition(backTarget, "down");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touchEndY]);

  // Handle wheel scroll as a "pull up" gesture to go to next quiz (desktop)
  const handleWheel = (e) => {
    const dy = e.deltaY || 0;

    // Scroll up = go back to previous visited if available
    if (dy < -120) {
      const backTarget =
        historyPrevPermalink ||
        explorerPrevPermalink ||
        question?.previous_question_permalink ||
        question?.navigation?.prev?.permalink;
      if (backTarget) {
        navigateWithTransition(backTarget, "down");
      }
      return;
    }

    const nextPath = explorerNextPermalink || backendNextPermalink;
    if (!nextPath) return;
    // accumulate downward scroll only
    const down = Math.max(0, dy);
    const next = wheelDelta + down;
    if (next > 320) {
      setWheelDelta(0);
      navigateWithTransition(nextPath, "up");
    } else {
      setWheelDelta(next);
    }
  };

  const fetchCorrectUsers = async (page = 1) => {
    if (!question?.id || !question?.quiz) return;
    setIsLoadingCorrectUsers(true);
    try {
      const resp = await apiClient.get(
        `/analytics/quizzes/${question.quiz.id}/questions/${question.id}/answers/?correct=true&page=${page}`
      );
      if (page === 1) {
        setCorrectUsers(resp.data.results || []);
      } else {
        setCorrectUsers((prev) => [...prev, ...(resp.data.results || [])]);
      }
      setCuPage(page);
      setCuHasNext(!!resp.data.next);
    } catch (err) {
      console.error("Error fetching correct users:", err);
    } finally {
      setIsLoadingCorrectUsers(false);
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading question...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={() => router.push("/quizzes")}>
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (!question) {
    return (
      <>
        <AppHeader />
        <div className={styles.container}>
          {loading ? (
            <div className={styles.loading}>Loading question...</div>
          ) : (
            <ErrorState
              title="Unable to load question"
              message={error || "Please check your connection or try again."}
              onRetry={() => router.replace(router.asPath)}
            />
          )}
        </div>
      </>
    );
  }

  const { quiz } = question;
  const isCorrect = selectedAnswer === question.correct_option;
  const creator = quiz?.created_by;

  return (
    <>
      <AppHeader />
      <div
        ref={containerRef}
        className={`${styles.container} ${
          transitionDir ? styles[transitionDir] : ""
        }`}
        onTouchStart={(e) => {
          setTouchStart(e.changedTouches[0].clientX);
          setTouchStartY(e.changedTouches[0].clientY);
        }}
        onTouchEnd={(e) => {
          setTouchEnd(e.changedTouches[0].clientX);
          setTouchEndY(e.changedTouches[0].clientY);
        }}
        onWheel={handleWheel}
      >
        {/* Timer in upper left corner */}
        <div className={styles.timerCorner}>
          <QuizTimer startTime={quizStartTime} />
        </div>

        {/* Header with quiz info & creator */}
        <div className={styles.header}>
          <div className={styles.headerTopRow}>
            {creator && (
              <Link
                href={`/guide/${creator.username || ""}`}
                className={styles.creatorInfo}
              >
                <div className={styles.creatorAvatarWrap}>
                  <ImgWithFallback
                    src={resolveAvatarUrl(creator.profile_image_url)}
                    fallbackSrc={DEFAULT_AVATAR}
                    alt={`${getDisplayName(creator)} avatar`}
                    width={24}
                    height={24}
                    className={styles.creatorAvatarHex}
                  />
                </div>
                <div className={styles.creatorMeta}>
                  <span className={styles.creatorLabel}>Created by</span>
                  <span className={styles.creatorName}>
                    {getDisplayName(creator)}
                  </span>
                </div>
              </Link>
            )}
          </div>

          <div className={styles.quizInfo}>
            <h1>{quiz.title}</h1>
            <div className={styles.progress}>
              Question {quiz.current_position} of {quiz.total_questions}
            </div>

            {/* AI Difficulty Badge (from quiz, fallback to question) */}
            {difficulty && (
              <div
                className={styles.difficultyBadge}
                data-difficulty-level={(difficulty.level_5 || "Medium")
                  .toLowerCase()
                  .replace(/\s+/g, "-")}
                title={`${difficulty.level_5} (${difficulty.confidence}% confidence)`}
                style={{ marginTop: "0.5rem", display: "inline-block" }}
              >
                <span style={{ marginRight: "0.4rem", fontSize: "1.2em" }}>
                  {difficulty.emoji}
                </span>
                <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                  {(() => {
                    const ranks = [
                      "Very Easy",
                      "Easy",
                      "Medium",
                      "Slightly Hard",
                      "Hard",
                    ];
                    const score = difficulty?.difficulty_score ?? 260;
                    const index = Math.min(
                      Math.max(Math.floor(score / 130), 0),
                      4
                    );
                    return ranks[index] || "Medium";
                  })()}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Question Content */}
        <div className={styles.questionContainer}>
          {/* Question Text */}
          {question.question_text && (
            <div
              className={styles.questionText}
              dangerouslySetInnerHTML={{ __html: question.question_text }}
            />
          )}

          {/* Media: Image and/or Audio */}
          <QuizContent.QuizMedia
            imageUrl={resolveMediaUrl(question.question_image)}
            imageAlt={question.question_image_alt || "Question image"}
            audioUrl={resolveMediaUrl(question.question_audio)}
            containerClass={styles.mediaContainer}
            imageClass={styles.mediaImage}
            audioClass={styles.mediaAudio}
          />

          {/* Options */}
          <div className={styles.options}>
            {[1, 2, 3, 4].map((optionNum) => {
              const optionText = question[`option${optionNum}`] || "";
              const optionImage = resolveMediaUrl(
                question[`option${optionNum}_image`]
              );
              const optionAudio = resolveMediaUrl(
                question[`option${optionNum}_audio`]
              );

              // Only render if there's text, image, or audio
              if (!optionText && !optionImage && !optionAudio) return null;

              const isSelected = selectedAnswer === optionNum;
              const isCorrectOption = question.correct_option === optionNum;
              const showCorrect = showFeedback && isCorrectOption;
              const showWrong = showFeedback && isSelected && !isCorrect;

              return (
                <button
                  key={optionNum}
                  className={`${styles.option} ${
                    isSelected ? styles.selected : ""
                  } ${showCorrect ? styles.correct : ""} ${
                    showWrong ? styles.wrong : ""
                  }`}
                  onClick={() => handleAnswerSelect(optionNum)}
                  disabled={showFeedback}
                >
                  <span className={styles.optionNumber}>{optionNum}</span>
                  <div className={styles.optionContent}>
                    {optionImage && (
                      <ImgWithFallback
                        src={optionImage}
                        alt={`Option ${optionNum}`}
                        width={40}
                        height={40}
                        className={styles.optionImage}
                        hideOnError
                      />
                    )}
                    {optionText && (
                      <span className={styles.optionText}>{optionText}</span>
                    )}
                  </div>
                  {optionAudio && (
                    <audio
                      controls
                      src={optionAudio}
                      className={styles.optionAudio}
                    >
                      Your browser does not support the audio element.
                    </audio>
                  )}
                  {showFeedback && isCorrectOption && (
                    <span className={styles.checkmark}>✓</span>
                  )}
                  {showFeedback && isSelected && !isCorrect && (
                    <span className={styles.xmark}>✗</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Compact footer actions */}
          <div className={styles.footerBar}>
            <div className={styles.footerLeft}>
              {(question.hint1 || question.hint2) && (
                <QuizContent.HintBlock
                  hint1={question.hint1}
                  hint2={question.hint2}
                  mode="collapsible"
                  containerClass={styles.footerHints}
                  hintButtonClass={styles.footerHintButton}
                  hintDisplayClass={styles.footerHintDisplay}
                  onHintUsed={handleHintUsed}
                />
              )}
              <button
                className={styles.footerIconButton}
                title="Share"
                onClick={() => setShowShareModal(true)}
              >
                <Share2 size={14} />
              </button>
              <button
                className={styles.footerIconButton}
                title="Report"
                onClick={() => setShowReportModal(true)}
              >
                <AlertTriangle size={14} />
              </button>
            </div>
            <div className={styles.footerRight}>
              {quiz?.lesson_title ? (
                <Link
                  href={`/lessons/${quiz.lesson_permalink}`}
                  className={styles.footerPill}
                  title={`Part of lesson: ${quiz.lesson_title}`}
                >
                  📖 {quiz.lesson_title}
                </Link>
              ) : quiz?.course_title ? (
                <span
                  className={styles.footerPill}
                  title={`Part of course: ${quiz.course_title}`}
                >
                  🎓 {quiz.course_title}
                </span>
              ) : (
                <span className={styles.footerPill} title="Standalone quiz">
                  ⭐ Standalone
                </span>
              )}
              {typeof question.times_answered === "number" && (
                <span className={styles.footerPill} title="Times answered">
                  📊 {question.times_answered}
                </span>
              )}
              {typeof question.times_correct === "number" &&
                typeof question.times_wrong === "number" && (
                  <>
                    <button
                      className={styles.footerPill}
                      title="Click to see users who answered correctly"
                      onClick={() => {
                        setShowCorrectUsers(true);
                        fetchCorrectUsers(1);
                      }}
                      style={{
                        cursor: "pointer",
                        background: "none",
                        border: "none",
                        padding: "0.2rem 0.5rem",
                      }}
                    >
                      ✓ {question.times_correct}
                    </button>
                    <span className={styles.footerPill} title="Wrong answers">
                      ✗ {question.times_wrong}
                    </span>
                  </>
                )}
            </div>
          </div>

          {/* Compact Navigation: side arrows after answer, down arrow always */}
          <div className={styles.navigation}>
            {showFeedback ? (
              <>
                {question.previous_question_permalink ||
                question.navigation?.prev?.permalink ? (
                  <button
                    onClick={() =>
                      directNavigate(
                        question.previous_question_permalink ||
                          question.navigation?.prev?.permalink
                      )
                    }
                    className={`${styles.navIconButton} ${styles.navIconButtonLeft}`}
                    aria-label="Previous question"
                    title="Previous (or swipe right)"
                  >
                    <ChevronLeft size={18} />
                  </button>
                ) : (
                  <button
                    className={`${styles.navIconButton} ${styles.navIconButtonLeft}`}
                    disabled
                    aria-label="No previous question"
                  >
                    <ChevronLeft size={18} />
                  </button>
                )}
                {question.next_question_permalink ||
                question.navigation?.next?.permalink ? (
                  <button
                    onClick={() =>
                      directNavigate(
                        question.next_question_permalink ||
                          question.navigation?.next?.permalink
                      )
                    }
                    className={`${styles.navIconButton} ${styles.navIconButtonRight}`}
                    aria-label="Next question"
                    title="Next (or swipe left)"
                  >
                    <ChevronRight size={18} />
                  </button>
                ) : (
                  <button
                    className={`${styles.navIconButton} ${styles.navIconButtonRight}`}
                    disabled
                    aria-label="No next question"
                  >
                    <ChevronRight size={18} />
                  </button>
                )}
              </>
            ) : null}
            {/* Up arrow: previous quiz from history - disabled until at least 2 quizzes viewed */}
            <button
              onClick={async () => {
                // historyPrevPermalink now contains quiz ID, not permalink
                // Need to fetch the first question permalink for that quiz
                if (historyPrevPermalink) {
                  try {
                    // Fetch quiz details to get first question permalink
                    const resp = await apiClient.get(
                      `/quizzes/${historyPrevPermalink}/`
                    );
                    const firstQ = resp?.data?.first_question_permalink;
                    if (firstQ) {
                      navigateWithTransition(firstQ, "down");
                    }
                  } catch (e) {
                    console.error("Failed to fetch previous quiz", e);
                  }
                } else if (explorerPrevPermalink) {
                  navigateWithTransition(explorerPrevPermalink, "down");
                }
              }}
              className={styles.navIconButtonUp}
              aria-label="Previous quiz"
              title={
                historyPrevPermalink || explorerPrevPermalink
                  ? "Previous quiz (scroll up)"
                  : "Start of feed - scroll down to continue"
              }
              disabled={!(historyPrevPermalink || explorerPrevPermalink)}
            >
              <ChevronUp size={20} />
            </button>
            {/* Down arrow: next quiz via prefetch queue or backend feed */}
            {prefetchQueue.length > 0 ||
            explorerNextPermalink ||
            backendNextPermalink ||
            isPrefetching ? (
              <button
                onClick={() => {
                  // Only allow click if we have something ready
                  if (isPrefetching && prefetchQueue.length === 0) return;
                  // Try prefetched first, then fallback to explorer/backend
                  const nextItem = prefetchQueue[0];
                  const p =
                    nextItem?.permalink ||
                    explorerNextPermalink ||
                    backendNextPermalink;
                  if (!p) return;
                  // If prefetched, pop from queue
                  if (nextItem) {
                    setPrefetchQueue((prev) => prev.slice(1));
                  }
                  navigateWithTransition(p, "up");
                }}
                className={styles.navIconButtonDown}
                aria-label="Next quiz"
                title={
                  prefetchQueue.length > 0
                    ? "Next quiz ready (scroll down)"
                    : "Loading next quiz..."
                }
                disabled={isPrefetching && prefetchQueue.length === 0}
              >
                {isPrefetching && prefetchQueue.length === 0 ? (
                  <div
                    style={{
                      animation: "spin 1s linear infinite",
                      display: "inline-block",
                    }}
                  >
                    ⟳
                  </div>
                ) : (
                  <ChevronDown size={20} />
                )}
              </button>
            ) : (
              <div
                style={{
                  position: "fixed",
                  bottom: "1rem",
                  left: "50%",
                  transform: "translateX(-50%)",
                  textAlign: "center",
                  padding: "0.75rem 1.5rem",
                  background: "rgba(255, 255, 255, 0.95)",
                  borderRadius: "12px",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
                  border: "2px solid rgba(0, 0, 0, 0.1)",
                  zIndex: 20,
                }}
              >
                <div
                  style={{
                    fontSize: "0.9rem",
                    fontWeight: 600,
                    marginBottom: "0.5rem",
                    color: "#374151",
                  }}
                >
                  🎉 End of Content
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#6b7280",
                    marginBottom: "0.75rem",
                    lineHeight: 1.4,
                  }}
                >
                  {`You've reached the end of this subject's content`}
                </div>
                <Link
                  href="/quizzes"
                  style={{
                    display: "inline-block",
                    padding: "0.4rem 1rem",
                    background:
                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                    color: "#fff",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 500,
                    textDecoration: "none",
                    transition: "transform 0.2s",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.transform = "scale(1.05)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.transform = "scale(1)")
                  }
                >
                  ← Back to Explorer
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Users who answered correctly modal */}
        {showCorrectUsers && (
          <div
            className="modal-overlay"
            role="dialog"
            aria-modal="true"
            onClick={() => setShowCorrectUsers(false)}
          >
            <div
              className="modal-content"
              style={{ maxWidth: 480 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-header">
                <h4>Answered correctly</h4>
                <button
                  className="modal-close-btn"
                  onClick={() => setShowCorrectUsers(false)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="modal-body">
                {isLoadingCorrectUsers && correctUsers.length === 0 ? (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    <Loader2
                      size={24}
                      style={{ animation: "spin 1s linear infinite" }}
                    />
                  </div>
                ) : correctUsers.length === 0 ? (
                  <div
                    style={{
                      padding: "2rem",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                    }}
                  >
                    No users yet.
                  </div>
                ) : (
                  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                    {groupedCorrectUsers.map((u, i) => (
                      <li
                        key={u.id || u.user_id || u.username || i}
                        style={{
                          borderTop:
                            i > 0 ? "1px solid var(--border-color)" : "none",
                        }}
                      >
                        <Link
                          href={`/guide/${
                            u.username ||
                            u.user_username ||
                            u.user?.username ||
                            "unknown"
                          }`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "1rem",
                            padding: "0.75rem 1.25rem",
                            textDecoration: "none",
                            color: "inherit",
                            cursor: "pointer",
                          }}
                          onClick={() => setShowCorrectUsers(false)}
                        >
                          <ImgWithFallback
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                            src={resolveAvatarUrl(
                              u.user_profile_image_url ||
                                u.profile_image_url ||
                                u.user?.profile_image_url
                            )}
                            fallbackSrc={DEFAULT_AVATAR}
                            alt={
                              u.username ||
                              u.user_username ||
                              u.display_name ||
                              "User"
                            }
                            width={44}
                            height={44}
                          />
                          <div style={{ flexGrow: 1 }}>
                            <div style={{ fontWeight: 600 }}>
                              @
                              {u.username ||
                                u.user_username ||
                                u.display_name ||
                                "guest"}{" "}
                              <span
                                style={{
                                  color: "var(--text-secondary)",
                                  fontWeight: 400,
                                }}
                              >
                                × {u.answers?.length || 1}
                              </span>
                            </div>
                            {u.answered_at && (
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  color: "var(--text-secondary)",
                                }}
                              >
                                {new Date(u.answered_at).toLocaleString()}
                              </div>
                            )}
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {cuHasNext && (
                <div className="modal-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => fetchCorrectUsers(cuPage + 1)}
                    disabled={isLoadingCorrectUsers}
                  >
                    {isLoadingCorrectUsers ? "Loading…" : "Load more"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <ReportQuizModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          quizId={quiz?.id}
        />
        <ShareQuizModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          quizId={quiz?.id}
          quizLink={
            question?.permalink
              ? `${
                  typeof window !== "undefined" ? window.location.origin : ""
                }/quizzes/q/${question.permalink}`
              : `${
                  typeof window !== "undefined" ? window.location.origin : ""
                }${quizPermalinkToUrl(quiz?.permalink)}`
          }
        />
      </div>
    </>
  );
}

// Disable AppLayout to prevent header padding and allow full-screen Instagram-like layout
QuestionDetailPage.getLayout = function getLayout(page) {
  return page;
};

export default QuestionDetailPage;
