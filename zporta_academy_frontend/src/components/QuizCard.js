import React, { useState, useContext, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';                
import apiClient from '../api'; // Use your actual API client
import { AuthContext } from '../context/AuthContext'; // Use your actual AuthContext
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
} from 'lucide-react';
import styles from './QuizCard.module.css';

// Your original components are correctly imported
import SpeechToTextInput from './SpeechToTextInput';
import FillInTheBlanksQuestion from './FillInTheBlanksQuestion';
import SortQuestion from './SortQuestion';

const DEFAULT_AVATAR =
  "https://zportaacademy.com/media/managed_images/zpacademy.png";

function resolveAvatarUrl(user) {
  let url = user?.profile_image_url?.trim() || "";
  // if it’s relative, prefix your API root:
  if (url && !url.startsWith("http")) {
    url = `${process.env.REACT_APP_API_BASE_URL}${url}`;
  }
  return url || DEFAULT_AVATAR;
}

const getSourceLabel = (source) => {
  switch (source) {
    case 'review':       return '🧠 Review';
    case 'personalized': return '🎯 Personalized';
    case 'explore':      return '🌍 Explore';
    default:             return '';
  }
};
// Helper components from your original file
const RenderCardMedia = ({ url, type, alt = '', className = '', controls = true }) => {
  if (!url) return null;
  if (type === 'image') return <img src={url} alt={alt || 'Related image'} className={`${styles.cardMediaImage} ${className}`} onError={(e) => { e.currentTarget.style.display = 'none'; }} />;
  if (type === 'audio') return <audio controls={controls} src={url} className={`${styles.cardMediaAudio} ${className}`}>Your browser does not support the audio element.</audio>;
  return null;
};

const CardErrorDisplay = ({ message }) => (
  <div className={`${styles.quizCard} ${styles.errorCard}`} role="alert">
    <AlertTriangle className={styles.errorIcon} aria-hidden="true" />
    <p className={styles.errorMessage}>{message || "Error loading quiz data."}</p>
  </div>
);


