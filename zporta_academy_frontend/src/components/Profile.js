import React, { useEffect, useState, useRef, useContext, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import { FaEdit, FaChevronDown, FaSpinner, FaBookOpen, FaQuestionCircle, FaChalkboardTeacher, FaUserGraduate, FaCamera } from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api";
import styles from './Profile.module.css'; // Ensure this file is in the same directory

const ITEMS_PER_LOAD = 6;

// Zporta Academy Brand Colors
const zportaMainColor = '#222E3A'; // Dark Blue/Slate
const zportaSecondaryColor = '#FFC107'; // Vibrant Yellow/Gold

const Profile = () => {
  const { user, token, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  // --- Profile State ---
  const [profile, setProfile] = useState(user || null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [error, setError] = useState("");

  // --- Image Upload State ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const fileInputRef = useRef(null);

  // --- Email Edit State ---
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState("");

  // --- Password Change State ---
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState({ text: "", type: "error" });

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState("courses");

  // --- Data Fetching & "Load More" State ---
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [displayedCoursesCount, setDisplayedCoursesCount] = useState(ITEMS_PER_LOAD);
  const [totalCourses, setTotalCourses] = useState(0);
  const [coursesError, setCoursesError] = useState("");

  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [displayedLessonsCount, setDisplayedLessonsCount] = useState(ITEMS_PER_LOAD);
  const [totalLessons, setTotalLessons] = useState(0);
  const [lessonsError, setLessonsError] = useState("");

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [displayedQuizzesCount, setDisplayedQuizzesCount] = useState(ITEMS_PER_LOAD);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [quizzesError, setQuizzesError] = useState("");

  const stripHTML = (html) => {
    if (!html) return "";
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = html;
    return tempDiv.textContent || tempDiv.innerText || "";
  };

  const fetchProfile = useCallback(async () => {
    setIsLoadingProfile(true);
    setError("");
    try {
      const response = await apiClient.get('/users/profile/');
      setProfile(response.data);
      setNewEmail(response.data.email);
    } catch (err) {
      console.error("Fetch profile error:", err.response ? err.response.data : err.message);
      setError(err.response?.data?.detail || "Failed to fetch profile. Please try again.");
      if (err.response?.status === 401) logout();
    } finally {
      setIsLoadingProfile(false);
    }
  }, [logout]);

  const fetchDataForTab = useCallback(async (endpoint, setData, setLoading, setTotalCount, dataKey, setTabError) => {
    setLoading(true);
    setTabError("");
    try {
      const response = await apiClient.get(endpoint);
      const sortedData = response.data.sort((a, b) => {
        const dateA = new Date(a.created_at || a.updated_at || 0);
        const dateB = new Date(b.created_at || b.updated_at || 0);
        return dateB - dateA;
      });
      setData(sortedData);
      setTotalCount(sortedData.length);
    } catch (err) {
      console.error(`Error fetching ${dataKey}:`, err.response ? err.response.data : err.message);
      setTabError(`Failed to load your ${dataKey}. Please try again.`);
      if (err.response?.status === 401) logout();
    } finally {
      setLoading(false);
    }
  }, [logout]);

  const fetchUserCourses = useCallback(() => fetchDataForTab('/courses/my/', setCourses, setCoursesLoading, setTotalCourses, 'courses', setCoursesError), [fetchDataForTab]);
  const fetchUserLessons = useCallback(() => fetchDataForTab('/lessons/my/', setLessons, setLessonsLoading, setTotalLessons, 'lessons', setLessonsError), [fetchDataForTab]);
  const fetchUserQuizzes = useCallback(() => fetchDataForTab('/quizzes/my/', setQuizzes, setQuizzesLoading, setTotalQuizzes, 'quizzes', setQuizzesError), [fetchDataForTab]);

  useEffect(() => {
    if (!token) {
      navigate("/login");
    } else {
      fetchProfile();
    }
  }, [token, navigate, fetchProfile]);

  useEffect(() => {
    if (profile) {
      setDisplayedCoursesCount(ITEMS_PER_LOAD);
      setCoursesError("");
      setDisplayedLessonsCount(ITEMS_PER_LOAD);
      setLessonsError("");
      setDisplayedQuizzesCount(ITEMS_PER_LOAD);
      setQuizzesError("");
      setError("");

      if (activeTab === "courses") fetchUserCourses();
      if (activeTab === "lessons") fetchUserLessons();
      if (activeTab === "quizzes") fetchUserQuizzes();
    }
  }, [activeTab, profile, fetchUserCourses, fetchUserLessons, fetchUserQuizzes]);

  const handleProfileImageClick = () => {
    if (fileInputRef.current) fileInputRef.current.click();
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        setError("Please select an image file (e.g., JPG, PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file size should not exceed 5MB.");
        return;
      }
      setError('');
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadImage = async () => {
    if (!selectedFile) {
      setError("No file selected for upload.");
      return;
    }
    setError('');
    const formData = new FormData();
    formData.append("profile_image", selectedFile);
    try {
      await apiClient.put('/users/profile/', formData);
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchProfile();
    } catch (err) {
      console.error("Error uploading profile image:", err.response ? err.response.data : err.message);
      setError(err.response?.data?.profile_image?.[0] || err.response?.data?.detail || "Failed to update profile image.");
      if (err.response?.status === 401) logout();
    }
  };

  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError('');
  };

  const handleEmailEditToggle = () => {
    setEditingEmail(!editingEmail);
    setNewEmail(profile?.email || '');
    setEmailError('');
    setError('');
  };

  const handleEmailSave = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
        setEmailError("Please enter a valid email address.");
        return;
    }
    setEmailError('');
    try {
      await apiClient.put('/users/profile/', { email: newEmail });
      setEditingEmail(false);
      fetchProfile();
    } catch (err) {
      console.error("Error updating email:", err.response ? err.response.data : err.message);
      setEmailError(err.response?.data?.email?.[0] || err.response?.data?.detail || "Failed to update email.");
      if (err.response?.status === 401) logout();
    }
  };

  const toggleChangePasswordForm = () => {
    setShowChangePassword(!showChangePassword);
    setChangePasswordMessage({ text: "", type: "error" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordMessage({ text: "", type: "error" });
    if (newPassword !== confirmNewPassword) {
      setChangePasswordMessage({ text: "New passwords do not match.", type: "error" });
      return;
    }
    if (newPassword.length < 8) {
        setChangePasswordMessage({ text: "New password must be at least 8 characters long.", type: "error" });
        return;
    }
    try {
      await apiClient.post('/users/change-password/', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      setChangePasswordMessage({ text: "Password changed successfully!", type: "success" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setShowChangePassword(false);
        setChangePasswordMessage({ text: "", type: "error" });
      }, 2000);
    } catch (err) {
      console.error("Change password error:", err.response ? err.response.data : err.message);
      const backendError = err.response?.data?.error || err.response?.data?.detail || (err.response?.data?.non_field_errors ? err.response.data.non_field_errors.join(' ') : null) || (err.response?.data?.new_password ? `New Password: ${err.response.data.new_password.join(' ')}` : null) || (err.response?.data?.current_password ? `Current Password: ${err.response.data.current_password.join(' ')}` : null) || "Failed to change password.";
      setChangePasswordMessage({ text: backendError, type: "error" });
      if (err.response?.status === 401) logout();
    }
  };

  if (isLoadingProfile && !profile) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-slate-100">
        <FaSpinner className={`animate-spin text-4xl text-[${zportaMainColor}]`} />
        <p className="ml-3 text-lg text-slate-700">Loading Profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto p-4 sm:p-6 lg:p-8 text-center min-h-screen bg-slate-100">
        <p className="text-red-600 text-xl bg-red-100 p-4 rounded-lg shadow-md">
          {error || "Could not load profile data. Please try logging in again."}
        </p>
        <button onClick={() => navigate('/login')} 
                style={{ backgroundColor: zportaMainColor }}
                className={`mt-6 hover:opacity-90 text-white font-semibold py-2 px-6 rounded-lg shadow-md transition duration-150 ease-in-out`}>
            Go to Login
        </button>
      </div>
    );
  }
  
  const handleLoadMore = (currentDisplayedCount, setDisplayedCount, totalItems) => {
    if (currentDisplayedCount < totalItems) {
      setDisplayedCount(Math.min(currentDisplayedCount + ITEMS_PER_LOAD, totalItems));
    }
  };

  const renderLoadMoreButton = (displayedCount, setDisplayedCount, totalItems, isLoadingMore) => {
    if (isLoadingMore && displayedCount > 0 && displayedCount < totalItems) { 
        return ( <div className="flex justify-center mt-8"> <FaSpinner className={`animate-spin text-3xl text-[${zportaMainColor}]`} /> </div> );
    }
    if (displayedCount < totalItems) {
      return (
        <div className="text-center mt-8">
          <button onClick={() => handleLoadMore(displayedCount, setDisplayedCount, totalItems)} disabled={isLoadingMore} 
                  style={{ backgroundColor: zportaMainColor }}
                  className={`hover:opacity-90 disabled:bg-opacity-70 text-white font-semibold py-2.5 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-150 ease-in-out flex items-center justify-center mx-auto`}>
            Load More <FaChevronDown className="ml-2" />
          </button>
        </div>
      );
    }
    return null;
  };

  const sidebarActionError = error || emailError || (changePasswordMessage.text && changePasswordMessage.type === 'error' ? changePasswordMessage.text : '');

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans p-4 sm:p-6 lg:p-8">
      <div className="container mx-auto max-w-7xl">
        
        {sidebarActionError && (previewUrl || selectedFile || editingEmail || showChangePassword) && (
            <div className="mb-6 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg shadow-sm text-sm">
                <p>{sidebarActionError}</p>
            </div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="w-full lg:w-1/3 xl:w-1/4 bg-white p-6 rounded-2xl shadow-xl border border-slate-200">
            <div className="text-center">
              <div className={`relative w-40 h-40 mx-auto mb-6 group ${styles.hexagonContainer}`}>
                <img
                  src={previewUrl || profile.profile_image_url?.trim() || `https://placehold.co/160x160/${zportaSecondaryColor.substring(1)}/${zportaMainColor.substring(1)}?text=${profile.username[0].toUpperCase()}`}
                  onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/160x160/D1D5DB/4B5563?text=Error"; }}
                  alt={profile.username || "User"}
                  style={{ borderColor: zportaSecondaryColor }}
                  className={`w-full h-full object-cover ${styles.hexagonImage} border-4 transition-transform duration-300 group-hover:scale-105`}
                />
                <button onClick={handleProfileImageClick} title="Change profile picture" 
                  style={{ backgroundColor: zportaMainColor }}
                  className={`absolute bottom-2 right-2 hover:opacity-90 text-white p-3 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-300 focus:opacity-100 focus:ring-2 focus:ring-offset-2 focus:ring-offset-white focus:ring-[${zportaSecondaryColor}]`}>
                  <FaCamera size={16}/>
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange}/>
              </div>

              {previewUrl && (
                <div className="flex justify-center gap-3 mb-6">
                  <button onClick={handleUploadImage} className="bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"> Upload </button>
                  <button onClick={handleCancelUpload} className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-md transition duration-150"> Cancel </button>
                </div>
              )}
              
              <h1 className="text-3xl font-bold text-slate-800 mb-1.5">{profile.username}</h1>
              <p className="text-sm text-slate-500 mb-6"> Joined: {new Date(profile.date_joined).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })} </p>

              <div className="mt-5 text-left space-y-5">
                <div className="pb-4 border-b border-slate-200">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-slate-700 font-semibold text-sm">Email:</span>
                        {!editingEmail && (
                            <button onClick={handleEmailEditToggle} title={"Edit Email"} style={{ color: zportaMainColor }} className={`ml-2 hover:opacity-80 flex-shrink-0 p-1 rounded-md hover:bg-slate-100`}> <FaEdit size={16} /> </button>
                        )}
                    </div>
                    {editingEmail ? (
                        <div className="mt-1.5">
                            <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="w-full bg-slate-50 text-slate-800 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:border-slate-300 outline-none text-sm" style={{borderColor: editingEmail ? zportaMainColor : 'default', ringColor: zportaMainColor}}/>
                             <div className="mt-3 flex justify-end gap-2.5">
                                <button onClick={handleEmailSave} className="bg-green-500 hover:bg-green-600 text-white text-xs font-semibold py-2 px-4 rounded-md shadow-sm">Save</button>
                                <button onClick={handleEmailEditToggle} className="bg-slate-500 hover:bg-slate-600 text-white text-xs font-semibold py-2 px-4 rounded-md shadow-sm">Cancel</button>
                            </div>
                        </div>
                    ) : ( <span className="text-slate-700 text-sm mt-0.5 block truncate" title={profile.email}>{profile.email}</span> )}
                     {emailError && editingEmail && <p className="text-red-600 text-xs mt-2 bg-red-50 p-2 rounded-md">{emailError}</p>}
                </div>
               
                <div className="pb-4 border-b border-slate-200">
                    <span className="text-slate-700 font-semibold text-sm">Bio:</span>
                    <p className="text-slate-700 text-sm mt-1 break-words">{profile.bio || "No bio provided."}</p>
                </div>
              </div>

              <Link to={`/guide/${profile.username}`} style={{ backgroundColor: zportaMainColor }} className={`mt-8 block w-full hover:opacity-90 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 ease-in-out text-center`}> View Public Profile </Link>
              <button onClick={toggleChangePasswordForm} style={{ backgroundColor: zportaSecondaryColor }} className={`mt-3 block w-full hover:opacity-90 text-[${zportaMainColor}] font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 ease-in-out`}>
                {showChangePassword ? 'Cancel Password Change' : 'Change Password'}
              </button>

              {showChangePassword && (
                <form onSubmit={handleChangePassword} className="mt-5 p-5 bg-slate-50 rounded-xl space-y-4 text-left border border-slate-200 shadow-inner">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="currentPasswordProf">Current Password</label>
                    <input type="password" id="currentPasswordProf" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required autoComplete="current-password" className="w-full bg-white text-slate-800 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:border-slate-300 outline-none" style={{borderColor: showChangePassword ? zportaMainColor : 'default', ringColor: zportaMainColor}}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="newPasswordProf">New Password</label>
                    <input type="password" id="newPasswordProf" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required autoComplete="new-password" className="w-full bg-white text-slate-800 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:border-slate-300 outline-none" style={{borderColor: showChangePassword ? zportaMainColor : 'default', ringColor: zportaMainColor}}/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5" htmlFor="confirmNewPasswordProf">Confirm New Password</label>
                    <input type="password" id="confirmNewPasswordProf" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required autoComplete="new-password" className="w-full bg-white text-slate-800 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:border-slate-300 outline-none" style={{borderColor: showChangePassword ? zportaMainColor : 'default', ringColor: zportaMainColor}}/>
                  </div>
                  {changePasswordMessage.text && ( <p className={`text-sm p-3 rounded-lg ${changePasswordMessage.type === 'success' ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-red-100 text-red-700 border border-red-200'}`}> {changePasswordMessage.text} </p> )}
                  <button type="submit" className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md transition duration-150"> Update Password </button>
                </form>
              )}
            </div>
            <button onClick={logout} className="mt-8 w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-150 ease-in-out"> Logout </button>
          </aside>

          <main className="w-full lg:w-2/3 xl:w-3/4 bg-white p-6 sm:p-8 rounded-2xl shadow-xl border border-slate-200">
            <div className="mb-8 border-b border-slate-200">
              <nav className="flex flex-wrap -mb-px sm:space-x-2 md:space-x-3 lg:space-x-5" aria-label="Tabs">
                {["courses", "lessons", "quizzes"].map((tab) => (
                  <button key={tab} onClick={() => { setActiveTab(tab); }}
                    className={`whitespace-nowrap pb-3.5 pt-1.5 px-3 sm:px-4 md:px-5 border-b-2 font-semibold text-sm sm:text-base transition-colors duration-200
                      ${activeTab === tab ? `border-[${zportaMainColor}] text-[${zportaMainColor}]` : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'}`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            <div className="mt-5">
              {activeTab === "courses" && coursesError && <div className="mb-5 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">{coursesError}</div>}
              {activeTab === "lessons" && lessonsError && <div className="mb-5 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">{lessonsError}</div>}
              {activeTab === "quizzes" && quizzesError && <div className="mb-5 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">{quizzesError}</div>}
              
              {activeTab === "courses" && (
                <div>
                  <h2 className="text-2xl xl:text-3xl font-bold text-slate-800 mb-7">Your Enrolled Courses</h2>
                  {coursesLoading && courses.length === 0 ? ( <div className="flex justify-center items-center h-52"><FaSpinner className={`animate-spin text-4xl text-[${zportaMainColor}]`} /></div>
                  ) : courses.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
                      {courses.slice(0, displayedCoursesCount).map((course) => (
                        <div key={course.id} className="bg-slate-50 rounded-xl shadow-lg overflow-hidden transform hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col group border border-slate-200">
                          <div className="w-full h-48 sm:h-52 overflow-hidden bg-slate-200">
                            {course.cover_image ? ( <img src={course.cover_image} alt={course.title || "Course Image"} onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/600x400/E2E8F0/${zportaMainColor.substring(1)}?text=Course`; }} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                            ) : ( <div className="w-full h-full flex items-center justify-center text-slate-400"> <FaChalkboardTeacher size={60} /> </div> )}
                          </div>
                          <div className="p-5 flex flex-col flex-grow">
                            <h3 className={`text-xl font-semibold text-[${zportaMainColor}] mb-2 truncate`} title={course.title}>{course.title}</h3>
                            <p className={`text-slate-600 text-sm mb-5 flex-grow ${styles.clampLines3}`}> {stripHTML(course.description) || "No description available."} </p>
                            <button onClick={() => navigate(`/courses/${course.permalink}`)} style={{ backgroundColor: zportaMainColor }} className={`mt-auto w-full hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition duration-150 text-sm`}> View Course </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( !coursesLoading && !coursesError && <p className="text-slate-500 text-center py-12 text-lg">You haven't enrolled in any courses yet.</p> )}
                  {renderLoadMoreButton(displayedCoursesCount, setDisplayedCoursesCount, totalCourses, coursesLoading)}
                </div>
              )}

              {activeTab === "lessons" && (
                <div>
                  <h2 className="text-2xl xl:text-3xl font-bold text-slate-800 mb-7">Your Accessed Lessons</h2>
                   {lessonsLoading && lessons.length === 0 ? ( <div className="flex justify-center items-center h-52"><FaSpinner className={`animate-spin text-4xl text-[${zportaMainColor}]`} /></div>
                  ) : lessons.length > 0 ? (
                     <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-7">
                      {lessons.slice(0, displayedLessonsCount).map((lesson) => (
                        <div key={lesson.id} className="bg-slate-50 rounded-xl shadow-lg overflow-hidden transform hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 flex flex-col group border border-slate-200">
                           <div className="w-full h-48 sm:h-52 overflow-hidden bg-slate-200 flex items-center justify-center text-slate-400"> <FaBookOpen size={60} /> </div>
                          <div className="p-5 flex flex-col flex-grow">
                            <h3 className={`text-xl font-semibold text-[${zportaMainColor}] mb-2 truncate`} title={lesson.title}>{lesson.title}</h3>
                            <div className="text-slate-600 text-sm mb-5 flex-grow prose prose-sm max-w-none overflow-y-auto h-32 sm:h-28">
                                <div dangerouslySetInnerHTML={{ __html: lesson.content || "No content available." }} />
                            </div>
                            <button onClick={() => navigate(`/lessons/${lesson.permalink}`)} style={{ backgroundColor: zportaMainColor }} className={`mt-auto w-full hover:opacity-90 text-white font-semibold py-2.5 px-4 rounded-lg shadow-md transition duration-150 text-sm`}> Read Full Lesson </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : ( !lessonsLoading && !lessonsError && <p className="text-slate-500 text-center py-12 text-lg">You haven't accessed any lessons yet.</p> )}
                  {renderLoadMoreButton(displayedLessonsCount, setDisplayedLessonsCount, totalLessons, lessonsLoading)}
                </div>
              )}

              {activeTab === "quizzes" && (
                <div>
                  <h2 className="text-2xl xl:text-3xl font-bold text-slate-800 mb-7">Your Attempted Quizzes</h2>
                  {quizzesLoading && quizzes.length === 0 ? ( <div className="flex justify-center items-center h-52"><FaSpinner className={`animate-spin text-4xl text-[${zportaMainColor}]`} /></div>
                  ) : quizzes.length > 0 ? (
                    <ul className="space-y-6">
                      {quizzes.slice(0, displayedQuizzesCount).map((quiz) => (
                        <li key={quiz.id} className="bg-slate-50 p-6 rounded-xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-5 border border-slate-200 hover:shadow-xl transition-shadow duration-300">
                           <div className="flex-grow min-w-0">
                            <div className="flex items-center mb-1.5">
                                <FaQuestionCircle className={`text-[${zportaMainColor}] mr-2.5 flex-shrink-0`} size={20}/>
                                <h3 className={`text-xl font-semibold text-[${zportaMainColor}] truncate`} title={quiz.title}>{quiz.title}</h3>
                            </div>
                            <p className={`text-slate-600 text-sm ${styles.clampLines2}`}> {stripHTML(quiz.question) || "No question preview."} </p>
                          </div>
                          <Link to={`/quizzes/${quiz.permalink}`} style={{ backgroundColor: zportaMainColor }} className={`mt-4 sm:mt-0 flex-shrink-0 hover:opacity-90 text-white font-semibold py-2.5 px-6 rounded-lg shadow-md transition duration-150 text-sm text-center`}> View Quiz </Link>
                        </li>
                      ))}
                    </ul>
                  ) : ( !quizzesLoading && !quizzesError && <p className="text-slate-500 text-center py-12 text-lg">You haven't attempted any quizzes yet.</p> )}
                  {renderLoadMoreButton(displayedQuizzesCount, setDisplayedQuizzesCount, totalQuizzes, quizzesLoading)}
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
