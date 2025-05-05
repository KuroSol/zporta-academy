import React, { useState, useContext } from 'react';
import apiClient from '../api'; // Use your actual API client
import { AuthContext } from '../context/AuthContext'; // Use your actual AuthContext
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import styles from './QuizCard.module.css'; // Import CSS Module

// --- Error Display (Simplified for Card) ---
const CardErrorDisplay = ({ message }) => (
    <div className={`${styles.quizCard} ${styles.errorCard}`}>
        <AlertTriangle className={styles.errorIcon} />
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

  const rootClassName = styles.quizCard;

  if (totalQuestions === 0) {
    return (
      <article className={`${styles.quizCard} ${styles.emptyCard}`}>
        <h3 className={styles.cardTitle}>{quiz.title}</h3>
        <p className={styles.noQuestions}>No questions available in this quiz.</p>
      </article>
    );
  }

  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), totalQuestions - 1);
  const currentQuestion = questions[safeCurrentIndex] ?? {};

  const options = [
    { html: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
    { html: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
    { html: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
    { html: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
  ].filter(o => (o.html || o.img || o.aud));

  const correctAnswerIndex = (typeof currentQuestion.correct_option === 'number' && currentQuestion.correct_option > 0)
                             ? currentQuestion.correct_option - 1
                             : -1;

  // --- Event Handlers ---
  const handleAnswer = async (selectedIndex) => {
    if (answerSubmitted || !currentQuestion.id) return;

    setCardError(null);
    const wasCorrect = correctAnswerIndex !== -1 && selectedIndex === correctAnswerIndex;

    setSelectedAnswerIndex(selectedIndex);
    setIsCorrect(wasCorrect);
    setAnswerSubmitted(true); // Mark as submitted

    if (token) {
        try {
          await apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
            question_id: currentQuestion.id,
            selected_option: selectedIndex + 1
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (err) {
          console.error("Error recording answer from quiz card:", err);
          setCardError("Couldn't save answer.");
          if (err.response?.status === 401 && typeof logout === 'function') {
             logout();
          }
        }
    } else {
        console.warn("User not logged in. Answer not recorded.");
    }
  };

  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      // Reset state for the new question
      setSelectedAnswerIndex(null);
      setIsCorrect(null);
      setAnswerSubmitted(false); // Reset submitted state for the new question
      setCardError(null);
    }
  };

  const goPrev = () => goToQuestion(safeCurrentIndex - 1);
  const goNext = () => goToQuestion(safeCurrentIndex + 1);

  // --- Dynamic ClassName Logic ---
  const getOptionClassName = (index) => {
    let classNames = [styles.optionButton];
    const isTheCorrectAnswer = correctAnswerIndex !== -1 && index === correctAnswerIndex;
    const isSelected = index === selectedAnswerIndex;

    if (answerSubmitted) {
        if (isTheCorrectAnswer) {
            classNames.push(styles.correct);
        }
        if (isSelected) {
            classNames.push(isCorrect ? styles.selectedCorrect : styles.selectedIncorrect);
        } else if (!isTheCorrectAnswer) {
            classNames.push(styles.disabled);
        }
    } else {
        classNames.push(styles.interactive);
    }
    return classNames.join(' ');
  };

  // --- Render Component ---
  return (
      <article className={rootClassName} role="region" aria-label={`Quiz: ${quiz.title}`}>
        {/* Card Header */}
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle}>{quiz.title}</h3>
          {totalQuestions > 0 && (
              <span className={styles.progressText} aria-live="polite">
                Q {safeCurrentIndex + 1}/{totalQuestions}
              </span>
          )}
        </div>

        {/* --- Question Display Area --- */}
        <div className={styles.questionDisplayArea}>
            {currentQuestion.question_image && (
            <img
                src={currentQuestion.question_image}
                alt={currentQuestion.question_image_alt || 'Question image'}
                className={styles.mediaImage}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            )}
            {currentQuestion.question_audio && (
            <audio
                controls
                src={currentQuestion.question_audio}
                className={styles.mediaAudio}
            >
                Your browser does not support the audio element.
            </audio>
            )}
            <div
                className={styles.questionText}
                dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || '...' }}
            />
        </div>


        {/* Options List */}
        <div className={styles.optionsList} role="radiogroup">
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              role="radio"
              aria-checked={selectedAnswerIndex === idx}
              className={getOptionClassName(idx)}
              onClick={() => handleAnswer(idx)}
              disabled={answerSubmitted} // Only disabled after submitting
            >
              <div className={styles.optionContent}>
                  {opt.img && (
                      <img
                          src={opt.img}
                          alt=""
                          className={styles.optionMediaImage}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                  )}
                  <span
                      className={styles.optionText}
                      dangerouslySetInnerHTML={{ __html: opt.html || '' }}
                  />
              </div>
              {opt.aud && (
                  <audio
                      controls
                      src={opt.aud}
                      className={styles.optionAudioControl}
                      onClick={(e) => e.stopPropagation()}
                      onPlay={(e) => e.stopPropagation()}
                  >
                      Your browser does not support the audio element.
                  </audio>
              )}
               {answerSubmitted && (
                   <div className={styles.optionFeedbackIcon}>
                       { (idx === correctAnswerIndex) && <CheckCircle size={16} /> }
                       { (idx === selectedAnswerIndex && !isCorrect) && <XCircle size={16} /> }
                   </div>
               )}
            </button>
          ))}
        </div>

        {/* --- Feedback Area --- */}
        {cardError && !answerSubmitted && (
             <div className={`${styles.feedbackArea} ${styles.feedbackError}`}>
                 <AlertTriangle size={18} className={styles.feedbackIcon} /> {cardError}
             </div>
        )}
        {answerSubmitted && (
            <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
                {isCorrect !== null && (
                    <>
                        {isCorrect
                        ? <><CheckCircle size={18} className={styles.feedbackIcon} /> Correct!</>
                        : <><XCircle size={18} className={styles.feedbackIcon} /> Incorrect.</>
                        }
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
            disabled={safeCurrentIndex === 0} // Only disabled if it's the first question
            aria-label="Previous Question"
        >
            <ChevronLeft size={20} aria-hidden="true" />
            <span className={styles.visuallyHidden}>Previous</span>
        </button>
        <button
            type="button"
            className={styles.navButton}
            onClick={goNext}
            // Only disable if it's the last question
            disabled={safeCurrentIndex === totalQuestions - 1}
            aria-label="Next Question"
        >
            <span className={styles.visuallyHidden}>Next</span>
            <ChevronRight size={20} aria-hidden="true" />
        </button>
        </div>
      </article>
  );
};

// Export the actual component
export default QuizCard;
