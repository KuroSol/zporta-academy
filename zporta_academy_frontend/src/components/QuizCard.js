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

  // Add a temporary unique ID to each question for the card context
  // This helps ensure keys are unique if multiple cards are on a page or for child components.
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
  // Use currentQuestion.id (original DB ID) for backend communication and state keys related to specific questions.
  const currentQuestionId = currentQuestion.id; // This should be the persistent ID from the database
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
    setCardError(null); // Clear general card error when user interacts
  };

const handleSubmitAnswerForCurrentQuestion = async (submittedAnswerFromInteraction) => {
  // Ensure we're using the correct question ID (persistent ID)
  const questionToSubmitId = currentQuestion.id;
  if (!questionToSubmitId || submittedAnswers[questionToSubmitId] || isLoadingSubmission) return;

  const answer = submittedAnswerFromInteraction !== undefined // Check for undefined specifically
    ? submittedAnswerFromInteraction
    : userAnswers[questionToSubmitId];
  const question = currentQuestion; // currentQuestion should be the one with questionToSubmitId

  // Validation for empty answers (especially for types that require input)
  if (['dragdrop','sort', 'short', 'multi'].includes(question.question_type)) {
    const isEmpty =
      answer === null ||
      answer === undefined ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (Array.isArray(answer) && answer.length === 0) ||
      (typeof answer === 'object' && Object.keys(answer).length === 0 && question.question_type === 'dragdrop'); // For dragdrop, an empty object means no items placed

    // For dragdrop, if there are no solutions expected, an empty answer is correct.
    let allowEmptySubmit = false;
    if (question.question_type === 'dragdrop') {
        const solutions = question._fill_blank?.solutions || [];
        if (solutions.length === 0 && (answer === null || answer === undefined || Object.keys(answer || {}).length === 0)) {
            allowEmptySubmit = true;
        }
    }


    if (isEmpty && !allowEmptySubmit) {
      setCardError("Please provide an answer before submitting.");
      return;
    }
  }

  setCardError(null);
  setIsLoadingSubmission(true);

  let isCorrect = false;
  let correctValueForFeedback = null;

  try {
    switch (question.question_type) {
      case 'mcq':
        isCorrect = answer === question.correct_option;
        correctValueForFeedback = question.correct_option;
        break;

      case 'multi': {
        const correctSet = new Set(question.correct_options || []);
        const answerSet  = new Set(answer || []);
        isCorrect = correctSet.size === answerSet.size &&
                      [...correctSet].every(v => answerSet.has(v));
        correctValueForFeedback = [...correctSet].sort((a,b)=>a-b);
        break;
      }

      case 'short':
        isCorrect = answer?.toString().trim().toLowerCase() ===
                      question.correct_answer?.trim().toLowerCase();
        correctValueForFeedback = question.correct_answer;
        break;

      case 'sort': {
        const correctArr = question.correct_options || [];
        isCorrect = JSON.stringify(answer || []) === JSON.stringify(correctArr);
        correctValueForFeedback = correctArr;
        break;
      }

      case 'dragdrop': {
        const studentMap = answer || {}; // This is the 'filledMap' from FillInTheBlanksQuestion
        const fillBlankData = question._fill_blank;
        const solutions = Array.isArray(fillBlankData?.solutions) ? fillBlankData.solutions : [];
        const words = Array.isArray(fillBlankData?.words) ? fillBlankData.words : [];
        
        // CRITICAL CHANGE: Use question.id as the base for key construction
        // This aligns with the HTML evidence (e.g., zone_99_0) suggesting FillInTheBlanksQuestion
        // uses the persistent question.id for the keys in the studentMap it returns.
        const baseId = question.id; 

        if (!baseId) {
            console.error("[QuizCard] DragDrop Check: question.id is missing, cannot reliably check answer.", question);
            isCorrect = false; // Cannot determine correctness without a baseId
        } else if (solutions.length === 0 && Object.keys(studentMap).length === 0) {
          isCorrect = true; // No solutions expected, no answer given = correct
        } else if (solutions.length !== Object.keys(studentMap).length) {
          isCorrect = false; // Number of dropped items doesn't match number of solutions
        } else {
          isCorrect = solutions.every(sol => {
            // Construct the zone key based on the solution's slot index using question.id
            const zoneKeyForSolution = `zone_${baseId}_${sol.slot_index}`;
            // Get the student's placed item ID for this zone from the studentMap
            const studentPlacedItemKey = studentMap[zoneKeyForSolution];

            // Find the index of the correct word (by its backend ID) in the word bank
            const wordBankIndex = words.findIndex(w => String(w.id) === String(sol.correct_word));

            if (wordBankIndex < 0) {
              console.error(`[QuizCard] DragDrop Check: Correct word (Backend ID: ${sol.correct_word}) for slot ${sol.slot_index} not found in word bank. Word bank:`, words);
              return false; // This specific solution cannot be satisfied correctly
            }
            
            // Construct the expected item key that should be in this zone, using question.id
            const expectedItemKey = `item_${baseId}_${wordBankIndex}`;
            
            // console.log(`[QuizCard] Slot ${sol.slot_index} (Zone: ${zoneKeyForSolution}): Expected Item Key: ${expectedItemKey}, Student Placed Item Key: ${studentPlacedItemKey}, Match: ${studentPlacedItemKey === expectedItemKey}`);
            return studentPlacedItemKey === expectedItemKey;
          });
        }
        correctValueForFeedback = question._fill_blank; // For showing detailed feedback if needed
        break;
      }

      default:
        console.warn(`Unsupported question type in QuizCard: ${question.question_type}`);
        break;
    }

    setFeedback(prev => ({
      ...prev,
      [questionToSubmitId]: { isCorrect, correctValue: correctValueForFeedback }
    }));
    setSubmittedAnswers(prev => ({
      ...prev,
      [questionToSubmitId]: true
    }));

    if (token) {
      await apiClient.post(
        `/quizzes/${quiz.id}/record-answer/`,
        { question_id: questionToSubmitId, selected_option: answer } 
      );
    }
  } catch (err) {
    console.error("Error submitting answer in card:", err);
    setCardError("Failed to submit answer. Please try again.");
    setFeedback(prev => { const newState = {...prev}; delete newState[questionToSubmitId]; return newState; });
    setSubmittedAnswers(prev => { const newState = {...prev}; delete newState[questionToSubmitId]; return newState; });
    if (err.response?.status === 401 && logout) logout();
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
    const feedbackForThisOption = feedback[currentQuestionId]; 

    if (currentQuestion.question_type === 'mcq') {
        if (submittedAnswers[currentQuestionId]) { 
            if (feedbackForThisOption?.correctValue === (optionIndex + 1)) classNames.push(styles.correct);
            if (currentSelection === (optionIndex + 1) && !feedbackForThisOption?.isCorrect) classNames.push(styles.selectedIncorrect);
            if (feedbackForThisOption?.correctValue !== (optionIndex + 1) && currentSelection !== (optionIndex + 1)) classNames.push(styles.disabled);
            if (currentSelection === (optionIndex + 1) && feedbackForThisOption?.isCorrect) classNames.push(styles.selectedCorrect); 
        } else {
            if (currentSelection === (optionIndex + 1)) classNames.push(styles.selected);
        }
    } else if (currentQuestion.question_type === 'multi') {
        const selectionsArray = Array.isArray(currentSelection) ? currentSelection : [];
        if (submittedAnswers[currentQuestionId]) { 
            const correctOptionsArray = Array.isArray(feedbackForThisOption?.correctValue) ? feedbackForThisOption.correctValue : [];
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
    if (!submittedAnswers[currentQuestionId]) classNames.push(styles.interactive);
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
                                const nextAnswer = opt.index + 1;
                                setUserAnswers(prev => ({ ...prev, [currentQuestionId]: nextAnswer }));
                                handleSubmitAnswerForCurrentQuestion(nextAnswer);
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
                        <button 
                            onClick={() => handleSubmitAnswerForCurrentQuestion(currentSelections)} 
                            className={`${styles.submitButton} ${styles.cardSubmitButton}`} 
                            disabled={currentSelections.length === 0 || isLoadingSubmission}>
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
                        <button 
                            onClick={() => handleSubmitAnswerForCurrentQuestion(currentQUserAnswer)} 
                            className={`${styles.submitButton} ${styles.cardSubmitButton}`}
                            disabled={!currentQUserAnswer?.trim() || isLoadingSubmission}>
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
                        handleSubmitAnswerForCurrentQuestion(filledMap);
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
                    onSubmit={() => handleSubmitAnswerForCurrentQuestion(currentQUserAnswer)}
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
                <button 
                    type="button" 
                    className={styles.navButton} 
                    onClick={goNext} 
                    disabled={safeCurrentIndex === totalQuestions - 1 || isLoadingSubmission || !isAnswerSubmittedForCurrent} 
                    aria-label="Next Question"
                >
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
