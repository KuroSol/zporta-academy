import React, { useEffect, useState, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import apiClient from '../api'; 
import "./PublicGuideProfile.css"; 

const PublicGuideProfile = () => {
  const { username } = useParams();
  const navigate = useNavigate();

  // Get current user and token from AuthContext
  const { user: currentUser, token, logout } = useContext(AuthContext);

  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("posts");

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(true);

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [currentCoursePage, setCurrentCoursePage] = useState(1);
  const itemsPerCoursePage = 5;
  const totalCoursePages = Math.ceil(courses.length / itemsPerCoursePage);
  const paginatedCourses = courses.slice(
    (currentCoursePage - 1) * itemsPerCoursePage,
    currentCoursePage * itemsPerCoursePage
  );

  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [currentLessonPage, setCurrentLessonPage] = useState(1);
  const itemsPerLessonPage = 5;
  const totalLessonPages = Math.ceil(lessons.length / itemsPerLessonPage);
  const paginatedLessons = lessons.slice(
    (currentLessonPage - 1) * itemsPerLessonPage,
    currentLessonPage * itemsPerLessonPage
  );

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [currentQuizPage, setCurrentQuizPage] = useState(1);
  const itemsPerQuizPage = 5;
  const totalQuizPages = Math.ceil(quizzes.length / itemsPerQuizPage);
  const paginatedQuizzes = quizzes.slice(
    (currentQuizPage - 1) * itemsPerQuizPage,
    currentQuizPage * itemsPerQuizPage
  );

  const [attendances, setAttendances] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // State for guide request (attendance) functionality
  const [guideRequest, setGuideRequest] = useState(null);
  const [attendLoading, setAttendLoading] = useState(false);

  // Helper: strip HTML tags
  const stripHTML = (html) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

// Main data fetching effect using apiClient (with individual loading states)
useEffect(() => {
  const fetchData = async () => {
    // Set ALL loading states true at the beginning
    setLoading(true); // Overall page loading
    setPostsLoading(true);
    setCoursesLoading(true);
    setLessonsLoading(true);
    setQuizzesLoading(true);
    setError("");
    // Reset content states
    setProfile(null); setPosts([]); setCourses([]); setLessons([]); setQuizzes([]);
    setAttendances(0); setGuideRequest(null);

    let fetchedProfileData = null;

    try {
      // --- Fetch core profile first ---
      const profileRes = await apiClient.get(`/users/guides/${username}/`);
      fetchedProfileData = profileRes.data;
      if (!fetchedProfileData?.id) {
        throw new Error("Guide profile not found or is invalid.");
      }
      setProfile(fetchedProfileData);
      const profileUserId = fetchedProfileData.id;

      // --- Fetch other data concurrently ---
      const promisesToRun = [
        apiClient.get(`/posts/?created_by=${username}`),
        apiClient.get(`/courses/?created_by=${username}`),
        apiClient.get(`/lessons/?created_by=${username}`),
        apiClient.get(`/quizzes/?created_by=${username}`),
        (token && currentUser) ? apiClient.get(`/social/guide-requests/`) : Promise.resolve({ data: null })
      ];

      // Execute all promises (errors will be caught below)
      const [
        postsRes,
        coursesRes,
        lessonsRes,
        quizzesRes,
        guideRequestsRes
      ] = await Promise.all(promisesToRun);

      // --- Process results and set loading states individually ---
      try {
        setPosts(Array.isArray(postsRes?.data) ? postsRes.data : []);
      } catch (e) { console.error("Error processing posts", e); setPosts([]); }
      finally { setPostsLoading(false); } // Mark posts as loaded (or failed)

      try {
        setCourses(Array.isArray(coursesRes?.data) ? coursesRes.data : []);
      } catch (e) { console.error("Error processing courses", e); setCourses([]); }
      finally { setCoursesLoading(false); } // Mark courses as loaded

      try {
        setLessons(Array.isArray(lessonsRes?.data) ? lessonsRes.data : []);
      } catch (e) { console.error("Error processing lessons", e); setLessons([]); }
      finally { setLessonsLoading(false); } // Mark lessons as loaded

      try {
        setQuizzes(Array.isArray(quizzesRes?.data) ? quizzesRes.data : []);
      } catch (e) { console.error("Error processing quizzes", e); setQuizzes([]); }
      finally { setQuizzesLoading(false); } // Mark quizzes as loaded

      // Process Guide Requests (Client-side filtering required)
       try {
            const allUserRequests = Array.isArray(guideRequestsRes?.data) ? guideRequestsRes.data : [];
            // Calculate Attendances
            const acceptedCount = allUserRequests.filter(
                req => String(req.guide) === String(profileUserId) && req.status === 'accepted'
            ).length;
            setAttendances(acceptedCount);
            // Find Specific Request Status
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
      // All non-critical data processed or failed individually

    } catch (err) { // Catch critical errors (like profile fetch) or Promise.all failure
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
      // Ensure all states are cleared on critical error
      setProfile(null); setPosts([]); setCourses([]); setLessons([]); setQuizzes([]);
      setAttendances(0); setGuideRequest(null);
      // Ensure all loading states are false on critical error
      setPostsLoading(false); setCoursesLoading(false); setLessonsLoading(false); setQuizzesLoading(false);
    } finally {
      setLoading(false); // Stop overall page loading indicator
    }
  };

  fetchData();
}, [username, currentUser, token, logout]); // Keep dependencies

// Handler to send an attend request using apiClient
const handleAttend = async () => {
  if (!profile?.id || !token) {
      alert("Cannot send request: Profile ID missing or not logged in.");
      return;
  }
  setAttendLoading(true);
  setError(''); // Clear previous main errors

  try {
    // Use apiClient.post - Auth handled automatically
    const response = await apiClient.post(`/social/guide-requests/`, {
      guide: profile.id // Send the ID of the guide profile being viewed
    });

    // --- Handle Success ---
    // Assuming the API returns the created/updated request object
    if (response.data && response.data.id) {
        setGuideRequest(response.data); // Update state with the new request status
        alert("Attend request sent successfully!");
    } else {
        console.error("Send attend request response missing data:", response.data);
        alert("Request sent, but status update failed. Please refresh.");
    }

  } catch (err) {
    // --- Handle Errors ---
    console.error("Error sending attend request:", err.response ? err.response.data : err.message);
    const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
    // Display error in main error state or alert
    setError(`Failed to send request: ${apiErrorMessage || "Please try again."}`);
    // alert(`Failed to send request: ${apiErrorMessage || "Please try again."}`);

    // Check for authorization errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout();
    }
  } finally {
      setAttendLoading(false); // Stop button loading indicator
  }
};

// Handler to cancel/unattend request using apiClient
const cancelAttend = async () => {
  if (!guideRequest?.id || !token) {
      alert("Cannot cancel request: Request ID missing or not logged in.");
      return;
  }
  setAttendLoading(true);
  setError(''); // Clear previous main errors

  try {
    // Use apiClient.post - Auth handled automatically, no body needed assumed
    // This endpoint might handle both cancelling 'pending' and 'accepted' requests
    await apiClient.post(`/social/guide-requests/${guideRequest.id}/cancel/`);

    // --- Handle Success ---
    // Assume success if no error is thrown
    setGuideRequest(null); // Clear the request state to show the 'Attend' button again
    alert("Request cancelled successfully.");

  } catch (err) {
    // --- Handle Errors ---
    console.error("Error cancelling attend request:", err.response ? err.response.data : err.message);
    const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
    setError(`Failed to cancel request: ${apiErrorMessage || "Please try again."}`);
    // alert(`Failed to cancel request: ${apiErrorMessage || "Please try again."}`);

    // Check for authorization errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout();
    }
  } finally {
      setAttendLoading(false); // Stop button loading indicator
  }
};

if (loading) return <p>Loading profile...</p>;
if (error) return <p className="error">{error}</p>;
if (!profile) return <p>No profile found.</p>;

  console.log("currentUser:", currentUser);
  console.log("profile:", profile);

  // Determine which button to show based on the guideRequest state
  let attendButton;
  if (guideRequest) {
    if (guideRequest.status === "pending") {
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className="btn btn-secondary"
        >
          Pending (Cancel Request)
        </button>
      );
    } else if (guideRequest.status === "accepted") {
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className="btn btn-secondary"
        >
          Attended (Unattend)
        </button>
      );
    } else {
      // fallback for status=declined or something else
      attendButton = (
        <button
          onClick={cancelAttend}
          disabled={attendLoading}
          className="btn btn-secondary"
        >
          Cancel Request
        </button>
      );
    }
  } else {
    attendButton = (
      <button
        onClick={handleAttend}
        disabled={attendLoading}
        className="btn btn-primary"
      >
        Attend
      </button>
    );
  }

  const renderTabContent = () => {
    // POSTS TAB
    if (activeTab === "posts") {
      return (
        <div className="tab-panel">
          <h2>Posts</h2>
          {/* Use postsLoading state for this tab */}
          {postsLoading ? (
            <p className="loading">Loading posts...</p>
          ) : posts.length > 0 ? (
            <div className="cards-grid">
              {/* Map posts... (keep existing map logic) */}
              {posts.map((post) => (
                  post && ( // Safe access check
                      <Link to={`/posts/${post.permalink}`} key={post.id} className="card">
                          <div className="card-image">
                              {post.og_image_url ? (
                              <img src={post.og_image_url} alt={post.title || 'Post image'} />
                              ) : (
                              <div className="post-placeholder">
                                  <p>{post.title || 'Untitled Post'}</p>
                              </div>
                              )}
                          </div>
                          <div className="card-info">
                              <h3>{post.title || 'Untitled Post'}</h3>
                              <p>
                              {post.created_by} | {post.created_at ? new Date(post.created_at).toLocaleDateString() : ''}
                              </p>
                          </div>
                      </Link>
                  )
              ))}
            </div>
          ) : (
            <p>No posts available.</p> // Message if loading done and no posts
          )}
        </div>
      );
    }
    // COURSES TAB
    else if (activeTab === "courses") {
      return (
        <div className="tab-panel">
          <h2>Courses</h2>
          {/* Use coursesLoading state for this tab */}
          {coursesLoading ? (
            <p className="loading">Loading courses...</p>
          ) : courses.length > 0 ? (
             <>
                <div className="cards-grid">
                {/* Map paginatedCourses... (keep existing map logic) */}
                {paginatedCourses.map((course) => (
                     course && ( // Safe access check
                        <div key={course.id} className="card">
                            {course.cover_image ? (
                            <img
                                src={course.cover_image}
                                alt={`${course.title || 'Course'} cover`}
                                className="card-image"
                            />
                            ) : (
                            <div className="grid-item-placeholder"><p>No Image</p></div>
                            )}
                            <div className="card-info">
                            <h3>{course.title || 'Untitled Course'}</h3>
                            <p>{course.description ? course.description.substring(0, 100) + '...' : ''}</p>
                            <button
                                className="details-btn"
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
                {/* Keep Pagination Logic */}
                {totalCoursePages > 1 && ( <div className="pagination">{/*...*/}</div> )}
            </>
          ) : (
            <p>No courses available.</p>
          )}
        </div>
      );
    }
    // LESSONS TAB
    else if (activeTab === "lessons") {
       return (
        <div className="tab-panel">
          <h2>Lessons</h2>
          {/* Use lessonsLoading state for this tab */}
          {lessonsLoading ? (
            <p className="loading">Loading lessons...</p>
          ) : lessons.length > 0 ? (
            <>
                <ul className="list">
                {/* Map paginatedLessons... (keep existing map logic) */}
                {paginatedLessons.map((lesson) => (
                    lesson && ( // Safe access check
                        <li key={lesson.id} className="list-item">
                        <h3>{lesson.title || 'Untitled Lesson'}</h3>
                        <p>{lesson.content ? stripHTML(lesson.content).substring(0, 100) + '...' : ''}</p>
                        <button
                            onClick={() => lesson.permalink ? navigate(`/lessons/${lesson.permalink}`) : null}
                            className="details-btn"
                            disabled={!lesson.permalink}
                        >
                            View Details
                        </button>
                        </li>
                    )
                ))}
                </ul>
                {/* Keep Pagination Logic */}
                {totalLessonPages > 1 && ( <div className="pagination">{/*...*/}</div> )}
            </>
          ) : (
            <p>No lessons available.</p>
          )}
        </div>
      );
    }
    // QUIZZES TAB
    else if (activeTab === "quizzes") {
       return (
        <div className="tab-panel">
          <h2>Quizzes</h2>
          {/* Use quizzesLoading state for this tab */}
          {quizzesLoading ? (
            <p className="loading">Loading quizzes...</p>
          ) : quizzes.length > 0 ? (
             <>
                <ul className="list">
                {/* Map paginatedQuizzes... (keep existing map logic) */}
                {paginatedQuizzes.map((quiz) => (
                     quiz && ( // Safe access check
                        <li key={quiz.id} className="list-item">
                            <h3>{quiz.title || 'Untitled Quiz'}</h3>
                            <p>
                            {quiz.question ? stripHTML(quiz.question).substring(0, 100) + "..." : ""}
                            </p>
                            {/* Link assumes viewing quiz details doesn't require enrollment context */}
                            <Link to={`/quizzes/${quiz.permalink}`} className="details-btn">
                            View Details
                            </Link>
                        </li>
                     )
                ))}
                </ul>
                {/* Keep Pagination Logic */}
                {totalQuizPages > 1 && ( <div className="pagination">{/*...*/}</div> )}
            </>
          ) : (
            <p>No quizzes available.</p>
          )}
        </div>
      );
    }
    // Fallback if no tab matches (shouldn't happen)
    return null;
  };

  return (
    <div className="public-profile-dashboard">
      <aside className="public-profile-sidebar">
        <div className="sidebar-card">
          <div className="sidebar-image-container">
            <img
              src={
                profile.profile_image_url && profile.profile_image_url.trim()
                  ? profile.profile_image_url
                  : "https://via.placeholder.com/150"
              }
              alt={profile.username}
              className="hexagon"
            />
          </div>
          <div className="sidebar-info">
            <h2 className="sidebar-username">{profile.username}</h2>
            <p className="sidebar-joined">
              Joined {new Date(profile.date_joined).toLocaleDateString()}
            </p>
            <p className="sidebar-bio">{profile.bio || "No bio available."}</p>
          </div>
          {/* Show the attend/cancel/unattend button if user is not the profile owner */}
          {currentUser && currentUser.username !== profile.username && (
            <div className="attend-section">{attendButton}</div>
          )}
        </div>
      </aside>
      <main className="public-profile-main">
        <div className="stats-section">
          <div className="stat">
            <h3>{posts.length}</h3>
            <p>Posts</p>
          </div>
          <div className="stat">
            <h3>{courses.length}</h3>
            <p>Courses</p>
          </div>
          <div className="stat">
            <h3>{lessons.length}</h3>
            <p>Lessons</p>
          </div>
          <div className="stat">
            <h3>{quizzes.length}</h3>
            <p>Quizzes</p>
          </div>
          <div className="stat">
            <h3>{attendances}</h3>
            <p>Attendees</p>
          </div>
        </div>
        <div className="tab-navigation">
          {["posts", "courses", "lessons", "quizzes"].map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                if (tab === "courses") setCurrentCoursePage(1);
                if (tab === "lessons") setCurrentLessonPage(1);
                if (tab === "quizzes") setCurrentQuizPage(1);
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
        <div className="tab-content">{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default PublicGuideProfile;
