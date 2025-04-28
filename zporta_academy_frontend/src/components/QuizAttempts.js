import React, { useEffect, useState, useContext, useCallback } from "react";
import { Link } from "react-router-dom";
// Import recharts if ScoreChart or QuizPerformanceChart depend on it, otherwise remove if unused.
// Assuming ScoreChart might use something simple or custom SVG, no top-level recharts import needed here unless QuizPerformanceChart uses it.
import apiClient from "../api"; // Assuming apiClient is configured
import { AuthContext } from "../context/AuthContext"; // Assuming AuthContext is set up
import styles from "./QuizAttempts.module.css"; // Import CSS Module
import QuizPerformanceChart from "./QuizPerformanceChart"; // Assuming this component exists for the attempts list
import ScoreChart from "./ScoreChart"; // Re-introducing ScoreChart for the subject scores
import { AlertCircle, Loader, Inbox, TrendingUp, Percent, Clock, UserCheck } from 'lucide-react'; // Added more relevant icons

// --- Helper Function for Date Formatting ---
const formatDate = (isoString) => {
  if (!isoString) return "N/A";
  try {
    return new Date(isoString).toLocaleString(undefined, { // Use locale-sensitive formatting
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch (e) {
    console.error("Error formatting date:", e);
    return "Invalid Date";
  }
};

// --- Helper function to format detail labels ---
const formatDetailLabel = (key) => {
    switch (key) {
        case 'accuracy': return 'Accuracy';
        case 'engagement': return 'Engagement';
        case 'recency': return 'Recency';
        case 'tenure': return 'Tenure';
        default: return key.charAt(0).toUpperCase() + key.slice(1);
    }
};

// --- Helper function to get icons for details ---
const getDetailIcon = (key) => {
    switch (key) {
        case 'accuracy': return <Percent size={14} className={styles.detailIcon} />;
        case 'engagement': return <TrendingUp size={14} className={styles.detailIcon} />;
        case 'recency': return <Clock size={14} className={styles.detailIcon} />;
        case 'tenure': return <UserCheck size={14} className={styles.detailIcon} />;
        default: return null;
    }
};


// --- Quiz Attempts Component ---
const QuizAttempts = () => {
  // --- State Variables ---
  const [aggregatedAttempts, setAggregatedAttempts] = useState([]);
  const [userScoresBySubject, setUserScoresBySubject] = useState({});
  const [loadingAttempts, setLoadingAttempts] = useState(true); // Specific loading state
  const [loadingScores, setLoadingScores] = useState(true); // Specific loading state
  const [attemptsError, setAttemptsError] = useState("");
  const [scoresError, setScoresError] = useState("");

  // --- Hooks ---
  const { token, logout } = useContext(AuthContext);

  // --- Data Fetching Callbacks (Identical to previous versions) ---
  const fetchAttempts = useCallback(async () => {
    setLoadingAttempts(true);
    setAttemptsError("");
    try {
      const response = await apiClient.get("/events/", {
         headers: { Authorization: `Bearer ${token}` }
      });

      if (Array.isArray(response.data)) {
        const answerEvents = response.data.filter(
          (event) => event.event_type === "quiz_answer_submitted" && event.object_id && event.quiz_permalink
        );
        const grouped = answerEvents.reduce((acc, event) => {
          const quizId = event.object_id;
          if (!acc[quizId]) acc[quizId] = [];
          acc[quizId].push(event);
          return acc;
        }, {});
        const aggregated = Object.keys(grouped).map((quizId) => {
          const events = grouped[quizId];
          if (!events || events.length === 0) return null;
          const firstEvent = events[0];
          const quiz_permalink = firstEvent.quiz_permalink;
          const quiz_title = firstEvent.quiz_title || `Quiz ${quizId}`;
          const total = events.length;
          const correct = events.filter(e => e.metadata?.is_correct === true).length;
          const wrong = total - correct;
          const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
          const timestamp = events.reduce((earliest, event) => {
             try {
                 const currentEventDate = new Date(event.timestamp);
                 return currentEventDate < new Date(earliest) ? event.timestamp : earliest;
             } catch { return earliest; }
          }, events[0].timestamp);
          return { quizId, quiz_title, quiz_permalink, total, correct, wrong, percentage, timestamp };
        }).filter(Boolean);
        aggregated.sort((a, b) => {
           try { return new Date(b.timestamp) - new Date(a.timestamp); }
           catch { return 0; }
        });
        setAggregatedAttempts(aggregated);
      } else {
        console.error("Unexpected data format for attempts:", response.data);
        setAttemptsError("Unexpected data format received for quiz attempts.");
      }
    } catch (err) {
      console.error("Failed to fetch quiz attempts:", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      } else {
        setAttemptsError("Failed to load your quiz attempts. Please try again later.");
      }
    } finally {
      setLoadingAttempts(false);
    }
  }, [token, logout]);

  const fetchUserScore = useCallback(async () => {
    setLoadingScores(true);
    setScoresError("");
    try {
      const { data } = await apiClient.get('/users/score/', {
         headers: { Authorization: `Bearer ${token}` }
      });
      if (typeof data === 'object' && data !== null) {
        setUserScoresBySubject(data);
      } else {
        console.error("Unexpected data format for scores:", data);
        setScoresError("Unexpected data format received for scores.");
        setUserScoresBySubject({});
      }
    } catch (err) {
      console.error("Failed to fetch user score:", err);
       if (err.response?.status === 401 || err.response?.status === 403) {
         setScoresError("Could not load scores due to authorization issue.");
       } else {
         setScoresError("Failed to load your scores by subject.");
       }
       setUserScoresBySubject({});
    } finally {
      setLoadingScores(false);
    }
  }, [token]);

  // --- Effect to Fetch Data ---
  useEffect(() => {
    if (token) {
      fetchAttempts();
      fetchUserScore();
    } else {
      setLoadingAttempts(false);
      setLoadingScores(false);
      setAttemptsError("Please log in to view your quiz attempts.");
      setScoresError("Please log in to view your scores.");
      setAggregatedAttempts([]);
      setUserScoresBySubject({});
    }
  }, [token, fetchAttempts, fetchUserScore]);

  // --- Render Logic ---
  // const isLoading = loadingAttempts || loadingScores; // Can use this if needed for a single initial loader

  return (
    <div className={styles.quizAttemptsPage}>

      {/* --- Scores Per Subject Section (Improved Card Layout) --- */}
      <section className={styles.userScoreContainer}>
        <h2 className={styles.sectionTitle}>Your Scores by Subject</h2>
        {loadingScores ? (
          <div className={styles.loadingContainer}><Loader className={styles.loadingIcon} size={32} /> Loading Scores...</div>
        ) : scoresError ? (
          <div className={styles.errorContainer}><AlertCircle size={20} /> {scoresError}</div>
        ) : Object.keys(userScoresBySubject).length > 0 ? (
          <div className={styles.subjectScoreGrid}>
            {Object.entries(userScoresBySubject)
              // Optional: Sort subjects alphabetically or by score
              .sort(([subjectA, scoreInfoA], [subjectB, scoreInfoB]) => subjectA.localeCompare(subjectB)) // Sort alphabetically
              // .sort(([_, scoreInfoA], [__, scoreInfoB]) => (scoreInfoB?.score ?? 0) - (scoreInfoA?.score ?? 0)) // Sort by score desc
              .map(([subjectName, scoreInfo]) => (
              // Validate scoreInfo and scoreInfo.score before rendering
              scoreInfo && typeof scoreInfo.score === 'number' ? (
                <div key={subjectName} className={styles.subjectScoreCard}>
                  {/* Top section with Chart and Main Score */}
                  <div className={styles.subjectScoreCardTop}>
                    <div className={styles.scoreChartWrapper}>
                      {/* Pass score, ensure ScoreChart handles rendering */}
                      <ScoreChart score={scoreInfo.score} />
                    </div>
                    <div className={styles.subjectScoreCardInfo}>
                      <h3 className={styles.subjectTitle}>{subjectName}</h3>
                      <p className={styles.subjectScoreValue}>
                        {scoreInfo.score}
                        <span className={styles.scoreOutOf}> / 100</span>
                      </p>
                    </div>
                  </div>

                  {/* Bottom section for Details */}
                  {scoreInfo.details && (
                    <div className={styles.scoreDetails}>
                      {Object.entries(scoreInfo.details).map(([key, value]) => (
                        <div key={key} className={styles.detailItem}>
                           {getDetailIcon(key)}
                           <span className={styles.detailLabel}>{formatDetailLabel(key)}:</span>
                           <span className={styles.detailValue}>{value ?? 'N/A'}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : null // Don't render card if score info is invalid
            ))}
          </div>
        ) : (
           <div className={styles.noDataContainer}><Inbox size={24} /> No score data available yet.</div>
        )}
      </section>

      {/* --- Quiz Attempts Section (Remains the same) --- */}
      <section className={styles.quizAttemptsContainer}>
         <h2 className={styles.sectionTitle}>Your Quiz Attempts</h2>
         {loadingAttempts ? (
           <div className={styles.loadingContainer}><Loader className={styles.loadingIcon} size={32} /> Loading Attempts...</div>
         ) : attemptsError ? (
           <div className={styles.errorContainer}><AlertCircle size={20} /> {attemptsError}</div>
         ) : aggregatedAttempts.length > 0 ? (
           <div className={styles.quizAttemptsList}>
              {aggregatedAttempts.map((attempt) => (
                <div key={attempt.quizId + attempt.timestamp} className={styles.quizAttemptCard}>
                   <div className={styles.cardHeader}>
                     <h3 className={styles.cardTitle}>{attempt.quiz_title}</h3>
                     <p className={styles.cardDate}>
                        Attempted: {formatDate(attempt.timestamp)}
                     </p>
                   </div>
                   <div className={styles.cardBody}>
                     <div className={styles.cardChartContainer}>
                        <QuizPerformanceChart
                          total={attempt.total}
                          correct={attempt.correct}
                          wrong={attempt.wrong}
                        />
                        <p className={styles.cardPercentage}>{attempt.percentage}%</p>
                     </div>
                     <div className={styles.cardStats}>
                        <p><span>Total Questions:</span> <span>{attempt.total}</span></p>
                        <p><span>Correct:</span> <span className={styles.statCorrect}>{attempt.correct}</span></p>
                        <p><span>Wrong:</span> <span className={styles.statWrong}>{attempt.wrong}</span></p>
                     </div>
                   </div>
                   <div className={styles.cardFooter}>
                     {attempt.quiz_permalink ? (
                        <Link to={`/quiz/${attempt.quiz_permalink}`} className={styles.cardReviewButton}>
                           View Quiz
                        </Link>
                     ) : (
                        <span className={styles.noReviewLink}>Review Unavailable</span>
                     )}
                   </div>
                </div>
              ))}
           </div>
         ) : (
           <div className={styles.noDataContainer}>
              <Inbox size={24} />
              You haven't attempted any quizzes yet.
              <Link to="/quizzes" className={styles.findQuizLink}> Find a quiz to start!</Link>
           </div>
         )}
      </section>
    </div>
  );
};

export default QuizAttempts;
