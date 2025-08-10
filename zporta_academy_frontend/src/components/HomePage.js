import React, { useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed
import apiClient from '../api'; // Adjust path as needed
import styles from './HomePage.module.css'; // Import NEW CSS Module styles
import { quizPermalinkToUrl } from '../utils/urls';

import { 
    FaRocket, FaChalkboardTeacher, FaNewspaper, FaGraduationCap, 
    FaCheckCircle, FaTimesCircle, FaEllipsisH, FaBookOpen
} from 'react-icons/fa'; // Example icons

// --- Helper Components (Styled with CSS Modules) ---
const LoadingPlaceholder = ({ message = "Loading..." }) => (
    <div className={styles.loadingPlaceholder}>
        <FaSpinner className={styles.spinner} size={24} /> {/* Using spinner class from CSS */}
        {message}
    </div>
);
const ErrorMessage = ({ message }) => (
    <p className={styles.errorMessage}>{message}</p>
);
const EmptyState = ({ message }) => (
    <p className={styles.emptyStateMessage}>{message}</p>
);

// FaSpinner for inline loading states if needed
const FaSpinner = ({ className, ...props }) => (
    <svg className={`${styles.spinner} ${className || ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" {...props}>
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
);


// --- Main HomePage Component ---
const HomePage = () => {
    const navigate = useNavigate();
    const { user, token, logout } = useContext(AuthContext);

    // Redirect to login if no token
    useEffect(() => {
        if (!token) {
            navigate('/login');
        }
    }, [token, navigate]);

    // --- State Declarations ---
    const [latestPosts, setLatestPosts] = useState([]);
    const [randomCourses, setRandomCourses] = useState([]);
    const [loadingDiscover, setLoadingDiscover] = useState(true);
    const [errorDiscover, setErrorDiscover] = useState('');

    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [loadingEnrolled, setLoadingEnrolled] = useState(true);
    const [errorEnrolled, setErrorEnrolled] = useState('');

    const [latestQuizAttempts, setLatestQuizAttempts] = useState([]);
    const [loadingQuizAttempts, setLoadingQuizAttempts] = useState(true);
    const [errorQuizAttempts, setErrorQuizAttempts] = useState('');

    const [latestLessons, setLatestLessons] = useState([]); 
    const [loadingLessons, setLoadingLessons] = useState(true);
    const [errorLessons, setErrorLessons] = useState('');


    // --- Data Fetching Effects ---
    const handleApiError = useCallback((err, setErrorState, defaultMessage) => {
        console.error("API Error:", err.response ? err.response.data : err.message);
        let message = defaultMessage;
        if (err.response) {
            if (err.response.status === 401 || err.response.status === 403) {
                message = "Session expired. Please log in again.";
                logout(); 
            } else if (err.response.data?.detail) {
                message = err.response.data.detail;
            } else if (typeof err.response.data === 'string' && err.response.data.length < 100) {
                message = err.response.data;
            }
        } else if (err.message) {
            message = err.message;
        }
        setErrorState(message);
    }, [logout]);

    useEffect(() => {
        if (!token) return;
        const fetchDiscoverContent = async () => {
            setLoadingDiscover(true);
            setErrorDiscover('');
            try {
                const [postsRes, coursesRes] = await Promise.all([
                    apiClient.get('/posts/?ordering=-created_at&limit=4'), 
                    apiClient.get('/courses/?random=4') 
                ]);
                setLatestPosts(Array.isArray(postsRes.data) ? postsRes.data : []);
                setRandomCourses(Array.isArray(coursesRes.data) ? coursesRes.data : []);
            } catch (err) {
                handleApiError(err, setErrorDiscover, "Could not load discover content.");
                setLatestPosts([]);
                setRandomCourses([]);
            } finally {
                setLoadingDiscover(false);
            }
        };
        fetchDiscoverContent();
    }, [token, handleApiError]);

    useEffect(() => {
        if (!token) return;
        const fetchEnrolledCourses = async () => {
            setLoadingEnrolled(true);
            setErrorEnrolled('');
            try {
                const response = await apiClient.get('/enrollments/user/?ordering=-enrollment_date&limit=3');
                if (Array.isArray(response.data)) {
                    setEnrolledCourses(response.data);
                } else {
                    setEnrolledCourses([]);
                    setErrorEnrolled("Unexpected data format for enrolled courses.");
                }
            } catch (err) {
                handleApiError(err, setErrorEnrolled, "Failed to load enrolled courses preview.");
                setEnrolledCourses([]);
            } finally {
                setLoadingEnrolled(false);
            }
        };
        fetchEnrolledCourses();
    }, [token, handleApiError]);
    
    useEffect(() => {
        if (!token) return;
        const fetchQuizAttempts = async () => {
          setLoadingQuizAttempts(true);
          setErrorQuizAttempts('');
          try {
            const res = await apiClient.get("/events/?event_type=quiz_answer_submitted&ordering=-timestamp");
            if (!Array.isArray(res.data)) {
              setErrorQuizAttempts("Unexpected data format for quiz attempts.");
              setLatestQuizAttempts([]); return;
            }
            const grouped = res.data.reduce((acc, event) => {
              const quizId = event.object_id;
              if (!quizId) return acc;
              if (!acc[quizId]) {
                acc[quizId] = { events: [], quiz_title: event.quiz_title || `Quiz ${quizId}`, quizId };
              }
              acc[quizId].events.push(event);
              return acc;
            }, {});
            let aggregated = Object.values(grouped).map(({ events, quiz_title, quizId }) => {
              const total = events.length;
              const correct = events.filter(e => e.metadata?.is_correct).length;
              const latestTimestamp = events.map(e => new Date(e.timestamp)).sort((a, b) => b - a)[0].toISOString();
              return { quizId, quiz_title, total, correct, wrong: total - correct, timestamp: latestTimestamp };
            });
            aggregated = aggregated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 3);
            const withPermalinks = await Promise.all(
              aggregated.map(async item => {
                try {
                  const quizRes = await apiClient.get(`/quizzes/${item.quizId}/`);
                  return { ...item, permalink: quizRes.data.permalink };
                } catch { return { ...item, permalink: null }; }
              })
            );
            setLatestQuizAttempts(withPermalinks);
          } catch (err) {
            handleApiError(err, setErrorQuizAttempts, "Failed to fetch quiz attempts.");
            setLatestQuizAttempts([]);
          } finally { setLoadingQuizAttempts(false); }
        };
        fetchQuizAttempts();
      }, [token, handleApiError]);
      
    useEffect(() => {
        if (!token) return;
        const fetchRecentLessonCompletions = async () => {
            setLoadingLessons(true);
            setErrorLessons('');
            try {
                const response = await apiClient.get('/lessons/completed/recent/'); 
                if (Array.isArray(response.data)) {
                    const lessons = response.data.map(completion => completion.lesson).filter(lesson => lesson).slice(0, 3); 
                    setLatestLessons(lessons);
                } else {
                    setLatestLessons([]);
                    setErrorLessons("Unexpected data format for completed lessons.");
                }
            } catch (err) {
                handleApiError(err, setErrorLessons, "Failed to load recent lessons.");
                setLatestLessons([]);
            } finally {
                setLoadingLessons(false);
            }
        };
        fetchRecentLessonCompletions();
    }, [token, handleApiError]);


    // --- Render Logic ---
    if (!user && token) { 
        return <LoadingPlaceholder message="Initializing your dashboard..." />;
    }
    if (!user) return null; 

    const userRole = user.profile?.role || 'explorer';
    const showStudentSections = userRole === 'explorer' || userRole === 'both';
    const showTeacherSections = userRole === 'guide' || userRole === 'both';

    return (
        <div className={styles.homeWrapper}>
            <header className={styles.homeHeader}>
                {/* Welcome Title and Subtitle are removed for a more compact header */}
                {/* <h1 className={styles.homeTitle}>Welcome back, {user.first_name || user.username}!</h1> */}
                {/* <p className={styles.homeSubtitle}>Ready to dive back into your learning journey or manage your content?</p> */}
                <button
                    className={styles.startPlanButton}
                    onClick={() => navigate(showTeacherSections && !showStudentSections ? '/teacher-dashboard' : '/study/dashboard')}
                >
                    <span className={styles.startPlanIcon}><FaRocket /></span>
                    {showTeacherSections && !showStudentSections ? 'Go to Teacher Dashboard' : 'Start Your Study Plan'}
                </button>
            </header>

            <main className={styles.homeContentGrid}>
                {showStudentSections && (
                    <>
                        <div className={styles.dashboardCard}>
                            <h2>Your Courses</h2>
                            {loadingEnrolled ? <LoadingPlaceholder /> : errorEnrolled ? <ErrorMessage message={errorEnrolled} /> : enrolledCourses.length > 0 ? (
                                <div className={styles.enrolledPreviewList}>
                                    {enrolledCourses.map(enrollment => (
                                        enrollment?.course && (
                                            <div
                                                key={enrollment.id}
                                                className={styles.enrolledPreviewItem}
                                                onClick={() => enrollment.course.permalink ? navigate(`/courses/${enrollment.course.permalink}`) : null}
                                                role="button" tabIndex={0}
                                                onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && enrollment.course.permalink ? navigate(`/courses/${enrollment.course.permalink}`) : null}
                                                aria-label={`Go to course: ${enrollment.course.title || 'Untitled Course'}`}
                                            >
                                                {enrollment.course.cover_image ? (
                                                    <img src={enrollment.course.cover_image} alt="" className={styles.enrolledPreviewThumb} onError={(e) => e.target.style.display='none'}/>
                                                ) : (
                                                    <div className={`${styles.enrolledPreviewThumb} ${styles.placeholderThumb}`}>
                                                        <FaChalkboardTeacher />
                                                    </div>
                                                )}
                                                <div className={styles.enrolledPreviewDetails}>
                                                    <h3>{enrollment.course.title || "Untitled Course"}</h3>
                                                    {enrollment.progress !== null && enrollment.progress >= 0 && (
                                                        <div className={styles.progressWrapper}>
                                                            <div className={styles.progressBarContainer}>
                                                                <div className={styles.progressBar} style={{ width: `${enrollment.progress}%` }} aria-valuenow={enrollment.progress} aria-valuemin="0" aria-valuemax="100"></div>
                                                            </div>
                                                            <span className={styles.progressText}>{enrollment.progress}%</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : ( <EmptyState message="You haven't enrolled in any courses yet. Explore some now!" /> )}
                            <button className={styles.cardActionButton} onClick={() => navigate('/enrolled-courses')}>
                                See All Your Courses
                            </button>
                        </div>

                        <div className={styles.dashboardCard}>
                            <h2>Recently Completed Lessons</h2>
                            {loadingLessons ? <LoadingPlaceholder /> : errorLessons ? <ErrorMessage message={errorLessons} /> : latestLessons.length > 0 ? (
                                <div className={styles.lessonHistoryPreview}>
                                    {latestLessons.map(lesson => (
                                        lesson?.id && lesson?.permalink && (
                                            <div
                                                key={lesson.id}
                                                className={styles.lessonHistoryItem}
                                                onClick={() => navigate(`/lessons/${lesson.permalink}`)}
                                                role="button" tabIndex={0}
                                                onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/lessons/${lesson.permalink}`)}
                                                aria-label={`Go to lesson: ${lesson.title || 'Untitled Lesson'}`}
                                            >
                                                <div className={styles.lessonHistoryIcon}><FaBookOpen /></div>
                                                <div className={styles.lessonHistoryDetails}>
                                                    <h3>{lesson.title || "Untitled Lesson"}</h3>
                                                    {lesson.course_title && <p className={styles.lessonCourseContext}>{lesson.course_title}</p>}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : ( <EmptyState message="No recently completed lessons to show." /> )}
                            <button className={styles.cardActionButton} onClick={() => navigate('/lessons/completed')}>
                                View All Completed
                            </button>
                        </div>

                        <div className={styles.dashboardCard}>
                            <h2>Recent Quizzes</h2>
                             {loadingQuizAttempts ? <LoadingPlaceholder /> : errorQuizAttempts ? <ErrorMessage message={errorQuizAttempts} /> : latestQuizAttempts.length > 0 ? (
                                <div className={styles.quizAttemptsPreview}>
                                    {latestQuizAttempts.map(attempt => (
                                        attempt?.quizId && (
                                            <a
                                            key={attempt.quizId}
                                            className={styles.quizAttemptItem}
                                            href={attempt.permalink ? quizPermalinkToUrl(attempt.permalink) : '#'}
                                            aria-label={`View quiz: ${attempt.quiz_title || `Quiz ${attempt.quizId}`}`}
                                            >
                                            <div className={styles.attemptInfo}>
                                                <span className={styles.attemptQuiz}>{attempt.quiz_title || `Quiz ${attempt.quizId}`}</span>
                                                <span className={styles.attemptDate}>{new Date(attempt.timestamp).toLocaleDateString()}</span>
                                            </div>
                                            <div className={styles.attemptStats}>
                                                <span title={`${attempt.correct} Correct`}><FaCheckCircle className={styles.statIconCorrect}/> {attempt.correct}</span>
                                                <span title={`${attempt.wrong} Incorrect`}><FaTimesCircle className={styles.statIconIncorrect}/> {attempt.wrong}</span>
                                                <span title={`${attempt.total} Total Questions`}><FaEllipsisH /> {attempt.total}</span>
                                            </div>
                                            </a>
                                        )
                                    ))}
                                </div>
                            ) : ( <EmptyState message="No recent quiz attempts found." /> )}
                            <button className={styles.cardActionButton} onClick={() => navigate('/quiz-attempts')}>
                                See All Quiz Attempts
                            </button>
                        </div>
                    </>
                )}

                {showTeacherSections && (
                   <>
                       <div className={styles.dashboardCard}>
                           <h2>Teacher Dashboard</h2>
                           <p>Access tools to manage your courses, lessons, and student interactions.</p>
                           <button className={styles.cardActionButton} onClick={() => navigate('/teacher-dashboard')}>
                               Go to Teacher Dashboard
                           </button>
                       </div>
                       <div className={styles.dashboardCard}>
                           <h2>Student Inquiries</h2>
                           <p>Review and respond to questions from your students.</p>
                           <button className={styles.cardActionButton} onClick={() => navigate('/teacher-questions')}>
                               View Student Questions
                           </button>
                       </div>
                   </>
                )}

                 {loadingDiscover ? (
                     <div className={`${styles.discoverSection} ${styles.discoverSectionLoading}`}> <LoadingPlaceholder message="Loading new content..." /> </div>
                 ) : errorDiscover ? (
                      <div className={`${styles.discoverSection} ${styles.discoverSectionError}`}> <ErrorMessage message={errorDiscover} /> </div>
                 ) : (latestPosts.length > 0 || randomCourses.length > 0) ? (
                    <>
                    {latestPosts.length > 0 && (
                    <section className={styles.discoverSection}>
                        <div className={styles.discoverHeader}>
                            <h3>Recent Posts from Zporta</h3>
                            <Link to="/posts" className={styles.discoverSeeAllBtn}>See All Posts</Link>
                        </div>
                        <div className={styles.discoverGrid}>
                            {latestPosts.map(post => (
                                post && (
                                    <Link to={post.permalink ? `/posts/${post.permalink}` : '#'} key={post.id} className={styles.discoverCardLink}>
                                        {post.og_image_url ? (
                                            <img src={post.og_image_url} alt="" className={styles.discoverImage} loading="lazy" onError={(e) => e.target.style.display='none'} />
                                        ) : (
                                            <div className={styles.discoverPlaceholder}><FaNewspaper /></div>
                                        )}
                                        <div className={styles.discoverInfo}>
                                            <h4>{post.title || 'Untitled Post'}</h4>
                                            <p>{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</p>
                                        </div>
                                    </Link>
                                )
                            ))}
                        </div>
                    </section>
                    )}
                    {randomCourses.length > 0 && (
                    <section className={styles.discoverSection}>
                        <div className={styles.discoverHeader}>
                            <h3>Explore New Courses</h3>
                            <Link to="/explore?tab=courses" className={styles.discoverSeeAllBtn}>Explore All</Link>
                        </div>
                        <div className={styles.discoverGrid}>
                            {randomCourses.map(course => (
                                course && (
                                     <Link to={course.permalink ? `/courses/${course.permalink}` : '#'} key={course.id} className={styles.discoverCardLink}>
                                        {course.cover_image ? (
                                            <img src={course.cover_image} alt="" className={styles.discoverImage} loading="lazy" onError={(e) => e.target.style.display='none'}/>
                                        ) : (
                                            <div className={styles.discoverPlaceholder}><FaGraduationCap /></div>
                                        )}
                                        <div className={styles.discoverInfo}>
                                            <h4>{course.title || 'Untitled Course'}</h4>
                                            <p className={styles.courseTypeLabel}>
                                               {course.course_type ? course.course_type.charAt(0).toUpperCase() + course.course_type.slice(1) : 'Standard'}
                                            </p>
                                        </div>
                                    </Link>
                                )
                            ))}
                        </div>
                    </section>
                    )}
                    </>
                 ) : (
                     <div className={`${styles.discoverSection} ${styles.discoverSectionEmpty}`}>
                         <EmptyState message="Nothing new to discover right now. Check back later!" />
                     </div>
                 )}
            </main>
        </div>
    );
};

export default HomePage;
