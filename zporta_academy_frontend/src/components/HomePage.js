import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed
import apiClient from '../api'; // Adjust path as needed
import styles from './HomePage.module.css'; // Import NEW CSS Module styles

// --- Helper Components (Keep as is) ---
const LoadingPlaceholder = ({ message = "Loading..." }) => (
    <div className={styles.loadingPlaceholder}>{message}</div>
);
const ErrorMessage = ({ message }) => (
    <p className={styles.errorMessage}>{message}</p>
);
const EmptyState = ({ message }) => (
    <p className={styles.emptyStateMessage}>{message}</p>
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
    // Discover
    const [latestPosts, setLatestPosts] = useState([]);
    const [randomCourses, setRandomCourses] = useState([]);
    const [loadingDiscover, setLoadingDiscover] = useState(true);
    const [errorDiscover, setErrorDiscover] = useState('');
    // Enrolled Courses
    const [enrolledCourses, setEnrolledCourses] = useState([]);
    const [loadingEnrolled, setLoadingEnrolled] = useState(true);
    const [errorEnrolled, setErrorEnrolled] = useState('');
    // Quiz Attempts
    const [latestQuizAttempts, setLatestQuizAttempts] = useState([]);
    const [loadingQuizAttempts, setLoadingQuizAttempts] = useState(true);
    const [errorQuizAttempts, setErrorQuizAttempts] = useState('');
    // **NEW**: Recent Lessons (will hold Lesson objects from completions)
    const [latestLessons, setLatestLessons] = useState([]);
    const [loadingLessons, setLoadingLessons] = useState(true);
    const [errorLessons, setErrorLessons] = useState('');


    // --- Data Fetching Effects ---

    // Fetch Discover Content
    useEffect(() => {
        if (!token) return;
        const fetchDiscoverContent = async () => { /* ... keep existing fetch logic ... */
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
                console.error("Error fetching discover content:", err.response ? err.response.data : err.message);
                setErrorDiscover("Could not load discover content.");
                setLatestPosts([]);
                setRandomCourses([]);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    logout();
                }
            } finally {
                setLoadingDiscover(false);
            }
        };
        fetchDiscoverContent();
    }, [token, logout]);

    // Fetch Enrolled Courses Preview
    useEffect(() => {
        if (!token) return;
        const fetchEnrolledCourses = async () => { /* ... keep existing fetch logic ... */
            setLoadingEnrolled(true);
            setErrorEnrolled('');
            try {
                const response = await apiClient.get('/enrollments/user/?ordering=-enrollment_date&limit=3');
                if (Array.isArray(response.data)) {
                    setEnrolledCourses(response.data);
                } else {
                    console.warn("Unexpected format for enrolled courses:", response.data);
                    setEnrolledCourses([]);
                    setErrorEnrolled("Unexpected data format.");
                }
            } catch (err) {
                console.error("Error fetching enrolled courses:", err.response ? err.response.data : err.message);
                setEnrolledCourses([]);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    setErrorEnrolled('Session expired. Please log in again.');
                    logout();
                } else {
                    setErrorEnrolled(`Failed to load course preview: ${err.response?.data?.detail || err.message}`);
                }
            } finally {
                setLoadingEnrolled(false);
            }
        };
        fetchEnrolledCourses();
    }, [token, logout]);

    // Fetch Latest Quiz Attempts Preview
    useEffect(() => {
        if (!token) return;
        const fetchQuizAttempts = async () => { /* ... keep existing fetch logic ... */
             setLoadingQuizAttempts(true);
             setErrorQuizAttempts('');
             try {
                 const res = await apiClient.get("/events/?event_type=quiz_answer_submitted&ordering=-timestamp");

                 if (Array.isArray(res.data)) {
                     const groupedByQuiz = res.data.reduce((acc, event) => {
                         const quizId = event.object_id;
                         if (!quizId) return acc;
                         if (!acc[quizId]) {
                             acc[quizId] = {
                                 events: [],
                                 quiz_title: event.quiz_title || `Quiz ${quizId}`,
                                 // Assuming object_id is the actual Quiz ID for navigation
                                 quizId: quizId
                             };
                         }
                         acc[quizId].events.push(event);
                         return acc;
                     }, {});

                     let aggregated = Object.entries(groupedByQuiz).map(([/* quizIdKey */ , data]) => {
                         const { events, quiz_title, quizId } = data; // Use the quizId stored in the group
                         const total = events.length;
                         const correct = events.filter(e => e.metadata?.is_correct === true).length;
                         const wrong = total - correct;
                         const latestTimestamp = events.reduce((latest, event) => {
                             const currentTs = new Date(event.timestamp);
                             return currentTs > latest ? currentTs : latest;
                         }, new Date(0));

                         return {
                             quizId, // Use the stored quizId
                             quiz_title,
                             total,
                             correct,
                             wrong,
                             timestamp: latestTimestamp.toISOString(),
                         };
                     });
                     aggregated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                     setLatestQuizAttempts(aggregated.slice(0, 3));

                 } else {
                     console.warn("Unexpected data format for quiz attempts:", res.data);
                     setErrorQuizAttempts("Unexpected data format received.");
                     setLatestQuizAttempts([]);
                 }
             } catch (err) {
                 console.error("Error fetching quiz attempts:", err.response ? err.response.data : err.message);
                 setLatestQuizAttempts([]);
                 if (err.response?.status === 401 || err.response?.status === 403) {
                     setErrorQuizAttempts("Session expired. Please log in again.");
                     logout();
                 } else {
                     setErrorQuizAttempts(`Failed to fetch quiz attempts: ${err.response?.data?.detail || err.message}`);
                 }
             } finally {
                 setLoadingQuizAttempts(false);
             }
        };
        fetchQuizAttempts();
    }, [token, logout]);

    // **UPDATED**: Fetch Recent Lesson Completions
    useEffect(() => {
        if (!token) return;

        const fetchRecentLessonCompletions = async () => { // Renamed function
            setLoadingLessons(true);
            setErrorLessons('');
            try {
                // **CHANGED**: Call the new backend endpoint
                const response = await apiClient.get('/lessons/completed/recent/'); // Use the new URL

                if (Array.isArray(response.data)) {
                    // The response data should be LessonCompletion objects with nested lesson details
                    // Extract the lesson details for the state
                    const lessons = response.data.map(completion => completion.lesson).filter(lesson => lesson); // Get lesson object and filter out nulls
                    setLatestLessons(lessons);
                } else {
                    console.warn("Unexpected format for recent lesson completions:", response.data);
                    setLatestLessons([]);
                    setErrorLessons("Unexpected data format for completed lessons.");
                }
            } catch (err) {
                console.error("Error fetching recent lesson completions:", err.response ? err.response.data : err.message);
                setLatestLessons([]);
                if (err.response?.status === 401 || err.response?.status === 403) {
                    setErrorLessons("Session expired. Please log in again.");
                    logout();
                } else {
                    setErrorLessons(`Failed to load recent lessons: ${err.response?.data?.detail || err.message}`);
                }
            } finally {
                setLoadingLessons(false);
            }
        };

        fetchRecentLessonCompletions(); // Call the renamed function
    }, [token, logout]);


    // --- Render Logic ---

    if (!user && token) {
        return <LoadingPlaceholder message="Loading user info..." />;
    }
    if (!user) return null;

    const userRole = user.profile?.role || 'explorer';
    const showStudentSections = userRole === 'explorer' || userRole === 'both';
    const showTeacherSections = userRole === 'guide' || userRole === 'both';

    return (
        <div className={styles.homeWrapper}>
            {/* HERO SECTION */}
            <header className={styles.homeHeader}>
                <h1 className={styles.homeTitle}>Welcome back, {user.first_name || user.username}!</h1>
                <p className={styles.homeSubtitle}>Ready to dive back into your learning journey?</p>
                <button
                    className={styles.startPlanButton}
                    onClick={() => navigate('/study/dashboard')}
                >
                    <span className={styles.startPlanIcon}>🚀</span>
                    Start Your Study Plan
                </button>
            </header>

            {/* DASHBOARD & DISCOVER CONTENT AREA */}
            <main className={styles.homeContentGrid}>

                {/* --- Student Focused Cards --- */}
                {showStudentSections && (
                    <>
                        {/* Enrolled Courses Card */}
                        <div className={`${styles.dashboardCard} ${styles.enrolledCoursesCard}`}>
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
                                                    <img src={enrollment.course.cover_image} alt="" className={styles.enrolledPreviewThumb} />
                                                ) : (
                                                    <div className={`${styles.enrolledPreviewThumb} ${styles.placeholderThumb}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
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
                            ) : (
                                <EmptyState message="You haven't enrolled in any courses yet." />
                            )}
                            <button className={styles.cardActionButton} onClick={() => navigate('/enrolled-courses')}>
                                See All Courses
                            </button>
                        </div>

                        {/* **UPDATED**: Recent Lessons Card (using completion data) */}
                        <div className={`${styles.dashboardCard} ${styles.lessonsHistoryCard}`}>
                            <h2>Recently Completed Lessons</h2> {/* Title changed */}
                            {loadingLessons ? <LoadingPlaceholder /> : errorLessons ? <ErrorMessage message={errorLessons} /> : latestLessons.length > 0 ? (
                                <div className={styles.lessonHistoryPreview}>
                                    {latestLessons.map(lesson => ( // Now mapping over Lesson objects
                                        lesson?.id && lesson?.permalink && ( // Check lesson details
                                            <div
                                                key={lesson.id} // Use lesson ID as key
                                                className={styles.lessonHistoryItem}
                                                onClick={() => navigate(`/lessons/${lesson.permalink}`)} // Navigate using permalink
                                                role="button" tabIndex={0}
                                                onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/lessons/${lesson.permalink}`)}
                                                aria-label={`Go to lesson: ${lesson.title || 'Untitled Lesson'}`}
                                            >
                                                <div className={styles.lessonHistoryIcon}>
                                                     <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path></svg>
                                                </div>
                                                <div className={styles.lessonHistoryDetails}>
                                                    <h3>{lesson.title || "Untitled Lesson"}</h3>
                                                    {/* Use course_title from the serialized lesson data */}
                                                    {lesson.course_title && <p className={styles.lessonCourseContext}>{lesson.course_title}</p>}
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : (
                                <EmptyState message="No recently completed lessons." /> // Message updated
                            )}
                             {/* Optional: Link to a page showing all completed lessons */}
                            <button className={styles.cardActionButton} onClick={() => navigate('/lessons/completed')}>
                                See All Completed
                            </button>
                        </div>

                        {/* Latest Quiz Attempts Card - Links fixed */}
                        <div className={`${styles.dashboardCard} ${styles.quizAttemptsCard}`}>
                            <h2>Recent Quizzes</h2>
                             {loadingQuizAttempts ? <LoadingPlaceholder /> : errorQuizAttempts ? <ErrorMessage message={errorQuizAttempts} /> : latestQuizAttempts.length > 0 ? (
                                <div className={styles.quizAttemptsPreview}>
                                    {latestQuizAttempts.map(attempt => (
                                        attempt?.quizId && (
                                            <div
                                                key={attempt.quizId}
                                                className={styles.quizAttemptItem}
                                                // **Navigate using quizId**
                                                onClick={() => navigate(`/quizzes/${attempt.quizId}`)}
                                                role="button"
                                                tabIndex={0}
                                                onKeyPress={(e) => (e.key === 'Enter' || e.key === ' ') && navigate(`/quizzes/${attempt.quizId}`)}
                                                aria-label={`View quiz: ${attempt.quiz_title || `Quiz ${attempt.quizId}`}`}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className={styles.attemptInfo}>
                                                    <span className={styles.attemptQuiz}>{attempt.quiz_title || `Quiz ${attempt.quizId}`}</span>
                                                    <span className={styles.attemptDate}>
                                                        {new Date(attempt.timestamp).toLocaleDateString()}
                                                    </span>
                                                </div>
                                                <div className={styles.attemptStats}>
                                                    <span title={`${attempt.correct} Correct`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.statIconCorrect}><polyline points="20 6 9 17 4 12"></polyline></svg> {attempt.correct}</span>
                                                    <span title={`${attempt.wrong} Incorrect`}><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.statIconIncorrect}><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> {attempt.wrong}</span>
                                                    <span title={`${attempt.total} Total Questions`}>Σ {attempt.total}</span>
                                                </div>
                                            </div>
                                        )
                                    ))}
                                </div>
                            ) : (
                                <EmptyState message="No recent quiz attempts found." />
                            )}
                            <button className={styles.cardActionButton} onClick={() => navigate('/quizzes/attempts')}>
                                See All Attempts
                            </button>
                        </div>
                    </>
                )}

                {/* --- Teacher Focused Cards --- */}
                {showTeacherSections && (
                   <>
                       {/* ... Teacher cards remain the same ... */}
                       <div className={`${styles.dashboardCard} ${styles.teacherToolsCard}`}>
                           <h2>Teacher Dashboard</h2>
                           <p>Manage your content and students.</p>
                           <button className={styles.cardActionButton} onClick={() => navigate('/teacher-dashboard')}>
                               Go to Dashboard
                           </button>
                       </div>
                       <div className={`${styles.dashboardCard} ${styles.studentInquiriesCard}`}>
                           <h2>Student Questions</h2>
                           <p>Review questions needing your attention.</p>
                           <button className={styles.cardActionButton} onClick={() => navigate('/teacher-questions')}>
                               View Questions
                           </button>
                       </div>
                   </>
                )}

                {/* --- Discover Sections --- */}
                 {/* ... Discover sections remain the same ... */}
                 {loadingDiscover ? (
                     <div className={styles.discoverSectionLoading}> <LoadingPlaceholder /> </div>
                 ) : errorDiscover ? (
                      <div className={styles.discoverSectionError}> <ErrorMessage message={errorDiscover} /> </div>
                 ) : latestPosts.length > 0 && (
                    <section className={`${styles.discoverSection} ${styles.postsSection}`}>
                        <div className={styles.discoverHeader}>
                            <h3>Recent Posts</h3>
                            <Link to="/posts" className={styles.discoverSeeAllBtn}>See All</Link>
                        </div>
                        <div className={styles.discoverGrid}>
                            {latestPosts.map(post => (
                                post && (
                                    <Link to={post.permalink ? `/posts/${post.permalink}` : '#'} key={post.id} className={styles.discoverCardLink}>
                                        <div className={styles.discoverCard}>
                                            {post.og_image_url ? (
                                                <img src={post.og_image_url} alt="" className={styles.discoverImage} loading="lazy" />
                                            ) : (
                                                <div className={`${styles.discoverImage} ${styles.discoverPlaceholder}`}>
                                                     <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>
                                                </div>
                                            )}
                                            <div className={styles.discoverInfo}>
                                                <h4>{post.title || 'Untitled Post'}</h4>
                                                <p>{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</p>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            ))}
                        </div>
                    </section>
                 )}
                 {loadingDiscover ? null : errorDiscover ? null : randomCourses.length > 0 && (
                    <section className={`${styles.discoverSection} ${styles.coursesSection}`}>
                        <div className={styles.discoverHeader}>
                            <h3>Explore Courses</h3>
                            <Link to="/explore?tab=courses" className={styles.discoverSeeAllBtn}>See All</Link>
                        </div>
                        <div className={styles.discoverGrid}>
                            {randomCourses.map(course => (
                                course && (
                                     <Link to={course.permalink ? `/courses/${course.permalink}` : '#'} key={course.id} className={styles.discoverCardLink}>
                                        <div className={styles.discoverCard}>
                                             {course.cover_image ? (
                                                <img src={course.cover_image} alt="" className={styles.discoverImage} loading="lazy"/>
                                            ) : (
                                                <div className={`${styles.discoverImage} ${styles.discoverPlaceholder}`}>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                </div>
                                            )}
                                            <div className={styles.discoverInfo}>
                                                <h4>{course.title || 'Untitled Course'}</h4>
                                                <p className={styles.courseTypeLabel}>
                                                   {course.course_type ? course.course_type.charAt(0).toUpperCase() + course.course_type.slice(1) : 'Standard'}
                                                </p>
                                            </div>
                                        </div>
                                    </Link>
                                )
                            ))}
                        </div>
                    </section>
                 )}
                 {!loadingDiscover && !errorDiscover && latestPosts.length === 0 && randomCourses.length === 0 && (
                     <div className={styles.discoverSectionEmpty}>
                         <EmptyState message="Nothing new to discover right now. Check back later!" />
                     </div>
                 )}

            </main>
        </div>
    );
};

export default HomePage;
