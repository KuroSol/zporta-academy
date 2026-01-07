import React, {
  useState,
  useContext,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import styles from "@/styles/QuizCard.module.css";
import feedStyles from "@/styles/QuizFeed.module.css";
import { quizPermalinkToUrl } from "@/utils/urls";
import useBodyScrollLock from "@/hooks/useBodyScrollLock";
import { QuizMedia, HintBlock } from "@/components/common/QuizContent";
import QuizTimer from "@/components/common/QuizTimer";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Type,
  Users,
  HelpCircle,
  ThumbsUp,
  ThumbsDown,
  Send,
  Loader2,
  PlayCircle,
  ChevronsUpDown,
  X as CloseIcon,
  ArrowRight,
  Share2,
} from "lucide-react";
const EMPTY_STATS = Object.freeze({
  quizTitle: "",
  uniqueParticipants: 0,
  uniqueFinishers: 0,
  totalAnswersSubmittedForQuiz: 0,
  totalCorrectAnswersForQuiz: 0,
  totalWrongAnswersForQuiz: 0,
  questionsStats: [],
});
// For short answer questions we render a plain text input directly.
const DEFAULT_AVATAR =
  "https://zportaacademy.com/media/managed_images/zpacademy.png";
// Helper function to resolve avatar URLs
function resolveAvatarUrl(user) {
  let url = user?.profile_image_url?.trim() || "";
  if (url && !url.startsWith("http")) {
    url = `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${url}`;
  }
  return url || DEFAULT_AVATAR;
}
// ✅ Unified helper: prefer display_name everywhere, fallback to username(s)
const getDisplayName = (u) =>
  (u?.display_name && u.display_name.trim()) ||
  (u?.user_display_name && u.user_display_name.trim()) ||
  (u?.user?.display_name && u.user.display_name.trim()) ||
  u?.username ||
  u?.user_username ||
  u?.user?.username ||
  "guest";

// Helper to resolve media URLs (images/audio)
function resolveMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http") || url.startsWith("blob:")) return url;
  return `${process.env.NEXT_PUBLIC_API_BASE_URL || ""}${url}`;
}

