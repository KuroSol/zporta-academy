import React, { useState, useContext } from 'react';
import apiClient from '../api'; // Use your actual API client
import { AuthContext } from '../context/AuthContext'; // Use your actual AuthContext
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Volume2, Image as ImageIcon } from 'lucide-react'; // Added icons
import styles from './QuizCard.module.css'; // Import CSS Module

// --- Helper: Render Media (Image/Audio) for Card ---
// Adapts the QuizPage version for card styling
const RenderCardMedia = ({ url, type, alt = '', className = '' }) => {
    if (!url) return null;
    if (type === 'image') {
        return (
            <img
                src={url}
                alt={alt || 'Related image'}
                className={`${styles.cardMediaImage} ${className}`} // Use card-specific class
                onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide if image fails to load
            />
        );
    }
    if (type === 'audio') {
        return (
            <audio controls src={url} className={`${styles.cardMediaAudio} ${className}`}> {/* Use card-specific class */}
                Your browser does not support the audio element.
            </audio>
        );
    }
    return null;
};


// --- Error Display (Simplified for Card) ---
const CardErrorDisplay = ({ message }) => (
    // Added role="alert" for accessibility
    <div className={`${styles.quizCard} ${styles.errorCard}`} role="alert">
        <AlertTriangle className={styles.errorIcon} aria-hidden="true" />
        <p className={styles.errorMessage}>{message || "Error loading quiz data."}</p>
    </div>
);

