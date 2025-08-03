import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api'; 
import { AuthContext } from '../context/AuthContext'; 
import { AuthModalContext } from '../context/AuthModalContext';
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Edit3,
  Trash2,
  Loader2,
  AlertTriangle,
  HelpCircle,
  Share2,
  Users, 
  UserCheck, 
  ListChecks, 
  BarChart3, 
  CheckSquare, 
  XSquare, 
} from 'lucide-react';
import SpeechToTextInput from './SpeechToTextInput';
import styles from './QuizPage.module.css';
import SortQuestion from './SortQuestion';
import FillInTheBlanksQuestion from './FillInTheBlanksQuestion';

import ReportQuizModal from './ReportQuizModal';
import ShareQuizModal from './ShareQuizModal';

// --- Skeleton Loader Component ---
const SkeletonLoader = () => (
    <div className={styles.skeletonContainer}>
        {/* Skeleton structure remains the same */}
    </div>
);

// --- Error Display Component ---
const ErrorDisplay = ({ message }) => (
    <div className={styles.errorContainer}>
        <AlertTriangle className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Oops! Something went wrong.</h2>
        <p className={styles.errorMessage}>{message || "An unexpected error occurred."}</p>
    </div>
);

// --- Helper: Render Media (Image/Audio) ---
const RenderMedia = ({ url, type, alt = '', className = '' }) => {
    if (!url) return null;
    if (type === 'image') {
        return (
            <img
                src={url}
                alt={alt || 'Question related image'}
                className={`${styles.mediaImage} ${className}`}
                onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
        );
    }
    if (type === 'audio') {
        return (
            <audio controls src={url} className={`${styles.mediaAudio} ${className}`}>
                Your browser does not support the audio element.
            </audio>
        );
    }
    return null;
};

// --- Helper: Stat Item Component ---
const StatItem = ({ icon, label, value }) => (
    <div className={styles.statItem}>
        <div className={styles.statIcon}>{icon}</div>
        <div className={styles.statText}>
            <strong>{value}</strong>
            {label}
        </div>
    </div>
);

