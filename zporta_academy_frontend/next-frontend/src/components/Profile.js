import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { quizPermalinkToUrl } from "@/utils/urls";
import { 
  FaEdit, FaChevronDown, FaSpinner, FaBookOpen, 
  FaQuestionCircle, FaChalkboardTeacher, FaCamera,
  FaBookReader, FaAward, FaEnvelope
} from "react-icons/fa";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";
import styles from '@/styles/Profile.module.css';

const ITEMS_PER_LOAD = 6; // Items to load per scroll/click for each section

// Simple throttle function (same as public profile)
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

const Profile = () => {
  const { user, token, logout } = useContext(AuthContext);
  const router = useRouter();

  // --- Profile State ---
  const [profile, setProfile] = useState(user || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState(""); // General errors for sidebar actions or initial load

  // --- Image Upload State ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // --- Email Edit State ---
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // --- Display Name Edit State ---
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [displayNameError, setDisplayNameError] = useState("");
  // --- Password Change State ---
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState({ text: "", type: "error" });

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState("courses");

  // --- Data & "Load More" State for each tab ---
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true); // Initial fetch loading
  const [isCoursesLoadingMore, setIsCoursesLoadingMore] = useState(false); // Subsequent load more
  const [displayedCoursesCount, setDisplayedCoursesCount] = useState(ITEMS_PER_LOAD);
  const [totalCourses, setTotalCourses] = useState(0);
  const [coursesError, setCoursesError] = useState(""); // Error specific to courses tab

  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [isLessonsLoadingMore, setIsLessonsLoadingMore] = useState(false);
  const [displayedLessonsCount, setDisplayedLessonsCount] = useState(ITEMS_PER_LOAD);
  const [totalLessons, setTotalLessons] = useState(0);
  const [lessonsError, setLessonsError] = useState("");

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [isQuizzesLoadingMore, setIsQuizzesLoadingMore] = useState(false);
  const [displayedQuizzesCount, setDisplayedQuizzesCount] = useState(ITEMS_PER_LOAD);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [quizzesError, setQuizzesError] = useState("");

  // --- Scores State ---
  const [scores, setScores] = useState({ growth_score: 0, impact_score: 0 }); // Initialize with 0
  const [scoresLoading, setScoresLoading] = useState(true);
  const [scoresError, setScoresError] = useState(null); // Error specific to scores

  // Helper to strip HTML tags for plain text display
  const stripHTML = (html) => {
    if (!html) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  // Fetch main user profile data
  const fetchProfileCallback = useCallback(async () => {
    setIsLoadingProfile(true);
    setError(""); // Clear general error
    try {
      const response = await apiClient.get('/users/profile/');
      setProfile(response.data);
      setNewEmail(response.data.email); // Initialize newEmail with current profile email
      setNewDisplayName(response.data.display_name || "");
    } catch (err) {
      console.error("Fetch profile error:", err.response ? err.response.data : err.message);
      setError(err.response?.data?.detail || "Failed to fetch profile. Please try again.");
      if (err.response?.status === 401) logout();
    } finally {
      setIsLoadingProfile(false);
    }
  }, [logout]);

  // Generic function to fetch data for tabs (courses, lessons, quizzes)
  const fetchDataForTab = useCallback(async (endpoint, setData, setInitialLoading, setTotalCount, dataKey, setTabError) => {
    setInitialLoading(true);
    setTabError(""); // Clear specific tab error
    try {
      const response = await apiClient.get(endpoint);
      const sortedData = (response.data || []).sort((a, b) => {
        const dateA = new Date(a.created_at || a.updated_at || 0);
        const dateB = new Date(b.created_at || b.updated_at || 0);
        return dateB - dateA; // Sort newest first
      });
      setData(sortedData);
      setTotalCount(sortedData.length);
    } catch (err) {
      console.error(`Error fetching ${dataKey}:`, err.response ? err.response.data : err.message);
      setTabError(`Failed to load your ${dataKey}. Please try again.`);
      if (err.response?.status === 401) logout();
    } finally {
      setInitialLoading(false);
    }
  }, [logout]);

  // Specific fetch functions for each tab
  const fetchUserCourses = useCallback(() => fetchDataForTab('/courses/my/', setCourses, setCoursesLoading, setTotalCourses, 'courses', setCoursesError), [fetchDataForTab]);
  const fetchUserLessons = useCallback(() => fetchDataForTab('/lessons/my/', setLessons, setLessonsLoading, setTotalLessons, 'lessons', setLessonsError), [fetchDataForTab]);
  const fetchUserQuizzes = useCallback(() => fetchDataForTab('/quizzes/my/', setQuizzes, setQuizzesLoading, setTotalQuizzes, 'quizzes', setQuizzesError), [fetchDataForTab]);
  
  // Fetch user scores
  const fetchUserScores = useCallback(async () => {
    setScoresLoading(true);
    setScoresError(null);
    try {
      const { data } = await apiClient.get('/users/score/');
      setScores({
        growth_score: data.growth_score !== null ? data.growth_score : 0, // Default to 0 if null
        impact_score: data.impact_score !== null ? data.impact_score : 0  // Default to 0 if null
      });
    } catch (err) {
      console.error('Error loading scores:', err);
      setScoresError(err.response?.data?.detail || "Could not load scores.");
      setScores({ growth_score: 0, impact_score: 0 }); // Default to 0 on error
      if (err.response?.status === 401) logout();
    } finally {
      setScoresLoading(false);
    }
  }, [logout]);

  // Initial data fetch on component mount (profile and scores)
  useEffect(() => {
    if (!token) {
      router.push("/login");
    } else {
      fetchProfileCallback();
      fetchUserScores(); 
    }
  }, [token, router, fetchProfileCallback, fetchUserScores]);

  // Fetch data for the active tab when it changes or when profile is loaded
  useEffect(() => {
    if (profile) { 
      // Reset displayed counts and errors for all tabs when activeTab or profile changes
      setDisplayedCoursesCount(ITEMS_PER_LOAD);
      setCoursesError("");
      setDisplayedLessonsCount(ITEMS_PER_LOAD);
      setLessonsError("");
      setDisplayedQuizzesCount(ITEMS_PER_LOAD);
      setQuizzesError("");
      
      if (activeTab === "courses") fetchUserCourses();
      else if (activeTab === "lessons") fetchUserLessons();
      else if (activeTab === "quizzes") fetchUserQuizzes();
    }
  }, [activeTab, profile, fetchUserCourses, fetchUserLessons, fetchUserQuizzes]);

  // Generic "load more" handler for infinite scroll
  const handleLoadMore = useCallback((currentDisplayedCount, setDisplayedCount, totalItems, itemsPerLoad, setIsLoadingMoreFlag, isLoadingMoreFlag) => {
    if (isLoadingMoreFlag || currentDisplayedCount >= totalItems) return; // Prevent multiple calls or loading beyond total

    setIsLoadingMoreFlag(true);
    // Simulate network delay for loader visibility, then update count
    setTimeout(() => { 
      setDisplayedCount(prev => Math.min(prev + itemsPerLoad, totalItems));
      setIsLoadingMoreFlag(false);
    }, 500); // 500ms delay
  }, []);


  // Infinite Scroll Logic
  useEffect(() => {
    const onScroll = () => {
      // Trigger load more if near bottom (e.g., 300px buffer) and not already loading
      if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 300) { 
        if (activeTab === "courses" && !coursesLoading && !isCoursesLoadingMore && displayedCoursesCount < totalCourses) {
          handleLoadMore(displayedCoursesCount, setDisplayedCoursesCount, totalCourses, ITEMS_PER_LOAD, setIsCoursesLoadingMore, isCoursesLoadingMore);
        } else if (activeTab === "lessons" && !lessonsLoading && !isLessonsLoadingMore && displayedLessonsCount < totalLessons) {
          handleLoadMore(displayedLessonsCount, setDisplayedLessonsCount, totalLessons, ITEMS_PER_LOAD, setIsLessonsLoadingMore, isLessonsLoadingMore);
        } else if (activeTab === "quizzes" && !quizzesLoading && !isQuizzesLoadingMore && displayedQuizzesCount < totalQuizzes) {
          handleLoadMore(displayedQuizzesCount, setDisplayedQuizzesCount, totalQuizzes, ITEMS_PER_LOAD, setIsQuizzesLoadingMore, isQuizzesLoadingMore);
        }
      }
    };
    const throttledScrollHandler = throttle(onScroll, 200); // Throttle scroll handler
    window.addEventListener('scroll', throttledScrollHandler);
    return () => window.removeEventListener('scroll', throttledScrollHandler); // Cleanup
  }, [
    activeTab, 
    coursesLoading, lessonsLoading, quizzesLoading,
    isCoursesLoadingMore, isLessonsLoadingMore, isQuizzesLoadingMore,
    displayedCoursesCount, displayedLessonsCount, displayedQuizzesCount,
    totalCourses, totalLessons, totalQuizzes,
    handleLoadMore // Ensure handleLoadMore is stable or included if it changes
  ]);

  // --- Event Handlers for Profile Actions ---
  const handleProfileImageClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) { setError("Please select an image file (e.g., JPG, PNG)."); return; }
      if (file.size > 5 * 1024 * 1024) { setError("Image file size should not exceed 5MB."); return; }
      setError(''); setSelectedFile(file); setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadImage = async () => {
    if (!selectedFile) { setError("No file selected for upload."); return; }
    setError(''); // Clear previous general errors
    const formData = new FormData();
    formData.append("profile_image", selectedFile);
    try {
      await apiClient.put('/users/profile/', formData);
      setSelectedFile(null); setPreviewUrl(null); fetchProfileCallback(); // Refetch profile to show new image
    } catch (err) {
      setError(err.response?.data?.profile_image?.[0] || err.response?.data?.detail || "Failed to update profile image.");
      if (err.response?.status === 401) logout();
    }
  };
  const handleCancelUpload = () => { setSelectedFile(null); setPreviewUrl(null); if(fileInputRef.current) fileInputRef.current.value = ""; setError(''); };

  const handleEmailEditToggle = () => { setEditingEmail(!editingEmail); setNewEmail(profile?.email || ''); setEmailError(''); setError(''); };
  const handleEmailSave = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) { setEmailError("Please enter a valid email address."); return; }
    setEmailError(''); // Clear email-specific error
    try {
      await apiClient.put('/users/profile/', { email: newEmail });
      setEditingEmail(false); fetchProfileCallback(); // Refetch profile
    } catch (err) {
      setEmailError(err.response?.data?.email?.[0] || err.response?.data?.detail || "Failed to update email.");
      if (err.response?.status === 401) logout();
    }
  };

  
  const handleDisplayNameEditToggle = () => {
    setEditingDisplayName(!editingDisplayName);
    setNewDisplayName(profile?.display_name || "");
    setDisplayNameError('');
    setError('');
  };

  const handleDisplayNameSave = async () => {
    const value = (newDisplayName || "").trim();
    if (!value) {
      setDisplayNameError("Display name cannot be empty.");
      return;
    }
    if (value.length > 50) {
      setDisplayNameError("Display name must be 50 characters or fewer.");
      return;
    }
    setDisplayNameError('');
    try {
      await apiClient.put('/users/profile/', { display_name: value });
      setEditingDisplayName(false);
      fetchProfileCallback();
    } catch (err) {
      // backend may return {"display_name": ["..."]} or {"detail": "..."}
      setDisplayNameError(
        err.response?.data?.display_name?.[0] ||
        err.response?.data?.detail ||
        "Failed to update display name."
      );
      if (err.response?.status === 401) logout();
    }
  };

  const toggleChangePasswordForm = () => { setShowChangePassword(!showChangePassword); setChangePasswordMessage({ text: "", type: "error" }); setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword(""); setError(''); };
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordMessage({ text: "", type: "error" }); // Clear previous message
    if (newPassword !== confirmNewPassword) { setChangePasswordMessage({ text: "New passwords do not match.", type: "error" }); return; }
    if (newPassword.length < 8) { setChangePasswordMessage({ text: "New password must be at least 8 characters long.", type: "error" }); return; }
    try {
      await apiClient.post('/users/change-password/', { current_password: currentPassword, new_password: newPassword, confirm_new_password: confirmNewPassword });
      setChangePasswordMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      setTimeout(() => { setShowChangePassword(false); setChangePasswordMessage({ text: "", type: "error" }); }, 2000);
    } catch (err) {
      const backendError = err.response?.data?.error || err.response?.data?.detail || (err.response?.data?.non_field_errors ? err.response.data.non_field_errors.join(' ') : null) || (err.response?.data?.new_password ? `New Password: ${err.response.data.new_password.join(' ')}` : null) || (err.response?.data?.current_password ? `Current Password: ${err.response.data.current_password.join(' ')}` : null) || "Failed to change password.";
      setChangePasswordMessage({ text: backendError, type: "error" });
      if (err.response?.status === 401) logout();
    }
  };

  // --- Render Logic ---
  if (isLoadingProfile && !profile) { // Show full page loader only if profile is not yet available
    return (
      <div className={`${styles.profilePage} flex items-center justify-center`}>
        <div className={styles.loadingState}>
          <FaSpinner className={styles.spinner} size={30} /> Loading Profile...
        </div>
      </div>
    );
  }

  if (!profile) { // If profile fetch failed
    return (
      <div className={`${styles.profilePage} text-center`}>
        <p className={styles.errorState}>
          {error || "Could not load profile data. Please try logging in again."}
        </p>
        <button onClick={() => router.push('/login')} className={`${styles.sidebarButton} ${styles.publicProfileBtn} mt-6 mx-auto w-auto px-6`}>
            Go to Login
        </button>
      </div>
    );
  }
  
  // Consolidate sidebar errors to display in one place if an action is active
  const sidebarActionError = error || emailError || (changePasswordMessage.text && changePasswordMessage.type === 'error' ? changePasswordMessage.text : '');

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileContainer}>
        {/* Display general error if it's related to an active sidebar form */}
        {sidebarActionError && (previewUrl || selectedFile || editingEmail || showChangePassword) && (
            <div className={`${styles.errorState} mb-6 text-sm`}> {/* Ensure this class is styled for errors */}
                <p>{sidebarActionError}</p>
            </div>
        )}

        <div className={styles.profileLayout}>
          <aside className={styles.profileSidebar}>
            <div className={styles.sidebarContent}>
              <div className={styles.hexagonContainer} onClick={handleProfileImageClick} title="Change profile picture">
                <img
                  src={previewUrl || profile.profile_image_url?.trim() || `https://placehold.co/160x160/FFC107/1B2735?text=${profile.username[0].toUpperCase()}`}
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/160x160/DEE2E6/5A6268?text=Error"; }}
                  alt={profile.username || "User"}
                  className={styles.hexagonImage}
                />
                <div className={styles.changeImageButton}><FaCamera size={16}/></div>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/>
              </div>

              {previewUrl && (
                <div className={styles.imageUploadActions}>
                  <button onClick={handleUploadImage} className={`${styles.uploadBtn} ${styles['imageUploadActions button']}`}>Upload</button>
                  <button onClick={handleCancelUpload} className={`${styles.cancelBtn} ${styles['imageUploadActions button']}`}>Cancel</button>
                </div>
              )}
              
              <h1 className={styles.username}>
                {profile.display_name?.trim() || profile.username}
              </h1>
              <p className={styles.joinedDate}> Joined: {new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} </p>
             
              <div className={styles.scoreContainer}>
                <div className={styles.scoreItem}>
                  <FaBookReader size={22} />
                  <div>
                    <span className={styles.scoreValue}>
                      {scoresLoading ? <FaSpinner className={styles.spinner} /> : scores.growth_score}
                    </span>
                    <div className={styles.scoreLabel}>Learning Score</div>
                  </div>
                </div>
                <div className={styles.scoreItem}>
                  <FaAward size={22} />
                  <div>
                    <span className={styles.scoreValue}>
                      {scoresLoading ? <FaSpinner className={styles.spinner} /> : scores.impact_score}
                    </span>
                    <div className={styles.scoreLabel}>Impact Score</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 mt-5"> {/* Tailwind for simple spacing */}
                {/* Display Name (editable like Email) */}
                <div className={styles.infoSection}>
                  <div className={styles.infoLabelContainer}>
                    <span className={styles.infoLabel}>Display name:</span>
                    {!editingDisplayName && (
                      <button
                        onClick={handleDisplayNameEditToggle}
                        title="Edit Display Name"
                        className={styles.editIconButton}
                      >
                        <FaEdit size={16} />
                      </button>
                    )}
                  </div>
                  {editingDisplayName ? (
                    <div>
                      <input
                        type="text"
                        value={newDisplayName}
                        onChange={(e) => setNewDisplayName(e.target.value)}
                        className={styles.infoInput}
                        placeholder="Your public name"
                        maxLength={50}
                      />
                      {displayNameError && (
                        <p className={`${styles.errorState} text-xs !p-2 mt-2`}>
                          {displayNameError}
                        </p>
                      )}
                      <div className={styles.emailEditActions}>
                        <button
                          onClick={handleDisplayNameSave}
                          className={`${styles.sidebarButton} ${styles.uploadBtn} !mt-0 !py-1.5 !px-3`}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleDisplayNameEditToggle}
                          className={`${styles.sidebarButton} ${styles.cancelBtn} !bg-slate-500 hover:!bg-slate-600 !mt-0 !py-1.5 !px-3`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className={styles.infoValue}>
                      {profile.display_name?.trim() || "—"}
                    </span>
                  )}
                </div>
                <div className={styles.infoSection}>
                    <div className={styles.infoLabelContainer}>
                        <span className={styles.infoLabel}>Email:</span>
                        {!editingEmail && (
                            <button onClick={handleEmailEditToggle} title="Edit Email" className={styles.editIconButton}> <FaEdit size={16} /> </button>
                        )}
                    </div>
                    {editingEmail ? (
                        <div>
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={styles.infoInput}/>
                             {emailError && <p className={`${styles.errorState} text-xs !p-2 mt-2`}>{emailError}</p>}
                             <div className={styles.emailEditActions}>
                                <button onClick={handleEmailSave} className={`${styles.sidebarButton} ${styles.uploadBtn} !mt-0 !py-1.5 !px-3`}>Save</button>
                                <button onClick={handleEmailEditToggle} className={`${styles.sidebarButton} ${styles.cancelBtn} !bg-slate-500 hover:!bg-slate-600 !mt-0 !py-1.5 !px-3`}>Cancel</button>
                            </div>
                        </div>
                    ) : ( <span className={styles.infoValue} title={profile.email}>{profile.email}</span> )}
                </div>
               
                <div className={styles.infoSection}>
                    <span className={styles.infoLabel}>Bio:</span>
                    <p className={`${styles.infoValue} ${profile.bio ? '' : 'italic'}`}>{profile.bio || "No bio provided."}</p>
                </div>
              </div>

              <Link href={`/guide/${profile.username}`} className={`${styles.sidebarButton} ${styles.publicProfileBtn}`}> View Public Profile </Link>
              
              {/* Mail Magazine Button - Only for teachers/admins */}
              {(profile.role === 'guide' || profile.role === 'both' || profile.is_staff || profile.is_superuser) && (
                <Link href="/mail-magazine" className={`${styles.sidebarButton} ${styles.mailMagazineBtn}`}>
                  <FaEnvelope size={16} style={{ marginRight: '0.5rem' }} />
                  Mail Magazine
                </Link>
              )}
              
              <button onClick={toggleChangePasswordForm} className={`${styles.sidebarButton} ${styles.changePasswordBtn}`}>
                {showChangePassword ? 'Cancel Password Change' : 'Change Password'}
              </button>

              {showChangePassword && (
                <form onSubmit={handleChangePassword} className={styles.changePasswordForm}>
                  <div>
                    <label htmlFor="currentPasswordProf">Current Password</label>
                    <input type="password" id="currentPasswordProf" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password"/>
                  </div>
                  <div>
                    <label htmlFor="newPasswordProf">New Password</label>
                    <input type="password" id="newPasswordProf" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password"/>
                  </div>
                  <div>
                    <label htmlFor="confirmNewPasswordProf">Confirm New Password</label>
                    <input type="password" id="confirmNewPasswordProf" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required autoComplete="new-password"/>
                  </div>
                  {changePasswordMessage.text && ( <p className={changePasswordMessage.type === 'success' ? styles.successMessage : `${styles.errorState} !text-xs !p-2`}> {changePasswordMessage.text} </p> )}
                  <button type="submit" className={`${styles.sidebarButton} ${styles.updatePasswordBtn}`}> Update Password </button>
                </form>
              )}
            </div>
            <button onClick={logout} className={`${styles.sidebarButton} ${styles.logoutBtn}`}> Logout </button>
          </aside>

          <main className={styles.profileMainContent}>
            <nav className={styles.tabNavigation}>
              {["courses", "lessons", "quizzes"].map((tab) => (
                <button key={tab} onClick={() => { setActiveTab(tab); }}
                  className={`${styles.tabButton} ${activeTab === tab ? styles.tabButtonActive : ''}`}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </nav>

            <div className="mt-6"> {/* Content for tabs */}
              {activeTab === "courses" && (
                <div>
                  <h2 className={styles.sectionTitle}>Your Enrolled Courses</h2>
                  {coursesError && <div className={`${styles.errorState} mb-4`}>{coursesError}</div>}
                  {coursesLoading && courses.length === 0 && !coursesError ? ( <div className={styles.loadingState}><FaSpinner className={styles.spinner} size={24}/> Loading Courses...</div>
                  ) : courses.length > 0 ? (
                    <div className={styles.cardsGrid}>
                      {courses.slice(0, displayedCoursesCount).map((course) => (
                        <div key={course.id} className={styles.card}>
                          <div className={styles.cardImageContainer}>
                            {course.cover_image ? ( <img src={course.cover_image} alt={course.title || "Course"} onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/600x400/DEE2E6/1B2735?text=Course`; }}/>
                            ) : ( <FaChalkboardTeacher size={50} className={styles.cardImagePlaceholderIcon} /> )}
                          </div>
                          <div className={styles.cardContent}>
                            <h3 className={styles.cardTitle} title={course.title}>{course.title}</h3>
                            <p className={styles.cardDescription}> {stripHTML(course.description) || "No description."} </p>
                            <button onClick={() => router.push(`/courses/${course.permalink}`)} className={styles.cardButton}> View Course </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( !coursesLoading && !coursesError && <p className="text-center py-10 text-slate-500">You haven&apos;t enrolled in any courses yet.</p> )}
                  {isCoursesLoadingMore && <div className={`${styles.loadingState} mt-4`}>Loading</div>}
                  {!isCoursesLoadingMore && displayedCoursesCount < totalCourses && (
                    <div className={styles.loadMoreButtonContainer}>
                        <button 
                            onClick={() => handleLoadMore(displayedCoursesCount, setDisplayedCoursesCount, totalCourses, ITEMS_PER_LOAD, setIsCoursesLoadingMore, isCoursesLoadingMore)} 
                            className={styles.loadMoreButton}
                            disabled={isCoursesLoadingMore}
                        >
                            {isCoursesLoadingMore ? 'Loading' : 'Load More'} <FaChevronDown />
                        </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "lessons" && (
                <div>
                  <h2 className={styles.sectionTitle}>Your Accessed Lessons</h2>
                  {lessonsError && <div className={`${styles.errorState} mb-4`}>{lessonsError}</div>}
                  {lessonsLoading && lessons.length === 0 && !lessonsError ? ( <div className={styles.loadingState}><FaSpinner className={styles.spinner} size={24}/> Loading Lessons...</div>
                  ) : lessons.length > 0 ? (
                     <div className={styles.cardsGrid}> 
                      {lessons.slice(0, displayedLessonsCount).map((lesson) => (
                        <div key={lesson.id} className={styles.card}>
                           <div className={styles.cardImageContainer}> <FaBookOpen size={50} className={styles.cardImagePlaceholderIcon} /> </div>
                          <div className={styles.cardContent}>
                            <h3 className={styles.cardTitle} title={lesson.title}>{lesson.title}</h3>
                            <div className={`${styles.cardDescription} prose prose-sm max-w-none`} dangerouslySetInnerHTML={{ __html: stripHTML(lesson.content).substring(0,150) + (stripHTML(lesson.content).length > 150 ? '...' : '') || "No content." }} />
                            <Link href={`/lessons/${lesson.permalink}`}>
                              <button className={styles.cardButton}>
                                Read Full Lesson
                              </button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( !lessonsLoading && !lessonsError && <p className="text-center py-10 text-slate-500">You haven&apos;t accessed any lessons yet.</p> )}
                  {isLessonsLoadingMore && <div className={`${styles.loadingState} mt-4`}>Loading</div>}
                   {!isLessonsLoadingMore && displayedLessonsCount < totalLessons && (
                     <div className={styles.loadMoreButtonContainer}>
                        <button 
                            onClick={() => handleLoadMore(displayedLessonsCount, setDisplayedLessonsCount, totalLessons, ITEMS_PER_LOAD, setIsLessonsLoadingMore, isLessonsLoadingMore)} 
                            className={styles.loadMoreButton}
                            disabled={isLessonsLoadingMore}
                        >
                            {isLessonsLoadingMore ? 'Loading' : 'Load More'} <FaChevronDown />
                        </button>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "quizzes" && (
                <div>
                  <h2 className={styles.sectionTitle}>Your Attempted Quizzes</h2>
                  {quizzesError && <div className={`${styles.errorState} mb-4`}>{quizzesError}</div>}
                  {quizzesLoading && quizzes.length === 0 && !quizzesError ? ( <div className={styles.loadingState}><FaSpinner className={styles.spinner} size={24}/> Loading Quizzes...</div>
                  ) : quizzes.length > 0 ? (
                    <div className="space-y-5"> 
                      {quizzes.slice(0, displayedQuizzesCount).map((quiz) => (
                        <div key={quiz.id} className={styles.listItem}>
                           <div className={styles.listItemContent}>
                                <h3 className={styles.listItemTitle}><FaQuestionCircle className="text-[color:var(--primary-dark)] flex-shrink-0"/>{quiz.title}</h3>
                                <p className={styles.listItemDescription}> {stripHTML(quiz.question) || "No question preview."} </p>
                          </div>
                            <Link href={quizPermalinkToUrl(quiz.permalink)} className={`${styles.cardButton} ${styles.listItemButton}`}>
                            View Quiz
                            </Link>
                        </div>
                      ))}
                    </div>
                  ) : ( !quizzesLoading && !quizzesError && <p className="text-center py-10 text-slate-500">You haven&apos;t attempted any quizzes yet.</p> )}
                  {isQuizzesLoadingMore && <div className={`${styles.loadingState} mt-4`}>Loading</div>}
                  {!isQuizzesLoadingMore && displayedQuizzesCount < totalQuizzes && (
                    <div className={styles.loadMoreButtonContainer}>
                        <button 
                            onClick={() => handleLoadMore(displayedQuizzesCount, setDisplayedQuizzesCount, totalQuizzes, ITEMS_PER_LOAD, setIsQuizzesLoadingMore, isQuizzesLoadingMore)} 
                            className={styles.loadMoreButton}
                            disabled={isQuizzesLoadingMore}
                        >
                           {isQuizzesLoadingMore ? 'Loading' : 'Load More'} <FaChevronDown />
                        </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Profile;
