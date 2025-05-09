import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api'; // Assuming apiClient is configured elsewhere
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext is set up
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Edit3, Trash2, Loader2, AlertTriangle, Volume2, HelpCircle, Mic } from 'lucide-react'; // Added Mic icon
// Import the SpeechToTextInput component
import SpeechToTextInput from './SpeechToTextInput'; // Adjust path if necessary
import styles from './QuizPage.module.css';

// --- Skeleton Loader Component ---
const SkeletonLoader = () => (
    // ... Skeleton loader JSX ...
    <div className={styles.skeletonContainer}>
        <div className={`${styles.skeleton} ${styles.skeletonTitle}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonProgress}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonProgressText}`}></div>
        <div className={`${styles.skeleton} ${styles.skeletonQuestionArea}`}></div>
        <div className={styles.skeletonOptionsGrid}>
            <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
            <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
            <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
            <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
        </div>
        <div className={styles.skeletonNav}>
            <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
            <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
        </div>
    </div>
);

// --- Error Display Component ---
const ErrorDisplay = ({ message }) => (
    // ... Error display JSX ...
    <div className={styles.errorContainer}>
        <AlertTriangle className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Oops! Something went wrong.</h2>
        <p className={styles.errorMessage}>{message || "An unexpected error occurred."}</p>
    </div>
);