// --- Main Quiz Page Component ---
const QuizPage = () => {
    const [quizData, setQuizData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({});
    const [submittedAnswers, setSubmittedAnswers] = useState({});
    const [feedback, setFeedback] = useState({});
    const [isDeleting, setIsDeleting] = useState(false);
    const [showHint, setShowHint] = useState(null);

    // --- FIX: Track when each question was shown ---
    // 1. Add state to hold per-question start timestamps.
    // Using useRef is better here than useState to avoid re-renders when times are set.
    const questionStartTimes = useRef({});

    const { username, subject, date, quizSlug } = useParams();
    const permalink = `${username}/${subject}/${date}/${quizSlug}`;
    const navigate = useNavigate();
    const { user, token, logout } = useContext(AuthContext);      // :contentReference[oaicite:4]{index=4}
    const { openLoginModal }           = useContext(AuthModalContext);
    const [showReportModal, setShowReportModal] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    const [quizStats, setQuizStats] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [statsLoading, setStatsLoading] = useState(false);
    const [statsError, setStatsError] = useState(null);

    let quizCreatorUsername = null;
    if (quizData?.created_by) {
        if (typeof quizData.created_by === 'string') {
            quizCreatorUsername = quizData.created_by;
        } else {
            quizCreatorUsername = quizData.created_by.username;
        }
    }
    const isOwner = !!user?.username && !!quizCreatorUsername && user.username === quizCreatorUsername;

    const fetchQuiz = useCallback(async () => {
        setLoading(true);
        setError(null);
        setQuizData(null);
        setUserAnswers({});
        setSubmittedAnswers({});
        setFeedback({});
        setShowHint(null);
        setCurrentIndex(0);
        questionStartTimes.current = {}; // Reset timer on new fetch

        try {
            const res = await apiClient.get(`/quizzes/${permalink}/`);
            const fetchedQuizData = res.data?.quiz || res.data;

            if (!fetchedQuizData) throw new Error("Quiz data not found in API response.");
            if (typeof fetchedQuizData.title !== 'string' || !Array.isArray(fetchedQuizData.questions)) {
                throw new Error("Invalid quiz data format received from API.");
            }
            
            const processedQuestions = fetchedQuizData.questions.map((q) => {
                let processedQ = { ...q };
                processedQ.question_data = {
                    items: Array.isArray(q.question_data?.items) ? q.question_data.items : [],
                    dropZones: Array.isArray(q.question_data?.dropZones) ? q.question_data.dropZones : [],
                };
                if (typeof q.correct_options === 'string') {
                    try {
                        processedQ.correct_options = JSON.parse(q.correct_options);
                    } catch (e) {
                        console.error(`Error parsing correct_options for question ${q.id}`, e);
                        processedQ.correct_options = [];
                    }
                } else if (!Array.isArray(q.correct_options)) {
                    processedQ.correct_options = [];
                }
                if (q.question_type === 'dragdrop') {
                    if (!q._fill_blank || typeof q._fill_blank.sentence !== 'string' || !Array.isArray(q._fill_blank.words) || !Array.isArray(q._fill_blank.solutions)) {
                        console.error(`Invalid _fill_blank for dragdrop question ${q.id}:`, q._fill_blank);
                        processedQ._fill_blank = { sentence: '', words: [], solutions: [] };
                    }
                }
                return processedQ;
            });

            setQuizData({ ...fetchedQuizData, questions: processedQuestions });

        } catch (err) {
            console.error("Failed to load quiz:", err);
            setQuizData(null);
            if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); }
            else if (err.response?.status === 404) { setError("Quiz not found."); }
            else { setError(err.message || "An error occurred."); }
        } finally {
            setLoading(false);
        }
    }, [permalink, logout, navigate]);

    useEffect(() => {
        if (token) {
            fetchQuiz();
        } else {
            if (!loading && !error) openLoginModal();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permalink, token]);
    // --- NEW: tell backend “I’ve started this quiz” as soon as it loads ---
  useEffect(() => {
    if (!quizData?.id) return;
    apiClient
      .post(`/api/quizzes/${quizData.id}/start/`)
      .then(res => setSessionId(res.data.session_id))
      .catch(console.error);
  }, [quizData?.id]);

   useEffect(() => {
        if (quizData?.id) {
            setStatsLoading(true);
            setStatsError(null);
            apiClient.get(`/analytics/quizzes/${quizData.id}/detailed-statistics/`)
            .then(res => {
                const data = res.data;
                setQuizStats({
                    uniqueParticipants: data.unique_participants ?? 0,
                    uniqueFinishers: data.unique_finishers ?? 0,
                    totalAnswersSubmitted: data.total_answers_submitted_for_quiz ?? 0,
                    totalCorrectAnswers: data.total_correct_answers_for_quiz ?? 0,
                    totalWrongAnswers: data.total_wrong_answers_for_quiz ?? 0,
                    overallCorrectness: data.overall_correctness_percentage ?? 0,
                });
            })
            .catch(() => {
                setStatsError("Could not load quiz statistics.");
            })
            .finally(() => {
                setStatsLoading(false);
            });
        }
    }, [quizData]);

    const questions = quizData?.questions ?? [];
    const totalQuestions = questions.length;
    const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
    const currentQuestion = questions[safeCurrentIndex] ?? {};
    const currentQuestionId = currentQuestion.id;

    // --- FIX: Track when each question was shown ---
    // 2. Stamp the start time whenever the current question changes.
    // This useEffect is placed *after* currentQuestionId is declared to avoid the initialization error.
    useEffect(() => {
        if (currentQuestionId && !questionStartTimes.current[currentQuestionId]) {
            questionStartTimes.current[currentQuestionId] = Date.now();
        }
    }, [currentQuestionId]);


    const isAnswerSubmitted = !!submittedAnswers[currentQuestionId];
    const currentFeedback = feedback[currentQuestionId];
    const mcqOptions = [
        { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
        { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
        { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
        { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
    ].filter(o => (o.text?.trim() || o.img || o.aud));

    // --- Answer Handling ---
    const handleAnswerChange = (questionId, answer) => {
        if (submittedAnswers[questionId]) return;
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleMcqAnswer = (optionIndex) => {
        if (isAnswerSubmitted) return;
        const answerValue = optionIndex + 1;
        handleAnswerChange(currentQuestionId, answerValue);
        handleSubmitAnswer(currentQuestionId, answerValue);
    };

    const handleMultiAnswer = (optionIndex, isChecked) => {
        if (isAnswerSubmitted) return;
        const currentSelection = userAnswers[currentQuestionId] || [];
        let newSelection;
        if (isChecked) {
            newSelection = [...currentSelection, optionIndex + 1];
        } else {
            newSelection = currentSelection.filter(idx => idx !== optionIndex + 1);
        }
        handleAnswerChange(currentQuestionId, newSelection.sort((a, b) => a - b));
    };

    const handleSubmitAnswer = async (questionId, answerOverride = null) => {
          if (!token) {
                openLoginModal();
                return;
            }
        if (submittedAnswers[questionId]) return;
        const answer = answerOverride !== null ? answerOverride : userAnswers[questionId];
        const question = questions.find(q => q.id === questionId);
        if (!question) {
            setError("Question not found.");
            return;
        }
        if (answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === '') || (Array.isArray(answer) && answer.length === 0)) {
            return;
        }
        setError(null);
        setSubmittedAnswers(prev => ({ ...prev, [questionId]: true }));

        // --- FIX: Include time_spent_ms in answer submissions ---
        // 3. Calculate elapsed time and include it in the POST request.
        const startTime = questionStartTimes.current[questionId] || Date.now();
        const timeSpentMs = Date.now() - startTime;

        let isCorrect = false;
        let correctValueForFeedback = null;
        
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
            } else {
                isCorrect = backendSolutions.every(sol => {
                    const wordInBank = (question._fill_blank.words || []).find(w => w.id === sol.correct_word);
                    if (!wordInBank) return false;
                    const wordIndexInBank = (question._fill_blank.words || []).findIndex(w => w.id === sol.correct_word);
                    const correctFrontendWordId = `item_${question.temp_id || question.id}_${wordIndexInBank}`;
                    const frontendZoneIdForSolution = `zone_${question.temp_id || question.id}_${sol.slot_index}`;
                    return studentMap[frontendZoneIdForSolution] === correctFrontendWordId;
                });
            }
            correctValueForFeedback = question._fill_blank;
        }

        setFeedback(prev => ({
            ...prev,
            [questionId]: { isCorrect, correctValue: correctValueForFeedback }
        }));

        if (token) {
            try {
                // Send the timeSpentMs to the backend
                await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
                    question_id: questionId,
                    selected_option: answer,
                    time_spent_ms: timeSpentMs,
                    session_id:    sessionId
                });
            } catch (err) {
                 console.error("Error recording answer:", err);
            }
        }
    };

    const goToQuestion = (index) => {
        if (index >= 0 && index < totalQuestions) {
            setCurrentIndex(index);
            setError(null);
            setShowHint(null);
        }
    };
    const goPrev = () => goToQuestion(safeCurrentIndex - 1);
    const goNext = () => {
          if (!token) {
                openLoginModal();
                return;
            }
        if (isAnswerSubmitted || safeCurrentIndex === totalQuestions -1) {
            goToQuestion(safeCurrentIndex + 1);
        } else {
            setError("Please submit your answer before proceeding.");
        }
    };
    const handleShowHint = (hintNum) => setShowHint(hintNum);
    const handleDeleteQuiz = async () => {
        if (!quizData?.id || isDeleting) return;
        if (!window.confirm('Are you sure you want to delete this quiz?')) return;
        setIsDeleting(true);
        setError(null);
        try {
            await apiClient.delete(`/quizzes/${quizData.id}/delete/`);
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('Error deleting quiz:', err);
            setError('Failed to delete quiz.');
        } finally {
            setIsDeleting(false);
        }
    };

    if (loading) return <SkeletonLoader />;
    if (error && !quizData) return <ErrorDisplay message={error} />;
    if (!quizData || !questions || questions.length === 0) {
        return <ErrorDisplay message={error || "Quiz data is unavailable or has no questions."} />;
    }
    
    const renderAnswerArea = () => {
        const questionType = currentQuestion.question_type;
        switch (questionType) {
            case 'mcq':
                return (
                    <div className={`${styles.optionsGrid} ${styles.mcqOptions}`}>
                        {mcqOptions.map((opt) => (
                        <button
                            key={opt.index}
                            type="button"
                            className={`${styles.optionButton}
                            ${userAnswers[currentQuestionId] === (opt.index + 1) ? styles.selected : ''}
                            ${isAnswerSubmitted && currentFeedback?.correctValue === (opt.index + 1) ? styles.correct : ''}
                            ${isAnswerSubmitted && userAnswers[currentQuestionId] === (opt.index + 1) && !currentFeedback?.isCorrect ? styles.incorrect : ''}
                            ${isAnswerSubmitted ? styles.disabled : ''}
                            `}
                            onClick={() => handleMcqAnswer(opt.index)}
                            disabled={isAnswerSubmitted}
                        >
                            <div className={styles.optionContent}>
                            {opt.img && <RenderMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage} />}
                            {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                            </div>
                            {opt.aud && <RenderMedia url={opt.aud} type="audio" className={styles.optionAudioControl} />}
                            {isAnswerSubmitted && currentFeedback?.correctValue === (opt.index + 1) && <CheckCircle size={20} className={styles.optionFeedbackIconCorrect} />}
                            {isAnswerSubmitted && userAnswers[currentQuestionId] === (opt.index + 1) && !currentFeedback?.isCorrect && <XCircle size={20} className={styles.optionFeedbackIconIncorrect} />}
                        </button>
                        ))}
                    </div>
                );
            case 'multi':
                const currentSelection = userAnswers[currentQuestionId] || [];
                return (
                  <div className={`${styles.optionsGrid} ${styles.multiOptions}`}>
                    {mcqOptions.map((opt) => {
                      const isChecked = currentSelection.includes(opt.index + 1);
                      const isCorrectOption = currentFeedback?.correctValue?.includes(opt.index + 1);
                      return (
                        <label
                          key={opt.index}
                          className={`${styles.optionLabel} ${styles.optionButton}
                            ${isChecked ? styles.selected : ''}
                            ${isAnswerSubmitted && isCorrectOption ? styles.correct : ''}
                            ${isAnswerSubmitted && isChecked && !isCorrectOption ? styles.incorrect : ''}
                            ${isAnswerSubmitted ? styles.disabled : ''}
                          `}
                          aria-disabled={isAnswerSubmitted}
                        >
                          <input type="checkbox" className={styles.multiCheckbox} checked={isChecked} onChange={(e) => handleMultiAnswer(opt.index, e.target.checked)} disabled={isAnswerSubmitted} />
                          <div className={styles.optionContent}>
                             {opt.img && <RenderMedia url={opt.img} type="image" alt={`Option ${opt.index + 1}`} className={styles.optionMediaImage} />}
                             {opt.text && <span className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                          </div>
                          {opt.aud && <RenderMedia url={opt.aud} type="audio" className={styles.optionAudioControl} />}
                          {isAnswerSubmitted && isCorrectOption && <CheckCircle size={20} className={styles.optionFeedbackIconCorrect} />}
                          {isAnswerSubmitted && isChecked && !isCorrectOption && <XCircle size={20} className={styles.optionFeedbackIconIncorrect} />}
                        </label>
                      );
                    })}
                     {!isAnswerSubmitted && (
                         <button type="button" className={`${styles.btn} ${styles.btnSubmitAnswer}`} onClick={() => handleSubmitAnswer(currentQuestionId)} disabled={currentSelection.length === 0}>
                             Submit Answer
                         </button>
                     )}
                  </div>
                );
            case 'short':
                return (
                    <div className={styles.shortAnswerArea}>
                        <input type="text" className={styles.shortAnswerInput} placeholder="Type your answer..." value={userAnswers[currentQuestionId] || ''} onChange={(e) => handleAnswerChange(currentQuestionId, e.target.value)} disabled={isAnswerSubmitted} />
                        {currentQuestion.allow_speech_to_text && (
                            <SpeechToTextInput onTranscriptReady={(transcript) => handleAnswerChange(currentQuestionId, transcript)} disabled={isAnswerSubmitted} />
                        )}
                        {!isAnswerSubmitted && (
                            <button type="button" className={`${styles.btn} ${styles.btnSubmitAnswer}`} onClick={() => handleSubmitAnswer(currentQuestionId)} disabled={!userAnswers[currentQuestionId]?.trim()}>
                                Submit Answer
                            </button>
                        )}
                    </div>
                );
            case 'sort':
                return <SortQuestion question={currentQuestion} submitted={isAnswerSubmitted} userAnswer={userAnswers[currentQuestionId]} onChange={(order) => handleAnswerChange(currentQuestionId, order)} onSubmit={() => handleSubmitAnswer(currentQuestionId)} feedback={currentFeedback} />;
            case 'dragdrop':
                if (!currentQuestion?._fill_blank) return <p>Loading question...</p>;
                return <FillInTheBlanksQuestion question={currentQuestion} disabled={isAnswerSubmitted} onSubmit={(filledMap) => handleSubmitAnswer(currentQuestionId, filledMap)} submittedAnswer={userAnswers[currentQuestionId]} feedback={currentFeedback} />;
            default:
                return <p>Unknown question type: '{currentQuestion.question_type}'</p>;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <Helmet>
                <title>{quizData?.seo_title || quizData?.title || 'Quiz'}</title>
                <meta name="description" content={quizData?.seo_description || `Take the quiz: ${quizData?.title}`} />
            </Helmet>

            <div className={styles.quizContainer}>
                <div className={styles.quizHeader}>
                    <h1 className={styles.quizTitle} dangerouslySetInnerHTML={{ __html: quizData.title }}></h1>
                    {isOwner && (
                        <div className={styles.quizActions}>
                            <button onClick={() => navigate(`/admin/create-quiz/${quizData.id}`)} title="Edit Quiz" className={`${styles.actionButton} ${styles.editButton}`} disabled={isDeleting}><Edit3 size={16} /><span>Edit</span></button>
                            <button onClick={handleDeleteQuiz} title="Delete Quiz" className={`${styles.actionButton} ${styles.deleteButton}`} disabled={isDeleting}>{isDeleting ? <Loader2 size={16} className={styles.spinner} /> : <Trash2 size={16} />}<span>{isDeleting ? 'Deleting...' : 'Delete'}</span></button>
                        </div>
                    )}
                    <div className={styles.progressContainer}>
                        <span className={styles.progressText} aria-live="polite">Question {safeCurrentIndex + 1} of {totalQuestions}</span>
                        <div className={styles.progressBar}><div className={styles.progressFill} style={{ width: `${totalQuestions > 0 ? ((safeCurrentIndex + 1) / totalQuestions) * 100 : 0}%` }}></div></div>
                    </div>
                </div>
                
                {statsError ? (
                    <p className={styles.errorMessageGeneral}>{statsError}</p>
                ) : quizStats && !statsLoading ? (
                    <div className={styles.statsSummary}>
                        <StatItem icon={<Users size={20} />} label="Participants" value={quizStats.uniqueParticipants} />
                        <StatItem icon={<UserCheck size={20} />} label="Finishers" value={quizStats.uniqueFinishers} />
                        <StatItem icon={<ListChecks size={20} />} label="Total Answers" value={quizStats.totalAnswersSubmitted} />
                        <StatItem icon={<CheckSquare size={20} />} label="Correct" value={quizStats.totalCorrectAnswers} />
                        <StatItem icon={<XSquare size={20} />} label="Wrong" value={quizStats.totalWrongAnswers} />
                        <StatItem icon={<BarChart3 size={20} />} label="Correctness" value={`${quizStats.overallCorrectness}%`} />
                    </div>
                ) : (
                    statsLoading && <p>Loading analytics...</p>
                )}

                {currentQuestion && Object.keys(currentQuestion).length > 0 ? (
                    <>
                        <div className={styles.questionCard}>
                            <div className={styles.questionMediaArea}>
                                <RenderMedia url={currentQuestion.question_image} type="image" alt={currentQuestion.question_image_alt || "Question image"}/>
                                <RenderMedia url={currentQuestion.question_audio} type="audio" />
                            </div>
                            <div className={styles.questionContentArea}>
                                <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || '' }} />
                                {(currentQuestion.hint1 || currentQuestion.hint2) && (
                                    <div className={styles.hintsContainer}>
                                        {currentQuestion.hint1 && <button onClick={() => handleShowHint(1)} disabled={showHint === 1} className={styles.hintButton}><HelpCircle size={16}/> Hint 1</button>}
                                        {currentQuestion.hint2 && <button onClick={() => handleShowHint(2)} disabled={showHint === 2} className={styles.hintButton}><HelpCircle size={16}/> Hint 2</button>}
                                    </div>
                                )}
                                 {showHint && <div className={styles.hintDisplay}><strong>Hint {showHint}:</strong> {showHint === 1 ? currentQuestion.hint1 : currentQuestion.hint2}</div>}
                            </div>
                        </div>
                        
                        <div className={styles.answerArea}>
                            {renderAnswerArea()}
                        </div>

                        {isAnswerSubmitted && currentFeedback && (
                            <div className={`${styles.feedbackArea} ${currentFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
                                {currentFeedback.isCorrect ? <CheckCircle className={styles.feedbackIcon} /> : <XCircle className={styles.feedbackIcon} />}
                                <span>{currentFeedback.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                                {!currentFeedback.isCorrect && currentQuestion.question_type === 'short' && currentFeedback.correctValue && (
                                    <span className={styles.correctAnswerText}>Correct: {currentFeedback.correctValue}</span>
                                )}
                            </div>
                        )}
                        
                    </>
                ) : (
                    !loading && <p>Question data is not available.</p>
                )}

                {error && <p className={styles.errorMessageGeneral}>{error}</p>}

                <div className={styles.navigation}>
                    <button type="button" className={styles.navButton} onClick={goPrev} disabled={safeCurrentIndex === 0 || isDeleting} aria-label="Previous Question">
                        <ChevronLeft size={20} /> <span>Previous</span>
                    </button>
                    {safeCurrentIndex === totalQuestions - 1 && isAnswerSubmitted ? (
                        <div className={styles.completionMessage}>
                            Quiz Completed!
                            <button onClick={() => navigate('/study/dashboard')} className={`${styles.btn} ${styles.resultsButton}`}>Back to Dashboard</button>
                        </div>
                    ) : (
                        <button type="button" className={styles.navButton} onClick={goNext} disabled={safeCurrentIndex >= totalQuestions - 1 || !isAnswerSubmitted || isDeleting} aria-label="Next Question">
                            <span>Next</span> <ChevronRight size={20} />
                        </button>
                    )}
                    
                </div>
                <div className={styles.underQuestionActions}>
                    <button onClick={() => setShowShareModal(true)} className={styles.iconButton} title="Share quiz">
                        <Share2 />
                        <span>Share</span>
                    </button>
                    <button onClick={() => setShowReportModal(true)} className={styles.iconButton} title="Report problem">
                        <AlertTriangle />
                        <span>Report</span>
                    </button>
                </div>
            </div>

            <ReportQuizModal isOpen={showReportModal} onClose={() => setShowReportModal(false)} quizId={quizData?.id} />
            <ShareQuizModal isOpen={showShareModal} onClose={() => setShowShareModal(false)} quizId={quizData?.id} quizLink={`${window.location.origin}/quizzes/${permalink}/`} />
        </div>
    );
};

export default QuizPage;
