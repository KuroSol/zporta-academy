import React, { useState, useContext, useEffect } from 'react';
import apiClient from '../api'; // Use your actual API client
import { AuthContext } from '../context/AuthContext'; // Use your actual AuthContext
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Volume2, Mic, Type, ListChecks, Shuffle, Send, Loader2 } from 'lucide-react'; // Added Loader2
import styles from './QuizCard.module.css'; // Import CSS Module

// Assuming these components are correctly exported and can be used here
// You might need to adjust paths or ensure they are designed for reuse.
import SpeechToTextInput from './SpeechToTextInput'; // From QuizPage.js
import FillInTheBlanksQuestion from './FillInTheBlanksQuestion'; // From QuizPage.js
import SortQuestion from './SortQuestion'; // From QuizPage.js

// --- Helper: Render Media (Image/Audio) for Card ---
const RenderCardMedia = ({ url, type, alt = '', className = '', controls = true }) => {
    if (!url) return null;
    if (type === 'image') {
        return (
            <img
                src={url}
                alt={alt || 'Related image'}
                className={`${styles.cardMediaImage} ${className}`}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
        );
    }
    if (type === 'audio') {
        return (
            <audio controls={controls} src={url} className={`${styles.cardMediaAudio} ${className}`}>
                Your browser does not support the audio element.
            </audio>
        );
    }
    return null;
};

// --- Error Display (Simplified for Card) ---
const CardErrorDisplay = ({ message }) => (
    <div className={`${styles.quizCard} ${styles.errorCard}`} role="alert">
        <AlertTriangle className={styles.errorIcon} aria-hidden="true" />
        <p className={styles.errorMessage}>{message || "Error loading quiz data."}</p>
    </div>
);

