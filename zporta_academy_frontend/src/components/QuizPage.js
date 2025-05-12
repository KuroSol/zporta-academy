import React, { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api'; // Assuming apiClient is configured elsewhere
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext is set up
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Edit3, Trash2, Loader2, AlertTriangle, Volume2, HelpCircle, Mic } from 'lucide-react';
import SpeechToTextInput from './SpeechToTextInput';
import styles from './QuizPage.module.css';
import SortQuestion from './SortQuestion';
import FillInTheBlanksQuestion from './FillInTheBlanksQuestion'; // Import the new component

// --- Skeleton Loader Component ---
const SkeletonLoader = () => (
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
                onError={(e) => { e.currentTarget.style.display = 'none'; }} // Hide if image fails to load
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
    const [quizData, setQuizData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [userAnswers, setUserAnswers] = useState({}); // Stores user's selections before submission
    const [submittedAnswers, setSubmittedAnswers] = useState({}); // Tracks if an answer for a question ID is submitted
    const [feedback, setFeedback] = useState({}); // Stores feedback (isCorrect, correctValue) for submitted answers
    const [isDeleting, setIsDeleting] = useState(false);
    const [showHint, setShowHint] = useState(null); // null, 1, or 2

    const { username, subject, date, quizSlug } = useParams();
    const permalink = `${username}/${subject}/${date}/${quizSlug}`;
    const navigate = useNavigate();
    const { user, token, logout } = useContext(AuthContext);
    const isOwner = user?.username && quizData?.created_by && user.username === quizData.created_by;

    const fetchQuiz = useCallback(async () => {
        setLoading(true);
        setError(null);
        setQuizData(null); // Reset quiz data on new fetch
        setUserAnswers({});
        setSubmittedAnswers({});
        setFeedback({});
        setShowHint(null);
        setCurrentIndex(0); // Reset to first question

        try {
            const res = await apiClient.get(`/quizzes/${permalink}/`, {
                // Authorization header might be handled by apiClient interceptor
                // headers: { Authorization: `Bearer ${token}` }
            });
            const fetchedQuizData = res.data?.quiz || res.data; // Adjust based on your API response structure

            if (!fetchedQuizData) throw new Error("Quiz data not found in API response.");
            if (typeof fetchedQuizData.title !== 'string' || !Array.isArray(fetchedQuizData.questions)) {
                throw new Error("Invalid quiz data format received from API.");
            }
            
            // Process questions to ensure data structures are consistent
            const processedQuestions = fetchedQuizData.questions.map((q, index) => {
                let processedQ = { ...q }; // Start with a copy

                // Ensure question_data is an object with items and dropZones arrays
                processedQ.question_data = {
                    items: Array.isArray(q.question_data?.items) ? q.question_data.items : [],
                    dropZones: Array.isArray(q.question_data?.dropZones) ? q.question_data.dropZones : [],
                };

                // Handle correct_options (which might be a stringified JSON)
                if (typeof q.correct_options === 'string') {
                    try {
                        processedQ.correct_options = JSON.parse(q.correct_options);
                    } catch (e) {
                        console.error(`Error parsing correct_options for question ${q.id} (type: ${q.question_type}):`, e);
                        processedQ.correct_options = []; // Default to empty array on parse error
                    }
                } else if (!Array.isArray(q.correct_options)) {
                    // If it's not a string and not an array, default it for safety
                    processedQ.correct_options = [];
                }
                
                // --- Specific processing for 'dragdrop' ---
                if (q.question_type === 'dragdrop') {
                    // The backend sends the fill_blank structure under `_fill_blank`
                    // We need to ensure this structure is present and valid
                    if (!q._fill_blank || typeof q._fill_blank.sentence !== 'string' || !Array.isArray(q._fill_blank.words) || !Array.isArray(q._fill_blank.solutions)) {
                        console.error(`Invalid or missing _fill_blank structure for dragdrop question ${q.id}:`, q._fill_blank);
                        // You might want to mark this question as invalid or provide defaults
                        processedQ._fill_blank = { sentence: '', words: [], solutions: [] }; // Provide safe defaults
                    }
                    // The actual solution for dragdrop is within _fill_blank.solutions
                    // correct_options on the question itself is NOT used for dragdrop answers.
                }
                
                return processedQ;
            });

            setQuizData({ ...fetchedQuizData, questions: processedQuestions });

        } catch (err) {
            console.error("Failed to load quiz:", err);
            setQuizData(null); // Ensure quizData is null on error
            if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); }
            else if (err.response?.status === 404) { setError(`Quiz not found at '${permalink}'.`); }
            else { setError(err.message || "An error occurred while loading the quiz."); }
        } finally {
            setLoading(false);
        }
    }, [permalink, token, logout, navigate]); // Removed fetchQuiz from dependencies as it causes loop

    useEffect(() => {
        if (token) {
            fetchQuiz();
        } else {
            // If no token, redirect to login, but only if not already loading or errored
            if(!loading && !error) navigate('/login');
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [permalink, token]); // Removed navigate, fetchQuiz, loading, error from deps to prevent loops


    const questions = quizData?.questions ?? [];
    const totalQuestions = questions.length;
    // Ensure currentIndex is always valid
    const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
    const currentQuestion = questions[safeCurrentIndex] ?? {}; // Default to empty object if questions array is empty
    const currentQuestionId = currentQuestion.id;
    const isAnswerSubmitted = !!submittedAnswers[currentQuestionId]; // Check if current question's answer is submitted
    const currentFeedback = feedback[currentQuestionId]; // Feedback for the current question

    // Options for MCQ/Multi, filtered to remove empty ones
    const mcqOptions = [
        { index: 0, text: currentQuestion.option1, img: currentQuestion.option1_image, aud: currentQuestion.option1_audio },
        { index: 1, text: currentQuestion.option2, img: currentQuestion.option2_image, aud: currentQuestion.option2_audio },
        { index: 2, text: currentQuestion.option3, img: currentQuestion.option3_image, aud: currentQuestion.option3_audio },
        { index: 3, text: currentQuestion.option4, img: currentQuestion.option4_image, aud: currentQuestion.option4_audio },
    ].filter(o => (o.text?.trim() || o.img || o.aud)); // Ensure text is trimmed before checking

    // --- Answer Handling ---
    const handleAnswerChange = (questionId, answer) => {
        if (submittedAnswers[questionId]) return; // Don't change if already submitted
        setUserAnswers(prev => ({ ...prev, [questionId]: answer }));
    };

    const handleMcqAnswer = (optionIndex) => {
        if (isAnswerSubmitted) return;
        const answerValue = optionIndex + 1; // MCQ answers are 1-based
        handleAnswerChange(currentQuestionId, answerValue);
        handleSubmitAnswer(currentQuestionId, answerValue); // Auto-submit MCQ
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
        // For multi, user clicks a separate submit button
    };

    const handleSubmitAnswer = async (questionId, answerOverride = null) => {
        if (submittedAnswers[questionId]) return; // Already submitted
        const answer = answerOverride !== null ? answerOverride : userAnswers[questionId];

        const question = questions.find(q => q.id === questionId);
        if (!question) {
            setError("Question not found for submission.");
            return;
        }
        
        // Basic validation: ensure an answer is provided (except for some edge cases)
        if (answer === undefined || answer === null || 
            (typeof answer === 'string' && answer.trim() === '' && question.question_type !== 'dragdrop') || // Allow empty string for dragdrop if it means no items placed
            (Array.isArray(answer) && answer.length === 0 && question.question_type !== 'dragdrop') ) {
            setError("Please provide an answer before submitting.");
            return;
        }
        setError(null); // Clear previous errors
        setSubmittedAnswers(prev => ({ ...prev, [questionId]: true }));

        let isCorrect = false;
        let correctValueForFeedback = null;

        try {
            // --- Determine Correctness based on Question Type ---
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
                // 'answer' for dragdrop is expected to be an object: { "blank_0_id": "word_item_id_x", ... }
                // The solution is in question._fill_blank.solutions: [{slot_index: 0, correct_word: (backend_word_id)}, ...]
                const studentMap = answer || {}; // e.g., { "zone_tempId_0": "item_tempId_wordIdx_a", ... }
                const backendSolutions = question._fill_blank?.solutions || [];
                
                if (backendSolutions.length === 0 && Object.keys(studentMap).length === 0) {
                    isCorrect = true; // No blanks, no answers = correct
                } else if (backendSolutions.length !== Object.keys(studentMap).length && backendSolutions.length > 0) {
                    isCorrect = false; // Mismatch in number of filled blanks vs expected
                } else {
                    isCorrect = backendSolutions.every(sol => {
                        // Find the frontend zone ID that corresponds to this backend solution's slot_index
                        const zoneId = question._fill_blank.words[sol.slot_index] ? // This logic is flawed.
                                       `zone_${question.temp_id || question.id}_${sol.slot_index}` : null; // Fallback, but might not be reliable
                        
                        // Find the frontend item ID that corresponds to the backend correct_word ID
                        // This requires mapping backend BlankWord IDs to frontend temporary item IDs.
                        // This mapping should ideally happen during data fetching or be part of _fill_blank structure.
                        // For now, we assume `FillInTheBlanksQuestion` provides `studentMap` with frontend item IDs.
                        // And `backendSolutions` needs to be compared against this.
                        
                        // Simplified: We need to compare the student's placed word ID (frontend temp ID)
                        // for a given blank (identified by its frontend zone ID)
                        // with the correct word ID (frontend temp ID) for that same blank.

                        // Let's assume `FillInTheBlanksQuestion` passes `studentMap` as { "frontend_zone_id": "frontend_word_id" }
                        // And `question._fill_blank.solutions` is [{slot_index: 0, correct_word: backend_word_id}]
                        // We need to map `backend_word_id` to its `frontend_word_id` and `slot_index` to `frontend_zone_id`.

                        // This part is complex and depends heavily on the structure of _fill_blank
                        // and how FillInTheBlanksQuestion structures its 'answer' object.
                        // Placeholder for now:
                        const correctWordBackendId = sol.correct_word; // This is the DB ID of the BlankWord
                        // Find the frontend temporary ID for this correct word
                        let correctFrontendWordId = null;
                        const wordInBank = (question._fill_blank.words || []).find(w => w.id === correctWordBackendId);
                        if (wordInBank) {
                            const wordIndexInBank = (question._fill_blank.words || []).findIndex(w => w.id === correctWordBackendId);
                            correctFrontendWordId = `item_${question.temp_id || question.id}_${wordIndexInBank}`;
                        }
                        
                        const frontendZoneIdForSolution = `zone_${question.temp_id || question.id}_${sol.slot_index}`;
                        return studentMap[frontendZoneIdForSolution] === correctFrontendWordId;
                    });
                }
                correctValueForFeedback = question._fill_blank; // Pass the whole structure for detailed feedback
            }
            
            setFeedback(prev => ({
                ...prev,
                [questionId]: { isCorrect, correctValue: correctValueForFeedback }
            }));

            // Record answer on backend if user is logged in
            if (token) {
                await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
                    question_id: questionId,
                    selected_option: answer // Send the answer in the format backend expects
                }, { /* headers: { Authorization: `Bearer ${token}` } */ });
            } else {
                console.warn("User not logged in, answer not recorded on backend.");
            }

        } catch (err) {
            console.error("Error submitting answer:", err);
            setSubmittedAnswers(prev => ({ ...prev, [questionId]: false })); // Revert submission status on error
            setError("Failed to submit answer. Please try again.");
            if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); }
        }
    };

    // --- Navigation and UI Actions ---
    const goToQuestion = (index) => {
        if (index >= 0 && index < totalQuestions) {
            setCurrentIndex(index);
            setError(null); // Clear general error when navigating
            setShowHint(null); // Reset hint display
        }
    };
    const goPrev = () => goToQuestion(safeCurrentIndex - 1);
    const goNext = () => {
        // Only allow next if current question is submitted (or if it's the last one and submitted)
        if (isAnswerSubmitted || safeCurrentIndex === totalQuestions -1) {
            goToQuestion(safeCurrentIndex + 1);
        } else {
            setError("Please submit your answer before proceeding.");
        }
    };
    const handleShowHint = (hintNum) => setShowHint(hintNum);

    const handleDeleteQuiz = async () => {
        if (!quizData?.id || isDeleting) return;
        if (!window.confirm('Are you sure you want to delete this quiz? This action cannot be undone.')) return;
        setIsDeleting(true);
        setError(null);
        try {
            await apiClient.delete(`/quizzes/${quizData.id}/delete/`, {
                // headers: { Authorization: `Bearer ${token}` }
            });
            navigate('/dashboard', { replace: true }); // Navigate to dashboard after delete
        } catch (err) {
            console.error('Error deleting quiz:', err);
            let deleteError = 'Failed to delete quiz. Please try again later.';
            if (err.response?.status === 401) { if (typeof logout === 'function') logout(); navigate('/login'); deleteError = 'Authentication failed.'; }
            else if (err.response?.status === 403) { deleteError = 'Permission denied.'; }
            else if (err.response?.status === 404) { deleteError = 'Quiz not found.'; }
            setError(deleteError);
        } finally {
            setIsDeleting(false);
        }
    };

    // --- Render Logic ---
    if (loading) return <SkeletonLoader />;
    if (error && !quizData) return <ErrorDisplay message={error} />;
    if (!quizData || !questions || questions.length === 0) {
        return <ErrorDisplay message={error || "Quiz data is unavailable or the quiz has no questions."} />;
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
                          {opt.img && <RenderMedia url={opt.img} type="image" alt={`Option ${opt.index + 1} image`} className={styles.optionMediaImage} />}
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
                             {opt.img && <RenderMedia url={opt.img} type="image" alt={`Option ${opt.index + 1} image`} className={styles.optionMediaImage} />}
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
                             disabled={currentSelection.length === 0} // Disable if no options selected
                         >
                             Submit Answer
                         </button>
                     )}
                  </div>
                );
            case 'short':
                return (
                    <div className={styles.shortAnswerArea}>
                        <input
                            type="text"
                            className={styles.shortAnswerInput}
                            placeholder="Type your answer here..."
                            value={userAnswers[currentQuestionId] || ''}
                            onChange={(e) => handleAnswerChange(currentQuestionId, e.target.value)}
                            disabled={isAnswerSubmitted}
                            aria-label="Short answer input"
                        />
                        {currentQuestion.allow_speech_to_text && (
                            <SpeechToTextInput
                                onTranscriptReady={(transcript) => handleAnswerChange(currentQuestionId, transcript)}
                                // You might want to add a disabled prop here too
                            />
                        )}
                        {!isAnswerSubmitted && (
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.btnSubmitAnswer}`}
                                onClick={() => handleSubmitAnswer(currentQuestionId)}
                                disabled={!userAnswers[currentQuestionId]?.trim()} // Disable if input is empty
                            >
                                Submit Answer
                            </button>
                        )}
                    </div>
                );
            case 'sort':
                return (
                  <SortQuestion
                    question={currentQuestion} // Pass the full question object
                    submitted={isAnswerSubmitted}
                    userAnswer={userAnswers[currentQuestionId]} 
                    onChange={(order) => handleAnswerChange(currentQuestionId, order)} 
                    onSubmit={() => handleSubmitAnswer(currentQuestionId)} 
                    feedback={currentFeedback} 
                  />
                );
            case 'dragdrop':
                // Ensure currentQuestion and its _fill_blank structure are loaded
                if (!currentQuestion?._fill_blank) {
                     return <p className={styles.errorText}>Loading fill-in-the-blanks question data...</p>;
                }
                return (
                  <FillInTheBlanksQuestion
                    question={currentQuestion} // Pass the full question object which includes _fill_blank
                    disabled={isAnswerSubmitted}
                    onSubmit={(filledMap) => handleSubmitAnswer(currentQuestionId, filledMap)}
                    submittedAnswer={userAnswers[currentQuestionId]} // The map of {zoneId: wordId}
                    feedback={currentFeedback} // Pass feedback for displaying correct/incorrect
                  />
                );
            default:
                return <p className={styles.errorText}>Error: Unknown question type '{currentQuestion.question_type}'</p>;
        }
    };

    return (
        <div className={styles.pageContainer}>
            <Helmet>
                <title>{quizData?.seo_title || quizData?.title || 'Quiz'}</title>
                <meta name="description" content={quizData?.seo_description || `Take the quiz: ${quizData?.title}`} />
                {/* Add other SEO meta tags as needed from quizData.seo */}
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

                {/* Ensure currentQuestion is defined before accessing its properties */}
                {currentQuestion && Object.keys(currentQuestion).length > 0 ? (
                    <>
                        <div className={styles.questionCard}>
                            <div className={styles.questionMediaArea}>
                                <RenderMedia url={currentQuestion.question_image} type="image" alt={currentQuestion.question_image_alt || `Question ${safeCurrentIndex + 1} image`}/>
                                <RenderMedia url={currentQuestion.question_audio} type="audio" />
                            </div>
                            <div className={styles.questionContentArea}>
                                <div className={styles.questionText} dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Loading question...' }} />
                                {(currentQuestion.hint1 || currentQuestion.hint2) && (
                                    <div className={styles.hintsContainer}>
                                        {currentQuestion.hint1 && (
                                            <button onClick={() => handleShowHint(1)} disabled={showHint === 1} className={styles.hintButton}>
                                                <HelpCircle size={16}/> Hint 1
                                            </button>
                                        )}
                                        {currentQuestion.hint2 && (
                                             <button onClick={() => handleShowHint(2)} disabled={showHint === 2 || (showHint === 1 && !currentQuestion.hint1)} className={styles.hintButton}>
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

                        <div className={styles.answerArea}>
                            {renderAnswerArea()}
                        </div>

                        {isAnswerSubmitted && currentFeedback && (
                            <div className={`${styles.feedbackArea} ${currentFeedback.isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
                                {currentFeedback.isCorrect ? <CheckCircle size={20} className={styles.feedbackIcon} /> : <XCircle size={20} className={styles.feedbackIcon} />}
                                <span>{currentFeedback.isCorrect ? 'Correct!' : 'Incorrect.'}</span>
                                {/* Specific feedback for short answer */}
                                {!currentFeedback.isCorrect && currentQuestion.question_type === 'short' && currentFeedback.correctValue && (
                                    <span className={styles.correctAnswerText}>Correct Answer: {currentFeedback.correctValue}</span>
                                )}
                                {/* Specific feedback for sort */}
                                {!currentFeedback.isCorrect && currentQuestion.question_type === 'sort' && Array.isArray(currentFeedback.correctValue) && (
                                    <div className={styles.correctSortOrderDisplay}>
                                        <strong>Correct order:</strong> {currentFeedback.correctValue.join(' → ')}
                                    </div>
                                )}
                                {/* TODO: Add specific feedback for dragdrop if needed, using currentFeedback.correctValue which is the _fill_blank object */}
                            </div>
                        )}
                    </>
                ) : (
                    !loading && <p className={styles.errorText}>Question data is not available.</p> // Show if question is somehow undefined after loading
                )}


                {error && <p className={`${styles.errorMessageGeneral} ${styles.errorText}`}>{error}</p>}

                <div className={styles.navigation}>
                    <button type="button" className={styles.navButton} onClick={goPrev} disabled={safeCurrentIndex === 0 || isDeleting} aria-label="Previous Question">
                        <ChevronLeft size={20} /> <span>Previous</span>
                    </button>

                    {safeCurrentIndex === totalQuestions - 1 && isAnswerSubmitted ? (
                        <div className={styles.completionMessage}>
                        Quiz Completed!
                        {/* Consider a link/button to a results summary page if you have one */}
                        <button onClick={() => navigate('/dashboard')} className={`${styles.btn} ${styles.resultsButton}`}>Back to Dashboard</button>
                        </div>
                    ) : (
                        <button type="button" className={styles.navButton} onClick={goNext} disabled={safeCurrentIndex >= totalQuestions - 1 || !isAnswerSubmitted || isDeleting} aria-label="Next Question">
                        <span>Next</span> <ChevronRight size={20} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default QuizPage;
