import React, { useEffect, useState, useContext, useRef, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import apiClient from '../api'; // Assuming apiClient is configured
import { AuthContext } from '../context/AuthContext'; // Assuming AuthContext provides token/user
import styles from './StudyDashboard.module.css'; // Import CSS Module
import QuizCard from './QuizCard'; // Import your QuizCard component
// Import icons
import { BookOpen, Lightbulb, HelpCircle, ArrowRight, Loader, AlertTriangle, RefreshCw, BookCopy, FileQuestion } from 'lucide-react'; // Added BookCopy, FileQuestion

// --- Helper Function to Shuffle Array ---
// (Fisher-Yates Algorithm) - Kept for potential randomization if needed
function shuffleArray(array) {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
  return array;
}

// --- Feed Item Components ---

// Component for displaying an enrolled or suggested course/lesson context
// Adapts based on whether it's enrolled or suggested
const CourseFeedItem = ({ course, isEnrolled = false, progress = 0 }) => {
  const navigate = useNavigate();
  if (!course) return null;

  const permalink = course.permalink; // Assuming permalink exists
  const subjectName = course.subject?.name || 'General';
  const title = course.title || 'Untitled Course';
  const description = course.short_description || '';

  const handleNavigate = () => {
      if (permalink) {
          navigate(`/courses/${permalink}`);
      } else {
          console.warn("Missing permalink for course:", course);
      }
  };

  return (
    <article
      className={`${styles.feedItem} ${isEnrolled ? styles.enrolledCard : styles.suggestedCard}`}
      onClick={handleNavigate}
      tabIndex={0}
      onKeyPress={(e) => e.key === 'Enter' && handleNavigate()}
      aria-label={`${isEnrolled ? 'Continue course' : 'View suggested course'}: ${title}`}
    >
             {course.thumbnail && (
         <div className={styles.cardThumbnail}>
           <img
             src={course.thumbnail}
             alt={`${title} thumbnail`}
           />
         </div>
       )}
      <div className={styles.cardHeader}>
         <div className={styles.cardIcon}>
            {isEnrolled ? <BookOpen size={20} /> : <Lightbulb size={20} />}
         </div>
         <div className={styles.cardHeaderText}>
            <h3 className={styles.cardTitle}>{title}</h3>
             <p className={styles.cardSubtitle}>
                <span className={styles.itemTypeLabel}>{isEnrolled ? 'Enrolled Course' : 'Suggested Course'}</span>
                <span className={styles.subjectTag}>{subjectName}</span>
             </p>
         </div>
         <div className={styles.cardAction}>
             <span>{isEnrolled ? 'Continue' : 'View'}</span>
             <ArrowRight size={18} />
         </div>
      </div>

      {/* Optional: Add description or progress */}
      {description && !isEnrolled && <p className={styles.cardDescription}>{description}</p>}

      {isEnrolled && (
        <div className={styles.progressSection}>
          <div className={styles.progressBarContainer}>
            <div
              className={styles.progressBar}
              style={{ width: `${progress}%` }}
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label={`${title} progress`}
            ></div>
          </div>
          <span className={styles.progressText}>{progress}% Complete</span>
        </div>
      )}
    </article>
  );
};


// Component for displaying a suggested quiz using QuizCard visually, but navigates on click
const QuizFeedItem = ({ quiz }) => {
    const navigate = useNavigate();
    if (!quiz) return null;

    // Construct permalink for navigation (adjust based on your actual Quiz object structure)
    const permalink = quiz.permalink || (quiz.created_by && quiz.subject?.name && quiz.date_created && quiz.slug
                         ? `${quiz.created_by}/${quiz.subject.name}/${quiz.date_created}/${quiz.slug}`
                         : null);
    const subjectName = quiz.subject?.name || 'General';
    const title = quiz.title || 'Untitled Quiz';

    const handleNavigate = () => {
        if (permalink) {
            // Navigate to the QuizPage using the constructed permalink from App.js
            navigate(`/quizzes/${permalink}`);
        } else {
            console.warn("Missing data to construct permalink for quiz:", quiz);
            // Fallback or error handling if permalink cannot be constructed
            // Maybe navigate to a generic quiz list page?
            // navigate('/quizzes/my');
        }
    };

    return (
        <article
            className={`${styles.feedItem} ${styles.quizFeedItemContainer}`}
            onClick={handleNavigate}
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && handleNavigate()}
            aria-label={`Take quiz: ${title}`}
        >
            <div className={styles.cardHeader}>
                <div className={styles.cardIcon} style={{ backgroundColor: 'var(--zporta-info)' }}> {/* Specific color for quiz */}
                    <FileQuestion size={20} />
                </div>
                <div className={styles.cardHeaderText}>
                    <h3 className={styles.cardTitle}>{title}</h3>
                    <p className={styles.cardSubtitle}>
                        <span className={styles.itemTypeLabel}>Suggested Quiz</span>
                        <span className={styles.subjectTag}>{subjectName}</span>
                    </p>
                </div>
                 <div className={styles.cardAction}>
                    <span>Take Quiz</span>
                    <ArrowRight size={18} />
                </div>
            </div>
            {/* Render QuizCard visually inside, but don't make it interactive here */}
            {/* Pass a prop like `isFeedView={true}` if QuizCard needs to disable interactions */}
            <div className={styles.quizCardWrapper}>
                 <QuizCard quiz={quiz} isFeedView={true} /> {/* Pass isFeedView prop */}
            </div>
        </article>
    );
};
// --- LESSON FEED ITEM ---
const LessonFeedItem = ({ lesson, isNext = false }) => {
  const navigate = useNavigate();
  const { lesson_title, lesson_permalink, course, excerpt } = lesson;
  const subjectName = course?.subject?.name || 'General';

  return (
    <article
      className={`${styles.feedItem} ${isNext ? styles.nextLesson : styles.suggestedLesson}`}
      onClick={() => navigate(`/lessons/${lesson_permalink}`)}
      tabIndex={0}
      aria-label={`${isNext ? 'Start next lesson' : 'View suggested lesson'}: ${lesson_title}`}
    >
      <div className={styles.cardHeader}>
        <div className={styles.cardIcon}>
          {isNext ? <HelpCircle size={20} /> : <Lightbulb size={20} />}
        </div>
        <div className={styles.cardHeaderText}>
          <h3 className={styles.cardTitle}>{lesson_title}</h3>
          <p className={styles.cardSubtitle}>
            <span className={styles.itemTypeLabel}>
              {isNext ? 'Next Lesson' : 'Suggested Lesson'}
            </span>
            <span className={styles.subjectTag}>{subjectName}</span>
          </p>
        </div>
                {excerpt && (
          <div
            className={styles.cardDescription}
            dangerouslySetInnerHTML={{ __html: excerpt }}
          />
        )}

        <div className={styles.cardAction}>
          <span>{isNext ? 'Start' : 'View'}</span>
          <ArrowRight size={18} />
        </div>
      </div>
    </article>
  );
};

