import React, { useState, useEffect } from "react";
import { Clock } from "lucide-react";

/**
 * Stylish timer overlay for quizzes
 * Shows elapsed time in MM:SS format
 */
const QuizTimer = ({ startTime, isActive = true, className = "" }) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isActive || !startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = now - startTime;
      setElapsed(Math.floor(diff / 1000)); // convert to seconds
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, isActive]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (!isActive || !startTime) return null;

  const containerStyle = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.35rem",
    padding: "0.2rem 0.5rem",
    borderRadius: "999px",
    background: "rgba(31, 41, 55, 0.92)",
    color: "#fff",
    fontSize: "0.75rem",
    lineHeight: 1,
    border: "1px solid rgba(255, 255, 255, 0.15)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
  };

  return (
    <div
      className={`quiz-timer ${className}`}
      aria-live="polite"
      title="Elapsed time"
      style={containerStyle}
    >
      <Clock size={14} />
      <span className="quiz-timer-text">{formatTime(elapsed)}</span>
    </div>
  );
};

export default QuizTimer;
