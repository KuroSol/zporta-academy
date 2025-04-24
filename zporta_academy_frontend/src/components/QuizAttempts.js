// src/components/QuizAttempts.js
import React, { useEffect, useState, useContext } from "react";
import { Link } from "react-router-dom";
import apiClient from "../api";
import { AuthContext } from "../context/AuthContext";
import "./QuizAttempts.css";
import QuizPerformanceChart from "./QuizPerformanceChart";
import ScoreChart from "./ScoreChart";

const QuizAttempts = () => {
  const [aggregatedAttempts, setAggregatedAttempts] = useState([]);
  const [userScoresBySubject, setUserScoresBySubject] = useState({}); // Corrected state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { token, logout } = useContext(AuthContext);

  useEffect(() => {
    if (!token) {
      setError("Please log in to view your quiz attempts.");
      setLoading(false);
      return;
    }

    const fetchAttempts = async () => {
      setLoading(true);
      setError("");
      try {
        const response = await apiClient.get("/events/");
        if (Array.isArray(response.data)) {
          const answerEvents = response.data.filter(
            (event) => event.event_type === "quiz_answer_submitted"
          );
          const grouped = answerEvents.reduce((acc, event) => {
            const quizId = event.object_id;
            if (!acc[quizId]) acc[quizId] = [];
            acc[quizId].push(event);
            return acc;
          }, {});

          const aggregated = Object.keys(grouped).map((quizId) => {
            const events = grouped[quizId];
            const quiz_permalink = events[0].quiz_permalink;
            const total = events.length;
            const correct = events.filter(e => e.metadata && e.metadata.is_correct).length;
            const wrong = total - correct;
            const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
            const timestamp = events.reduce((earliest, event) => 
              new Date(event.timestamp) < new Date(earliest) ? event.timestamp : earliest,
              events[0].timestamp
            );
            const quiz_title = events[0].quiz_title;

            return { quizId, quiz_title, quiz_permalink, total, correct, wrong, percentage, timestamp };
          });

          aggregated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          setAggregatedAttempts(aggregated);
        } else {
          setError("Unexpected data format received.");
        }
      } catch (err) {
        setError("Failed to fetch quiz attempts.");
        if (err.response?.status === 401 || err.response?.status === 403) logout();
      } finally {
        setLoading(false);
      }
    };

    const fetchUserScore = async () => {
      try {
        const { data } = await apiClient.get('/users/score/');
        console.log('API Response for score:', data); // For debugging
        setUserScoresBySubject(data);  // Directly set data
      } catch (err) {
        console.error("Failed to fetch user score:", err);
      }
    };

    fetchAttempts();
    fetchUserScore();
  }, [token, logout]);

  return (
    <div className="quiz-attempts-page">
      {/* --- Scores Per Subject Section --- */}
      {/* Conditionally render the whole container */}
      {Object.keys(userScoresBySubject).length > 0 && (
        <div className="user-score-container">
          <h2>Your Scores by Subject</h2>
          {/* Added subject-score-grid wrapper */}
          <div className="subject-score-grid">
            {Object.entries(userScoresBySubject).map(([subjectName, scoreInfo]) => (
              // Check if scoreInfo and scoreInfo.score exist before rendering card
              scoreInfo && typeof scoreInfo.score === 'number' ? (
                <div key={subjectName} className="subject-score-card">
                  {/* Added wrapper for content layout */}
                  <div className="subject-score-card-content">
                    {/* Added wrapper for chart */}
                    <div className="score-chart-wrapper">
                       <ScoreChart score={scoreInfo.score} />
                    </div>
                    {/* Added wrapper for text info */}
                    <div className="subject-score-card-info">
                       <h3>{subjectName}: {scoreInfo.score}/100</h3>
                       {/* Optional: Add other quick info here if needed */}
                    </div>
                  </div>
                  {/* Check if details exist before rendering description */}
                  {scoreInfo.details && (
                    <p className="score-description">
                      {/* Using spans for potentially better wrapping/styling control */}
                      <span>Acc: {scoreInfo.details.accuracy}%</span> |
                      <span>Eng: {scoreInfo.details.engagement}%</span> |
                      <span>Rec: {scoreInfo.details.recency}%</span> |
                      <span>Ten: {scoreInfo.details.tenure}%</span>
                    </p>
                  )}
                </div>
              ) : null // Don't render card if score info is invalid
            ))}
          </div>
        </div>
      )}
      {/* Optionally show error specific to scores */}
      {/* {error === "Could not load subject scores." && <p className="error-message">{error}</p>} */}


      {/* --- Quiz Attempts Section --- */}
      <h2>Your Quiz Attempts</h2>
      {/* Display general error OR specific attempts error */}
      {error && error !== "Could not load subject scores." && <p className="error-message">{error}</p>}

      {/* Use general loading state or specific one for attempts */}
      {loading ? (
        <p className="loading-message">Loading...</p>
      ) : aggregatedAttempts.length > 0 ? (
        <div className="quiz-attempts-list">
           {/* ... aggregatedAttempts.map(...) remains the same ... */}
           {aggregatedAttempts.map((attempt) => (
            <div key={attempt.quizId} className="quiz-attempt-card">
                {/* ... card content ... */}
                <div className="card-header">
                    <h3 className="card-title">{attempt.quiz_title}</h3>
                    <p className="card-date">
                      Attempted on: {new Date(attempt.timestamp).toLocaleString()}
                    </p>
                </div>
                <div className="card-body">
                  <div className="card-chart-container">
                      <QuizPerformanceChart
                        total={attempt.total}
                        correct={attempt.correct}
                        wrong={attempt.wrong}
                      />
                      <p className="card-percentage">{attempt.percentage}% Score</p>
                  </div>
                  <div className="card-stats">
                      <p>Total Questions: <span>{attempt.total}</span></p>
                      <p>Correct Answers: <span className="stat-correct">{attempt.correct}</span></p>
                      <p>Wrong Answers: <span className="stat-wrong">{attempt.wrong}</span></p>
                  </div>
                </div>
                <div className="card-footer">
                  <Link to={attempt.quiz_permalink ? `/quizzes/${attempt.quiz_permalink}` : `/quizzes/review/${attempt.quizId}`} className="card-review-button">
                      Review Attempt
                  </Link>
                </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="no-attempts-message">You haven't attempted any quizzes yet. <Link to="/quizzes">Find a quiz!</Link></p>
      )}
    </div>
  );
};

export default QuizAttempts;