// --- Main Study Dashboard Component ---
export default function StudyDashboard() {
  const { token, user } = useContext(AuthContext); // Get user for potential welcome message
  const navigate = useNavigate();

  // State
  const [feedItems, setFeedItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1); // For pagination (simulated)
  const [hasMore, setHasMore] = useState(true); // Assume more initially
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Ref for the observer target
  const observerTarget = useRef(null);

  // Function to fetch initial data
  const fetchInitialData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch all data types from the single dashboard endpoint
      const response = await apiClient.get('study/dashboard/');
      const {
        enrolled,
        suggested_courses,
        suggested_quizzes,
        next_lessons,
        suggested_lessons
      } = response.data;
      

      // 1) Enrolled courses
      const enrolledCourses = enrolled.map(item => ({
        type: 'enrolledCourse',
        id: `enrolled-${item.course.id}`,
        data: item
      }));

      // 2) Next lessons (not yet completed)
      const nextLessons = (next_lessons || []).map(item => ({
        type: 'nextLesson',
        id: item.id,
        data: item.data
      }));

      // 3) Suggested lessons
      const suggestedLessons = (suggested_lessons || []).map(item => ({
        type: 'suggestedLesson',
        id: item.id,
        data: item.data
      }));

      // 4) Suggested courses
      const suggestedCourses = suggested_courses.map(item => ({
        type: 'suggestedCourse',
        id: `suggested-course-${item.id}`,
        data: item
      }));

      // 5) Suggested quizzes
      const suggestedQuizzes = suggested_quizzes.map(item => ({
        type: 'suggestedQuiz',
        id: `suggested-quiz-${item.id}`,
        data: item
      }));

      // 6) Combine & shuffle
      let combinedItems = [
        ...enrolledCourses,
        ...nextLessons,
        ...suggestedLessons,
        ...suggestedCourses,
        ...suggestedQuizzes
      ];

      combinedItems = shuffleArray(combinedItems);

      // 7) Set state
      setFeedItems(combinedItems);


      setPage(1); // Reset page number
      // Simulate hasMore based on whether we got any data initially
      // A real API would indicate if more pages exist
      setHasMore(combinedItems.length > 0); // Simple check, adjust if API provides total count

    } catch (err) {
      console.error("Error fetching study dashboard:", err.response ? err.response.data : err.message);
      setError('Could not load your study feed. Please try refreshing.');
        if (err.response?.status === 401 || err.response?.status === 403) {
            // Optional: Redirect to login on auth error
            // navigate('/login');
        }
    } finally {
      setLoading(false);
    }
  }, [token]); // Removed navigate from dependencies unless used inside fetchInitialData

  // Function to simulate loading more items
   const loadMoreItems = useCallback(async () => { // Make async if fetching real data
    if (isLoadingMore || !hasMore || loading) return; // Prevent multiple loads

    console.log("Attempting to load more items...");
    setIsLoadingMore(true);

    // ** SIMULATION / Placeholder for API Call **
    // In a real app, you'd fetch `study/feed/?page=${page + 1}` here.
    // Replace this timeout with an actual API call.
    await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate network delay

    try {
        // --- Start Real API Call Section (Example) ---
        // const nextPage = page + 1;
        // const response = await apiClient.get(`study/feed/?page=${nextPage}`); // Your paginated endpoint
        // const newData = response.data; // Assuming response structure { results: [], has_more: boolean }

        // const newItems = (newData.results || []).map(item => {
        //     // Map API data to your feed item structure ({ type, id, data })
        //     // Example: Detect type based on API response structure
        //     if (item.type === 'course') { // Adjust based on your actual API response
        //         return { type: item.is_enrolled ? 'enrolledCourse' : 'suggestedCourse', id: `${item.type}-${item.id}`, data: item };
        //     } else if (item.type === 'quiz') {
        //         return { type: 'suggestedQuiz', id: `quiz-${item.id}`, data: item };
        //     }
        //     // Add more types as needed
        //     return null;
        // }).filter(Boolean); // Filter out nulls

        // setFeedItems(prevItems => [...prevItems, ...newItems]);
        // setPage(nextPage);
        // setHasMore(newData.has_more || false); // Update based on API response
        // --- End Real API Call Section ---


        // --- Simulation Logic (Keep or replace with API call) ---
        // For simulation, let's just say we reached the end after the first "load more" attempt
        console.log("Simulation: No more items to load.");
        setHasMore(false); // Simulate reaching the end
        // --- End Simulation Logic ---

    } catch (err) {
        console.error("Error loading more items:", err);
        // Optionally show an error message to the user
        // setError('Could not load more items.');
        // Decide if you want to stop trying to load more on error
        // setHasMore(false);
    } finally {
        setIsLoadingMore(false);
        console.log("Finished loading more items.");
    }
}, [isLoadingMore, hasMore, page, loading]); // Added loading dependency


  // Effect for initial data load
  useEffect(() => {
    if (!token) {
      navigate('/login'); // Redirect if not logged in
      return;
    }
    fetchInitialData();
  }, [token, navigate, fetchInitialData]); // Include fetchInitialData

  // Effect for Intersection Observer (Infinite Scroll)
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        // Trigger load more only when intersecting, more data exists, and not already loading
        if (target.isIntersecting && hasMore && !loading && !isLoadingMore) {
             console.log("Observer triggered: Loading more...");
             loadMoreItems();
        } else if (target.isIntersecting) {
            // console.log("Observer triggered but conditions not met:", { hasMore, loading, isLoadingMore });
        }
      },
      {
          root: null, // Use the viewport as the root
          rootMargin: '0px', // No margin
          threshold: 0.8 // Trigger when 80% of the target is visible
      }
    );

    const currentTarget = observerTarget.current; // Capture ref value
    if (currentTarget) {
      observer.observe(currentTarget); // Start observing
       // console.log("IntersectionObserver is now observing the target.");
    } else {
        // console.log("Observer target ref is not yet available.");
    }

    // Cleanup function
    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget); // Stop observing
        // console.log("IntersectionObserver stopped observing the target.");
      }
    };
  }, [hasMore, loading, isLoadingMore, loadMoreItems]); // Re-run observer setup if these change

  // --- Render Loading State ---
  if (loading && page === 1) { // Show initial loading state only on first load
    return (
      <div className={styles.centeredMessage}>
        <Loader size={48} className={styles.spinner} />
        <p>Loading your study feed...</p>
      </div>
    );
  }

  // --- Render Error State ---
  if (error) {
    return (
        <div className={`${styles.centeredMessage} ${styles.errorMessageContainer}`}>
          <AlertTriangle size={48} />
         <p>{error}</p>
          {/* Provide a way to retry fetching */}
          <button onClick={fetchInitialData} className={styles.retryButton}>
              <RefreshCw size={16} /> Retry
          </button>
        </div>
    );
  }

  // --- Render Main Dashboard Feed ---
  return (
    <div className={styles.dashboardContainer}>
      <h1 className={styles.pageTitle}>Study Feed</h1>
      {user && <p className={styles.welcomeMessage}>Welcome back, {user.first_name || user.username}!</p>}


      {/* --- Feed Items --- */}
      {feedItems.length > 0 ? (
        <div className={styles.feedContainer}>
          {feedItems.map((item) => {
             // Use a stable key - prefer API-provided unique ID
             const key = `${item.type}-${item.id}`;
             switch (item.type) {
              case 'enrolledCourse':
                return (
                  <CourseFeedItem
                    key={key}
                    course={item.data.course}
                    isEnrolled={true}
                    progress={item.data.progress}
                  />
                );
              case 'nextLesson':
                return <LessonFeedItem key={key} lesson={item.data} isNext />;
              case 'suggestedLesson':
                return <LessonFeedItem key={key} lesson={item.data} />;
              case 'suggestedCourse':
                return <CourseFeedItem key={key} course={item.data} isEnrolled={false} />;
              case 'suggestedQuiz':
                return <QuizFeedItem key={key} quiz={item.data} />;
              default:
                return null;
            }
            
          })}

          {/* Observer Target Element (for triggering load more) */}
          {/* Placed after the list, will trigger when it comes into view */}
          <div ref={observerTarget} className={styles.observerTarget}>
              {/* This element should have some height or be visible to trigger intersection */}
              {/* You might add padding or a min-height if needed */}
          </div>

          {/* Loading More Indicator */}
          {isLoadingMore && (
            <div className={styles.centeredMessage} style={{ minHeight: 'auto', padding: '2rem 0' }}>
              <Loader size={32} className={styles.spinner} />
              <p>Loading more...</p>
            </div>
          )}

            {/* No More Items Message */}
            {!hasMore && feedItems.length > 0 && !isLoadingMore && (
              <div className={styles.centeredMessage} style={{ minHeight: 'auto', padding: '2rem 0', opacity: 0.7 }}>
                <p>You've reached the end!</p>
              </div>
            )}

        </div>
      ) : (
        // --- Empty State (if no items at all after initial load) ---
         !loading && feedItems.length === 0 && ( // Only show empty state if not loading and feed is empty
            <div className={styles.emptyState}>
              <BookCopy size={40} className={styles.emptyIcon} />
              <p>Your study feed is looking a bit empty.</p>
              <p>Why not explore some new topics?</p>
              <Link to="/explore" className={styles.exploreLink}> {/* Changed link to /explore */}
                Explore Courses & Quizzes <ArrowRight size={16} />
              </Link>
            </div>
         )
      )}
    </div>
  );
}