// --- Interactive Quiz Card Component ---
const QuizCard = ({ quiz }) => {
  // --- State Variables ---
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [cardError, setCardError] = useState(null);

  // --- Hooks ---
  const auth = useContext(AuthContext) || {}; // Provide default empty object
  const { user, token, logout } = auth;

  // --- Basic Validation & Derived Values ---
  if (!quiz || typeof quiz !== 'object' || !quiz.id || typeof quiz.title !== 'string' || !Array.isArray(quiz.questions)) {
    console.warn("Invalid or incomplete quiz prop passed to QuizCard:", quiz);
    return <CardErrorDisplay message="Invalid quiz data provided." />;
  }

  const questions = quiz.questions;
  const totalQuestions = questions.length;

  // Base class for the card
  const rootClassName = styles.quizCard;

  // Handle empty quizzes gracefully
  if (totalQuestions === 0) {
    return (
      <article className={`${styles.quizCard} ${styles.emptyCard}`}>
        <h3 className={styles.cardTitle}>{quiz.title}</h3>
        <p className={styles.noQuestions}>No questions available in this quiz.</p>
      </article>
    );
  }

  // Ensure currentIndex is valid
  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), totalQuestions - 1);
  const currentQuestion = questions[safeCurrentIndex] ?? {};

  // Filter and structure options, similar to QuizPage but using card-specific fields if needed
  // Assuming the same field names (option1, option1_image, etc.)
  const options = [
    { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
    { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
    { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
    { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
  ].filter(o => (o.text?.trim() || o.img || o.aud)); // Filter out empty options

  // Determine the correct answer index (1-based from API to 0-based for array)
  const correctAnswerIndex = (typeof currentQuestion.correct_option === 'number' && currentQuestion.correct_option > 0)
                             ? currentQuestion.correct_option - 1
                             : -1; // Use -1 if no correct option is defined

  // --- Event Handlers ---
  const handleAnswer = async (selectedIndex) => {
    if (answerSubmitted || !currentQuestion.id || correctAnswerIndex === -1) return; // Don't process if already submitted or no correct answer defined

    setCardError(null); // Clear previous errors
    const wasCorrect = selectedIndex === correctAnswerIndex;

    setSelectedAnswerIndex(selectedIndex);
    setIsCorrect(wasCorrect);
    setAnswerSubmitted(true); // Mark as submitted

    // Record answer on backend if user is logged in
    if (token) {
        try {
          // Use the correct API endpoint and payload structure
          await apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
            question_id: currentQuestion.id,
            selected_option: selectedIndex + 1 // Send 1-based index to backend
          }, {
            // Authorization might be handled by an interceptor
            // headers: { Authorization: `Bearer ${token}` }
          });
        } catch (err) {
          console.error("Error recording answer from quiz card:", err);
          setCardError("Couldn't save answer."); // Set user-friendly error
          // Handle specific errors like 401 Unauthorized
          if (err.response?.status === 401 && typeof logout === 'function') {
             logout();
             // Optionally redirect or show a login prompt
          }
        }
    } else {
        console.warn("User not logged in. Answer not recorded.");
    }
  };

  // Navigate between questions
  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      // Reset state for the new question
      setSelectedAnswerIndex(null);
      setIsCorrect(null);
      setAnswerSubmitted(false);
      setCardError(null);
    }
  };

  const goPrev = () => goToQuestion(safeCurrentIndex - 1);
  const goNext = () => goToQuestion(safeCurrentIndex + 1);

  // --- Dynamic ClassName Logic for Options ---
  const getOptionClassName = (index) => {
    let classNames = [styles.optionButton]; // Start with base class
    const isTheCorrectAnswer = index === correctAnswerIndex;
    const isSelected = index === selectedAnswerIndex;

    if (answerSubmitted) {
        // After submission styling
        if (isTheCorrectAnswer) {
            classNames.push(styles.correct); // Style correct answer distinctly
        }
        if (isSelected) {
            // Style the selected answer (correctly or incorrectly)
            classNames.push(isCorrect ? styles.selectedCorrect : styles.selectedIncorrect);
        } else if (!isTheCorrectAnswer) {
            // Dim or disable non-selected, non-correct answers
            classNames.push(styles.disabled);
        }
    } else {
        // Before submission, allow interaction
        classNames.push(styles.interactive);
    }
    return classNames.join(' '); // Combine all classes
  };

  // --- Render Component ---
  return (
      <article className={rootClassName} role="region" aria-label={`Quiz: ${quiz.title}`}>
        {/* Card Header: Title and Progress */}
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle} dangerouslySetInnerHTML={{ __html: quiz.title || 'Quiz' }}></h3>
          {totalQuestions > 0 && (
              <span className={styles.progressText} aria-live="polite">
                Q {safeCurrentIndex + 1}/{totalQuestions}
              </span>
          )}
        </div>

        {/* Question Display Area: Media and Text */}
        {/* Ensure currentQuestion is valid before rendering */}
        {currentQuestion.id && (
            <div className={styles.questionDisplayArea}>
                {/* Render question media (image/audio) */}
                <RenderCardMedia url={currentQuestion.question_image} type="image" alt={currentQuestion.question_image_alt || 'Question image'}/>
                <RenderCardMedia url={currentQuestion.question_audio} type="audio" />

                {/* Render question text */}
                <div
                    className={styles.questionText}
                    dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Loading question...' }}
                />
            </div>
        )}

        {/* Options List */}
        {currentQuestion.id && options.length > 0 && (
            <div className={styles.optionsList} role="radiogroup" aria-labelledby={`question-text-${currentQuestion.id}`}>
            {options.map((opt, idx) => (
                <button
                key={idx}
                type="button"
                role="radio"
                aria-checked={selectedAnswerIndex === idx}
                className={getOptionClassName(idx)}
                onClick={() => handleAnswer(idx)}
                disabled={answerSubmitted} // Disable button after an answer is submitted
                >
                {/* Option Content: Image/Text/Audio */}
                <div className={styles.optionContent}>
                    {/* Render option image */}
                    {opt.img && (
                        <RenderCardMedia url={opt.img} type="image" alt={`Option ${idx + 1}`} className={styles.optionMediaImage} />
                    )}
                    {/* Render option text */}
                    {opt.text && (
                        <span
                            className={styles.optionText}
                            dangerouslySetInnerHTML={{ __html: opt.text }}
                        />
                    )}
                </div>
                {/* Render option audio (below content) */}
                {opt.aud && (
                    <RenderCardMedia
                        url={opt.aud}
                        type="audio"
                        className={styles.optionAudioControl}
                        // Stop propagation to prevent button click when interacting with audio controls
                        onClick={(e) => e.stopPropagation()}
                        onPlay={(e) => e.stopPropagation()}
                    />
                )}
                {/* Feedback Icon (Check/X) shown after submission */}
                {answerSubmitted && (
                    <div className={styles.optionFeedbackIcon}>
                        { (idx === correctAnswerIndex) && <CheckCircle size={16} aria-hidden="true" /> }
                        { (idx === selectedAnswerIndex && !isCorrect) && <XCircle size={16} aria-hidden="true" /> }
                    </div>
                )}
                </button>
            ))}
            </div>
        )}

        {/* Feedback Area: Shows correctness or errors */}
        <div className={styles.feedbackContainer}>
            {cardError && !answerSubmitted && (
                <div className={`${styles.feedbackArea} ${styles.feedbackError}`} role="alert">
                    <AlertTriangle size={16} className={styles.feedbackIcon} aria-hidden="true" /> {cardError}
                </div>
            )}
            {answerSubmitted && isCorrect !== null && (
                <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`} role="status">
                    {isCorrect
                    ? <><CheckCircle size={16} className={styles.feedbackIcon} aria-hidden="true" /> Correct!</>
                    : <><XCircle size={16} className={styles.feedbackIcon} aria-hidden="true" /> Incorrect.</>
                    }
                </div>
            )}
        </div>

        {/* Navigation Controls: Previous/Next */}
        {totalQuestions > 1 && ( // Only show navigation if more than one question
            <div className={styles.navigation}>
            <button
                type="button"
                className={styles.navButton}
                onClick={goPrev}
                disabled={safeCurrentIndex === 0} // Disable if it's the first question
                aria-label="Previous Question"
            >
                <ChevronLeft size={20} aria-hidden="true" />
                <span className={styles.visuallyHidden}>Previous</span>
            </button>
            <button
                type="button"
                className={styles.navButton}
                onClick={goNext}
                disabled={safeCurrentIndex === totalQuestions - 1} // Disable if it's the last question
                aria-label="Next Question"
            >
                <span className={styles.visuallyHidden}>Next</span>
                <ChevronRight size={20} aria-hidden="true" />
            </button>
            </div>
        )}
      </article>
  );
};

export default QuizCard;
