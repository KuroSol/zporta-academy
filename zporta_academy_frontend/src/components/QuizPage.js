import React, { useEffect, useState, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import apiClient from '../api'; // Assuming apiClient is configured elsewhere
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext is set up
import { ChevronLeft, ChevronRight, CheckCircle, XCircle, Edit3, Trash2, Loader2, AlertTriangle } from 'lucide-react';
import styles from './QuizPage.module.css'; // Import CSS Module

// --- Skeleton Loader Component ---
// Uses styles defined in QuizPage.module.css
const SkeletonLoader = () => (
  <div className={styles.skeletonContainer}>
    <div className={`${styles.skeleton} ${styles.skeletonTitle}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonProgress}`}></div>
    <div className={`${styles.skeleton} ${styles.skeletonProgressText}`}></div>
    {/* Updated skeleton for question area */}
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
// Uses styles defined in QuizPage.module.css
const ErrorDisplay = ({ message }) => (
    <div className={styles.errorContainer}>
        <AlertTriangle className={styles.errorIcon} />
        <h2 className={styles.errorTitle}>Oops! Something went wrong.</h2>
        <p className={styles.errorMessage}>{message || "An unexpected error occurred."}</p>
    </div>
);


// --- Main Quiz Page Component ---
const QuizPage = () => {
  // --- State Variables ---
  const [quizData, setQuizData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswerIndex, setSelectedAnswerIndex] = useState(null);
  const [isCorrect, setIsCorrect] = useState(null);
  const [answerSubmitted, setAnswerSubmitted] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);


  // --- Hooks ---
  const { username, subject, date, quizSlug } = useParams();
  const permalink = `${username}/${subject}/${date}/${quizSlug}`;
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext);

  const isOwner = user?.username && quizData?.created_by && user.username === quizData.created_by;

  // --- Data Fetching ---
  const fetchQuiz = useCallback(async () => {
    setLoading(true);
    setError(null);
    setQuizData(null);
    try {
      const res = await apiClient.get(`/quizzes/${permalink}/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const fetchedQuizData = res.data?.quiz || res.data;
      if (!fetchedQuizData) {
          throw new Error("Quiz data not found in API response.");
      }
       if (typeof fetchedQuizData.title !== 'string' || !Array.isArray(fetchedQuizData.questions)) {
           throw new Error("Fetched quiz data is missing required fields (title or questions).");
       }
      setQuizData(fetchedQuizData);
    } catch (err) {
      console.error("Failed to load quiz:", err);
      setQuizData(null);
      if (err.response?.status === 401) {
        if (typeof logout === 'function') logout();
        navigate('/login');
      } else if (err.response?.status === 404) {
        setError(`Quiz not found at '${permalink}'. Please check the URL or ensure the quiz exists.`);
      } else {
        setError(err.message || "An error occurred while loading the quiz. Please check your connection or try again later.");
      }
    } finally {
      setLoading(false);
    }
  }, [permalink, token, logout, navigate]);

  useEffect(() => {
    if (token) {
      fetchQuiz();
    } else {
      navigate('/login');
    }
    setCurrentIndex(0);
    setSelectedAnswerIndex(null);
    setIsCorrect(null);
    setAnswerSubmitted(false);
    setError(null);
  }, [permalink, token, fetchQuiz, navigate]);

  // --- Derived Values ---
  const questions = quizData?.questions ?? [];
  const totalQuestions = questions.length;
  const safeCurrentIndex = Math.min(Math.max(0, currentIndex), Math.max(0, totalQuestions - 1));
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
    if (answerSubmitted || !quizData || !currentQuestion.id) return;

    const wasCorrect = correctAnswerIndex !== -1 && selectedIndex === correctAnswerIndex;

    setSelectedAnswerIndex(selectedIndex);
    setIsCorrect(wasCorrect);
    setAnswerSubmitted(true);

    if (token) {
        try {
          await apiClient.post(`/quizzes/${quizData.id}/record-answer/`, {
            question_id: currentQuestion.id,
            selected_option: selectedIndex + 1
          }, {
            headers: { Authorization: `Bearer ${token}` }
          });
        } catch (err) {
          console.error("Error recording answer:", err);
          if (err.response?.status === 401) {
            if (typeof logout === 'function') logout();
            navigate('/login');
          }
        }
    } else {
        console.warn("User not logged in, answer not recorded.");
    }
  };

  const goToQuestion = (index) => {
    if (index >= 0 && index < totalQuestions) {
      setCurrentIndex(index);
      setSelectedAnswerIndex(null);
      setIsCorrect(null);
      setAnswerSubmitted(false);
    }
  };

  const goPrev = () => goToQuestion(safeCurrentIndex - 1);
  const goNext = () => goToQuestion(safeCurrentIndex + 1);


  // --- Delete Handler ---
  const handleDeleteQuiz = async () => {
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
         deleteError = 'Authentication failed. Please log in again.';
       } else if (err.response?.status === 403) {
          deleteError = 'You do not have permission to delete this quiz.';
       } else if (err.response?.status === 404) {
           deleteError = 'Quiz not found for deletion.';
       }
       setError(deleteError);
     } finally {
       setIsDeleting(false);
     }
   };


  // --- Conditional Rendering ---
  if (loading) return <SkeletonLoader />;
  if (error) return <ErrorDisplay message={error} />;
  if (!quizData || !quizData.questions || quizData.questions.length === 0) {
      return <ErrorDisplay message="Quiz data is unavailable or the quiz has no questions." />;
  }


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
    <div className={styles.pageContainer}>
      <Helmet>
        <title>{quizData.seo_title || quizData.title || 'Quiz'}</title>
        {quizData.seo_description && <meta name="description" content={quizData.seo_description} />}
        {quizData.canonical_url && <link rel="canonical" href={quizData.canonical_url} />}
        {quizData.og_title && <meta property="og:title" content={quizData.og_title} />}
        {quizData.og_description && <meta property="og:description" content={quizData.og_description} />}
        {quizData.og_image && <meta property="og:image" content={quizData.og_image} />}
      </Helmet>

      <div className={styles.quizContainer}>

        <h1 className={styles.quizTitle}>{quizData.title}</h1>

         {isOwner && (
           <div className={styles.quizActions}>
             <button
               onClick={() => navigate(`/admin/create-quiz/${quizData.id}`)}
               title="Edit Quiz"
               className={`${styles.actionButton} ${styles.editButton}`}
               disabled={isDeleting}
             >
               <Edit3 size={18} />
               <span>Edit</span>
             </button>
             <button
               onClick={handleDeleteQuiz}
               title="Delete Quiz"
               className={`${styles.actionButton} ${styles.deleteButton}`}
               disabled={isDeleting}
             >
               {isDeleting ? <Loader2 size={18} className={styles.spinner} /> : <Trash2 size={18} />}
               <span>{isDeleting ? 'Deleting...' : 'Delete'}</span>
             </button>
           </div>
         )}

        <div className={styles.progressContainer}>
           <span className={styles.progressText} aria-live="polite">
             Question {safeCurrentIndex + 1} of {totalQuestions}
           </span>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${totalQuestions > 0 ? ((safeCurrentIndex + 1) / totalQuestions) * 100 : 0}%` }}
            ></div>
          </div>
        </div>

        {/* --- Question Display Area (No Flip) --- */}
        <div className={styles.questionDisplayArea}>
            {currentQuestion.question_image && (
            <img
                src={currentQuestion.question_image}
                alt={currentQuestion.question_image_alt || ''}
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
                dangerouslySetInnerHTML={{ __html: currentQuestion.question_text || 'Question text missing...' }}
            />
        </div>


        {/* Options List */}
        <div className={styles.optionsList}>
          {options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              className={getOptionClassName(idx)}
              onClick={() => handleAnswer(idx)}
              disabled={answerSubmitted}
              aria-pressed={selectedAnswerIndex === idx}
            >
              {/* Option content layout */}
              <div className={styles.optionContent}>
                  {opt.img && (
                      <img
                          src={opt.img}
                          alt=""
                          className={styles.optionMediaImage}
                          onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                  )}
                  {/* Text is always present or spacer */}
                  <span
                      className={styles.optionText}
                      dangerouslySetInnerHTML={{ __html: opt.html || '' }} // Render empty if no html
                  />
              </div>

              {/* Audio controls rendered below main content if present */}
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

               {/* Check/X icon overlay shown after answer */}
               {answerSubmitted && (
                   <div className={styles.optionFeedbackIcon}>
                       { (idx === correctAnswerIndex) && <CheckCircle size={18} /> }
                       { (idx === selectedAnswerIndex && !isCorrect) && <XCircle size={18} /> }
                   </div>
               )}
            </button>
          ))}
        </div>

        {/* --- Feedback Area (Displayed after options) --- */}
        {answerSubmitted && (
            <div className={`${styles.feedbackArea} ${isCorrect ? styles.feedbackCorrect : styles.feedbackIncorrect}`}>
                {isCorrect !== null && (
                    <>
                        {isCorrect
                        ? <><CheckCircle size={20} className={styles.feedbackIcon} /> Correct!</>
                        : <><XCircle size={20} className={styles.feedbackIcon} /> Incorrect.</>
                        }
                        {/* {currentQuestion.explanation && <p className={styles.explanation}>{currentQuestion.explanation}</p>} */}
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
            disabled={safeCurrentIndex === 0 || isDeleting}
            aria-label="Previous Question"
          >
            <ChevronLeft size={20} />
            <span>Previous</span>
          </button>

          {safeCurrentIndex === totalQuestions - 1 && answerSubmitted ? (
            <div className={styles.completionMessage}>
              Quiz Completed!
               <button onClick={() => navigate('/dashboard')} className={styles.resultsButton}>
                   View Results
               </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.navButton}
              onClick={goNext}
              disabled={safeCurrentIndex === totalQuestions - 1 || !answerSubmitted || isDeleting}
              aria-label="Next Question"
            >
              <span>Next</span>
              <ChevronRight size={20} />
            </button>
          )}
        </div>

      </div> {/* End .quizContainer */}
    </div> // End .pageContainer
  );
};

export default QuizPage;