const QuizCard = ({
  quiz,
  onItemVisible,
  onItemHidden,
  itemType,
  isLoading: isLoadingProp,
  isFeedView = false,    // <— add this
}) => {
 // State for new expand/collapse UI
  const [isExpanded, setIsExpanded] = useState(false);

  // All of your original state from the uploaded file
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState({});
  const [submittedAnswers, setSubmittedAnswers] = useState({});
  const [feedback, setFeedback] = useState({});
  const [cardError, setCardError] = useState(null);
  const [isLoadingSubmission, setIsLoadingSubmission] = useState(false);
  const [publicStats, setPublicStats] = useState({
    quizTitle: '', uniqueParticipants: 0, uniqueFinishers: 0,
    totalAnswersSubmittedForQuiz: 0, totalCorrectAnswersForQuiz: 0, totalWrongAnswersForQuiz: 0,
    questionsStats: [],
  });
  const [isLoadingPublicStats, setIsLoadingPublicStats] = useState(true);
  const [publicStatsError, setPublicStatsError] = useState(null);

  const { token, logout } = useContext(AuthContext) || {};
  const cardRef = useRef(null);

  // All of your original useEffects and logic are fully restored
  useEffect(() => {
    if (!onItemVisible || !onItemHidden || !itemType) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onItemVisible(quiz.id, itemType);
        else onItemHidden(quiz.id, itemType);
      }, { threshold: 0.5 }
    );
    const currentCardRef = cardRef.current;
    if (currentCardRef) observer.observe(currentCardRef);
    return () => { if (currentCardRef) observer.unobserve(currentCardRef); };
  }, [quiz.id, itemType, onItemVisible, onItemHidden]);

  useEffect(() => {
    setUserAnswers({});
    setSubmittedAnswers({});
    setFeedback({});
    setCurrentIndex(0);
    setCardError(null);
    setIsExpanded(false);
    setIsLoadingPublicStats(true);
    setPublicStatsError(null);
  }, [quiz.id]);

  const fetchPublicQuizStats = useCallback(async () => {
    if (!quiz?.id) { setIsLoadingPublicStats(false); return; }
    try {
      const response = await apiClient.get(`/analytics/quizzes/${quiz.id}/detailed-statistics/`);
      setPublicStats({
        quizTitle: response.data.quiz_title || quiz.title,
        uniqueParticipants: response.data.unique_participants ?? 0,
        uniqueFinishers: response.data.unique_finishers ?? 0,
        totalAnswersSubmittedForQuiz: response.data.total_answers_submitted_for_quiz ?? 0,
        totalCorrectAnswersForQuiz: response.data.total_correct_answers_for_quiz ?? 0,
        totalWrongAnswersForQuiz: response.data.total_wrong_answers_for_quiz ?? 0,
        questionsStats: Array.isArray(response.data.questions_stats) ? response.data.questions_stats : [],
      });
    } catch (err) {
      setPublicStatsError("Could not load quiz statistics.");
    } finally {
      setIsLoadingPublicStats(false);
    }
  }, [quiz?.id, quiz?.title]);

  useEffect(() => {
    if (quiz?.id) {
      setIsLoadingPublicStats(true);
      setPublicStatsError(null);
      fetchPublicQuizStats();
    }
  }, [quiz?.id, fetchPublicQuizStats]);

  const questions = (quiz.questions || []).map((q, index) => ({ ...q, temp_id: `card_q_${quiz.id}_${index}` }));
  const totalQuestions = questions.length;
  const isQuizCompleted = totalQuestions > 0 && Object.keys(submittedAnswers).length === totalQuestions;
  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
  const currentQuestion = totalQuestions > 0 ? questions[safeCurrentIndex] : {};
  const currentQuestionId = currentQuestion?.id;
  const isAnswerSubmittedForCurrent = currentQuestionId ? !!submittedAnswers[currentQuestionId] : false;
  const currentFeedback = currentQuestionId ? feedback[currentQuestionId] : null;

  const currentQuestionPublicStats = currentQuestionId && Array.isArray(publicStats.questionsStats)
    ? publicStats.questionsStats.find(qs => qs.question_id === currentQuestionId)
    : null;

  const mcqOptions = currentQuestionId ? [
    { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
    { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
    { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
    { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
  ].filter(o => (o.text?.trim() || o.img || o.aud)) : [];

  const handleAnswerChange = (questionIdToUpdate, answer) => {
    if (submittedAnswers[questionIdToUpdate]) return;
    setUserAnswers(prev => ({ ...prev, [questionIdToUpdate]: answer }));
    setCardError(null);
  };

  const handleSubmitAnswerForCurrentQuestion = async (submittedAnswerFromInteraction) => {
    const questionToSubmitId = currentQuestion.id;
    if (!questionToSubmitId || submittedAnswers[questionToSubmitId] || isLoadingSubmission) return;

    const answer = submittedAnswerFromInteraction !== undefined ? submittedAnswerFromInteraction : userAnswers[questionToSubmitId];
    const question = currentQuestion;

    if (['dragdrop','sort', 'short', 'multi'].includes(question.question_type)) {
      const isEmpty = answer === null || answer === undefined ||
        (typeof answer === 'string' && answer.trim() === '') ||
        (Array.isArray(answer) && answer.length === 0) ||
        (typeof answer === 'object' && Object.keys(answer).length === 0 && question.question_type === 'dragdrop');
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
          isCorrect = correctSet.size === answerSet.size && [...correctSet].every(v => answerSet.has(v));
          correctValueForFeedback = [...correctSet].sort((a,b)=>a-b);
          break;
        }
        case 'short':
          isCorrect = answer?.toString().trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
          correctValueForFeedback = question.correct_answer;
          break;
        case 'sort': {
          const correctArr = question.correct_options || [];
          isCorrect = JSON.stringify(answer || []) === JSON.stringify(correctArr);
          correctValueForFeedback = correctArr;
          break;
        }
        case 'dragdrop': {
          const studentMap = answer || {};
          const fillBlankData = question._fill_blank;
          const solutions = Array.isArray(fillBlankData?.solutions) ? fillBlankData.solutions : [];
          const words = Array.isArray(fillBlankData?.words) ? fillBlankData.words : [];
          const baseId = question.id; 
          if (!baseId) { isCorrect = false; }
          else if (solutions.length === 0 && Object.keys(studentMap).length === 0) { isCorrect = true; }
          else if (solutions.length !== Object.keys(studentMap).length) { isCorrect = false; }
          else {
            isCorrect = solutions.every(sol => {
              const zoneKey = `zone_${baseId}_${sol.slot_index}`;
              const studentPlaced = studentMap[zoneKey];
              const wordBankIndex = words.findIndex(w => String(w.id) === String(sol.correct_word));
              if (wordBankIndex < 0) return false;
              const expectedKey = `item_${baseId}_${wordBankIndex}`;
              return studentPlaced === expectedKey;
            });
          }
          correctValueForFeedback = question._fill_blank;
          break;
        }
        default: break;
      }

      setFeedback(prev => ({ ...prev, [questionToSubmitId]: { isCorrect, correctValue: correctValueForFeedback } }));
      setSubmittedAnswers(prev => ({ ...prev, [questionToSubmitId]: true }));

      if (token) {
        await apiClient.post(`/quizzes/${quiz.id}/record-answer/`, { 
            question_id: questionToSubmitId, 
            selected_option: answer,
        });
        fetchPublicQuizStats();
      }
    } catch (err) {
      console.error("Error submitting answer in card:", err);
      setCardError("Failed to submit answer. Please try again.");
      setFeedback(prev => { const copy = { ...prev }; delete copy[questionToSubmitId]; return copy; });
      setSubmittedAnswers(prev => { const copy = { ...prev }; delete copy[questionToSubmitId]; return copy; });
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

  const getOptionClassName = (optionValue) => {
    let classNames = [styles.optionButton];
    const currentQId = currentQuestion?.id;
    if (!currentQId) return styles.optionButton;

    const currentSelection = userAnswers[currentQId] || (currentQuestion.question_type === 'multi' ? [] : null);
    const fb = feedback[currentQId];
    const submitted = submittedAnswers[currentQId];

    if (currentQuestion.question_type === 'mcq') {
      if (submitted) {
        if (fb?.correctValue === optionValue) classNames.push(styles.correct);
        if (currentSelection === optionValue && !fb?.isCorrect) classNames.push(styles.selectedIncorrect);
        if (fb?.correctValue !== optionValue && currentSelection !== optionValue) classNames.push(styles.disabled);
        if (currentSelection === optionValue && fb?.isCorrect) classNames.push(styles.selectedCorrect);
      } else {
        if (currentSelection === optionValue) classNames.push(styles.selected);
      }
    } else if (currentQuestion.question_type === 'multi') {
      const selectionsArray = Array.isArray(currentSelection) ? currentSelection : [];
      if (submitted) {
        const correctOptionsArray = Array.isArray(fb?.correctValue) ? fb.correctValue : [];
        if (correctOptionsArray.includes(optionValue)) classNames.push(styles.correct);
        if (selectionsArray.includes(optionValue)) {
          classNames.push(correctOptionsArray.includes(optionValue) ? styles.selectedCorrect : styles.selectedIncorrect);
        } else if (!correctOptionsArray.includes(optionValue)) {
          classNames.push(styles.disabled);
        }
      } else {
        if (selectionsArray.includes(optionValue)) classNames.push(styles.selected);
      }
    }
    if (!submitted) classNames.push(styles.interactive);
    else if (currentQuestion.question_type === 'mcq' || currentQuestion.question_type === 'multi') {
      if (!classNames.includes(styles.selectedCorrect) && !classNames.includes(styles.selectedIncorrect) && !classNames.includes(styles.correct)) {
        classNames.push(styles.disabled);
      }
    }
    return classNames.join(' ');
  };

  const renderAnswerArea = () => {
    const questionType = currentQuestion?.question_type;
    const currentQUserAnswer = userAnswers[currentQuestionId];
    if (!currentQuestionId) return <p className={styles.noQuestions}>Select a question.</p>;

    switch (questionType) {
      case 'mcq':
        return (
          <div className={styles.optionsList}>
            {mcqOptions.map((opt) => (
              <button key={opt.index} type="button" role="radio" aria-checked={currentQUserAnswer === (opt.index + 1)}
                className={getOptionClassName(opt.index + 1)}
                onClick={() => {
                  if (isAnswerSubmittedForCurrent) return;
                  const nextAnswer = opt.index + 1;
                  setUserAnswers(prev => ({ ...prev, [currentQuestionId]: nextAnswer }));
                  handleSubmitAnswerForCurrentQuestion(nextAnswer);
                }}
                disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
              >
                <div className={styles.optionMediaContainer}>{opt.img && <RenderCardMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage_Small} />}</div>
                <div className={styles.optionTextContainer}>
                  {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                  {opt.aud && <RenderCardMedia url={opt.aud} type="audio" className={styles.optionAudioControl_Small} controls={true} />}
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
                <button key={opt.index} type="button" role="checkbox" aria-checked={currentSelections.includes(opt.index + 1)}
                  className={getOptionClassName(opt.index + 1)}
                  onClick={() => {
                    if (isAnswerSubmittedForCurrent) return;
                    const newSelection = currentSelections.includes(opt.index + 1)
                      ? currentSelections.filter(item => item !== opt.index + 1)
                      : [...currentSelections, opt.index + 1];
                    handleAnswerChange(currentQuestionId, newSelection.sort((a,b)=>a-b));
                  }}
                  disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
                >
                  <div className={styles.optionMediaContainer}>{opt.img && <RenderCardMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage_Small} />}</div>
                  <div className={styles.optionTextContainer}>
                    {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                    {opt.aud && <RenderCardMedia url={opt.aud} type="audio" className={styles.optionAudioControl_Small} controls={true} />}
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
              <button onClick={() => handleSubmitAnswerForCurrentQuestion(currentSelections)}
                className={`${styles.submitButton} ${styles.cardSubmitButton}`}
                disabled={currentSelections.length === 0 || isLoadingSubmission}
              >
                {isLoadingSubmission ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Submit Multi-Select
              </button>
            )}
          </>
        );
      case 'short':
        return (
          <div className={styles.shortAnswerInteractiveArea}>
            <div className={styles.inputAndMicWrapper}>
              <Type size={20} className={styles.inputIconDecorator} />
              <input type="text" className={styles.shortAnswerInputCard} placeholder="Type your answer..."
                value={currentQUserAnswer || ''}
                onChange={(e) => handleAnswerChange(currentQuestionId, e.target.value)}
                disabled={isAnswerSubmittedForCurrent || isLoadingSubmission} aria-label="Short answer input"
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
              <button onClick={() => handleSubmitAnswerForCurrentQuestion(currentQUserAnswer)}
                className={`${styles.submitButton} ${styles.cardSubmitButton}`}
                disabled={!currentQUserAnswer?.trim() || isLoadingSubmission}
              >
                {isLoadingSubmission ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                Submit Answer
              </button>
            )}
          </div>
        );
      case 'dragdrop':
        if (!currentQuestion._fill_blank) return <p className={styles.errorText}>Loading fill-in-the-blanks data...</p>;
        return (
          <FillInTheBlanksQuestion question={currentQuestion} disabled={isAnswerSubmittedForCurrent || isLoadingSubmission}
            onSubmit={(filledMap) => { handleAnswerChange(currentQuestionId, filledMap); handleSubmitAnswerForCurrentQuestion(filledMap); }}
            submittedAnswer={currentQUserAnswer} feedback={currentFeedback}
          />
        );
      case 'sort':
        if (!currentQuestion.question_data?.items) return <p className={styles.errorText}>Loading sort question data...</p>;
        return (
          <SortQuestion question={currentQuestion} submitted={isAnswerSubmittedForCurrent}
            userAnswer={currentQUserAnswer} onChange={(order) => handleAnswerChange(currentQuestionId, order)}
            onSubmit={() => handleSubmitAnswerForCurrentQuestion(currentQUserAnswer)}
            feedback={currentFeedback} disabled={isLoadingSubmission}
          />
        );
      default:
        return <p className={styles.unsupportedType}>Unsupported question type for direct interaction on card.</p>;
    }
  };

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const getButtonState = () => {
    if (isQuizCompleted) {
      return { text: 'Review Quiz', icon: <CheckCircle size={20} /> };
    }
    if (Object.keys(submittedAnswers).length > 0) {
      return { text: 'Continue Quiz', icon: <PlayCircle size={20} /> };
    }
    return { text: 'See Details', icon: <ChevronsUpDown size={20} /> };
  };

  const { text: buttonText, icon: buttonIcon } = getButtonState();

return (
  <article
    ref={cardRef}
    className={`${styles.quizCard} ${isExpanded ? styles.isExpanded : ''}`}
    role="region"
    aria-label={`Quiz: ${publicStats.quizTitle || quiz.title}`}
  >
    {/* “Why this quiz?” banner */}
    {quiz?.why && (
      <div className={styles.whyThisCard}>
        <span className={styles.whyThisLabel}>Why this quiz?</span>
        <span className={styles.whyThisText}>{quiz.why}</span>
      </div>
    )}

    {/* AUTHOR STRIP */}
    {quiz.created_by && (
      <Link
        to={`/guide/${quiz.created_by.username}`}
        className={styles.creatorInfo}
      >
        <img
          src={resolveAvatarUrl(quiz.created_by)}
          alt={`${quiz.created_by.username}’s avatar`}
          className={styles.creatorAvatarHexagon}
          onError={e => {
            e.currentTarget.onerror = null;
            e.currentTarget.src = DEFAULT_AVATAR;
          }}
        />
        <div className={styles.creatorMeta}>
          <span className={styles.creatorName}>
            {quiz.created_by.username}
          </span>
        </div>
      </Link>
    )}

    {/* CARD HEADER */}
    {!isFeedView && (
      <div className={styles.cardHeader}>
        <h3
          className={styles.cardTitle}
          dangerouslySetInnerHTML={{
            __html: publicStats.quizTitle || quiz.title || 'Quiz'
          }}
        />
        {totalQuestions > 0 && (
          <span className={styles.progressText} aria-live="polite">
            {isExpanded
              ? `Q ${safeCurrentIndex + 1}/${totalQuestions}`
              : `${totalQuestions} Questions`}
          </span>
        )}
      </div>
    )}

    {/* SUBJECT + SOURCE BADGES */}
    <p className={styles.cardSubtitle}>
      <span className={styles.itemTypeLabel}>Quiz | </span>
      <span className={styles.subjectTag}>{quiz.subject || 'General'}</span>
    </p>

    {/* COLLAPSED CONTENT */}
    <div className={styles.collapsedContent}>
      {isLoadingPublicStats ? (
        <div className={styles.loadingContainer}>
          <Loader2 className={styles.loadingIcon} size={24} />
        </div>
      ) : publicStatsError ? (
        <div className={`${styles.feedbackArea} ${styles.feedbackError}`} role="alert">
          <AlertTriangle size={16} /> {publicStatsError}
        </div>
      ) : (
        <div className={styles.quizStatsContainer}>
          <div
            className={styles.statItem}
            title="Unique users who attempted this quiz"
          >
            <Users size={20} className={styles.statIcon} />
            <span className={styles.statValue}>
              {publicStats.uniqueParticipants}
            </span>
            <span className={styles.statLabel}>Participants</span>
          </div>
          <div
            className={styles.statItem}
            title="Overall correct answers"
          >
            <CheckCircle
              size={20}
              className={`${styles.statIcon} ${styles.correctIcon}`}
            />
            <span className={`${styles.statValue} ${styles.correctText}`}>
              {publicStats.totalCorrectAnswersForQuiz}
            </span>
            <span className={styles.statLabel}>Correct</span>
          </div>
          <div
            className={styles.statItem}
            title="Overall wrong answers"
          >
            <XCircle
              size={20}
              className={`${styles.statIcon} ${styles.incorrectIcon}`}
            />
            <span className={`${styles.statValue} ${styles.incorrectText}`}>
              {publicStats.totalWrongAnswersForQuiz}
            </span>
            <span className={styles.statLabel}>Wrong</span>
          </div>
        </div>
      )}
      <button onClick={toggleExpand} className={styles.startQuizButton}>
        {buttonIcon}
        <span>{buttonText}</span>
      </button>
    </div>

    {/* EXPANDED CONTENT */}
    <div className={styles.expandedContent}>
      {totalQuestions === 0 ? (
        <p className={styles.noQuestions}>No questions available in this quiz.</p>
      ) : (
        <>
          <div className={styles.questionDisplayArea}>
            <RenderCardMedia
              url={currentQuestion.question_image}
              type="image"
              alt={currentQuestion.question_image_alt || 'Question image'}
              className={styles.questionMediaItem}
            />
            <RenderCardMedia
              url={currentQuestion.question_audio}
              type="audio"
              className={styles.questionMediaItem}
            />
            <div
              className={styles.questionText}
              dangerouslySetInnerHTML={{
                __html: currentQuestion.question_text || 'Loading question...'
              }}
            />
          </div>

          {currentQuestionPublicStats && !isLoadingPublicStats && (
            <div className={`${styles.quizStatsContainer} ${styles.perQuestionStats}`}>
              <div className={styles.statItem} title="Times this question was answered">
                <HelpCircle size={18} className={styles.statIcon} />
                <span className={styles.statValue}>
                  {currentQuestionPublicStats.times_answered}
                </span>
                <span className={styles.statLabel}>Answered</span>
              </div>
              <div className={styles.statItem} title="Times correct">
                <ThumbsUp size={18} className={`${styles.statIcon} ${styles.correctIcon}`} />
                <span className={`${styles.statValue} ${styles.correctText}`}>
                  {currentQuestionPublicStats.times_correct}
                </span>
                <span className={styles.statLabel}>Correctly</span>
              </div>
              <div className={styles.statItem} title="Times wrong">
                <ThumbsDown size={18} className={`${styles.statIcon} ${styles.incorrectIcon}`} />
                <span className={`${styles.statValue} ${styles.incorrectText}`}>
                  {currentQuestionPublicStats.times_wrong}
                </span>
                <span className={styles.statLabel}>Incorrectly</span>
              </div>
            </div>
          )}

          <div className={styles.answerAreaContainer}>
            {renderAnswerArea()}
          </div>

          <div className={styles.feedbackContainer}>
            {cardError && (
              <div className={`${styles.feedbackArea} ${styles.feedbackError}`} role="alert">
                <AlertTriangle size={16} /> {cardError}
              </div>
            )}
            {isAnswerSubmittedForCurrent && currentFeedback && (
              <div
                className={`${styles.feedbackArea} ${currentFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}
                role="status"
              >
                {currentFeedback.isCorrect ? <CheckCircle size={16} /> : <XCircle size={16} />}
                <span>{currentFeedback.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                {!currentFeedback.isCorrect &&
                  currentQuestion.question_type === 'short' &&
                  currentFeedback.correctValue && (
                    <span className={styles.correctAnswerTextCard}>
                      Correct: {currentFeedback.correctValue}
                    </span>
                  )}
              </div>
            )}
          </div>

          {totalQuestions > 1 && (
            <div className={styles.navigation}>
              <button
                type="button"
                className={styles.navButton}
                onClick={goPrev}
                disabled={safeCurrentIndex === 0 || isLoadingSubmission}
              >
                <ChevronLeft size={20} /> Prev
              </button>
              {safeCurrentIndex === totalQuestions - 1 ? (
                <button
                  onClick={toggleExpand}
                  className={`${styles.navButton} ${styles.finishButton}`}
                >
                  <ChevronsUpDown size={20} /> Collapse
                </button>
              ) : (
                <button
                  type="button"
                  className={styles.navButton}
                  onClick={goNext}
                  disabled={!isAnswerSubmittedForCurrent || isLoadingSubmission}
                >
                  Next <ChevronRight size={20} />
                </button>
              )}
            </div>
          )}

          {totalQuestions > 0 &&
            safeCurrentIndex === totalQuestions - 1 &&
            isAnswerSubmittedForCurrent && (
              <p className={styles.quizCompletedCard}>
                You've reached the end of the quiz!
              </p>
            )}
        </>
      )}
    </div>
  </article>
);


};

export default QuizCard;
