import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api'; // Assuming apiClient is configured elsewhere
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext is set up
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Edit3, Trash2 } from 'lucide-react';
import styles from './QuizPage.module.css'; // Import CSS Module

// --- Skeleton Loader Component ---
const SkeletonLoader = () => (
  <div className={styles.skeletonContainer}>
    <div className={`${styles.skeleton} ${styles.skeletonTitle}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonProgress}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonQuestion}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonOption}`}></div>
    <div className={styles.skeletonNav}>
      <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
      <div className={`${styles.skeleton} ${styles.skeletonButton}`}></div>
    </div>
  </div>
);

// --- Main Quiz Page Component ---
const QuizPage = () => {
  // --- State Variables ---
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null); // Index of the user's choice
  const [isCorrect, setIsCorrect] = useState(null); // Was the selected answer correct? (true/false)
  const [answerSubmitted, setAnswerSubmitted] = useState(false); // Has an answer been submitted for the current question?


  // --- Hooks ---
  const { username, subject, date, quizSlug } = useParams();
  const permalink = `${username}/${subject}/${date}/${quizSlug}`;
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext); // Assuming context provides user, token, logout
  const isOwner = user?.username === quizData?.created_by;
  const isCreator = user?.is_creator || isOwner; // Check if the user is a creator or the owner of the quiz
  // --- Data Fetching ---
  const fetchQuiz = useCallback(async () => {
    // console.log("Fetching quiz for permalink:", permalink); // Debug log
    setLoading(true);
    setError(null); // Reset error on new fetch
    setQuizData(null); // Reset quiz data before fetch
    try {
      const res = await apiClient.get(`/quizzes/${permalink}/`, {
        headers: { Authorization: `Bearer ${token}` } // Ensure token is sent
      });
      // console.log("API Response:", res.data); // Debug log

      // *** MODIFICATION START ***
      // Assume the successful response structure is { data: { quiz: { ... } } }
      // as implied by the original code. The checks later will handle if `res.data.quiz` is null/undefined.
      setQuizData(res.data.quiz);
      // *** MODIFICATION END ***

    } catch (err) {
      console.error("Failed to load quiz:", err); // Log detailed error
      setQuizData(null); // Ensure quizData is null on error
      if (err.response?.status === 401) {
        logout(); // Logout on unauthorized
        navigate('/login'); // Redirect to login
      } else if (err.response?.status === 404) {
        setError(`Quiz not found at '${permalink}'. Please check the URL.`);
      } else {
        // Provide a more generic error message for other potential issues
        setError("An error occurred while loading the quiz. Please check your connection or try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [permalink, token, logout, navigate]); // Dependencies for useCallback

  useEffect(() => {
    if (token) {
      fetchQuiz();
    } else {
      // If no token, redirect to login immediately
      navigate('/login');
    }
    // Reset state when permalink changes (e.g., navigating directly to a different quiz)
    setCurrentIndex(0);
    setSelectedAnswerIndex(null);
    setIsCorrect(null);
    setAnswerSubmitted(false);
  }, [permalink, token, fetchQuiz, navigate]); // Add fetchQuiz to dependencies

  // --- Derived Values ---
  // Use optional chaining and nullish coalescing for safety
  const questions = quizData?.questions ?? [];
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex] ?? {}; // Use empty object as fallback
  const options = [
    currentQuestion.option1,
    currentQuestion.option2,
    currentQuestion.option3,
    currentQuestion.option4,
  ].filter(Boolean); // Filter out null/empty options

  // --- Event Handlers ---
  const handleAnswer = async (selectedIndex) => {
    if (answerSubmitted || !quizData || !currentQuestion.id) return; // Prevent multiple submissions or actions without data

    const correctAnswerIndex = currentQuestion.correct_option - 1; // API gives 1-based index
    const wasCorrect = selectedIndex === correctAnswerIndex;

    setSelectedAnswerIndex(selectedIndex);
    setIsCorrect(wasCorrect);
    setAnswerSubmitted(true);

    // Optional: Send answer record to backend
    try {
      await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
        question_id: currentQuestion.id,
        selected_option: selectedIndex + 1 // Send 1-based index to API
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // console.log("Answer recorded successfully."); // Debug log
    } catch (err) {
      console.error("Error recording answer:", err); // Log error
      if (err.response?.status === 401) {
        logout(); // Handle unauthorized during answer submission
        navigate('/login');
      }
      // Optionally: Show a non-blocking error to the user that recording failed
      // e.g., set an error state specific to answer recording
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

  const goPrev = () => goToQuestion(currentIndex - 1);
  const goNext = () => goToQuestion(currentIndex + 1);

  // --- Conditional Rendering ---
  if (loading) return <SkeletonLoader />; // Show skeleton loader while loading

  if (error) return <div className={styles.errorContainer}><p className={styles.errorMessage}>{error}</p></div>; // Show fetch error message

  // Check for quizData *and* questions *after* loading and *without* error
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
     return <div className={styles.errorContainer}><p className={styles.errorMessage}>Quiz data is unavailable or the quiz has no questions.</p></div>;
  }


  // --- Dynamic ClassName Logic ---
  const getOptionClassName = (index) => {
    let className = styles.optionButton;
    if (answerSubmitted) {
      // Ensure correct_option exists and is a valid number before calculating index
      const correctAnswerIndex = (typeof currentQuestion.correct_option === 'number' && currentQuestion.correct_option > 0)
                                 ? currentQuestion.correct_option - 1
                                 : -1; // Set to invalid index if data is missing/wrong

      if (correctAnswerIndex !== -1 && index === correctAnswerIndex) {
        className += ` ${styles.correct}`; // Always highlight correct answer after submission if valid
      }
      if (index === selectedAnswerIndex) {
        // isCorrect state should be reliable here as it's set in handleAnswer
        className += isCorrect ? ` ${styles.selectedCorrect}` : ` ${styles.selectedIncorrect}`; // Style the selected answer
      } else {
         // Dim unselected options only if an answer was selected
         // If correctAnswerIndex is invalid, don't apply disabled style based on correctness
         if (selectedAnswerIndex !== null || correctAnswerIndex === -1) {
            className += ` ${styles.disabled}`;
         }
      }
    }
    return className;
  };

  // --- Delete Handler (only for creator) ---
  const handleDeleteQuiz = async () => {
    if (!window.confirm('Are you sure you want to delete this quiz?')) return;
    try {
      await apiClient.delete(`/quizzes/${quizData.id}/delete/`, { headers: { Authorization: `Bearer ${token}` } });

      navigate('/dashboard');  // or wherever you want to land
    } catch (err) {
      console.error('Error deleting quiz:', err);
      setError('Failed to delete quiz. Please try again later.');
    }
  };

  // --- Render Component ---
  return (
    <div className={styles.quizContainer}>
      <Helmet>
        {/* Use quizData safely */}
        <title>{quizData.seo_title || quizData.title || 'Quiz'}</title>
        {quizData.seo_description && <meta name="description" content={quizData.seo_description} />}
        {quizData.canonical_url && <link rel="canonical" href={quizData.canonical_url} />}
        {quizData.og_title && <meta property="og:title" content={quizData.og_title} />}
        {quizData.og_description && <meta property="og:description" content={quizData.og_description} />}
        {quizData.og_image && <meta property="og:image" content={quizData.og_image} />}
      </Helmet>

      {/* Quiz Header */}
      <h1 className={styles.quizTitle}>{quizData.title}</h1>

      {/* Progress Bar and Indicator */}
      <div className={styles.progressContainer}>
        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0}%` }} // Avoid division by zero
          ></div>
        </div>
        <span className={styles.progressText}>
          Question {currentIndex + 1} of {totalQuestions}
        </span>
      </div>

      {/* Question Area */}
      <div className={styles.questionArea}>
        <div
          className={styles.questionText}
          // Ensure currentQuestion.question_text exists before rendering
          dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Question not available.' }}
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
            disabled={answerSubmitted} // Disable button after submission
            // Use dangerouslySetInnerHTML carefully if HTML is trusted/sanitized
            dangerouslySetInnerHTML={{ __html: optionHtml }}
            aria-pressed={selectedAnswerIndex === index} // Indicate selection state for screen readers
          />
        ))}
      </div>

       {/* Feedback Area (replaces alert) */}
       {answerSubmitted && (
        <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
          {isCorrect ? (
            <>
              <CheckCircle size={20} className={styles.feedbackIcon} /> Correct!
            </>
          ) : (
            <>
              <XCircle size={20} className={styles.feedbackIcon} /> Incorrect.
              {/* Optional: Show the correct answer text if needed */}
              {/* You might need to ensure options and correct_option are valid before uncommenting */}
              {/* { typeof currentQuestion.correct_option === 'number' && currentQuestion.correct_option > 0 && options[currentQuestion.correct_option - 1] &&
                <div className={styles.correctAnswerText}>
                   Correct answer: <span dangerouslySetInnerHTML={{ __html: options[currentQuestion.correct_option - 1] }} />
                </div>
              } */}
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
          disabled={currentIndex === 0}
          aria-label="Previous Question"
        >
          <ChevronLeft size={24} />
          <span>Previous</span>
        </button>
        <button
          type="button"
          className={styles.navButton}
          onClick={goNext}
          // Disable if already submitted the last question OR if it's the last question index
          disabled={currentIndex === totalQuestions - 1}
          aria-label="Next Question"
        >
          <span>Next</span>
          <ChevronRight size={24} />
        </button>
      </div>

      {/* Optional: Add a summary/completion screen condition here */}
       {currentIndex === totalQuestions - 1 && answerSubmitted && (
         <div className={styles.completionMessage}>
           You've reached the end of the quiz!
           {/* Consider adding a link/button here to navigate away, e.g., back to dashboard or results page */}
           {/* Example: <button onClick={() => navigate('/dashboard')}>View Results</button> */}
         </div>
       )}

      {/* Conditionally render Edit and Delete buttons */}
      {isOwner  && (
            <div className={styles.quizActions}>
              <Edit3
                size={24}
                className={styles.actionIcon}
                title="Edit Quiz"
                onClick={() => navigate(`/admin/create-quiz/${quizData.id}`)}
              />
              <Trash2
                size={24}
                className={`${styles.actionIcon} ${styles.actionIconDelete}`}
                title="Delete Quiz"
                onClick={handleDeleteQuiz}
              />
            </div>
        )}

    </div>
  );
};

export default QuizPage;