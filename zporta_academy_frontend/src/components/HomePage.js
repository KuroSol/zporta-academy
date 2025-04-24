// src/components/HomePage.js

import React, { useContext, useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api';
import './HomePage.css';

const HomePage = () => {
  const navigate = useNavigate();
  const { user, token, logout } = useContext(AuthContext); 

  // Redirect to login if no token
  useEffect(() => {
    if (!token) {
      navigate('/login');
    }
  }, [token, navigate]);

  // State for Discover Section
  const [latestPosts, setLatestPosts] = useState([]);
  const [randomCourses, setRandomCourses] = useState([]);
  const [loadingDiscover, setLoadingDiscover] = useState(true);
  const [errorDiscover, setErrorDiscover] = useState('');

  // State for enrolled courses preview
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [loadingEnrolled, setLoadingEnrolled] = useState(true);
  const [errorEnrolled, setErrorEnrolled] = useState('');

  // New state: Latest Quiz Attempts preview
  const [latestQuizAttempts, setLatestQuizAttempts] = useState([]);
  const [loadingQuizAttempts, setLoadingQuizAttempts] = useState(false);
  const [errorQuizAttempts, setErrorQuizAttempts] = useState('');

  // Fetch Discover Content (posts and random courses)
  useEffect(() => {
    const fetchDiscoverContent = async () => {
      setLoadingDiscover(true);
      setErrorDiscover('');
      try {
        const [postsRes, coursesRes] = await Promise.all([
          apiClient.get('/posts/?ordering=-created_at&limit=6'),
          apiClient.get('/courses/?random=6')
        ]);
        if (postsRes.data && Array.isArray(postsRes.data)) {
          setLatestPosts(postsRes.data);
        } else {
          console.warn("Unexpected format for posts:", postsRes.data);
          setLatestPosts([]);
        }
        if (coursesRes.data && Array.isArray(coursesRes.data)) {
          setRandomCourses(coursesRes.data);
        } else {
          console.warn("Unexpected format for courses:", coursesRes.data);
          setRandomCourses([]);
        }
      } catch (err) {
        console.error("Error fetching discover content:", err.response ? err.response.data : err.message);
        setErrorDiscover("Could not load discover content. Please try refreshing.");
        setLatestPosts([]);
        setRandomCourses([]);
      } finally {
        setLoadingDiscover(false);
      }
    };

    fetchDiscoverContent();
  }, []);

  // Fetch latest enrolled courses for preview
  useEffect(() => {
    if (!token) {
      setEnrolledCourses([]);
      setLoadingEnrolled(false);
      setErrorEnrolled('');
      return;
    }
    const fetchEnrolledCourses = async () => {
      setLoadingEnrolled(true);
      setErrorEnrolled('');
      try {
        const response = await apiClient.get('/enrollments/user/?ordering=-enrollment_date&limit=3');
        if (response.data && Array.isArray(response.data)) {
          setEnrolledCourses(response.data);
        } else {
          console.warn("Unexpected format for enrolled courses:", response.data);
          setEnrolledCourses([]);
          setErrorEnrolled("Failed to load course preview: Unexpected data format.");
        }
      } catch (err) {
        console.error("Error fetching enrolled courses:", err.response ? err.response.data : err.message);
        setEnrolledCourses([]);
        if (err.response?.status === 401 || err.response?.status === 403) {
          setErrorEnrolled('Session expired. Please log in again to see enrolled courses.');
          logout();
        } else {
          const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
          setErrorEnrolled(`Failed to load course preview: ${apiErrorMessage || "Please try again."}`);
        }
      } finally {
        setLoadingEnrolled(false);
      }
    };

    fetchEnrolledCourses();
  }, [token, logout]);

  // Fetch latest quiz attempts preview
  useEffect(() => {
    if (!token) {
      setLatestQuizAttempts([]);
      setLoadingQuizAttempts(false);
      setErrorQuizAttempts('');
      return;
    }
    const fetchQuizAttempts = async () => {
      setLoadingQuizAttempts(true);
      setErrorQuizAttempts('');
      try {
        // Ensure your apiClient base URL maps "/events/" correctly (i.e. to /api/events/)
        const res = await apiClient.get("/events/");
        if (Array.isArray(res.data)) {
          // Filter for answer events (each answer event logged via RecordQuizAnswerView)
          const answerEvents = res.data.filter(event => event.event_type === 'quiz_answer_submitted');
          // Group events by quiz id (object_id)
          const grouped = answerEvents.reduce((acc, event) => {
            const quizId = event.object_id;
            if (!acc[quizId]) acc[quizId] = [];
            acc[quizId].push(event);
            return acc;
          }, {});
          // Aggregate data per quiz
          let aggregated = Object.entries(grouped).map(([quizId, events]) => {
            const total = events.length;
            // Ensure the metadata field exists and has a boolean is_correct
            const correct = events.filter(e => e.metadata && e.metadata.is_correct === true).length;
            const wrong = total - correct;
            // Use the earliest event timestamp as the attempt time
            const timestamp = events.reduce((earliest, event) => {
              return new Date(event.timestamp) < new Date(earliest)
                ? event.timestamp
                : earliest;
            }, events[0].timestamp);
            const quiz_title = events[0].quiz_title || `Quiz ${quizId}`;
            return { quizId, quiz_title, total, correct, wrong, timestamp };
          });
          // Sort by timestamp descending (latest attempt first)
          aggregated.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
          // Take only the latest 3 attempts
          aggregated = aggregated.slice(0, 3);
          setLatestQuizAttempts(aggregated);
        } else {
          console.warn("Unexpected data format for quiz attempts:", res.data);
          setErrorQuizAttempts("Unexpected data format received for quiz attempts.");
        }
      } catch (err) {
        console.error("Error fetching quiz attempts:", err.response ? err.response.data : err.message);
        if (err.response?.status === 401 || err.response?.status === 403) {
          setErrorQuizAttempts("Session expired or unauthorized. Please log in again.");
          logout();
        } else {
          const apiErrorMessage = err.response?.data?.detail || err.message;
          setErrorQuizAttempts(`Failed to fetch quiz attempts: ${apiErrorMessage || "Please try again."}`);
        }
      } finally {
        setLoadingQuizAttempts(false);
      }
    };

    fetchQuizAttempts();
  }, [token, logout]);

  if (!token) return null;
  if (!user) return <div className="home-loading">Loading user info...</div>;

  const userRole = user.profile && user.profile.role ? user.profile.role : 'explorer';
  const showStudentSections = userRole === 'explorer' || userRole === 'both';
  const showTeacherSections = userRole === 'guide' || userRole === 'both';

  return (
    <div className="home-wrapper">
      {/* HERO SECTION */}
      <header className="home-page-header">
          <h1 className="home-page-title">Welcome back, {user.first_name || user.username}!</h1>
          {/* Optional: You can add a subtitle here if you like */}
          {            <button
              className="btn-primary start-plan-btn"
              onClick={() => navigate('/study/dashboard')}
            >
              ▶ Start Your Study Plan
            </button>}

      </header>

      <div className="home-content">
        {/* Student Sections */}
        {showStudentSections && (
          <>
            <div className="dashboard-card enrolled-courses-card">
              <h2>Your Courses in Progress</h2>
              {loadingEnrolled ? (
                <p>Loading course preview...</p>
              ) : errorEnrolled ? (
                <p className="error-message">{errorEnrolled}</p>
              ) : enrolledCourses.length > 0 ? (
                <div className="enrolled-preview-list">
                  {enrolledCourses.map(enrollment => (
                    enrollment?.course && (
                      <div
                        key={enrollment.id}
                        className="enrolled-preview-item horizontal"
                        onClick={() =>
                          enrollment.course.permalink
                            ? navigate(`/courses/${enrollment.course.permalink}`)
                            : null
                        }
                        style={{ cursor: enrollment.course.permalink ? "pointer" : "default" }}
                      >
                        {enrollment.course.cover_image ? (
                          <img
                            src={enrollment.course.cover_image}
                            alt={`${enrollment.course.title || "Course"} cover`}
                            className="enrolled-preview-thumb"
                          />
                        ) : (
                          <div className="enrolled-preview-thumb enrolled-preview-placeholder">
                            No Image
                          </div>
                        )}
                        <div className="enrolled-preview-details">
                          <h3>{enrollment.course.title || "Untitled Course"}</h3>
                          {enrollment.progress !== null && (
                            <>
                              <div className="small-progress-container">
                                <div
                                  className="small-progress-bar"
                                  style={{ width: `${enrollment.progress}%` }}
                                ></div>
                              </div>
                              <div className="small-progress-text">{enrollment.progress}%</div>
                            </>
                          )}
                        </div>
                      </div>

                    )
                  ))}
                </div>
              ) : (
                <p>You haven't enrolled in any courses yet.</p>
              )}
              <button className="dashboard-card-action-btn" onClick={() => navigate('/enrolled-courses')}>See All Enrolled</button>
            </div>

            {/* Dashboard Card: Latest Quizzes */}
            <div className="dashboard-card quiz-attempts-card">
              <h2>Your Latest Quizzes</h2>
              <p>Review attempts, see results, or retry</p>
              {loadingQuizAttempts ? (
                <p>Loading quiz attempts...</p>
              ) : errorQuizAttempts ? (
                <p className="error-message">{errorQuizAttempts}</p>
              ) : latestQuizAttempts.length > 0 ? (
                <div className="quiz-attempts-preview">
                  {latestQuizAttempts.map(attempt => (
                    <div
                      key={attempt.quizId}
                      className="quiz-attempt-item"
                      onClick={() => navigate('/quizzes/Attempts')}
                      style={{ cursor: 'pointer' }}
                    >
                      <div className="attempt-info">
                        <span className="attempt-date">
                          {new Date(attempt.timestamp).toLocaleDateString()}
                        </span>
                        
                      <span className="attempt-quiz">{attempt.quiz_title || `Quiz ${attempt.quizId}`}</span>

                      </div>
                      <div className="attempt-stats">
                        <span>Total: {attempt.total}</span>
                        <span>Correct: {attempt.correct}</span>
                        <span>Wrong: {attempt.wrong}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No quiz attempts found.</p>
              )}
              
              <button className="dashboard-card-action-btn" onClick={() => navigate('/quizzes/Attempts')}>See All Attempts</button>
            </div>
          </>
        )}

        {/* Teacher Sections */}
        {showTeacherSections && (
          <>
            <div className="dashboard-card teacher-tools-card">
              <h2>Teacher Tools</h2>
              <p>Manage your courses, lessons, and quizzes</p>
              <button className="dashboard-card-action-btn" onClick={() => navigate('/teacher-dashboard')}>Teacher Dashboard</button>
            </div>
            <div className="dashboard-card student-inquiries-card">
              <h2>Student Inquiries</h2>
              <p>Check who needs help or feedback</p>
              <button className="dashboard-card-action-btn" onClick={() => navigate('/teacher-questions')}>View Questions</button>
            </div>
          </>
        )}
      </div>

      {/* Discover More Section */}
      <section className="discover-section">
        {/* Main section title */}
        <h2 className="discover-section-main-title">Discover More</h2>

        {/* Loading State */}
        {loadingDiscover ? (
          <p>Loading content...</p> /* Consider a more visual loader */

        /* Error State */
        ) : errorDiscover ? (
          <p className="error-message">{errorDiscover}</p>

        /* Empty State */
        ) : latestPosts.length === 0 && randomCourses.length === 0 ? (
          <p className="empty-state-message">Nothing new to discover right now.</p>

        /* Content Exists State */
        ) : (
          // Container for the different content types (Posts, Courses, etc.)
          <div className="discover-content-area">

            {/* --- Latest Posts Section --- */}
            {latestPosts.length > 0 && (
              // 1. Wrapper for posts section
              <div className="discover-content-section posts-section">
                {/* 2. Header for this section */}
                <div className="discover-section-header">
                  <h3 className="discover-section-title">Recent Posts</h3>
                  <Link to="/posts" className="discover-see-all-btn" title="See All Posts">
                    See All
                  </Link>
                </div>
                {/* 3. Grid containing post cards */}
                <div className="discover-grid">
                  {latestPosts.map(post => (
                    // Ensure post object is valid before rendering card
                    post && (
                      // 4. Clickable Card - THIS div handles navigation
                      <div
                        key={post.id}
                        className="discover-card"
                        onClick={() => post.permalink ? navigate(`/posts/${post.permalink}`) : null}
                        style={{ cursor: post.permalink ? 'pointer' : 'default' }}
                        role="link" // Indicate it's interactive
                        aria-label={`View post: ${post.title || 'Untitled Post'}`} // Accessibility
                      >
                        {/* Card Content */}
                        {post.og_image_url ? (
                          <img src={post.og_image_url} alt={post.title || 'Post image'} className="discover-image" loading="lazy" />
                        ) : (
                          <div className="discover-placeholder">No Image</div>
                        )}
                        <div className="discover-info">
                          <h3>{post.title || 'Untitled Post'}</h3>
                          <p>{post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}</p>
                        </div>
                      </div> // End Clickable Card
                    )
                  ))}
                </div> {/* End Grid */}
              </div> // End posts-section Wrapper
            )} {/* End Latest Posts Section check */}

            {/* --- Random Courses Section --- */}
            {randomCourses.length > 0 && (
              // 1. Wrapper for courses section
              <div className="discover-content-section courses-section">
                 {/* 2. Header for this section */}
                 <div className="discover-section-header">
                   <h3 className="discover-section-title">Explore Courses</h3>
                   <Link to="/explore?tab=courses" className="discover-see-all-btn" title="See All Courses">
                      See All
                   </Link>
                 </div>
                 {/* 3. Grid containing course cards */}
                <div className="discover-grid">
                  {randomCourses.map(course => (
                     // Ensure course object is valid
                     course && (
                       // 4. Clickable Card - THIS div handles navigation
                       <div
                         key={course.id}
                         className="discover-card"
                         onClick={() => course.permalink ? navigate(`/courses/${course.permalink}`) : null}
                         style={{ cursor: course.permalink ? 'pointer' : 'default' }}
                         role="link"
                         aria-label={`View course: ${course.title || 'Untitled Course'}`}
                       >
                         {/* Card Content */}
                          {course.cover_image ? (
                            <img src={course.cover_image} alt={course.title || 'Course cover'} className="discover-image" loading="lazy"/>
                          ) : (
                            <div className="discover-placeholder">No Image</div>
                          )}
                          <div className="discover-info">
                             <h3>{course.title || 'Untitled Course'}</h3>
                             <p>{course.course_type === 'premium' ? 'Premium' : 'Free'} Course</p>
                           </div>
                       </div> // End Clickable Card
                     )
                  ))}
                </div> {/* End Grid */}
              </div> // End courses-section Wrapper
            )} {/* End Random Courses Section check */}

            {/* --- Placeholder for other future sections if needed --- */}
            {/* Example:
            { latestQuizzes.length > 0 && (
                <div className="discover-content-section quizzes-section">
                    <div className="discover-section-header">...</div>
                    <div className="discover-grid">...</div>
                </div>
            )}
            */}

          </div> // End discover-content-area
        )}
      </section>
    </div>
  );
};

export default HomePage;
