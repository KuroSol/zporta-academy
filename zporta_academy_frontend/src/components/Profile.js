import React, { useEffect, useState, useRef, useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaUser, FaRegClock, FaEye } from "react-icons/fa"; // Kept all original icons
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api"; // <--- Import apiClient (Ensure path is correct, likely '../api' if Profile.js is in src/components/)
import "./Profile.css";


const Profile = () => {
  // --- Keep ALL original state variables ---
  const { user, token, logout } = useContext(AuthContext);
  const [profile, setProfile] = useState(user || null);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("courses");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState("");

  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [currentCoursePage, setCurrentCoursePage] = useState(1);
  const itemsPerCoursePage = 5;
  const totalCoursePages = Math.ceil(courses.length / itemsPerCoursePage);
  const paginatedCourses = courses.slice(
    (currentCoursePage - 1) * itemsPerCoursePage,
    currentCoursePage * itemsPerCoursePage
  );

  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [currentLessonPage, setCurrentLessonPage] = useState(1);
  const itemsPerLessonPage = 5;
  const totalLessonPages = Math.ceil(lessons.length / itemsPerLessonPage);
  const paginatedLessons = lessons.slice(
    (currentLessonPage - 1) * itemsPerLessonPage,
    currentLessonPage * itemsPerLessonPage
  );

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [currentQuizPage, setCurrentQuizPage] = useState(1);
  const itemsPerQuizPage = 5;
  const totalQuizPages = Math.ceil(quizzes.length / itemsPerQuizPage);
  const paginatedQuizzes = quizzes.slice(
    (currentQuizPage - 1) * itemsPerQuizPage,
    currentQuizPage * itemsPerQuizPage
  );

  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Helper to strip HTML tags (Keep original)
  const stripHTML = (html) => {
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  // --- useEffect Hooks (Keep original logic) ---
  useEffect(() => {
    if (!token) {
      navigate("/login");
      return; // Added return to prevent fetch if navigating away
    }
    fetchProfile();
  }, [token, navigate]); // Added navigate dependency

  useEffect(() => {
    if (profile) { // Check if profile is loaded before fetching related data
      //if (activeTab === "posts") fetchUserPosts();
      if (activeTab === "courses") fetchUserCourses();
      if (activeTab === "lessons") fetchUserLessons();
      if (activeTab === "quizzes") fetchUserQuizzes();
    }
  }, [activeTab, profile]); // Added profile dependency

  // --- Refactored API Call Functions using apiClient ---

  const fetchProfile = async () => {
    setError("");
    try {
        const response = await apiClient.get('/users/profile/'); // ✅ Corrected here
        setProfile(response.data);
        setNewEmail(response.data.email);
    } catch (err) {
        console.error("Fetch profile error:", err.response ? err.response.data : err.message);
        setError(err.response?.data?.detail || "Failed to fetch profile.");
        if (err.response?.status === 401) logout();
    }
};

  const fetchUserPosts = async () => {
    // Assuming /api/posts/ is public or filtering happens client-side as before
    setPostsLoading(true);
    setError(""); // Clear error on new fetch
    try {
      // Replaced fetch with apiClient.get; Using relative URL
      const response = await apiClient.get('/posts/'); // Correct relative path
      const userPosts = response.data.filter((post) => post.created_by === profile?.username); // Filter client-side
      setPosts(userPosts);
    } catch (err) {
      console.error("Error fetching posts:", err.response ? err.response.data : err.message);
      setError("Failed to load posts.");
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchUserCourses = async () => {
    setCoursesLoading(true);
    setError("");
    try {
      // Replaced fetch with apiClient.get; Auth handled by interceptor
      const response = await apiClient.get('/courses/my/'); // Correct relative path
      setCourses(response.data);
    } catch (err) {
      console.error("Error fetching courses:", err.response ? err.response.data : err.message);
      setError("Failed to load your courses.");
      if (err.response?.status === 401) logout();
    } finally {
      setCoursesLoading(false);
    }
  };

  const fetchUserLessons = async () => {
    setLessonsLoading(true);
    setError("");
    try {
      // Replaced fetch with apiClient.get; Auth handled by interceptor
      const response = await apiClient.get('/lessons/my/'); // Correct relative path
      setLessons(response.data);
    } catch (err) {
      console.error("Error fetching lessons:", err.response ? err.response.data : err.message);
      setError("Failed to load your lessons.");
      if (err.response?.status === 401) logout();
    } finally {
      setLessonsLoading(false);
    }
  };

  const fetchUserQuizzes = async () => {
    setQuizzesLoading(true);
    setError("");
    try {
      // Replaced fetch with apiClient.get; Auth handled by interceptor
      const response = await apiClient.get('/quizzes/my/'); // Correct relative path
      setQuizzes(response.data);
    } catch (err) {
      console.error("Error fetching quizzes:", err.response ? err.response.data : err.message);
      setError("Failed to load your quizzes.");
      if (err.response?.status === 401) logout();
    } finally {
      setQuizzesLoading(false);
    }
  };

  // --- Event Handlers (Keep original logic, refactor API calls within) ---

  const handleProfileImageClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Basic validation example (optional)
      if (!file.type.startsWith('image/')) {
         setError("Please select an image file.");
         return;
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit example
         setError("File size should not exceed 5MB.");
         return;
      }
      setError(''); // Clear error if valid
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
       setError("No file selected.");
       return;
    }
    // Removed redundant token check, interceptor handles auth failures
    setError('');
    const formData = new FormData();
    formData.append("profile_image", selectedFile);
    try {
      // Replaced fetch with apiClient.put; Auth and Content-Type handled automatically
      await apiClient.put('/users/profile/', formData);
      setSelectedFile(null);
      setPreviewUrl(null); // Clear preview
      fetchProfile(); // Refresh profile data to show new image
    } catch (err) {
      console.error("Error uploading profile image:", err.response ? err.response.data : err.message);
      // Try to get specific error detail from backend
      setError(err.response?.data?.profile_image || err.response?.data?.detail || "Failed to update profile image.");
      if (err.response?.status === 401) logout();
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if(fileInputRef.current) fileInputRef.current.value = ""; // Clear file input
  };

  const handleEmailEdit = () => {
    setNewEmail(profile?.email || ''); // Ensure newEmail starts with current value
    setEditingEmail(true);
  };

  const handleEmailChange = (e) => {
    setNewEmail(e.target.value);
  };

  const handleEmailSave = async () => {
    setError('');
    try {
      // Replaced fetch with apiClient.put; Auth and Content-Type handled automatically
      await apiClient.put('/api/users/profile/', { email: newEmail });
      setEditingEmail(false);
      fetchProfile(); // Refresh profile data
    } catch (err) {
      console.error("Error updating email:", err.response ? err.response.data : err.message);
      setError(err.response?.data?.email || err.response?.data?.detail || "Failed to update email.");
      if (err.response?.status === 401) logout();
    }
  };

  const toggleChangePassword = () => {
    setShowChangePassword(!showChangePassword);
    // Reset fields and message when toggling
    setChangePasswordMessage("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordMessage("");
    if (newPassword !== confirmNewPassword) {
      setChangePasswordMessage("New passwords do not match.");
      return;
    }
    try {
      // Replaced fetch with apiClient.post; Auth and Content-Type handled automatically
      await apiClient.post('/users/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      setChangePasswordMessage("Password changed successfully!");
      // Reset fields and hide form on success
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setShowChangePassword(false);
    } catch (err) {
      console.error("Change password error:", err.response ? err.response.data : err.message);
      // Extract more specific error messages from backend if possible
      const backendError = err.response?.data?.error ||
                          err.response?.data?.detail ||
                          (err.response?.data?.non_field_errors ? err.response.data.non_field_errors.join(' ') : null) ||
                          (err.response?.data?.new_password ? `New Password: ${err.response.data.new_password.join(' ')}` : null) ||
                          (err.response?.data?.current_password ? `Current Password: ${err.response.data.current_password.join(' ')}` : null) ||
                          "Failed to change password.";
      setChangePasswordMessage(backendError);
      if (err.response?.status === 401) logout();
    }
  };

  // --- JSX Rendering (Keeping entire original structure) ---

  // Keep original loading/error/redirect logic
  if (!token && !profile) return <p>Redirecting to login...</p>;
  if (error && !profile) return <p className="error">{error}</p>; // Show critical error if profile fails initial load
  if (!profile) return <p>Loading profile...</p>;

  return (
    <div className="profile-dashboard">
      <aside className="profile-sidebar">
        <div className="sidebar-card">
          <div className="sidebar-image-container">
              <img
                src={
                  previewUrl
                    ? previewUrl
                    : profile?.profile_image_url?.trim()
                      ? profile.profile_image_url.trim()
                      : "https://zportaacademy.com/media/managed_images/zpacademy.png"
                }
                onError={(e) => {
                  e.target.onerror = null; // prevent infinite loop
                  e.target.src = "https://zportaacademy.com/media/managed_images/zpacademy.png";
                }}
                alt={profile.username || "Zporta User"}
                className="hexagon"
              />

            <button className="profile-edit-btn" onClick={handleProfileImageClick}>
              <FaEdit />
            </button>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={handleFileChange}
            />
            {previewUrl && (
              <div className="upload-preview-controls">
                <button className="upload-btn" onClick={handleUpload}>
                  Upload
                </button>
                <button className="cancel-btn" onClick={handleCancelUpload}>
                  Cancel
                </button>
              </div>
            )}
          </div>

          <div className="sidebar-info">
            <h2 className="sidebar-username">{profile.username}</h2>
            <p className="sidebar-joined">
              Joined {new Date(profile.date_joined).toLocaleDateString()}
            </p>
            {/* Keep original Email editing UI */}
            <div className="sidebar-email">
               <span>Email: </span>
               {editingEmail ? (
                 <>
                   <input type="email" value={newEmail} onChange={handleEmailChange} required />
                   <button onClick={handleEmailSave} className="save-btn">Save</button>
                   <button onClick={() => { setEditingEmail(false); setError(''); }} className="cancel-btn">Cancel</button> {/* Clear error on cancel */}
                 </>
               ) : (
                 <>
                   <span>{profile.email}</span>
                   <button onClick={handleEmailEdit} className="edit-inline-btn"><FaEdit /></button>
                 </>
               )}
            </div>
            {/* Display email update errors here */}
            {editingEmail && error && <p className="error" style={{fontSize: 'small'}}>{error}</p>}

            <p className="sidebar-bio">{profile.bio || "No bio available."}</p>
            <Link to={`/guide/${profile.username}`} className="public-profile-btn">
              View Public Profile
            </Link>
            <button className="change-password-btn" onClick={toggleChangePassword}>
              {/* Keep toggling text */}
              {showChangePassword ? 'Cancel Change Password' : 'Change Password'}
            </button>
            {/* Keep Change Password Form */}
            {showChangePassword && (
              <div className="change-password-form">
                <form onSubmit={handleChangePassword}>
                  <label>Current Password:</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <label>New Password:</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <label>Confirm New Password:</label>
                  <input
                    type="password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    required
                    autoComplete="new-password"
                  />
                  <button type="submit" className="save-btn">
                    Update Password
                  </button>
                </form>
                {changePasswordMessage && (
                  <p className="change-password-message">{changePasswordMessage}</p>
                )}
              </div>
            )}
          </div>
          <button onClick={logout} className="logout-btn">
            Logout
          </button>
        </div>
      </aside>

      {/* Keep original Main Content structure */}
      <main className="profile-main">
        <div className="tab-navigation">
          {[/*"posts",*/ "courses", "lessons", "quizzes"].map((tab) => (
            <button
              key={tab}
              className={`tab-btn ${activeTab === tab ? "active" : ""}`}
              onClick={() => {
                setActiveTab(tab);
                // Keep pagination reset
                if (tab === "courses") setCurrentCoursePage(1);
                if (tab === "lessons") setCurrentLessonPage(1);
                if (tab === "quizzes") setCurrentQuizPage(1);
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="tab-content">
           {/* Keep original Tab Panels and their content */}
{/*          
          {activeTab === "posts" && (
            <div className="tab-panel">
              <h2>Your Posts</h2>
              {postsLoading ? (
                <p className="loading">Loading posts...</p>
              ) : posts.length > 0 ? (
                <div className="cards-grid">
                  {posts.map((post) => (
                    <Link to={`/posts/${post.permalink}`} key={post.id} className="card">
                      <div className="card-image">
                        {post.og_image_url ? (
                          <img src={post.og_image_url} alt={post.title} />
                        ) : (
                          <p>{stripHTML(post.content).substring(0, 100)}...</p>
                        )}
                      </div>
                      <div className="card-info">
                        <h3>{post.title}</h3>
                        <p>
                          {post.created_by} |{" "}
                          {new Date(post.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <p>You haven't created any posts yet.</p>
              )}
               {/* Display general fetch errors for this tab }
               {error && activeTab === 'posts' && <p className="error">{error}</p>}
            </div>
          )}
*/}
          {activeTab === "courses" && (
            <div className="tab-panel">
              <h2>Your Courses</h2>
              {coursesLoading ? (
                <p className="loading">Loading courses...</p>
              ) : courses.length > 0 ? (
                 <>
                   <div className="cards-grid">
                     {paginatedCourses.map((course) => (
                       <div key={course.id} className="card">
                         {course.cover_image ? (
                           <img
                             src={course.cover_image}
                             alt={`${course.title} cover`}
                             className="card-image"
                           />
                         ) : (
                           <div className="grid-item-placeholder">
                             <p>No Image</p>
                           </div>
                         )}
                         <div className="card-info">
                           <h3>{course.title}</h3>
                           <p>{course.description ? stripHTML(course.description).substring(0, 100)+"..." : "No description"}</p>
                           <button
                             className="details-btn"
                             onClick={() => navigate(`/courses/${course.permalink}`)}
                           >
                             View Details
                           </button>
                         </div>
                       </div>
                     ))}
                   </div>
                   {/* Keep pagination controls */}
                   {totalCoursePages > 1 && (
                     <div className="pagination">
                       {[...Array(totalCoursePages)].map((_, index) => (
                         <button
                           key={index}
                           className={`page-btn ${
                             currentCoursePage === index + 1 ? "active" : ""
                           }`}
                           onClick={() => setCurrentCoursePage(index + 1)}
                         >
                           {index + 1}
                         </button>
                       ))}
                     </div>
                   )}
                 </>
              ) : (
                <p>You haven't created any courses yet.</p>
              )}
              {/* Display general fetch errors for this tab */}
              {error && activeTab === 'courses' && <p className="error">{error}</p>}
            </div>
          )}

          {activeTab === "lessons" && (
            <div className="tab-panel">
              <h2>Your Lessons</h2>
              {lessonsLoading ? (
                <p className="loading">Loading lessons...</p>
              ) : lessons.length > 0 ? (
                <>
                  <ul className="list">
                    {paginatedLessons.map((lesson) => (
                      <li key={lesson.id} className="list-item">
                        <h3>{lesson.title}</h3>
                        <p>{stripHTML(lesson.content).substring(0, 100)}...</p>
                        <button
                          onClick={() => navigate(`/lessons/${lesson.permalink}`)}
                          className="details-btn"
                        >
                          View Details
                        </button>
                      </li>
                    ))}
                  </ul>
                  {/* Keep pagination controls */}
                  {totalLessonPages > 1 && (
                    <div className="pagination">
                      {[...Array(totalLessonPages)].map((_, index) => (
                        <button
                          key={index}
                          className={`page-btn ${
                            currentLessonPage === index + 1 ? "active" : ""
                          }`}
                          onClick={() => setCurrentLessonPage(index + 1)}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p>You haven't created any lessons yet.</p>
              )}
              {/* Display general fetch errors for this tab */}
              {error && activeTab === 'lessons' && <p className="error">{error}</p>}
            </div>
          )}

          {activeTab === "quizzes" && (
            <div className="tab-panel">
              <h2>Your Quizzes</h2>
              {quizzesLoading ? (
                <p className="loading">Loading quizzes...</p>
              ) : quizzes.length > 0 ? (
                <>
                  <ul className="list">
                    {paginatedQuizzes.map((quiz) => (
                      <li key={quiz.id} className="list-item">
                        <h3>{quiz.title}</h3>
                        <p>
                          {quiz.question
                            ? stripHTML(quiz.question).substring(0, 100) + "..."
                            : "No question preview"}
                        </p>
                        <Link to={`/quizzes/${quiz.permalink}`} className="details-btn">
                          View Details
                        </Link>
                      </li>
                    ))}
                  </ul>
                   {/* Keep pagination controls */}
                  {totalQuizPages > 1 && (
                    <div className="pagination">
                      {[...Array(totalQuizPages)].map((_, index) => (
                        <button
                          key={index}
                          className={`page-btn ${
                            currentQuizPage === index + 1 ? "active" : ""
                          }`}
                          onClick={() => setCurrentQuizPage(index + 1)}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p>You haven't created any quizzes yet.</p>
              )}
               {/* Display general fetch errors for this tab */}
               {error && activeTab === 'quizzes' && <p className="error">{error}</p>}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;