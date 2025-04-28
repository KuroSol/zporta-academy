import React, { useState, useContext } from 'react';
import apiClient from '../api'; // Assuming apiClient is configured
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext is set up
import { ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import styles from './QuizCard.module.css'; // Import CSS Module

// --- Interactive Quiz Card Component ---
// Expects a 'quiz' object prop with:
// - id: number | string
// - title: string
// - questions: array of question objects (with id, question_text, option1-4, correct_option)
const QuizCard = ({ quiz }) => {
  // --- State Variables ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false); // Submitted for the *current* question

  // --- Hooks ---
  const { token, logout } = useContext(AuthContext); // Get token and logout from context

  // --- Basic Validation & Derived Values ---
  if (!quiz || !quiz.id || typeof quiz.title !== 'string') {
    console.warn("Invalid quiz prop passed to QuizCard:", quiz);
    return (
      <div className={styles.quizCard} aria-live="polite">
        <p className={styles.errorMessage}>Invalid Quiz Data</p>
      </div>
    );
  }

  const questions = Array.isArray(quiz.questions) ? quiz.questions : [];
  const totalQuestions = questions.length;

  // Handle case where quiz has no questions
  if (totalQuestions === 0) {
    return (
      <article className={styles.quizCard}>
        <h3 className={styles.cardTitle}>{quiz.title}</h3>
        <p className={styles.noQuestions}>No questions available for this quiz.</p>
      </article>
    );
  }

  // Ensure currentIndex is valid
  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), totalQuestions - 1);
  const currentQuestion = questions[safeCurrentIndex] ?? {}; // Use empty object as fallback

  // Filter valid options
  const options = [
    currentQuestion.option1,
    currentQuestion.option2,
    currentQuestion.option3,
    currentQuestion.option4,
  ].filter(Boolean); // Filter out null/empty options

  // --- Event Handlers ---
  const handleAnswer = async (selectedIndex) => {
    if (answerSubmitted || !currentQuestion.id) return; // Prevent multiple submissions or actions without data

    const correctAnswerIndex = currentQuestion.correct_option - 1; // API gives 1-based index
    const wasCorrect = selectedIndex === correctAnswerIndex;

    setSelectedAnswerIndex(selectedIndex);
    setIsCorrect(wasCorrect);
    setAnswerSubmitted(true); // Mark as submitted for this question

    // Send answer record to backend (only if logged in)
    if (token) {
        try {
          await apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
            question_id: currentQuestion.id,
            selected_option: selectedIndex + 1 // Send 1-based index to API
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
          // console.log("Answer recorded successfully for quiz card.");
        } catch (err) {
          console.error("Error recording answer from quiz card:", err);
          if (err.response?.status === 401) {
            logout(); // Handle unauthorized
          }
          // Optionally show a non-blocking error to the user
        }
    } else {
        console.warn("User not logged in. Answer not recorded.");
        // Optionally inform the user they need to log in to save progress
    }
  };

  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      // Reset state for the new question
      setSelectedAnswerIndex(null);
      setIsCorrect(null);
      setAnswerSubmitted(false);
    }
  };

  const goPrev = () => goToQuestion(safeCurrentIndex - 1);
  const goNext = () => goToQuestion(safeCurrentIndex + 1);

  // --- Dynamic ClassName Logic ---
  const getOptionClassName = (index) => {
    let className = styles.optionButton;
    if (answerSubmitted) {
      const correctAnswerIndex = (typeof currentQuestion.correct_option === 'number' && currentQuestion.correct_option > 0)
                                 ? currentQuestion.correct_option - 1 : -1;

      if (correctAnswerIndex !== -1 && index === correctAnswerIndex) {
        className += ` ${styles.correct}`;
      }
      if (index === selectedAnswerIndex) {
        className += isCorrect ? ` ${styles.selectedCorrect}` : ` ${styles.selectedIncorrect}`;
      } else {
        if (selectedAnswerIndex !== null || correctAnswerIndex === -1) {
           className += ` ${styles.disabled}`;
        }
      }
    }
    return className;
  };

  // --- Render Component ---
  return (
    <article className={styles.quizCard}>
      {/* Card Header */}
      <div className={styles.cardHeader}>
        <h3 className={styles.cardTitle}>{quiz.title}</h3>
        {totalQuestions > 0 && (
           <span className={styles.progressText}>
             Q {safeCurrentIndex + 1} / {totalQuestions}
           </span>
        )}
      </div>

      {/* Question Area */}
      <div className={styles.questionArea}>
        <div
          className={styles.questionText}
          dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Loading...' }}
        />
      </div>

      {/* Options List */}
      <div className={styles.optionsList}>
        {options.map((optionHtml, index) => (
          <button
            key={index}
            type="button"
            className={getOptionClassName(index)}
            onClick={() => handleAnswer(index)}
            disabled={answerSubmitted}
            dangerouslySetInnerHTML={{ __html: optionHtml }}
            aria-pressed={selectedAnswerIndex === index}
          />
        ))}
      </div>

      {/* Feedback Area - appears after submission */}
      {answerSubmitted && (
        <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
          {isCorrect ? (
            <>
              <CheckCircle size={18} className={styles.feedbackIcon} /> Correct!
            </>
          ) : (
            <>
              <XCircle size={18} className={styles.feedbackIcon} /> Incorrect.
            </>
          )}
        </div>
      )}

      {/* Navigation Controls */}
      <div className={styles.navigation}>
        <button
          type="button"
          className={styles.navButton}
          onClick={goPrev}
          disabled={safeCurrentIndex === 0}
          aria-label="Previous Question"
        >
          <ChevronLeft size={20} />
          {/* <span>Prev</span> */}
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={goNext}
          disabled={safeCurrentIndex === totalQuestions - 1}
          aria-label="Next Question"
        >
          {/* <span>Next</span> */}
          <ChevronRight size={20} />
        </button>
      </div>
    </article>
  );
};

export default QuizCard;