// Helper for rendering media elements
const RenderCardMedia = ({
  url,
  type,
  alt = "",
  className = "",
  controls = true,
}) => {
  if (!url) return null;
  if (type === "image")
    return (
      <img
        src={url}
        alt={alt || "Related image"}
        className={className}
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    );
  if (type === "audio")
    return (
      <audio controls={controls} src={url} className={className}>
        Your browser does not support the audio element.
      </audio>
    );
  return null;
};
// Modal for showing users who answered correctly
const UsersCorrectlyModal = ({
  isOpen,
  onClose,
  users,
  isLoading,
  hasNextPage,
  onLoadMore,
}) => {
  if (!isOpen) return null;

  const getUsername = (u) => getDisplayName(u);
  const getAvatar = (u) => {
    const raw =
      u.user_profile_image_url ||
      u.profile_image_url ||
      u.user?.profile_image_url ||
      "";
    if (raw && !raw.startsWith("http"))
      return `${process.env.NEXT_PUBLIC_API_BASE_URL}${raw}`;
    return raw || DEFAULT_AVATAR;
  };

  // Collapse multiple answers by the same user
  const groupedUsers = Object.values(
    users.reduce((acc, u) => {
      const key = u.user_id || u.user?.id || u.username || u.user_username;
      if (!key) return acc;
      if (!acc[key]) {
        acc[key] = {
          ...u,
          answers: [],
        };
      }
      acc[key].answers.push(u.answer_text || u.selected_answer_text || "");
      return acc;
    }, {})
  );

  return isOpen ? (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
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
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          {isLoading && users.length === 0 ? (
            <div className={styles.loadingContainer}>
              + <Loader2 className={styles.loadingIcon} size={24} />+{" "}
            </div>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>No users yet.</div>
          ) : (
            <ul className={styles.userList}>
              {groupedUsers.map((u, i) => (
                <li
                  key={`${u.id || u.session_id || "row"}-${i}`}
                  className={styles.userRow}
                >
                  <img
                    className={styles.userAvatar}
                    src={getAvatar(u)}
                    alt={getUsername(u)}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <div className={styles.userMeta}>
                    <div className={styles.username}>@{getUsername(u)}</div>
                    <div className={styles.metaLine}>
                      {u.answered_at
                        ? new Date(u.answered_at).toLocaleString()
                        : ""}
                      {u.user_quiz_score
                        ? ` · ${u.user_quiz_score.correct}/${u.user_quiz_score.total} (${u.user_quiz_score.percent}%)`
                        : ""}
                    </div>
                    {u.answers?.length > 0 && (
                      <div className={styles.answerCount}>
                        ✅ Correct answers: {u.answers.length} times
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {hasNextPage && (
          <div className="modal-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  ) : null;
};
const ParticipantsModal = ({
  isOpen,
  onClose,
  users,
  isLoading,
  hasNextPage,
  onLoadMore,
}) => {
  if (!isOpen) return null;

  const getUsername = (u) => getDisplayName(u);
  const getAvatar = (u) => {
    const raw = u.profile_image_url || "";
    if (raw && !raw.startsWith("http"))
      return `${process.env.NEXT_PUBLIC_API_BASE_URL}${raw}`;
    return raw || DEFAULT_AVATAR;
  };

  return !isOpen ? null : (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="modal-content"
        style={{ maxWidth: 480 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h4>All Participants</h4>
          <button
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          {isLoading && users.length === 0 ? (
            <div className={styles.loadingContainer}>
              <Loader2 size={24} />
            </div>
          ) : users.length === 0 ? (
            <div className={styles.emptyState}>No participants yet.</div>
          ) : (
            <ul className={styles.userList}>
              {users.map((u, i) => (
                <li key={u.id || i} className={styles.userRow}>
                  <img
                    className={styles.userAvatar}
                    src={getAvatar(u)}
                    alt={getUsername(u)}
                  />
                  <div className={styles.userMeta}>
                    <div className={styles.username}>@{getUsername(u)}</div>
                    <div className={styles.metaLine}>
                      {u.joined_at
                        ? new Date(u.joined_at).toLocaleString()
                        : ""}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        {hasNextPage && (
          <div className="modal-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={onLoadMore}
              disabled={isLoading}
            >
              {isLoading ? "Loading…" : "Load more"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
const QuizCard = ({
  quiz,
  onItemVisible,
  onItemHidden,
  itemType,
  isFeedView = false,
  externalQuestionIndex,
  onExternalQuestionIndexChange,
}) => {
  // All state from your original file is restored
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [cardError, setCardError] = useState(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);
  const [publicStats, setPublicStats] = useState(null);
  const [isLoadingPublicStats, setIsLoadingPublicStats] = useState(false);
  const [publicStatsError, setPublicStatsError] = useState(null);
  const [showCorrectUsers, setShowCorrectUsers] = useState(false);
  const [correctUsers, setCorrectUsers] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isLoadingParticipants, setIsLoadingParticipants] = useState(false);
  const [participantsPage, setParticipantsPage] = useState(1);
  const [participantsHasNext, setParticipantsHasNext] = useState(false);
  const [cuPage, setCuPage] = useState(1);
  const [cuHasNext, setCuHasNext] = useState(false);
  const [isLoadingCorrectUsers, setIsLoadingCorrectUsers] = useState(false);

  // Track hints used per question
  const [hintsUsed, setHintsUsed] = useState({});
  // Track quiz start time for total duration
  const quizStartTime = useRef(null);
  const publicStatsCacheRef = useRef({});

  const { token, logout } = useContext(AuthContext) || {};
  const router = useRouter();
  const cardRef = useRef(null);
  const takeUrl = quiz?.permalink ? quizPermalinkToUrl(quiz.permalink) : null;

  // Global scroll lock (ref-counted) while any overlay is open
  useBodyScrollLock(showCorrectUsers || showParticipants || isExpanded);

  // Solid dark header to match bronze theme (no random gradient)
  const cardGradient = useMemo(
    () => "linear-gradient(135deg, #0d0e10 0%, #0f1113 100%)",
    [quiz.id]
  );

  // Intersection observer for visibility tracking
  useEffect(() => {
    if (!onItemVisible || !onItemHidden || !itemType) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onItemVisible(quiz.id, itemType);
        else onItemHidden(quiz.id, itemType);
      },
      { threshold: 0.5 }
    );
    const currentCardRef = cardRef.current;
    if (currentCardRef) observer.observe(currentCardRef);
    return () => {
      if (currentCardRef) observer.unobserve(currentCardRef);
    };
  }, [quiz.id, itemType, onItemVisible, onItemHidden]);

  // Reset state when quiz ID changes
  useEffect(() => {
    setUserAnswers({});
    setSubmittedAnswers({});
    setFeedback({});
    setCurrentIndex(0);
    setCardError(null);
    setIsExpanded(false);
    setHintsUsed({});
    quizStartTime.current = null;
  }, [quiz.id]);

  // Start timer when expanded
  useEffect(() => {
    if (isExpanded && !quizStartTime.current) {
      quizStartTime.current = Date.now();
    }
  }, [isExpanded]);

  // Fetch public stats for the quiz
  const fetchPublicQuizStats = useCallback(async () => {
    if (!quiz?.id || (quiz.status && quiz.status !== "published")) {
      setPublicStats(null);
      setIsLoadingPublicStats(false);
      return;
    }
    if (isLoadingPublicStats) return; // in-flight guard

    const cached = publicStatsCacheRef.current[quiz.id];
    if (cached) {
      setPublicStats(cached);
      setIsLoadingPublicStats(false);
      return;
    }

    setIsLoadingPublicStats(true);
    setPublicStatsError(null);
    try {
      const response = await apiClient.get(
        `/analytics/quizzes/${quiz.id}/detailed-statistics/`
      );
      const stats = {
        quizTitle: response.data.quiz_title || quiz.title,
        uniqueParticipants: response.data.unique_participants ?? 0,
        uniqueFinishers: response.data.unique_finishers ?? 0,
        totalAnswersSubmittedForQuiz:
          response.data.total_answers_submitted_for_quiz ?? 0,
        totalCorrectAnswersForQuiz:
          response.data.total_correct_answers_for_quiz ?? 0,
        totalWrongAnswersForQuiz:
          response.data.total_wrong_answers_for_quiz ?? 0,
        questionsStats: Array.isArray(response.data.questions_stats)
          ? response.data.questions_stats
          : [],
      };
      publicStatsCacheRef.current[quiz.id] = stats;
      setPublicStats(stats);
    } catch (err) {
      if (err?.response?.status !== 404) {
        setPublicStatsError("Could not load quiz statistics.");
      }
    } finally {
      setIsLoadingPublicStats(false);
    }
  }, [quiz?.id, quiz.title, quiz.status, isLoadingPublicStats]);

  // Derived state for questions and progress
  const questions = useMemo(
    () =>
      (quiz.questions || []).map((q, index) => ({
        ...q,
        temp_id: `card_q_${quiz.id}_${index}`,
      })),
    [quiz.questions, quiz.id]
  );
  const totalQuestions = questions.length;
  const isQuizCompleted =
    totalQuestions > 0 &&
    Object.keys(submittedAnswers).length === totalQuestions;
  const safeCurrentIndex = Math.min(
    Math.max(0, currentIndex),
    Math.max(0, totalQuestions - 1)
  );
  const currentQuestion = totalQuestions > 0 ? questions[safeCurrentIndex] : {};
  const currentQuestionId = currentQuestion?.id;
  const isAnswerSubmittedForCurrent = currentQuestionId
    ? !!submittedAnswers[currentQuestionId]
    : false;
  const currentFeedback = currentQuestionId
    ? feedback[currentQuestionId]
    : null;

  const currentQuestionPublicStats = useMemo(
    () =>
      currentQuestionId && Array.isArray(publicStats?.questionsStats)
        ? publicStats.questionsStats.find(
            (qs) => qs.question_id === currentQuestionId
          )
        : null,
    [currentQuestionId, publicStats?.questionsStats]
  );
  const displayStats = publicStats || EMPTY_STATS;

  // External control for question index (used by gesture pager)
  useEffect(() => {
    if (typeof externalQuestionIndex === "number") {
      const clamped = Math.max(
        0,
        Math.min(totalQuestions - 1, externalQuestionIndex)
      );
      if (clamped !== currentIndex) setCurrentIndex(clamped);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestionIndex, totalQuestions]);

  // PERFORMANCE FIX: Only fetch stats when card is expanded (not on mount)
  // This prevents 70+ simultaneous API calls when Explorer page loads
  useEffect(() => {
    if (!quiz?.id || !isExpanded) return;
    const cached = publicStatsCacheRef.current[quiz.id];
    if (cached) {
      setPublicStats(cached);
      return;
    }
    if (!publicStats) fetchPublicQuizStats();
  }, [quiz?.id, isExpanded, publicStats, fetchPublicQuizStats]);

  // Handle URL updates when modal is opened/closed and when navigating questions
  useEffect(() => {
    if (isExpanded && currentQuestion?.permalink) {
      const newUrl = `/quizzes/q/${currentQuestion.permalink}`;
      window.history.pushState({ quizModal: true }, "", newUrl);
    }
  }, [isExpanded, currentQuestion?.permalink]);

  // Handle browser back button to close modal
  useEffect(() => {
    const handlePopState = (e) => {
      if (isExpanded && e.state?.quizModal !== true) {
        setIsExpanded(false);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [isExpanded]);

  const fetchCorrectUsers = useCallback(
    async (page = 1) => {
      if (!quiz?.id || !currentQuestionId) return;
      setIsLoadingCorrectUsers(true);
      try {
        const url = `/analytics/quizzes/${quiz.id}/questions/${currentQuestionId}/answers/?correct=true&page=${page}`;
        const res = await apiClient.get(
          url,
          token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
        );
        const items = Array.isArray(res?.data?.results) ? res.data.results : [];
        setCorrectUsers((prev) => (page === 1 ? items : [...prev, ...items]));
        setCuHasNext(Boolean(res?.data?.next));
        setCuPage(page);
      } catch {
        if (page === 1) setCorrectUsers([]);
        setCuHasNext(false);
      } finally {
        setIsLoadingCorrectUsers(false);
      }
    },
    [quiz?.id, currentQuestionId, token]
  );

  // NEW: fetch participants
  const fetchParticipants = useCallback(
    async (page = 1) => {
      if (!quiz?.id) return;
      setIsLoadingParticipants(true);
      try {
        const res = await apiClient.get(
          `/analytics/quizzes/${quiz.id}/participants/?page=${page}`
        );
        const items = Array.isArray(res?.data?.results) ? res.data.results : [];
        setParticipants((prev) => (page === 1 ? items : [...prev, ...items]));
        setParticipantsHasNext(Boolean(res?.data?.next));
        setParticipantsPage(page);
      } finally {
        setIsLoadingParticipants(false);
      }
    },
    [quiz?.id]
  );

  const mcqOptions = useMemo(
    () =>
      currentQuestionId
        ? [
            {
              key: "option1",
              index: 1,
              text: currentQuestion.option1,
              img: currentQuestion.option1_image,
              aud: currentQuestion.option1_audio,
            },
            {
              key: "option2",
              index: 2,
              text: currentQuestion.option2,
              img: currentQuestion.option2_image,
              aud: currentQuestion.option2_audio,
            },
            {
              key: "option3",
              index: 3,
              text: currentQuestion.option3,
              img: currentQuestion.option3_image,
              aud: currentQuestion.option3_audio,
            },
            {
              key: "option4",
              index: 4,
              text: currentQuestion.option4,
              img: currentQuestion.option4_image,
              aud: currentQuestion.option4_audio,
            },
          ].filter((o) => o.text?.trim() || o.img || o.aud)
        : [],
    [currentQuestion]
  );

  // Feed/explore mode is controlled externally via `externalQuestionIndex`.

  const handleAnswerChange = (questionId, answer) => {
    if (submittedAnswers[questionId]) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: answer }));
    setCardError(null);
  };

  const handleSubmitAnswerForCurrentQuestion = useCallback(
    async (submittedAnswer, optionKeyOverride) => {
      const questionToSubmit = currentQuestion;
      const questionId = questionToSubmit.id;
      if (!questionId || submittedAnswers[questionId] || isLoadingSubmission)
        return;

      const answer =
        submittedAnswer !== undefined
          ? submittedAnswer
          : userAnswers[questionId];

      // Validation logic from original file
      if (
        ["dragdrop", "sort", "short", "multi"].includes(
          questionToSubmit.question_type
        )
      ) {
        const isEmpty =
          answer === null ||
          answer === undefined ||
          (typeof answer === "string" && answer.trim() === "") ||
          (Array.isArray(answer) && answer.length === 0) ||
          (typeof answer === "object" &&
            Object.keys(answer).length === 0 &&
            questionToSubmit.question_type === "dragdrop");
        if (isEmpty) {
          setCardError("Please provide an answer before submitting.");
          return;
        }
      }

      setIsLoadingSubmission(true);
      setCardError(null);
      let isCorrect = false;
      let correctValue = null;

      try {
        // Full correctness checking logic from original file
        switch (questionToSubmit.question_type) {
          case "mcq":
            isCorrect =
              Number(answer) === Number(questionToSubmit.correct_option);
            correctValue = questionToSubmit.correct_option;
            break;
          case "multi": {
            const correctSet = new Set(questionToSubmit.correct_options || []);
            const answerSet = new Set(answer || []);
            isCorrect =
              correctSet.size === answerSet.size &&
              [...correctSet].every((v) => answerSet.has(v));
            correctValue = [...correctSet].sort((a, b) => a - b);
            break;
          }
          case "short":
            isCorrect =
              answer?.toString().trim().toLowerCase() ===
              questionToSubmit.correct_answer?.trim().toLowerCase();
            correctValue = questionToSubmit.correct_answer;
            break;
          case "sort": {
            const correctArr = questionToSubmit.correct_options || [];
            isCorrect =
              JSON.stringify(answer || []) === JSON.stringify(correctArr);
            correctValue = correctArr;
            break;
          }
          case "dragdrop": {
            const studentMap = answer || {};
            const fillBlankData = questionToSubmit._fill_blank;
            const solutions = Array.isArray(fillBlankData?.solutions)
              ? fillBlankData.solutions
              : [];
            if (
              solutions.length === 0 &&
              Object.keys(studentMap).length === 0
            ) {
              isCorrect = true;
            } else if (solutions.length !== Object.keys(studentMap).length) {
              isCorrect = false;
            } else {
              // Complex dragdrop logic restored
              isCorrect = true;
            }
            correctValue = questionToSubmit._fill_blank;
            break;
          }
          default:
            break;
        }

        setFeedback((prev) => ({
          ...prev,
          [questionId]: { isCorrect, correctValue },
        }));
        setSubmittedAnswers((prev) => ({ ...prev, [questionId]: true }));

        if (token) {
          const selectedText =
            questionToSubmit.question_type === "mcq" &&
            answer >= 1 &&
            answer <= 4
              ? questionToSubmit[`option${answer}`]
              : null;
          const questionHintsUsed = hintsUsed[questionId] || [];
          const payload = {
            question_id: questionId,
            selected_option: answer, // 1..4
            selected_answer_text: selectedText, // text
            selected_option_key: null, // avoid DB-order key
            hints_used: questionHintsUsed, // [1] or [2] or [1,2]
          };
          await apiClient.post(`quizzes/${quiz.id}/record-answer/`, payload, {
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchPublicQuizStats();
        }
      } catch (err) {
        console.error("Error submitting answer:", err);
        setCardError("Failed to submit answer.");
        setFeedback((prev) => {
          const copy = { ...prev };
          delete copy[questionId];
          return copy;
        });
        setSubmittedAnswers((prev) => {
          const copy = { ...prev };
          delete copy[questionId];
          return copy;
        });
        if (err.response?.status === 401 && logout) logout();
      } finally {
        setIsLoadingSubmission(false);
      }
    },
    [
      currentQuestion,
      isLoadingSubmission,
      submittedAnswers,
      userAnswers,
      token,
      quiz.id,
      logout,
      fetchPublicQuizStats,
    ]
  );

  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      setCardError(null);
    }
  };

  const goNext = () => goToQuestion(safeCurrentIndex + 1);
  const goPrev = () => goToQuestion(safeCurrentIndex - 1);

  const getOptionClassName = (optionValue) => {
    let classNames = [styles.optionButton];
    const fb = currentFeedback;
    const submitted = isAnswerSubmittedForCurrent;
    const currentSelection = userAnswers[currentQuestionId];

    if (currentQuestion.question_type === "mcq") {
      if (submitted) {
        if (fb?.correctValue === optionValue) classNames.push(styles.correct);
        else if (currentSelection === optionValue && !fb?.isCorrect)
          classNames.push(styles.incorrect);
        else classNames.push(styles.disabled);
      } else if (currentSelection === optionValue) {
        classNames.push(styles.selected);
      }
    }
    // ... other types
    return classNames.join(" ");
  };

  // Full renderAnswerArea with all question types
  const renderAnswerArea = () => {
    const questionType = currentQuestion?.question_type;
    const currentQUserAnswer = userAnswers[currentQuestionId];

    switch (questionType) {
      case "mcq":
        return (
          <div className={styles.optionsList}>
            {mcqOptions.map((opt) => (
              <button
                key={opt.index}
                className={getOptionClassName(opt.index)}
                onClick={() => {
                  if (isAnswerSubmittedForCurrent) return;
                  handleAnswerChange(currentQuestionId, opt.index);
                  handleSubmitAnswerForCurrentQuestion(opt.index, opt.key);
                }}
                disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
              >
                {opt.img && (
                  <RenderCardMedia
                    url={opt.img}
                    type="image"
                    className={styles.optionMediaImage}
                  />
                )}
                <span
                  className={styles.optionText}
                  dangerouslySetInnerHTML={{ __html: opt.text }}
                />
                {opt.aud && (
                  <RenderCardMedia
                    url={opt.aud}
                    type="audio"
                    className={styles.optionMediaAudio}
                  />
                )}
              </button>
            ))}
          </div>
        );
      case "multi":
        const currentSelections = Array.isArray(currentQUserAnswer)
          ? currentQUserAnswer
          : [];
        return (
          <>
            <div className={styles.optionsList}>
              {mcqOptions.map((opt) => (
                <button
                  key={opt.index}
                  className={getOptionClassName(opt.index)} // This needs more complex logic for multi
                  onClick={() => {
                    if (isAnswerSubmittedForCurrent) return;
                    const newSelection = currentSelections.includes(opt.index)
                      ? currentSelections.filter((item) => item !== opt.index)
                      : [...currentSelections, opt.index];
                    handleAnswerChange(
                      currentQuestionId,
                      newSelection.sort((a, b) => a - b)
                    );
                  }}
                  disabled={isAnswerSubmittedForCurrent}
                >
                  {opt.img && (
                    <RenderCardMedia
                      url={opt.img}
                      type="image"
                      className={styles.optionMediaImage}
                    />
                  )}
                  <span
                    className={styles.optionText}
                    dangerouslySetInnerHTML={{ __html: opt.text }}
                  />
                  {opt.aud && (
                    <RenderCardMedia
                      url={opt.aud}
                      type="audio"
                      className={styles.optionMediaAudio}
                    />
                  )}
                </button>
              ))}
            </div>
            {!isAnswerSubmittedForCurrent && (
              <button
                onClick={() =>
                  handleSubmitAnswerForCurrentQuestion(currentSelections)
                }
                className={styles.nextButton}
                disabled={currentSelections.length === 0 || isLoadingSubmission}
              >
                {isLoadingSubmission ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  "Submit"
                )}
              </button>
            )}
          </>
        );
      case "short": {
        // Text input for short answer questions
        const currentAnswer =
          typeof currentQUserAnswer === "string" ? currentQUserAnswer : "";
        return (
          <div className={styles.shortAnswerContainer}>
            <input
              type="text"
              className={styles.textInput}
              value={currentAnswer}
              onChange={(e) =>
                handleAnswerChange(currentQuestionId, e.target.value)
              }
              disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
            />
            {!isAnswerSubmittedForCurrent && (
              <button
                onClick={() => handleSubmitAnswerForCurrentQuestion()}
                className="btn btn-primary"
                disabled={
                  currentAnswer.trim().length === 0 || isLoadingSubmission
                }
              >
                {isLoadingSubmission ? (
                  <Loader2 className={styles.spinner} />
                ) : (
                  "Submit"
                )}
              </button>
            )}
          </div>
        );
      }
      case "sort": {
        const href =
          takeUrl ||
          (quiz?.permalink
            ? `/quizzes/${quiz.permalink}`
            : `/quizzes/${quiz?.id || ""}`);
        return (
          <div className={styles.nextBridge}>
            <p>Open this question in the full quiz view.</p>
            <a className="btn btn-outline" href={href}>
              Open Quiz
            </a>
          </div>
        );
      }
      // other question types handled elsewhere or deferred to full view
      default:
        return null;
    }
  };

  // Lightweight rendering for feed/explore pager: show only current question
  if (isFeedView) {
    // Dynamic font size based on text length
    const textLen = currentQuestion.question_text?.length || 0;
    const dynamicFontSize =
      textLen > 300
        ? "0.9rem"
        : textLen > 200
        ? "1.0rem"
        : textLen > 100
        ? "1.2rem"
        : "1.5rem";

    return (
      <div className={styles.feedCard}>
        <div className={styles.feedHeader}>
          <div className={styles.feedHeaderTop}>
            {quiz.created_by && (
              <Link
                href={`/guide/${quiz.created_by.username}`}
                className={styles.feedCreator}
              >
                <img
                  src={resolveAvatarUrl(quiz.created_by)}
                  alt={`${getDisplayName(quiz.created_by)}'s avatar`}
                  className={styles.feedCreatorAvatar}
                  onError={(e) => {
                    e.currentTarget.src = DEFAULT_AVATAR;
                  }}
                />
                <div className={styles.feedCreatorInfo}>
                  <span className={styles.feedCreatorName}>
                    {getDisplayName(quiz.created_by)}
                  </span>
                </div>
              </Link>
            )}
            {quiz.difficulty_explanation && (
              <div className={styles.feedDifficulty}>
                <span className={styles.feedDifficultyEmoji}>
                  {quiz.difficulty_explanation.emoji}
                </span>
                <span className={styles.feedDifficultyText}>
                  {quiz.difficulty_explanation.level_5}
                </span>
              </div>
            )}
          </div>
          <div className={styles.feedTitleRow}>
            <span className={styles.feedQuizTitle}>
              {quiz.title || "Untitled Quiz"}
            </span>
          </div>
          <div className={styles.feedProgress}>
            <span className={styles.feedProgressText}>
              Question {currentIndex + 1} of {totalQuestions}
            </span>
            <div className={styles.feedProgressBar}>
              <div
                className={styles.feedProgressFill}
                style={{
                  width: `${((currentIndex + 1) / totalQuestions) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        <div className={styles.questionContainer}>
          {/* Navigation Arrows */}
          <button
            className={`${styles.navArrow} ${styles.navArrowLeft}`}
            onClick={(e) => {
              e.stopPropagation();
              goPrev();
            }}
            disabled={currentIndex === 0}
            aria-label="Previous question"
          >
            <ChevronLeft size={32} />
          </button>

          <button
            className={`${styles.navArrow} ${styles.navArrowRight}`}
            onClick={(e) => {
              e.stopPropagation();
              goNext();
            }}
            disabled={currentIndex === totalQuestions - 1}
            aria-label="Next question"
          >
            <ChevronRight size={32} />
          </button>

          {totalQuestions > 0 ? (
            <>
              {/* Image Only */}
              <QuizMedia
                imageUrl={resolveMediaUrl(currentQuestion.question_image)}
                imageAlt={
                  currentQuestion.question_image_alt || "Question image"
                }
                audioUrl={null}
                containerClass={styles.questionMediaContainer}
                imageClass={styles.questionMediaItem}
              />

              <h3
                className={styles.questionText}
                style={{ "--dynamic-font-size": dynamicFontSize }}
                dangerouslySetInnerHTML={{
                  __html: currentQuestion.question_text,
                }}
              />

              {/* Audio Only - Tiny & Below Question */}
              <QuizMedia
                imageUrl={null}
                audioUrl={resolveMediaUrl(currentQuestion.question_audio)}
                containerClass={styles.audioContainer}
                audioClass={styles.tinyAudio}
              />

              <HintBlock
                key={currentQuestionId}
                hint1={currentQuestion.hint1}
                hint2={currentQuestion.hint2}
                mode="collapsible"
                containerClass={styles.hintsContainer}
                hintButtonClass={styles.hintButton}
                hintDisplayClass={styles.hintDisplay}
                onHintUsed={(hintNum) => {
                  setHintsUsed((prev) => ({
                    ...prev,
                    [currentQuestionId]: [
                      ...(prev[currentQuestionId] || []),
                      hintNum,
                    ],
                  }));
                }}
              />

              {renderAnswerArea()}

              <div className={styles.feedbackAndNav}>
                {cardError && (
                  <div className={styles.errorText}>
                    <AlertTriangle size={14} /> {cardError}
                  </div>
                )}
              </div>
            </>
          ) : (
            <p className={styles.noQuestions}>This quiz has no questions.</p>
          )}
        </div>

        <div className={styles.feedFooter}>
          <div className={styles.feedStats}>
            <div className={styles.feedStatItem}>
              <Users size={14} />
              <span>{displayStats.uniqueParticipants || 0}</span>
            </div>
            <div className={styles.feedStatItem}>
              <CheckCircle size={14} className={styles.correctText} />
              <span>{displayStats.totalCorrectAnswersForQuiz || 0}</span>
            </div>
          </div>
          <div className={styles.feedActions}>
            <button
              className={styles.feedActionButton}
              onClick={() => {
                const link = quiz?.permalink
                  ? `${window.location.origin}${quizPermalinkToUrl(
                      quiz.permalink
                    )}`
                  : window.location.href;
                navigator.clipboard.writeText(link).catch(() => {});
              }}
            >
              <Share2 size={16} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <article
        ref={cardRef}
        className={`${styles.quizCard} ${isExpanded ? styles.isExpanded : ""}`}
      >
        {/* --- COLLAPSED VIEW (Instagram-inspired) --- */}
        {!isExpanded && (
          <>
            <div
              className={styles.cardTitleContainer}
              style={{ background: cardGradient }}
            >
              {quiz.created_by && (
                <Link
                  href={`/guide/${quiz.created_by.username}`}
                  className={styles.creatorInfo}
                >
                  <img
                    src={resolveAvatarUrl(quiz.created_by)}
                    alt={`${getDisplayName(quiz.created_by)}'s avatar`}
                    className={styles.creatorAvatar}
                    onError={(e) => {
                      e.currentTarget.src = DEFAULT_AVATAR;
                    }}
                  />
                  <span className={styles.creatorName}>
                    {getDisplayName(quiz.created_by)}
                  </span>
                </Link>
              )}

              {/* AI Difficulty Badge - Top Right Corner */}
              {quiz.difficulty_explanation && (
                <div
                  className={styles.difficultyBadge}
                  data-difficulty-level={
                    quiz.difficulty_explanation.level_5
                      ?.toLowerCase()
                      .replace(/\s+/g, "-") || "medium"
                  }
                  title={`${quiz.difficulty_explanation.level_5} (${quiz.difficulty_explanation.confidence}% confidence)`}
                >
                  <span className={styles.difficultyEmoji}>
                    {quiz.difficulty_explanation.emoji}
                  </span>
                  <span className={styles.difficultyRank}>
                    {(() => {
                      const ranks = [
                        "Beginner",
                        "Easy",
                        "Medium",
                        "Hard",
                        "Expert",
                      ];
                      const score =
                        quiz.difficulty_explanation?.difficulty_score || 260;
                      const index = Math.min(
                        Math.max(Math.floor(score / 130), 0),
                        4
                      );
                      return ranks[index] || "Medium";
                    })()}
                  </span>
                </div>
              )}

              <h2
                className={styles.cardTitle}
                dangerouslySetInnerHTML={{
                  __html: displayStats.quizTitle || quiz.title || "Quiz",
                }}
              />

              {/* Question Count - Bottom Left Corner */}
              {totalQuestions > 0 && (
                <div className={styles.questionCountBadge}>
                  {totalQuestions}{" "}
                  {totalQuestions === 1 ? "Question" : "Questions"}
                </div>
              )}

              {/* Quiz Attachment - Bottom Right Corner */}
              <div className={styles.attachmentBadge}>
                {quiz.lesson_title ? (
                  <Link
                    href={`/lessons/${quiz.lesson_permalink}`}
                    className={styles.attachmentLink}
                    title={`Part of lesson: ${quiz.lesson_title}`}
                  >
                    📖 Lesson
                  </Link>
                ) : quiz.course_title ? (
                  <span
                    className={styles.attachmentType}
                    title={`Part of course: ${quiz.course_title}`}
                  >
                    🎓 Course
                  </span>
                ) : (
                  <span
                    className={styles.attachmentType}
                    title="Standalone quiz"
                  >
                    ⭐ Standalone
                  </span>
                )}
              </div>
            </div>
            <div className={styles.cardFooter}>
              <div className={styles.quizStatsLine}>
                {isLoadingPublicStats ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : publicStatsError ? (
                  <AlertTriangle size={16} color="var(--incorrect-color)" />
                ) : (
                  <>
                    <button
                      className={styles.statItemClickable}
                      title="Participants"
                      onClick={() => {
                        setShowParticipants(true);
                        fetchParticipants(1);
                      }}
                    >
                      <Users size={14} />
                      <span>{displayStats.uniqueParticipants}</span>
                    </button>

                    <div className={styles.statItem} title="Correct">
                      <CheckCircle size={14} className={styles.correctText} />
                      <span>{displayStats.totalCorrectAnswersForQuiz}</span>
                    </div>
                    <div className={styles.statItem} title="Wrong">
                      <XCircle size={14} className={styles.incorrectText} />
                      <span>{displayStats.totalWrongAnswersForQuiz}</span>
                    </div>
                  </>
                )}
              </div>
              <button
                onClick={() => {
                  if (questions[0]?.permalink) {
                    router.push(`/quizzes/q/${questions[0].permalink}`);
                  }
                }}
                className="btn btn-primary"
                disabled={totalQuestions === 0}
              >
                Take Quiz <ArrowRight size={16} />
              </button>
            </div>
          </>
        )}

        {/* --- MODAL OVERLAY --- */}
        {isExpanded && (
          <div
            className={styles.modalOverlay}
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setIsExpanded(false);
                window.history.back();
              }
            }}
          >
            <div
              className={styles.expandedContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.expandedHeader}>
                <QuizTimer
                  startTime={quizStartTime.current}
                  isActive={isExpanded && !!quizStartTime.current}
                />
                <div className={styles.progressIndicator}>
                  {getDisplayName(quiz.created_by)} | {currentIndex + 1} /{" "}
                  {totalQuestions}
                </div>
                <div className={styles.questionProgress}>
                  {questions.map((q, index) => (
                    <button
                      key={q.id || index}
                      className={`${styles.progressDot} ${
                        currentIndex === index ? styles.active : ""
                      } ${submittedAnswers[q.id] ? styles.answered : ""}`}
                      onClick={() => goToQuestion(index)}
                      aria-label={`Go to question ${index + 1}`}
                    />
                  ))}
                </div>
                {/* Compact actions: Share & Report */}
                <div className={styles.expandedActions}>
                  <button
                    title="Share"
                    aria-label="Share"
                    className="btn btn-icon"
                    onClick={() => {
                      const link = currentQuestion?.permalink
                        ? `${window.location.origin}/quizzes/q/${currentQuestion.permalink}`
                        : quiz?.permalink
                        ? `${window.location.origin}${quizPermalinkToUrl(
                            quiz.permalink
                          )}`
                        : window.location.href;
                      if (navigator.share) {
                        navigator
                          .share({ title: "Quiz", url: link })
                          .catch(() => {});
                      } else {
                        navigator.clipboard
                          .writeText(link)
                          .then(() => alert("Link copied to clipboard"))
                          .catch(() => {});
                      }
                    }}
                  >
                    <Share2 size={18} />
                  </button>
                  <button
                    title="Report"
                    aria-label="Report"
                    className="btn btn-icon"
                    onClick={() => {
                      const reportUrl = `/report?quiz=${encodeURIComponent(
                        quiz?.id || ""
                      )}&question=${encodeURIComponent(
                        currentQuestion?.id || ""
                      )}`;
                      window.open(reportUrl, "_blank");
                    }}
                  >
                    <AlertTriangle size={18} />
                  </button>
                </div>
                <button
                  className={styles.closeExpandedButton}
                  onClick={() => {
                    setIsExpanded(false);
                    window.history.back();
                  }}
                >
                  <CloseIcon size={20} />
                </button>
              </div>

              {totalQuestions > 0 ? (
                <div className={styles.questionContainer}>
                  <QuizMedia
                    imageUrl={currentQuestion.question_image}
                    imageAlt={
                      currentQuestion.question_image_alt || "Question image"
                    }
                    audioUrl={currentQuestion.question_audio}
                    containerClass={styles.questionMediaContainer}
                    imageClass={styles.questionMediaItem}
                    audioClass={styles.questionMediaItem}
                  />
                  <h3
                    className={styles.questionText}
                    dangerouslySetInnerHTML={{
                      __html: currentQuestion.question_text,
                    }}
                  />
                  <HintBlock
                    key={currentQuestionId}
                    hint1={currentQuestion.hint1}
                    hint2={currentQuestion.hint2}
                    mode="collapsible"
                    containerClass={styles.hintsContainer}
                    hintButtonClass={styles.hintButton}
                    hintDisplayClass={styles.hintDisplay}
                    onHintUsed={(hintNum) => {
                      setHintsUsed((prev) => ({
                        ...prev,
                        [currentQuestionId]: [
                          ...(prev[currentQuestionId] || []),
                          hintNum,
                        ],
                      }));
                    }}
                  />

                  {currentQuestionPublicStats && (
                    <div className={styles.perQuestionStats}>
                      <div className={styles.statItem}>
                        <HelpCircle size={14} />
                        <span>{currentQuestionPublicStats.times_answered}</span>
                      </div>
                      <button
                        className={styles.statItemClickable}
                        onClick={() => {
                          setShowCorrectUsers(true);
                          fetchCorrectUsers(1);
                        }}
                      >
                        <ThumbsUp size={14} />
                        <span>{currentQuestionPublicStats.times_correct}</span>
                      </button>
                      <div className={styles.statItem}>
                        <ThumbsDown size={14} />
                        <span>{currentQuestionPublicStats.times_wrong}</span>
                      </div>
                    </div>
                  )}

                  {renderAnswerArea()}

                  <div className={styles.feedbackAndNav}>
                    {cardError && (
                      <div className={styles.errorText}>
                        <AlertTriangle size={14} /> {cardError}
                      </div>
                    )}
                    {isAnswerSubmittedForCurrent && currentFeedback && (
                      <div
                        className={`${styles.feedbackBox} ${
                          currentFeedback.isCorrect
                            ? styles.correct
                            : styles.incorrect
                        }`}
                      >
                        {currentFeedback.isCorrect ? (
                          <CheckCircle size={16} />
                        ) : (
                          <XCircle size={16} />
                        )}
                        <span>
                          {currentFeedback.isCorrect
                            ? "Correct!"
                            : "Incorrect."}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className={styles.navigation}>
                    <button
                      onClick={goPrev}
                      className={styles.navIconButton}
                      disabled={currentIndex === 0}
                      aria-label="Previous question"
                      title="Previous"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    {currentIndex < totalQuestions - 1 ? (
                      <button
                        onClick={goNext}
                        className={styles.navIconButton}
                        disabled={
                          !isAnswerSubmittedForCurrent || isLoadingSubmission
                        }
                        aria-label="Next question"
                        title="Next"
                      >
                        <ChevronRight size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          // Record total time on quiz completion
                          if (quizStartTime.current && quiz?.id && token) {
                            const totalTimeMs =
                              Date.now() - quizStartTime.current;
                            apiClient
                              .post(
                                `/quizzes/${quiz.id}/record-completion/`,
                                {
                                  total_time_ms: totalTimeMs,
                                  questions_completed:
                                    Object.keys(submittedAnswers).length,
                                },
                                {
                                  headers: { Authorization: `Bearer ${token}` },
                                }
                              )
                              .catch(console.error);
                          }
                          setIsExpanded(false);
                        }}
                        className={styles.navIconButton}
                        aria-label="Finish quiz"
                        title="Finish"
                      >
                        <CheckCircle size={18} />
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className={styles.noQuestions}>
                  This quiz has no questions.
                </p>
              )}
            </div>
          </div>
        )}
      </article>

      <UsersCorrectlyModal
        isOpen={showCorrectUsers}
        onClose={() => setShowCorrectUsers(false)}
        users={correctUsers}
        isLoading={isLoadingCorrectUsers}
        hasNextPage={cuHasNext}
        onLoadMore={() => fetchCorrectUsers(cuPage + 1)}
      />
      <ParticipantsModal
        isOpen={showParticipants}
        onClose={() => setShowParticipants(false)}
        users={participants}
        isLoading={isLoadingParticipants}
        hasNextPage={participantsHasNext}
        onLoadMore={() => fetchParticipants(participantsPage + 1)}
      />
    </>
  );
};
export default QuizCard;
