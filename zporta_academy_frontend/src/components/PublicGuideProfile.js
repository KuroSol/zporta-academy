import React, { useEffect, useState, useContext, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext"; // Assuming correct path
import apiClient from '../api'; // Assuming correct path
import styles from "./PublicGuideProfile.module.css"; // Ensure this path is correct
import { FaBookReader, FaAward } from "react-icons/fa";
import { quizPermalinkToUrl } from "../utils/urls"; 

const INITIAL_DISPLAY_DEFAULT_TAB = 6; // Max items for the very first display of the default tab
const SUBSEQUENT_LOAD_BATCH_SIZE = { // Number of items to load on each scroll and for initial display of non-default tabs
  courses: 6, // Batch size for courses (can be same or different from initial)
  lessons: 5,
  quizzes: 5,
};

// Simple throttle function
const throttle = (func, limit) => {
  let inThrottle;
  return function() {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

const PublicGuideProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  const { user: currentUser, token, logout } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("courses"); // Default active tab

  // Data states
  const [courses, setCourses] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);

  // Loading states for each data type (initial fetch)
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  
  // Loading state for "load more" action to prevent multiple triggers
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Display counts
  const [displayedCoursesCount, setDisplayedCoursesCount] = useState(SUBSEQUENT_LOAD_BATCH_SIZE.courses);
  const [displayedLessonsCount, setDisplayedLessonsCount] = useState(SUBSEQUENT_LOAD_BATCH_SIZE.lessons);
  const [displayedQuizzesCount, setDisplayedQuizzesCount] = useState(SUBSEQUENT_LOAD_BATCH_SIZE.quizzes);

  const [attendances, setAttendances] = useState(0);
  const [loading, setLoading] = useState(true); // Overall page loading
  const [error, setError] = useState("");

  const [guideRequest, setGuideRequest] = useState(null);
  const [attendLoading, setAttendLoading] = useState(false);

  const stripHTML = (html) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  // Load more handlers using SUBSEQUENT_LOAD_BATCH_SIZE
  const handleLoadMoreCourses = useCallback(() => {
    if (isLoadingMore || displayedCoursesCount >= courses.length) return;
    setIsLoadingMore(true);
    setDisplayedCoursesCount(prevCount => prevCount + SUBSEQUENT_LOAD_BATCH_SIZE.courses);
    setTimeout(() => setIsLoadingMore(false), 300); 
  }, [isLoadingMore, displayedCoursesCount, courses.length]);

  const handleLoadMoreLessons = useCallback(() => {
    if (isLoadingMore || displayedLessonsCount >= lessons.length) return;
    setIsLoadingMore(true);
    setDisplayedLessonsCount(prevCount => prevCount + SUBSEQUENT_LOAD_BATCH_SIZE.lessons);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedLessonsCount, lessons.length]);

  const handleLoadMoreQuizzes = useCallback(() => {
    if (isLoadingMore || displayedQuizzesCount >= quizzes.length) return;
    setIsLoadingMore(true);
    setDisplayedQuizzesCount(prevCount => prevCount + SUBSEQUENT_LOAD_BATCH_SIZE.quizzes);
    setTimeout(() => setIsLoadingMore(false), 300);
  }, [isLoadingMore, displayedQuizzesCount, quizzes.length]);


  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setCoursesLoading(true);
      setLessonsLoading(true);
      setQuizzesLoading(true);
      setIsLoadingMore(false);
      setError("");
      setProfile(null); setCourses([]); setLessons([]); setQuizzes([]);
      setAttendances(0); setGuideRequest(null);

      // Reset active tab to default when profile changes
      setActiveTab("courses"); 

      // Set initial display counts
      // Default active tab ("courses") gets the special initial limit
      setDisplayedCoursesCount(INITIAL_DISPLAY_DEFAULT_TAB);
      // Other tabs get their standard batch size for their first view when activated
      setDisplayedLessonsCount(SUBSEQUENT_LOAD_BATCH_SIZE.lessons);
      setDisplayedQuizzesCount(SUBSEQUENT_LOAD_BATCH_SIZE.quizzes);

      let fetchedProfileData = null;

      try {
        const profileRes = await apiClient.get(`/users/guides/${username}/`);
        fetchedProfileData = profileRes.data;
        if (!fetchedProfileData?.id) {
          throw new Error("Guide profile not found or is invalid.");
        }
        setProfile(fetchedProfileData);
        const profileUserId = fetchedProfileData.id;

        const promisesToRun = [
          apiClient.get(`/courses/?created_by=${username}`),
          apiClient.get(`/lessons/?created_by=${username}`),
          apiClient.get(`/quizzes/?created_by=${username}`),
          (token && currentUser) ? apiClient.get(`/social/guide-requests/`) : Promise.resolve({ data: null })
        ];

        const [
          coursesRes,
          lessonsRes,
          quizzesRes,
          guideRequestsRes
        ] = await Promise.all(promisesToRun);

        try {
          setCourses(Array.isArray(coursesRes?.data) ? coursesRes.data : []);
        } catch (e) { console.error("Error processing courses", e); setCourses([]); }
        finally { setCoursesLoading(false); }

        try {
          setLessons(Array.isArray(lessonsRes?.data) ? lessonsRes.data : []);
        } catch (e) { console.error("Error processing lessons", e); setLessons([]); }
        finally { setLessonsLoading(false); }

        try {
          setQuizzes(Array.isArray(quizzesRes?.data) ? quizzesRes.data : []);
        } catch (e) { console.error("Error processing quizzes", e); setQuizzes([]); }
        finally { setQuizzesLoading(false); }

        try {
          const allUserRequests = Array.isArray(guideRequestsRes?.data) ? guideRequestsRes.data : [];
          const acceptedCount = allUserRequests.filter(
            req => String(req.guide) === String(profileUserId) && req.status === 'accepted'
          ).length;
          setAttendances(acceptedCount);

          if (currentUser && token && currentUser.user_id !== profileUserId) {
            const specificRequest = allUserRequests.find(
              req => String(req.explorer) === String(currentUser.user_id) && String(req.guide) === String(profileUserId)
            );
            setGuideRequest(specificRequest || null);
          } else {
            setGuideRequest(null);
          }
        } catch (e) {
          console.error("Error processing guide requests", e);
          setAttendances(0);
          setGuideRequest(null);
        }

      } catch (err) {
        console.error("Error fetching profile page data:", err.response ? err.response.data : err.message);
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        const isProfileError = err.config?.url?.includes(`/users/guides/${username}`);
        const displayError = (isProfileError && err.response?.status === 404)
          ? "Guide profile not found."
          : `Failed to load profile data: ${apiErrorMessage || "Please try again."}`;
        setError(displayError);

        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
        }
        setProfile(null); setCourses([]); setLessons([]); setQuizzes([]);
        setAttendances(0); setGuideRequest(null);
        setCoursesLoading(false); setLessonsLoading(false); setQuizzesLoading(false);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [username, currentUser, token, logout]);


  // Infinite Scroll Logic
  useEffect(() => {
    const handleScroll = () => {
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 && !isLoadingMore) {
        if (activeTab === "courses" && !coursesLoading && displayedCoursesCount < courses.length) {
          handleLoadMoreCourses();
        } else if (activeTab === "lessons" && !lessonsLoading && displayedLessonsCount < lessons.length) {
          handleLoadMoreLessons();
        } else if (activeTab === "quizzes" && !quizzesLoading && displayedQuizzesCount < quizzes.length) {
          handleLoadMoreQuizzes();
        }
      }
    };

    const throttledScrollHandler = throttle(handleScroll, 200); 

    window.addEventListener('scroll', throttledScrollHandler);
    return () => window.removeEventListener('scroll', throttledScrollHandler);

  }, [activeTab, coursesLoading, lessonsLoading, quizzesLoading, 
      displayedCoursesCount, displayedLessonsCount, displayedQuizzesCount,
      courses.length, lessons.length, quizzes.length,
      handleLoadMoreCourses, handleLoadMoreLessons, handleLoadMoreQuizzes, isLoadingMore]);


  const handleAttend = async () => {
    if (!profile?.id || !token) {
      alert("Cannot send request: Profile ID missing or not logged in.");
      return;
    }
    setAttendLoading(true);
    setError('');

    try {
      const response = await apiClient.post(`/social/guide-requests/`, {
        guide: profile.id
      });
      if (response.data && response.data.id) {
        setGuideRequest(response.data);
        alert("Attend request sent successfully!");
      } else {
        console.error("Send attend request response missing data:", response.data);
        alert("Request sent, but status update failed. Please refresh.");
      }
    } catch (err) {
      console.error("Error sending attend request:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      setError(`Failed to send request: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setAttendLoading(false);
    }
  };

  const cancelAttend = async () => {
    if (!guideRequest?.id || !token) {
      alert("Cannot cancel request: Request ID missing or not logged in.");
      return;
    }
    setAttendLoading(true);
    setError('');

    try {
      await apiClient.post(`/social/guide-requests/${guideRequest.id}/cancel/`);
      setGuideRequest(null);
      alert("Request cancelled successfully.");
    } catch (err) {
      console.error("Error cancelling attend request:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      setError(`Failed to cancel request: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setAttendLoading(false);
    }
  };
  
  const itemsToDisplay = {
    courses: courses.slice(0, displayedCoursesCount),
    lessons: lessons.slice(0, displayedLessonsCount),
    quizzes: quizzes.slice(0, displayedQuizzesCount),
  };

  if (loading && !profile) return <p className={styles.loading}>Loading profile...</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!profile) return <p className={styles.loading}>No profile found.</p>;

  let attendButton;
  if (guideRequest) {
    if (guideRequest.status === "pending") {
      attendButton = (
        <button onClick={cancelAttend} disabled={attendLoading} className={styles.btnSecondary}>
          Pending (Cancel Request)
        </button>
      );
    } else if (guideRequest.status === "accepted") {
      attendButton = (
        <button onClick={cancelAttend} disabled={attendLoading} className={styles.btnSecondary}>
          Attended (Unattend)
        </button>
      );
    } else { 
      attendButton = (
        <button onClick={cancelAttend} disabled={attendLoading} className={styles.btnSecondary}>
          Cancel Request
        </button>
      );
    }
  } else {
    attendButton = (
      <button onClick={handleAttend} disabled={attendLoading} className={styles.btnPrimary}>
        Attend Guide
      </button>
    );
  }

  const renderTabContent = () => {
    if (activeTab === "courses") {
      return (
        <div className={styles.tabPanel}>
          <h2>Courses Created</h2>
          {coursesLoading && itemsToDisplay.courses.length === 0 ? ( 
            <p className={styles.loading}>Loading courses...</p>
          ) : courses.length > 0 ? (
            <>
              <div className={styles.cardsGrid}>
                {itemsToDisplay.courses.map((course) => (
                  course && (
                    <div key={course.id} className={styles.card}>
                      {course.cover_image ? (
                        <img
                          src={course.cover_image}
                          alt={`${course.title || 'Course'} cover`}
                          className={styles.cardImage}
                          onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/600x400/eee/ccc?text=No+Image"; }}
                        />
                      ) : (
                        <div className={styles.gridItemPlaceholder}><p>No Image</p></div>
                      )}
                      <div className={styles.cardInfo}>
                        <h3>{course.title || 'Untitled Course'}</h3>
                        <p>{course.description ? stripHTML(course.description).substring(0, 100) + '...' : 'No description available.'}</p>
                        <button
                          className={styles.detailsBtn}
                          onClick={() => course.permalink ? navigate(`/courses/${course.permalink}`) : null}
                          disabled={!course.permalink}
                        >
                          View Details
                        </button>
                      </div>
                    </div>
                  )
                ))}
              </div>
              {isLoadingMore && displayedCoursesCount < courses.length && <p className={styles.loading}>Loading</p>}
            </>
          ) : (
            <p>No courses created by this guide yet.</p>
          )}
        </div>
      );
    } else if (activeTab === "lessons") {
      return (
        <div className={styles.tabPanel}>
          <h2>Lessons Created</h2>
          {lessonsLoading && itemsToDisplay.lessons.length === 0 ? (
            <p className={styles.loading}>Loading lessons...</p>
          ) : lessons.length > 0 ? (
            <>
              <ul className={styles.list}>
                {itemsToDisplay.lessons.map((lesson) => (
                  lesson && (
                    <li key={lesson.id} className={styles.listItem}>
                      <h3>{lesson.title || 'Untitled Lesson'}</h3>
                      <p>{lesson.content ? stripHTML(lesson.content).substring(0, 150) + '...' : 'No content preview.'}</p>
                      <button
                        onClick={() => lesson.permalink ? navigate(`/lessons/${lesson.permalink}`) : null}
                        className={styles.detailsBtn}
                        disabled={!lesson.permalink}
                      >
                        View Details
                      </button>
                    </li>
                  )
                ))}
              </ul>
              {isLoadingMore && displayedLessonsCount < lessons.length && <p className={styles.loading}>Loading</p>}
            </>
          ) : (
            <p>No lessons created by this guide yet.</p>
          )}
        </div>
      );
    } else if (activeTab === "quizzes") {
      return (
        <div className={styles.tabPanel}>
          <h2>Quizzes Created</h2>
          {quizzesLoading && itemsToDisplay.quizzes.length === 0 ? (
            <p className={styles.loading}>Loading quizzes...</p>
          ) : quizzes.length > 0 ? (
            <>
              <ul className={styles.list}>
                {itemsToDisplay.quizzes.map((quiz) => (
                  quiz && (
                    <li key={quiz.id} className={styles.listItem}>
                      <h3>{quiz.title || 'Untitled Quiz'}</h3>
                      <p>
                        {quiz.question ? stripHTML(quiz.question).substring(0, 150) + "..." : "No question preview."}
                      </p>
                      <Link to={quizPermalinkToUrl(quiz.permalink)} className={styles.detailsBtn}>
                        View Details
                      </Link>
                    </li>
                  )
                ))}
              </ul>
              {isLoadingMore && displayedQuizzesCount < quizzes.length && <p className={styles.loading}>Loading</p>}
            </>
          ) : (
            <p>No quizzes created by this guide yet.</p>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <div className={styles.publicProfileDashboard}>
      <aside className={styles.publicProfileSidebar}>
        <div className={styles.sidebarCard}>
          <div className={styles.sidebarImageContainer}>
            <img
              src={
                profile.profile_image_url && profile.profile_image_url.trim()
                  ? profile.profile_image_url
                  : "https://placehold.co/150x150/FFC107/1B2735?text=User"
              }
              alt={profile.username}
              className={styles.hexagon}
              onError={(e) => { e.target.onerror = null; e.target.src="https://placehold.co/150x150/FFC107/1B2735?text=User"; }}
            />
          </div>
          <div className={styles.sidebarInfo}>
            <h1 className={styles.sidebarUsername}>{profile.username}</h1>
            <p className={styles.sidebarJoined}>
              Guide since: {new Date(profile.date_joined).toLocaleDateString()}
            </p>
            <p className={styles.sidebarBio}>{profile.bio || "This guide hasn't shared a bio yet."}</p>
          </div>
          
          <div className={styles.scoreContainer}>
            <div className={styles.scoreItem}>
              <FaBookReader size={24} />
              <div>
                <span className={styles.scoreValue}>{profile.growth_score || 0}</span>
                <div className={styles.scoreLabel}>Learning Score</div>
              </div>
            </div>
            <div className={styles.scoreItem}>
              <FaAward size={24} />
              <div>
                <span className={styles.scoreValue}>{profile.impact_score || 0}</span>
                <div className={styles.scoreLabel}>Impact Score</div>
              </div>
            </div>
          </div>

          {currentUser && currentUser.username !== profile.username && (
            <div className={styles.attendSection}>{attendButton}</div>
          )}
        </div>
      </aside>
      <main className={styles.publicProfileMain}>
        <div className={styles.statsSection}>
          {/* Courses Stat/Tab */}
          <div 
            className={`${styles.stat} ${styles.statClickable} ${activeTab === 'courses' ? styles.statActive : ''}`}
            onClick={() => setActiveTab('courses')}
            role="button" 
            tabIndex={0} 
            onKeyPress={(e) => e.key === 'Enter' && setActiveTab('courses')} 
          >
            <h3>{courses.length}</h3>
            <p>Courses</p>
          </div>
          {/* Lessons Stat/Tab */}
          <div 
            className={`${styles.stat} ${styles.statClickable} ${activeTab === 'lessons' ? styles.statActive : ''}`}
            onClick={() => setActiveTab('lessons')}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && setActiveTab('lessons')}
          >
            <h3>{lessons.length}</h3>
            <p>Lessons</p>
          </div>
          {/* Quizzes Stat/Tab */}
          <div 
            className={`${styles.stat} ${styles.statClickable} ${activeTab === 'quizzes' ? styles.statActive : ''}`}
            onClick={() => setActiveTab('quizzes')}
            role="button"
            tabIndex={0}
            onKeyPress={(e) => e.key === 'Enter' && setActiveTab('quizzes')}
          >
            <h3>{quizzes.length}</h3>
            <p>Quizzes</p>
          </div>
          {/* Attendees Stat (Not clickable as a tab) */}
          <div className={styles.stat}>
            <h3>{attendances}</h3>
            <p>Attendees</p>
          </div>
        </div>
        
        {/* The old tab navigation bar is now removed */}
        {/* <div className={styles.tabNavigation}>
          {["courses", "lessons", "quizzes"].map((tab) => (
            <button
              key={tab}
              className={`${styles.tabBtn} ${activeTab === tab ? styles.active : ""}`}
              onClick={() => {
                setActiveTab(tab);
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div> 
        */}

        <div className={styles.tabContent}>{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default PublicGuideProfile;