// --- Helper: Render Media (Image/Audio) ---
const RenderMedia = ({ url, type, alt = '', className = '' }) => {
    // ... RenderMedia JSX ...
    if (!url) return null;

    if (type === 'image') {
        return (
            <img
                src={url}
                alt={alt || 'Question related image'}
                className={`${styles.mediaImage} ${className}`}
                onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide on error
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


// --- Main Quiz Page Component ---
const QuizPage = () => {
    // --- State Variables ---
    const [quizData, setQuizData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({}); // Store answers: { questionId: answer }
    const [submittedAnswers, setSubmittedAnswers] = useState({}); // Store submitted status: { questionId: true }
    const [feedback, setFeedback] = useState({}); // Store feedback: { questionId: { isCorrect: bool, correctValue: any } }
    const [isDeleting, setIsDeleting] = useState(false);
    const [showHint, setShowHint] = useState(null);

    // --- Hooks ---
    const { username, subject, date, quizSlug } = useParams();
    const permalink = `${username}/${subject}/${date}/${quizSlug}`;
    const navigate = useNavigate();
    const { user, token, logout } = useContext(AuthContext);

    const isOwner = user?.username && quizData?.created_by && user.username === quizData.created_by;

    // --- Data Fetching ---
    const fetchQuiz = useCallback(async () => {
        // ... (fetchQuiz logic remains the same) ...
        setLoading(true);
        setError(null);
        setQuizData(null);
        setUserAnswers({});
        setSubmittedAnswers({});
        setFeedback({});
        setShowHint(null);
        try {
            const res = await apiClient.get(`/quizzes/${permalink}/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const fetchedQuizData = res.data?.quiz || res.data;
            if (!fetchedQuizData) throw new Error("Quiz data not found.");
            if (typeof fetchedQuizData.title !== 'string' || !Array.isArray(fetchedQuizData.questions)) {
                throw new Error("Invalid quiz data format.");
            }
            setQuizData(fetchedQuizData);
        } catch (err) {
            console.error("Failed to load quiz:", err);
            setQuizData(null);
            if (err.response?.status === 401) {
                if (typeof logout === 'function') logout();
                navigate('/login');
            } else if (err.response?.status === 404) {
                setError(`Quiz not found.`);
            } else {
                setError(err.message || "An error occurred while loading the quiz.");
            }
        } finally {
            setLoading(false);
        }
    }, [permalink, token, logout, navigate]);

    // --- Effects ---
    useEffect(() => {
        if (token) {
            fetchQuiz();
        } else {
            navigate('/login');
        }
        setCurrentIndex(0);
        setUserAnswers({});
        setSubmittedAnswers({});
        setFeedback({});
        setShowHint(null);
        setError(null);
    }, [permalink, token, navigate]); // Removed fetchQuiz from deps here

    // --- Derived Values ---
    const questions = quizData?.questions ?? [];
    const totalQuestions = questions.length;
    const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
    const currentQuestion = questions[safeCurrentIndex] ?? {};
    const currentQuestionId = currentQuestion.id;
    const isAnswerSubmitted = !!submittedAnswers[currentQuestionId];
    const currentFeedback = feedback[currentQuestionId];

    // Prepare options specifically for MCQ/Multi
    const mcqOptions = [
        { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
        { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
        { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
        { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
    ].filter(o => (o.text || o.img || o.aud));

    // --- Event Handlers ---

    // Generic answer update handler
    const handleAnswerChange = (questionId, answer) => {
        if (submittedAnswers[questionId]) return;
        setUserAnswers(prev => ({
            ...prev,
            [questionId]: answer,
        }));
    };

    // Specific handler for MCQ button clicks
    const handleMcqAnswer = (optionIndex) => {
        if (isAnswerSubmitted) return;
        const answerValue = optionIndex + 1;
        handleAnswerChange(currentQuestionId, answerValue);
        handleSubmitAnswer(currentQuestionId, answerValue);
    };

    // Specific handler for Multi-Select checkbox changes
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

    // Handler to submit the current question's answer
    const handleSubmitAnswer = async (questionId, answerOverride = null) => {
        if (submittedAnswers[questionId]) return;

        const answer = answerOverride !== null ? answerOverride : userAnswers[questionId];

        // Basic validation before submitting
        if (answer === undefined || answer === null || (typeof answer === 'string' && answer.trim() === '') || (Array.isArray(answer) && answer.length === 0)) {
            setError("Please provide an answer before submitting.");
            return;
        }
        setError(null);

        setSubmittedAnswers(prev => ({ ...prev, [questionId]: true }));

        let isCorrect = false;
        let correctValue = null;

        try {
            // Determine correctness locally
            const question = questions.find(q => q.id === questionId); // Find the question object
            if (!question) throw new Error("Question not found for submission.");

            if (question.question_type === 'mcq') {
                isCorrect = (answer === question.correct_option);
                correctValue = question.correct_option;
            } else if (question.question_type === 'multi') {
                const correctSet = new Set(question.correct_options || []);
                const answerSet = new Set(answer || []);
                isCorrect = correctSet.size === answerSet.size && [...correctSet].every(val => answerSet.has(val));
                correctValue = [...correctSet].sort((a, b) => a - b);
            } else if (question.question_type === 'short') {
                isCorrect = answer?.toString().trim().toLowerCase() === question.correct_answer?.trim().toLowerCase();
                correctValue = question.correct_answer;
            }
            // Add logic for 'sort', 'dragdrop' here if implementing local check

            setFeedback(prev => ({
                ...prev,
                [questionId]: { isCorrect: isCorrect, correctValue: correctValue }
            }));

            // API Call
            if (token) {
                await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
                    question_id: questionId,
                    selected_option: answer
                }, { headers: { Authorization: `Bearer ${token}` } });
            } else {
                console.warn("User not logged in, answer not recorded on backend.");
            }

        } catch (err) {
            console.error("Error submitting answer:", err);
            setSubmittedAnswers(prev => ({ ...prev, [questionId]: false })); // Revert submitted state on error
            setError("Failed to submit answer. Please try again.");
            if (err.response?.status === 401) {
                if (typeof logout === 'function') logout();
                navigate('/login');
            }
        }
    };


    const goToQuestion = (index) => {
        if (index >= 0 && index < totalQuestions) {
            setCurrentIndex(index);
            setError(null);
            setShowHint(null);
            // No need to manually reset controlled input, state handles it
        }
    };

    const goPrev = () => goToQuestion(safeCurrentIndex - 1);
    const goNext = () => goToQuestion(safeCurrentIndex + 1);

    const handleShowHint = (hintNum) => {
        setShowHint(hintNum);
    };

    // --- Delete Handler ---
    const handleDeleteQuiz = async () => {
        // ... (handleDeleteQuiz logic remains the same) ...
        if (!quizData?.id || isDeleting) return;
        if (!window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;

        setIsDeleting(true);
        setError(null);
        try {
            await apiClient.delete(`/quizzes/${quizData.id}/delete/`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            console.error('Error deleting quiz:', err);
            let deleteError = 'Failed to delete quiz. Please try again later.';
            if (err.response?.status === 401) {
                if (typeof logout === 'function') logout();
                navigate('/login');
                deleteError = 'Authentication failed.';
            } else if (err.response?.status === 403) {
                deleteError = 'Permission denied.';
            } else if (err.response?.status === 404) {
                deleteError = 'Quiz not found.';
            }
            setError(deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Render Logic ---
    if (loading) return <SkeletonLoader />;
    if (error && !quizData) return <ErrorDisplay message={error} />;
    if (!quizData || !quizData.questions || quizData.questions.length === 0) {
        return <ErrorDisplay message="Quiz data is unavailable or the quiz has no questions." />;
    }

    // --- Function to Render Answer Area Based on Type ---
    const renderAnswerArea = () => {
        const questionType = currentQuestion.question_type;

        switch (questionType) {
            case 'mcq':
                // ... (MCQ rendering logic remains the same) ...
                return (
                  <div className={`${styles.optionsGrid} ${styles.mcqOptions}`}>
                    {mcqOptions.map((opt) => (
                      <button
                        key={opt.index}
                        type="button"
                        className={`
                          ${styles.optionButton}
                          ${userAnswers[currentQuestionId] === (opt.index + 1) ? styles.selected : ''}
                          ${isAnswerSubmitted && currentFeedback?.correctValue === (opt.index + 1) ? styles.correct : ''}
                          ${isAnswerSubmitted && userAnswers[currentQuestionId] === (opt.index + 1) && !currentFeedback?.isCorrect ? styles.incorrect : ''}
                          ${isAnswerSubmitted && currentFeedback?.correctValue !== (opt.index + 1) ? styles.disabled : ''}
                        `}
                        onClick={() => handleMcqAnswer(opt.index)}
                        disabled={isAnswerSubmitted}
                        aria-pressed={userAnswers[currentQuestionId] === (opt.index + 1)}
                      >
                        <div className={styles.optionContent}>
                          {opt.img && <RenderMedia url={opt.img} type="image" className={styles.optionMediaImage} />}
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
                // ... (Multi-select rendering logic remains the same) ...
                const currentSelection = userAnswers[currentQuestionId] || [];
                return (
                  <div className={`${styles.optionsGrid} ${styles.multiOptions}`}>
                    {mcqOptions.map((opt) => {
                      const isChecked = currentSelection.includes(opt.index + 1);
                      const isCorrectOption = currentFeedback?.correctValue?.includes(opt.index + 1);
                      return (
                        <label
                          key={opt.index}
                          className={`
                            ${styles.optionLabel} ${styles.optionButton}
                            ${isChecked ? styles.selected : ''}
                            ${isAnswerSubmitted && isCorrectOption ? styles.correct : ''}
                            ${isAnswerSubmitted && isChecked && !isCorrectOption ? styles.incorrect : ''}
                            ${isAnswerSubmitted && !isCorrectOption ? styles.disabled : ''}
                          `}
                          aria-disabled={isAnswerSubmitted}
                        >
                          <input
                            type="checkbox"
                            className={styles.multiCheckbox}
                            checked={isChecked}
                            onChange={(e) => handleMultiAnswer(opt.index, e.target.checked)}
                            disabled={isAnswerSubmitted}
                            aria-labelledby={`option-text-${opt.index}`}
                          />
                          <div className={styles.optionContent}>
                             {opt.img && <RenderMedia url={opt.img} type="image" className={styles.optionMediaImage} />}
                             {opt.text && <span id={`option-text-${opt.index}`} className={styles.optionText} dangerouslySetInnerHTML={{ __html: opt.text }} />}
                          </div>
                          {opt.aud && <RenderMedia url={opt.aud} type="audio" className={styles.optionAudioControl} />}
                          {isAnswerSubmitted && isCorrectOption && <CheckCircle size={20} className={styles.optionFeedbackIconCorrect} />}
                          {isAnswerSubmitted && isChecked && !isCorrectOption && <XCircle size={20} className={styles.optionFeedbackIconIncorrect} />}
                        </label>
                      );
                    })}
                     {!isAnswerSubmitted && (
                         <button
                             type="button"
                             className={`${styles.btn} ${styles.btnSubmitAnswer}`}
                             onClick={() => handleSubmitAnswer(currentQuestionId)}
                             disabled={currentSelection.length === 0}
                         >
                             Submit Answer
                         </button>
                     )}
                  </div>
                );

            case 'short':
                return (
                    <div className={styles.shortAnswerArea}>
                        {/* Controlled Text Input */}
                        <input
                            type="text"
                            className={styles.shortAnswerInput}
                            placeholder="Type your answer here..."
                            value={userAnswers[currentQuestionId] || ''} // Controlled component
                            onChange={(e) => handleAnswerChange(currentQuestionId, e.target.value)}
                            disabled={isAnswerSubmitted}
                            aria-label="Short answer input"
                        />
                        {/* Conditionally render SpeechToTextInput */}
                        {currentQuestion.allow_speech_to_text && (
                            <SpeechToTextInput
                                // Pass callback to update state when transcript is ready
                                onTranscriptReady={(transcript) => handleAnswerChange(currentQuestionId, transcript)}
                            />
                        )}
                        {/* Submit Button */}
                        {!isAnswerSubmitted && (
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSubmitAnswer}`}
                                onClick={() => handleSubmitAnswer(currentQuestionId)}
                                disabled={!userAnswers[currentQuestionId]} // Disable if no input
                            >
                                Submit Answer
                            </button>
                        )}
                    </div>
                );

            case 'sort':
                // ... (Placeholder logic remains the same) ...
                 return (
                  <div className={styles.sortArea}>
                    <p className={styles.placeholderText}>Word Sort Interface Placeholder</p>
                     {!isAnswerSubmitted && (
                         <button type="button" className={`${styles.btn} ${styles.btnSubmitAnswer}`} onClick={() => handleSubmitAnswer(currentQuestionId)}>Submit Order</button>
                     )}
                  </div>
                );

            case 'dragdrop':
                 // ... (Placeholder logic remains the same) ...
                return (
                  <div className={styles.dragDropArea}>
                    <p className={styles.placeholderText}>Drag and Drop Interface Placeholder</p>
                     {!isAnswerSubmitted && (
                         <button type="button" className={`${styles.btn} ${styles.btnSubmitAnswer}`} onClick={() => handleSubmitAnswer(currentQuestionId)}>Submit Placement</button>
                     )}
                  </div>
                );

            default:
                return <p>Error: Unknown question type '{currentQuestion.question_type}'</p>;
        }
    };

    // --- Main Render ---
    return (
        <div className={styles.pageContainer}>
            <Helmet>
                <title>{quizData?.seo_title || quizData?.title || 'Quiz'}</title>
                {/* Add other meta tags */}
            </Helmet>

            <div className={styles.quizContainer}>
                {/* --- Header & Progress --- */}
                <div className={styles.quizHeader}>
                    {/* ... (Title, Actions, Progress JSX remains the same) ... */}
                    <h1 className={styles.quizTitle}>{quizData.title}</h1>
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

                {/* --- Question Card --- */}
                <div className={styles.questionCard}>
                    {/* ... (Media, Text, Hints JSX remains the same) ... */}
                    <div className={styles.questionMediaArea}>
                        <RenderMedia url={currentQuestion.question_image} type="image" alt={currentQuestion.question_image_alt}/>
                        <RenderMedia url={currentQuestion.question_audio} type="audio" />
                    </div>
                    <div className={styles.questionContentArea}>
                        <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Loading question...' }} />
                        {(currentQuestion.hint1 || currentQuestion.hint2) && (
                            <div className={styles.hintsContainer}>
                                <button onClick={() => handleShowHint(1)} disabled={!currentQuestion.hint1 || !!showHint} className={styles.hintButton}>
                                    <HelpCircle size={16}/> Hint 1
                                </button>
                                {currentQuestion.hint2 && (
                                     <button onClick={() => handleShowHint(2)} disabled={!currentQuestion.hint2 || showHint === 2} className={styles.hintButton}>
                                        <HelpCircle size={16}/> Hint 2
                                    </button>
                                )}
                            </div>
                        )}
                         {showHint && (
                            <div className={styles.hintDisplay}>
                                <strong>Hint {showHint}:</strong> {showHint === 1 ? currentQuestion.hint1 : currentQuestion.hint2}
                            </div>
                         )}
                    </div>
                </div>

                {/* --- Answer Area (Dynamically Rendered) --- */}
                <div className={styles.answerArea}>
                    {renderAnswerArea()}
                </div>

                {/* --- Feedback Area --- */}
                {isAnswerSubmitted && currentFeedback && (
                    // ... (Feedback JSX remains the same) ...
                    <div className={`${styles.feedbackArea} ${currentFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
                        {currentFeedback.isCorrect ? <CheckCircle size={20} className={styles.feedbackIcon} /> : <XCircle size={20} className={styles.feedbackIcon} />}
                        <span>{currentFeedback.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                        {!currentFeedback.isCorrect && currentQuestion.question_type === 'short' && (
                            <span className={styles.correctAnswerText}>Correct Answer: {currentFeedback.correctValue}</span>
                        )}
                    </div>
                )}

                {/* Display general error messages */}
                {error && <p className={styles.errorMessageGeneral}>{error}</p>}

                {/* --- Navigation --- */}
                <div className={styles.navigation}>
                    {/* ... (Navigation JSX remains the same) ... */}
                    <button type="button" className={styles.navButton} onClick={goPrev} disabled={safeCurrentIndex === 0 || isDeleting} aria-label="Previous Question">
                        <ChevronLeft size={20} /> <span>Previous</span>
                    </button>

                    {safeCurrentIndex === totalQuestions - 1 && isAnswerSubmitted ? (
                        <div className={styles.completionMessage}>
                        Quiz Completed!
                        <button onClick={() => navigate('/dashboard')} className={styles.resultsButton}>View Results</button>
                        </div>
                    ) : (
                        <button type="button" className={styles.navButton} onClick={goNext} disabled={safeCurrentIndex === totalQuestions - 1 || !isAnswerSubmitted || isDeleting} aria-label="Next Question">
                        <span>Next</span> <ChevronRight size={20} />
                        </button>
                    )}
                </div>

            </div> {/* End .quizContainer */}
        </div> // End .pageContainer
    );
};

export default QuizPage;