// --- Main Interactive Quiz Card Component ---
const QuizCard = ({ quiz }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [cardError, setCardError] = useState(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);

  const auth = useContext(AuthContext) || {};
  const { token, logout } = auth;

  // useEffect must be called before any early returns.
  useEffect(() => {
    // Reset answers when quiz changes (if quiz prop itself can change)
    setUserAnswers({});
    setSubmittedAnswers({});
    setFeedback({});
    setCurrentIndex(0);
    setCardError(null);
  }, [quiz.id]); // quiz.id ensures this runs if the quiz itself changes

  if (!quiz || typeof quiz !== 'object' || !quiz.id || typeof quiz.title !== 'string' || !Array.isArray(quiz.questions)) {
    return <CardErrorDisplay message="Invalid quiz data provided." />;
  }

  const questions = quiz.questions.map((q, index) => ({ ...q, temp_id: `card_q_${quiz.id}_${index}`}));
  const totalQuestions = questions.length;


  if (totalQuestions === 0) {
    return (
      <article className={`${styles.quizCard} ${styles.emptyCard}`}>
        <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle} dangerouslySetInnerHTML={{ __html: quiz.title || 'Quiz' }}></h3>
        </div>
        <p className={styles.noQuestions}>No questions available in this quiz.</p>
      </article>
    );
  }

  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), totalQuestions - 1);
  const currentQuestion = questions[safeCurrentIndex] ?? {};
  const currentQuestionId = currentQuestion.id; // Use this consistently
  const isAnswerSubmittedForCurrent = !!submittedAnswers[currentQuestionId];
  const currentFeedback = feedback[currentQuestionId];

  const mcqOptions = [
    { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
    { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
    { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
    { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
  ].filter(o => (o.text?.trim() || o.img || o.aud));

  const handleAnswerChange = (questionIdToUpdate, answer) => { // Renamed first param for clarity
    if (submittedAnswers[questionIdToUpdate]) return;
    setUserAnswers(prev => ({ ...prev, [questionIdToUpdate]: answer }));
    setCardError(null);
  };

  const handleSubmitAnswerForCurrentQuestion = async () => {
    if (isAnswerSubmittedForCurrent || isLoadingSubmission) return;

    const answer = userAnswers[currentQuestionId]; // Use currentQuestionId
    const question = currentQuestion;

    if (answer === undefined || answer === null ||
        (typeof answer === 'string' && answer.trim() === '' && question.question_type !== 'dragdrop') ||
        (Array.isArray(answer) && answer.length === 0 && question.question_type !== 'dragdrop' && question.question_type !== 'sort') ) {
        setCardError("Please provide an answer before submitting.");
        return;
    }
    setCardError(null);
    setIsLoadingSubmission(true);

    let isCorrect = false;
    let correctValueForFeedback = null;

    try {
        if (question.question_type === 'mcq') {
            isCorrect = (answer === question.correct_option);
            correctValueForFeedback = question.correct_option;
        } else if (question.question_type === 'multi') {
            const correctSet = new Set(Array.isArray(question.correct_options) ? question.correct_options : []);
            const answerSet = new Set(Array.isArray(answer) ? answer : []);
            isCorrect = correctSet.size === answerSet.size && [...correctSet].every(val => answerSet.has(val));
            correctValueForFeedback = [...correctSet].sort((a, b) => a - b);
        } else if (question.question_type === 'short') {
            isCorrect = answer?.toString().trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
            correctValueForFeedback = question.correct_answer;
        } else if (question.question_type === 'sort') {
            const correctAnswerArray = Array.isArray(question.correct_options) ? question.correct_options : [];
            const userAnswerArray = Array.isArray(answer) ? answer : [];
            isCorrect = JSON.stringify(userAnswerArray) === JSON.stringify(correctAnswerArray);
            correctValueForFeedback = correctAnswerArray;
        } else if (question.question_type === 'dragdrop') {
            const studentMap = answer || {};
            const backendSolutions = question._fill_blank?.solutions || [];
            if (backendSolutions.length === 0 && Object.keys(studentMap).length === 0) {
                isCorrect = true;
            } else if (backendSolutions.length !== Object.keys(studentMap).length && backendSolutions.length > 0) {
                isCorrect = false;
            } else {
                 isCorrect = backendSolutions.every(sol => {
                    const blankKey = `zone_${question.temp_id}_${sol.slot_index}`;
                    const correctWordData = (question._fill_blank.words || []).find(w => w.id === sol.correct_word);
                    const correctWordFrontendTempId = correctWordData ? `item_${question.temp_id}_${(question._fill_blank.words || []).indexOf(correctWordData)}` : null;
                    return studentMap[blankKey] === correctWordFrontendTempId;
                });
            }
            correctValueForFeedback = question._fill_blank;
        }

        setFeedback(prev => ({ ...prev, [currentQuestionId]: { isCorrect, correctValue: correctValueForFeedback } }));
        setSubmittedAnswers(prev => ({ ...prev, [currentQuestionId]: true }));

        if (token) {
            await apiClient.post(`/quizzes/${quiz.id}/record-answer/`, {
                question_id: currentQuestionId, // Use currentQuestionId
                selected_option: answer
            });
        }
    } catch (err) {
        console.error("Error submitting answer in card:", err);
        setCardError("Failed to submit answer. Please try again.");
        setFeedback(prev => { const newState = {...prev}; delete newState[currentQuestionId]; return newState;}); // Use currentQuestionId
        setSubmittedAnswers(prev => { const newState = {...prev}; delete newState[currentQuestionId]; return newState;}); // Use currentQuestionId
        if (err.response?.status === 401 && typeof logout === 'function') logout();
    } finally {
        setIsLoadingSubmission(false);
    }
  };

  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      setCardError(null);
    }
  };
  const goPrev = () => goToQuestion(safeCurrentIndex - 1);
  const goNext = () => goToQuestion(safeCurrentIndex + 1);


  const getOptionClassName = (optionIndex) => {
    let classNames = [styles.optionButton];
    const currentSelection = userAnswers[currentQuestionId] || (currentQuestion.question_type === 'multi' ? [] : null);

    if (currentQuestion.question_type === 'mcq') {
        if (isAnswerSubmittedForCurrent) {
            if (currentFeedback?.correctValue === (optionIndex + 1)) classNames.push(styles.correct);
            if (currentSelection === (optionIndex + 1) && !currentFeedback?.isCorrect) classNames.push(styles.selectedIncorrect);
            if (currentFeedback?.correctValue !== (optionIndex + 1) && currentSelection !== (optionIndex + 1)) classNames.push(styles.disabled);
             if (currentSelection === (optionIndex + 1) && currentFeedback?.isCorrect) classNames.push(styles.selectedCorrect);
        } else {
            if (currentSelection === (optionIndex + 1)) classNames.push(styles.selected);
        }
    } else if (currentQuestion.question_type === 'multi') {
        const selectionsArray = Array.isArray(currentSelection) ? currentSelection : [];
        if (isAnswerSubmittedForCurrent) {
            const correctOptionsArray = Array.isArray(currentFeedback?.correctValue) ? currentFeedback.correctValue : [];
            if (correctOptionsArray.includes(optionIndex + 1)) classNames.push(styles.correct);
            if (selectionsArray.includes(optionIndex + 1)) {
                 classNames.push(correctOptionsArray.includes(optionIndex + 1) ? styles.selectedCorrect : styles.selectedIncorrect);
            } else if (!correctOptionsArray.includes(optionIndex + 1)) {
                 classNames.push(styles.disabled);
            }
        } else {
            if (selectionsArray.includes(optionIndex + 1)) classNames.push(styles.selected);
        }
    }
     if(!isAnswerSubmittedForCurrent) classNames.push(styles.interactive);
    return classNames.join(' ');
  };

  const renderAnswerArea = () => {
    const questionType = currentQuestion.question_type;
    const currentQUserAnswer = userAnswers[currentQuestionId];

    switch (questionType) {
        case 'mcq':
            return (
                <div className={styles.optionsList}>
                    {mcqOptions.map((opt) => (
                        <button
                            key={opt.index} type="button" role="radio"
                            aria-checked={currentQUserAnswer === (opt.index + 1)}
                            className={getOptionClassName(opt.index)}
                            onClick={() => {
                                handleAnswerChange(currentQuestionId, opt.index + 1);
                                setTimeout(() => handleSubmitAnswerForCurrentQuestion(), 100);
                            }}
                            disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                        >
                             <div className={styles.optionMediaContainer}>
                                {opt.img && <RenderCardMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage_Small} />}
                            </div>
                            <div className={styles.optionTextContainer}>
                                {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                                {opt.aud && <RenderCardMedia url={opt.aud} type="audio" className={styles.optionAudioControl_Small} controls={true}/>}
                            </div>
                            {isAnswerSubmittedForCurrent && currentFeedback && (
                                <div className={styles.optionFeedbackIcon}>
                                    {currentFeedback.correctValue === (opt.index + 1) && <CheckCircle size={16} />}
                                    {currentQUserAnswer === (opt.index + 1) && !currentFeedback.isCorrect && <XCircle size={16} />}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            );
        case 'multi':
            const currentSelections = Array.isArray(currentQUserAnswer) ? currentQUserAnswer : [];
            return (
                <>
                    <div className={styles.optionsList}>
                        {mcqOptions.map((opt) => (
                            <button
                                key={opt.index} type="button" role="checkbox"
                                aria-checked={currentSelections.includes(opt.index + 1)}
                                className={getOptionClassName(opt.index)}
                                onClick={() => {
                                    const newSelection = currentSelections.includes(opt.index + 1)
                                        ? currentSelections.filter(item => item !== opt.index + 1)
                                        : [...currentSelections, opt.index + 1];
                                    handleAnswerChange(currentQuestionId, newSelection.sort((a,b)=>a-b));
                                }}
                                disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                            >
                                <div className={styles.optionMediaContainer}>
                                  {opt.img && <RenderCardMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage_Small} />}
                                </div>
                                <div className={styles.optionTextContainer}>
                                    {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                                    {opt.aud && <RenderCardMedia url={opt.aud} type="audio" className={styles.optionAudioControl_Small} controls={true}/>}
                                </div>
                                {isAnswerSubmittedForCurrent && currentFeedback && Array.isArray(currentFeedback.correctValue) && (
                                    <div className={styles.optionFeedbackIcon}>
                                        {currentFeedback.correctValue.includes(opt.index + 1) && <CheckCircle size={16} />}
                                        {currentSelections.includes(opt.index + 1) && !currentFeedback.correctValue.includes(opt.index + 1) && <XCircle size={16} />}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                    {!isAnswerSubmittedForCurrent && (
                        <button onClick={handleSubmitAnswerForCurrentQuestion} className={`${styles.submitButton} ${styles.cardSubmitButton}`} disabled={currentSelections.length === 0 || isLoadingSubmission}>
                            {isLoadingSubmission ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>} Submit Multi-Select
                        </button>
                    )}
                </>
            );
        case 'short':
            return (
                <div className={styles.shortAnswerInteractiveArea}>
                    <div className={styles.inputAndMicWrapper}>
                        <Type size={20} className={styles.inputIconDecorator}/>
                        <input
                            type="text"
                            className={styles.shortAnswerInputCard}
                            placeholder="Type your answer..."
                            value={currentQUserAnswer || ''}
                            onChange={(e) => handleAnswerChange(currentQuestionId, e.target.value)}
                            disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                        />
                        {currentQuestion.allow_speech_to_text && (
                           <SpeechToTextInput
                                onTranscriptReady={(transcript) => handleAnswerChange(currentQuestionId, transcript)}
                                disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                                buttonClassName={styles.micButtonCard}
                            />
                        )}
                    </div>
                    {!isAnswerSubmittedForCurrent && (
                        <button onClick={handleSubmitAnswerForCurrentQuestion} className={`${styles.submitButton} ${styles.cardSubmitButton}`} disabled={!currentQUserAnswer?.trim() || isLoadingSubmission}>
                           {isLoadingSubmission ? <Loader2 size={18} className="animate-spin" /> : <Send size={18}/>} Submit Answer
                        </button>
                    )}
                </div>
            );
        case 'dragdrop':
            if (!currentQuestion._fill_blank) return <p className={styles.errorText}>Loading fill-in-the-blanks data...</p>;
            return (
                <FillInTheBlanksQuestion
                    question={currentQuestion}
                    disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                    onSubmit={(filledMap) => {
                        handleAnswerChange(currentQuestionId, filledMap);
                        setTimeout(() => handleSubmitAnswerForCurrentQuestion(), 100);
                    }}
                    submittedAnswer={currentQUserAnswer}
                    feedback={currentFeedback}
                />
            );
        case 'sort':
             if (!currentQuestion.question_data?.items) return <p className={styles.errorText}>Loading sort question data...</p>;
            return (
                 <SortQuestion
                    question={currentQuestion}
                    submitted={isAnswerSubmittedForCurrent}
                    userAnswer={currentQUserAnswer}
                    onChange={(order) => handleAnswerChange(currentQuestionId, order)}
                    onSubmit={() => handleSubmitAnswerForCurrentQuestion()}
                    feedback={currentFeedback}
                    disabled={isLoadingSubmission}
                  />
            );
        default:
            return <p className={styles.unsupportedType}>Unsupported question type for direct interaction on card.</p>;
    }
  };

  return (
      <article className={styles.quizCard} role="region" aria-label={`Quiz: ${quiz.title}`}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardTitle} dangerouslySetInnerHTML={{ __html: quiz.title || 'Quiz' }}></h3>
          {totalQuestions > 0 && (
              <span className={styles.progressText} aria-live="polite">
                Q {safeCurrentIndex + 1}/{totalQuestions}
              </span>
          )}
        </div>

        {currentQuestion.id && (
            <div className={styles.questionDisplayArea}>
                <RenderCardMedia url={currentQuestion.question_image} type="image" alt={currentQuestion.question_image_alt || 'Question image'} className={styles.questionMediaItem}/>
                <RenderCardMedia url={currentQuestion.question_audio} type="audio" className={styles.questionMediaItem}/>
                <div
                    className={styles.questionText}
                    dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Loading question...' }}
                    id={`question-text-${currentQuestion.id}`}
                />
            </div>
        )}

        {currentQuestion.id && (
            <div className={styles.answerAreaContainer}>
                {renderAnswerArea()}
            </div>
        )}

        <div className={styles.feedbackContainer}>
            {cardError && <div className={`${styles.feedbackArea} ${styles.feedbackError}`} role="alert"><AlertTriangle size={16} className={styles.feedbackIcon} /> {cardError}</div>}
            {isAnswerSubmittedForCurrent && currentFeedback && (
                <div className={`${styles.feedbackArea} ${currentFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`} role="status">
                    {currentFeedback.isCorrect ? <CheckCircle size={16} className={styles.feedbackIcon} /> : <XCircle size={16} className={styles.feedbackIcon} />}
                    <span>{currentFeedback.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                    {!currentFeedback.isCorrect && currentQuestion.question_type === 'short' && currentFeedback.correctValue && (
                        <span className={styles.correctAnswerTextCard}>Correct: {currentFeedback.correctValue}</span>
                    )}
                </div>
            )}
        </div>

        {totalQuestions > 1 && (
            <div className={styles.navigation}>
                <button type="button" className={styles.navButton} onClick={goPrev} disabled={safeCurrentIndex === 0 || isLoadingSubmission} aria-label="Previous Question">
                    <ChevronLeft size={20} /> <span className={styles.navButtonText}>Prev</span>
                </button>
                <button type="button" className={styles.navButton} onClick={goNext} disabled={safeCurrentIndex === totalQuestions - 1 || isLoadingSubmission || !isAnswerSubmittedForCurrent} aria-label="Next Question">
                    <span className={styles.navButtonText}>Next</span> <ChevronRight size={20} />
                </button>
            </div>
        )}
         {safeCurrentIndex === totalQuestions - 1 && isAnswerSubmittedForCurrent && (
            <p className={styles.quizCompletedCard}>Quiz completed on card!</p>
        )}
      </article>
  );
};

export default QuizCard;
