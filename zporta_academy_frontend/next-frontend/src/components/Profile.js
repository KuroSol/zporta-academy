import React, {
  useEffect,
  useState,
  useRef,
  useContext,
  useCallback,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { quizPermalinkToUrl } from "@/utils/urls";
import {
  FaEdit,
  FaChevronDown,
  FaSpinner,
  FaBookOpen,
  FaQuestionCircle,
  FaChalkboardTeacher,
  FaCamera,
  FaBookReader,
  FaAward,
  FaEnvelope,
  FaCog,
  FaShieldAlt,
  FaBell,
  FaTrash,
  FaEye,
  FaEyeSlash,
  FaUserCheck,
} from "react-icons/fa";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";
import BioRenderer from "@/components/BioRenderer";
import styles from "@/styles/Profile.module.css";
import teacherStyles from "@/styles/TeacherDashboard.module.css";

const ITEMS_PER_LOAD = 6; // Items to load per scroll/click for each section

// Simple throttle function (same as public profile)
const throttle = (func, limit) => {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
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

  // --- Bio Edit State (for students) ---
  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState("");
  const [bioError, setBioError] = useState("");

  // --- Password Change State ---
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changePasswordMessage, setChangePasswordMessage] = useState({
    text: "",
    type: "error",
  });

  // --- Active Tab State ---
  const [activeTab, setActiveTab] = useState("courses");

  // --- Account Settings State ---
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [mailMagazineEnabled, setMailMagazineEnabled] = useState(true);
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  const [deactivateReason, setDeactivateReason] = useState("");
  const [settingsSaving, setSettingsSaving] = useState(false);

  // --- Enrolled Teachers/Students Lists ---
  const [enrolledTeachers, setEnrolledTeachers] = useState([]);
  const [myStudents, setMyStudents] = useState([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Check if user is teacher or admin
  const isTeacherOrAdmin =
    profile?.role === "guide" || profile?.is_staff === true;

  // --- Teacher Settings State ---
  const [teacherBio, setTeacherBio] = useState("");
  const [teacherWebsite, setTeacherWebsite] = useState("");
  const [teacherLinkedin, setTeacherLinkedin] = useState("");
  const [teacherTwitter, setTeacherTwitter] = useState("");
  const [teacherSpecialization, setTeacherSpecialization] = useState("");
  const [teacherProfileError, setTeacherProfileError] = useState("");

  // --- Showcase Images State ---
  const [showcaseImage1, setShowcaseImage1] = useState(null);
  const [showcaseImage2, setShowcaseImage2] = useState(null);
  const [showcaseImage3, setShowcaseImage3] = useState(null);
  const [showcaseImageUploadProgress, setShowcaseImageUploadProgress] =
    useState({
      image1: false,
      image2: false,
      image3: false,
    });

  // --- Showcase Captions and Tags State ---
  const [showcaseCaption1, setShowcaseCaption1] = useState("");
  const [showcaseCaption2, setShowcaseCaption2] = useState("");
  const [showcaseCaption3, setShowcaseCaption3] = useState("");
  const [showcaseTags1, setShowcaseTags1] = useState([]);
  const [showcaseTags2, setShowcaseTags2] = useState([]);
  const [showcaseTags3, setShowcaseTags3] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  // Tag input state for autocomplete
  const [tagInput1, setTagInput1] = useState("");
  const [tagInput2, setTagInput2] = useState("");
  const [tagInput3, setTagInput3] = useState("");
  const [tagSuggestions1, setTagSuggestions1] = useState([]);
  const [tagSuggestions2, setTagSuggestions2] = useState([]);
  const [tagSuggestions3, setTagSuggestions3] = useState([]);
  const [showSuggestions1, setShowSuggestions1] = useState(false);
  const [showSuggestions2, setShowSuggestions2] = useState(false);
  const [showSuggestions3, setShowSuggestions3] = useState(false);

  // --- Invitation Management State ---
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);
  const [invitationEmail, setInvitationEmail] = useState("");
  const [invitationMessage, setInvitationMessage] = useState("");
  const [invitationError, setInvitationError] = useState("");
  const [invitationSuccess, setInvitationSuccess] = useState("");
  const [remainingInvitations, setRemainingInvitations] = useState(0);
  const [canInvite, setCanInvite] = useState(false);

  // --- Data & "Load More" State for each tab ---
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(true); // Initial fetch loading
  const [isCoursesLoadingMore, setIsCoursesLoadingMore] = useState(false); // Subsequent load more
  const [displayedCoursesCount, setDisplayedCoursesCount] =
    useState(ITEMS_PER_LOAD);
  const [totalCourses, setTotalCourses] = useState(0);
  const [coursesError, setCoursesError] = useState(""); // Error specific to courses tab

  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(true);
  const [isLessonsLoadingMore, setIsLessonsLoadingMore] = useState(false);
  const [displayedLessonsCount, setDisplayedLessonsCount] =
    useState(ITEMS_PER_LOAD);
  const [totalLessons, setTotalLessons] = useState(0);
  const [lessonsError, setLessonsError] = useState("");

  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(true);
  const [isQuizzesLoadingMore, setIsQuizzesLoadingMore] = useState(false);
  const [displayedQuizzesCount, setDisplayedQuizzesCount] =
    useState(ITEMS_PER_LOAD);
  const [totalQuizzes, setTotalQuizzes] = useState(0);
  const [quizzesError, setQuizzesError] = useState("");

  // --- Scores State ---
  const [scores, setScores] = useState({ learning_score: 0, impact_score: 0 }); // Initialize with 0
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
      const response = await apiClient.get("/users/profile/");
      setProfile(response.data);
      setNewEmail(response.data.email); // Initialize newEmail with current profile email
      setNewDisplayName(response.data.display_name || "");
      // Initialize teacher profile fields
      setTeacherBio(response.data.teacher_about || "");
      setTeacherSpecialization(response.data.teaching_specialties || "");
      setTeacherWebsite(response.data.website_url || "");
      setTeacherLinkedin(response.data.linkedin_url || "");
      setTeacherTwitter(response.data.twitter_url || "");
      // Initialize showcase images
      setShowcaseImage1(response.data.showcase_image_1_url || null);
      setShowcaseImage2(response.data.showcase_image_2_url || null);
      setShowcaseImage3(response.data.showcase_image_3_url || null);
      // Initialize showcase captions and tags
      setShowcaseCaption1(response.data.showcase_image_1_caption || "");
      setShowcaseCaption2(response.data.showcase_image_2_caption || "");
      setShowcaseCaption3(response.data.showcase_image_3_caption || "");
      setShowcaseTags1(response.data.showcase_image_1_tags || []);
      setShowcaseTags2(response.data.showcase_image_2_tags || []);
      setShowcaseTags3(response.data.showcase_image_3_tags || []);
    } catch (err) {
      console.error(
        "Fetch profile error:",
        err.response ? err.response.data : err.message
      );
      setError(
        err.response?.data?.detail ||
          "Failed to fetch profile. Please try again."
      );
      if (err.response?.status === 401) logout();
    } finally {
      setIsLoadingProfile(false);
    }
  }, [logout]);

  // Generic function to fetch data for tabs (courses, lessons, quizzes)
  const fetchDataForTab = useCallback(
    async (
      endpoint,
      setData,
      setInitialLoading,
      setTotalCount,
      dataKey,
      setTabError
    ) => {
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
        console.error(
          `Error fetching ${dataKey}:`,
          err.response ? err.response.data : err.message
        );
        setTabError(`Failed to load your ${dataKey}. Please try again.`);
        if (err.response?.status === 401) logout();
      } finally {
        setInitialLoading(false);
      }
    },
    [logout]
  );

  // Specific fetch functions for each tab
  const fetchUserCourses = useCallback(
    () =>
      fetchDataForTab(
        "/courses/my/",
        setCourses,
        setCoursesLoading,
        setTotalCourses,
        "courses",
        setCoursesError
      ),
    [fetchDataForTab]
  );
  const fetchUserLessons = useCallback(
    () =>
      fetchDataForTab(
        "/lessons/my/",
        setLessons,
        setLessonsLoading,
        setTotalLessons,
        "lessons",
        setLessonsError
      ),
    [fetchDataForTab]
  );
  const fetchUserQuizzes = useCallback(
    () =>
      fetchDataForTab(
        "/quizzes/my/",
        setQuizzes,
        setQuizzesLoading,
        setTotalQuizzes,
        "quizzes",
        setQuizzesError
      ),
    [fetchDataForTab]
  );

  // Fetch user scores
  const fetchUserScores = useCallback(async () => {
    setScoresLoading(true);
    setScoresError(null);
    try {
      const { data } = await apiClient.get("/users/score/");
      setScores({
        learning_score: data.learning_score !== null ? data.learning_score : 0, // Default to 0 if null
        impact_score: data.impact_score !== null ? data.impact_score : 0, // Default to 0 if null
      });
    } catch (err) {
      console.error("Error loading scores:", err);
      setScoresError(err.response?.data?.detail || "Could not load scores.");
      setScores({ learning_score: 0, impact_score: 0 }); // Default to 0 on error
      if (err.response?.status === 401) logout();
    } finally {
      setScoresLoading(false);
    }
  }, [logout]);

  // Fetch available tags for showcase images
  const fetchAvailableTags = useCallback(async () => {
    setTagsLoading(true);
    try {
      const { data } = await apiClient.get("/tags/?page_size=1000");
      setAvailableTags(data.results || data || []);
    } catch (err) {
      console.error("Error loading tags:", err);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  // Search tags by query
  const searchTags = async (query) => {
    if (!query.trim()) return [];
    try {
      const { data } = await apiClient.get(
        `/tags/?search=${encodeURIComponent(query)}&page_size=10`
      );
      return data.results || data || [];
    } catch (err) {
      console.error("Error searching tags:", err);
      return [];
    }
  };

  // Create new tag
  const createTag = async (tagName) => {
    try {
      const { data } = await apiClient.post("/tags/", { name: tagName });
      setAvailableTags((prev) => [...prev, data]);
      return data;
    } catch (err) {
      console.error("Error creating tag:", err);
      return null;
    }
  };

  // Handle tag input change with autocomplete
  const handleTagInputChange = async (imageNumber, value) => {
    if (imageNumber === 1) {
      setTagInput1(value);
      if (value.trim()) {
        const suggestions = await searchTags(value);
        setTagSuggestions1(suggestions);
        setShowSuggestions1(true);
      } else {
        setShowSuggestions1(false);
      }
    } else if (imageNumber === 2) {
      setTagInput2(value);
      if (value.trim()) {
        const suggestions = await searchTags(value);
        setTagSuggestions2(suggestions);
        setShowSuggestions2(true);
      } else {
        setShowSuggestions2(false);
      }
    } else if (imageNumber === 3) {
      setTagInput3(value);
      if (value.trim()) {
        const suggestions = await searchTags(value);
        setTagSuggestions3(suggestions);
        setShowSuggestions3(true);
      } else {
        setShowSuggestions3(false);
      }
    }
  };

  // Add tag to showcase image
  const handleAddTag = async (imageNumber, tagName) => {
    const trimmedName = tagName.trim();
    if (!trimmedName) return;

    // Find existing tag or create new one
    let tag = availableTags.find(
      (t) => t.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (!tag) {
      tag = await createTag(trimmedName);
      if (!tag) return;
    }

    // Add tag to the appropriate showcase image
    let currentTags, setTags;
    if (imageNumber === 1) {
      currentTags = showcaseTags1;
      setTags = setShowcaseTags1;
      setTagInput1("");
      setShowSuggestions1(false);
    } else if (imageNumber === 2) {
      currentTags = showcaseTags2;
      setTags = setShowcaseTags2;
      setTagInput2("");
      setShowSuggestions2(false);
    } else if (imageNumber === 3) {
      currentTags = showcaseTags3;
      setTags = setShowcaseTags3;
      setTagInput3("");
      setShowSuggestions3(false);
    }

    // Check if tag already added
    if (currentTags.includes(tag.id)) {
      return;
    }

    const newTags = [...currentTags, tag.id];
    setTags(newTags);
    await handleSaveShowcaseTags(imageNumber, newTags);
  };

  // Remove tag from showcase image
  const handleRemoveTag = async (imageNumber, tagId) => {
    let currentTags, setTags;
    if (imageNumber === 1) {
      currentTags = showcaseTags1;
      setTags = setShowcaseTags1;
    } else if (imageNumber === 2) {
      currentTags = showcaseTags2;
      setTags = setShowcaseTags2;
    } else if (imageNumber === 3) {
      currentTags = showcaseTags3;
      setTags = setShowcaseTags3;
    }

    const newTags = currentTags.filter((id) => id !== tagId);
    setTags(newTags);
    await handleSaveShowcaseTags(imageNumber, newTags);
  };

  // Initial data fetch on component mount (profile and scores)
  useEffect(() => {
    if (!token) {
      router.push("/login");
    } else {
      fetchProfileCallback();
      fetchUserScores();
      fetchAvailableTags();
    }
  }, [
    token,
    router,
    fetchProfileCallback,
    fetchUserScores,
    fetchAvailableTags,
  ]);

  // Fetch data for the active tab when it changes or when profile is loaded
  useEffect(() => {
    if (profile) {
      // Load teacher-specific data - Use correct backend field names
      if (isTeacherOrAdmin) {
        console.log("Loading teacher profile data:", {
          teacher_about: profile.teacher_about,
          teaching_specialties: profile.teaching_specialties,
          website_url: profile.website_url,
          linkedin_url: profile.linkedin_url,
          twitter_url: profile.twitter_url,
        });
        setTeacherBio(profile.teacher_about || "");
        setTeacherWebsite(profile.website_url || "");
        setTeacherLinkedin(profile.linkedin_url || "");
        setTeacherTwitter(profile.twitter_url || "");
        setTeacherSpecialization(profile.teaching_specialties || "");
      }

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
      else if (activeTab === "settings") {
        fetchEnrolledTeachers();
        if (isTeacherOrAdmin) {
          fetchMyStudents();
        }
      }
    }
  }, [
    activeTab,
    profile,
    fetchUserCourses,
    fetchUserLessons,
    fetchUserQuizzes,
    isTeacherOrAdmin,
  ]);

  // Fetch invitations when teacher tab is active
  useEffect(() => {
    if (activeTab === "teacher" && isTeacherOrAdmin) {
      // Call API directly to avoid circular dependency with useCallback
      const loadInvitations = async () => {
        setInvitationsLoading(true);
        try {
          const { data } = await apiClient.get("/users/invitations/");
          setInvitations(data.invitations || []);
          setRemainingInvitations(data.remaining_this_month || 0);
          setCanInvite(data.can_invite || false);
        } catch (err) {
          console.error("Failed to fetch invitations:", err);
        } finally {
          setInvitationsLoading(false);
        }
      };
      loadInvitations();
    }
  }, [activeTab, isTeacherOrAdmin]);

  // Generic "load more" handler for infinite scroll
  const handleLoadMore = useCallback(
    (
      currentDisplayedCount,
      setDisplayedCount,
      totalItems,
      itemsPerLoad,
      setIsLoadingMoreFlag,
      isLoadingMoreFlag
    ) => {
      if (isLoadingMoreFlag || currentDisplayedCount >= totalItems) return; // Prevent multiple calls or loading beyond total

      setIsLoadingMoreFlag(true);
      // Simulate network delay for loader visibility, then update count
      setTimeout(() => {
        setDisplayedCount((prev) => Math.min(prev + itemsPerLoad, totalItems));
        setIsLoadingMoreFlag(false);
      }, 500); // 500ms delay
    },
    []
  );

  // Infinite Scroll Logic
  useEffect(() => {
    const onScroll = () => {
      // Trigger load more if near bottom (e.g., 300px buffer) and not already loading
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 300
      ) {
        if (
          activeTab === "courses" &&
          !coursesLoading &&
          !isCoursesLoadingMore &&
          displayedCoursesCount < totalCourses
        ) {
          handleLoadMore(
            displayedCoursesCount,
            setDisplayedCoursesCount,
            totalCourses,
            ITEMS_PER_LOAD,
            setIsCoursesLoadingMore,
            isCoursesLoadingMore
          );
        } else if (
          activeTab === "lessons" &&
          !lessonsLoading &&
          !isLessonsLoadingMore &&
          displayedLessonsCount < totalLessons
        ) {
          handleLoadMore(
            displayedLessonsCount,
            setDisplayedLessonsCount,
            totalLessons,
            ITEMS_PER_LOAD,
            setIsLessonsLoadingMore,
            isLessonsLoadingMore
          );
        } else if (
          activeTab === "quizzes" &&
          !quizzesLoading &&
          !isQuizzesLoadingMore &&
          displayedQuizzesCount < totalQuizzes
        ) {
          handleLoadMore(
            displayedQuizzesCount,
            setDisplayedQuizzesCount,
            totalQuizzes,
            ITEMS_PER_LOAD,
            setIsQuizzesLoadingMore,
            isQuizzesLoadingMore
          );
        }
      }
    };
    const throttledScrollHandler = throttle(onScroll, 200); // Throttle scroll handler
    window.addEventListener("scroll", throttledScrollHandler);
    return () => window.removeEventListener("scroll", throttledScrollHandler); // Cleanup
  }, [
    activeTab,
    coursesLoading,
    lessonsLoading,
    quizzesLoading,
    isCoursesLoadingMore,
    isLessonsLoadingMore,
    isQuizzesLoadingMore,
    displayedCoursesCount,
    displayedLessonsCount,
    displayedQuizzesCount,
    totalCourses,
    totalLessons,
    totalQuizzes,
    handleLoadMore, // Ensure handleLoadMore is stable or included if it changes
  ]);

  // --- Event Handlers for Profile Actions ---
  const handleProfileImageClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setError("Please select an image file (e.g., JPG, PNG).");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError("Image file size should not exceed 5MB.");
        return;
      }
      setError("");
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleUploadImage = async () => {
    if (!selectedFile) {
      setError("No file selected for upload.");
      return;
    }
    setError(""); // Clear previous general errors
    const formData = new FormData();
    formData.append("profile_image", selectedFile);
    try {
      await apiClient.put("/users/profile/", formData);
      setSelectedFile(null);
      setPreviewUrl(null);
      fetchProfileCallback(); // Refetch profile to show new image
    } catch (err) {
      setError(
        err.response?.data?.profile_image?.[0] ||
          err.response?.data?.detail ||
          "Failed to update profile image."
      );
      if (err.response?.status === 401) logout();
    }
  };
  const handleCancelUpload = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError("");
  };

  // --- Teacher Profile Handlers ---
  const handleSaveTeacherProfile = async () => {
    console.log("Auto-saving teacher profile...", {
      teacher_about: teacherBio,
      website_url: teacherWebsite,
      linkedin_url: teacherLinkedin,
      twitter_url: teacherTwitter,
      teaching_specialties: teacherSpecialization,
    });

    setTeacherProfileError("");
    try {
      const response = await apiClient.put("/users/profile/", {
        teacher_about: teacherBio,
        website_url: teacherWebsite,
        linkedin_url: teacherLinkedin,
        twitter_url: teacherTwitter,
        teaching_specialties: teacherSpecialization,
      });
      console.log("Teacher profile saved successfully:", response.data);
      // Optionally refresh profile to get updated data
      // fetchProfileCallback();
      setError("");
    } catch (err) {
      console.error("Failed to save teacher profile:", err);
      setTeacherProfileError(
        err.response?.data?.detail || "Failed to update teacher profile."
      );
    }
  };

  const handleShowcaseImageUpload = async (imageNumber, file) => {
    if (!file) return;

    const progressKey = `image${imageNumber}`;
    setShowcaseImageUploadProgress((prev) => ({
      ...prev,
      [progressKey]: true,
    }));
    setTeacherProfileError("");

    const formData = new FormData();
    formData.append(`showcase_image_${imageNumber}`, file);

    try {
      const response = await apiClient.put("/users/profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      // Update the showcase image URL
      const imageUrlKey = `showcase_image_${imageNumber}_url`;
      const newImageUrl = response.data[imageUrlKey];

      if (imageNumber === 1) setShowcaseImage1(newImageUrl);
      if (imageNumber === 2) setShowcaseImage2(newImageUrl);
      if (imageNumber === 3) setShowcaseImage3(newImageUrl);

      // Update profile state
      setProfile(response.data);
      console.log(`Showcase image ${imageNumber} uploaded successfully`);
    } catch (err) {
      console.error(`Failed to upload showcase image ${imageNumber}:`, err);
      setTeacherProfileError(
        err.response?.data?.detail ||
          `Failed to upload showcase image ${imageNumber}.`
      );
    } finally {
      setShowcaseImageUploadProgress((prev) => ({
        ...prev,
        [progressKey]: false,
      }));
    }
  };

  const handleDeleteShowcaseImage = async (imageNumber) => {
    if (!confirm(`Delete showcase image ${imageNumber}?`)) return;

    setTeacherProfileError("");
    const formData = new FormData();
    formData.append(`showcase_image_${imageNumber}`, ""); // Send empty to delete

    try {
      const response = await apiClient.put("/users/profile/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (imageNumber === 1) setShowcaseImage1(null);
      if (imageNumber === 2) setShowcaseImage2(null);
      if (imageNumber === 3) setShowcaseImage3(null);

      setProfile(response.data);
      console.log(`Showcase image ${imageNumber} deleted successfully`);
    } catch (err) {
      console.error(`Failed to delete showcase image ${imageNumber}:`, err);
      setTeacherProfileError(
        err.response?.data?.detail ||
          `Failed to delete showcase image ${imageNumber}.`
      );
    }
  };

  // Save showcase image caption
  const handleSaveShowcaseCaption = async (imageNumber, caption) => {
    try {
      const payload = {
        [`showcase_image_${imageNumber}_caption`]: caption,
      };
      const response = await apiClient.patch("/users/profile/", payload);
      setProfile(response.data);
      console.log(`Showcase image ${imageNumber} caption saved`);
    } catch (err) {
      console.error(`Failed to save caption for image ${imageNumber}:`, err);
      setTeacherProfileError(
        err.response?.data?.detail || `Failed to save caption.`
      );
    }
  };

  // Save showcase image tags
  const handleSaveShowcaseTags = async (imageNumber, tagIds) => {
    try {
      const payload = {
        [`showcase_image_${imageNumber}_tags`]: tagIds,
      };
      const response = await apiClient.patch("/users/profile/", payload);
      setProfile(response.data);
      console.log(`Showcase image ${imageNumber} tags saved`);
    } catch (err) {
      console.error(`Failed to save tags for image ${imageNumber}:`, err);
      setTeacherProfileError(
        err.response?.data?.detail || `Failed to save tags.`
      );
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    setInvitationError("");
    setInvitationSuccess("");

    if (!invitationEmail.trim()) {
      setInvitationError("Please enter an email address.");
      return;
    }

    try {
      const { data } = await apiClient.post("/users/invitations/send/", {
        invitee_email: invitationEmail,
        personal_message: invitationMessage,
      });
      setInvitationSuccess(
        `Invitation sent successfully! ${data.remaining_invitations_this_month} invitations remaining this month.`
      );
      setInvitationEmail("");
      setInvitationMessage("");
      fetchTeacherInvitations();
    } catch (err) {
      setInvitationError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to send invitation."
      );
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;
    try {
      await apiClient.post(`/users/invitations/${invitationId}/cancel/`);
      fetchTeacherInvitations();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to cancel invitation.");
    }
  };

  const handleEmailEditToggle = () => {
    setEditingEmail(!editingEmail);
    setNewEmail(profile?.email || "");
    setEmailError("");
    setError("");
  };
  const handleEmailSave = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setEmailError(""); // Clear email-specific error
    try {
      await apiClient.put("/users/profile/", { email: newEmail });
      setEditingEmail(false);
      fetchProfileCallback(); // Refetch profile
    } catch (err) {
      setEmailError(
        err.response?.data?.email?.[0] ||
          err.response?.data?.detail ||
          "Failed to update email."
      );
      if (err.response?.status === 401) logout();
    }
  };

  const handleDisplayNameEditToggle = () => {
    setEditingDisplayName(!editingDisplayName);
    setNewDisplayName(profile?.display_name || "");
    setDisplayNameError("");
    setError("");
  };

  const handleBioEditToggle = () => {
    setEditingBio(!editingBio);
    setNewBio(profile?.bio || "");
    setBioError("");
    setError("");
  };

  const handleBioSave = async () => {
    const value = (newBio || "").trim();
    setBioError("");
    try {
      await apiClient.put("/users/profile/", { bio: value });
      setEditingBio(false);
      fetchProfileCallback();
    } catch (err) {
      setBioError(
        err.response?.data?.bio?.[0] ||
          err.response?.data?.detail ||
          "Failed to update bio."
      );
      if (err.response?.status === 401) logout();
    }
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
    setDisplayNameError("");
    try {
      await apiClient.put("/users/profile/", { display_name: value });
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

  const toggleChangePasswordForm = () => {
    setShowChangePassword(!showChangePassword);
    setChangePasswordMessage({ text: "", type: "error" });
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setError("");
  };
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setChangePasswordMessage({ text: "", type: "error" }); // Clear previous message
    if (newPassword !== confirmNewPassword) {
      setChangePasswordMessage({
        text: "New passwords do not match.",
        type: "error",
      });
      return;
    }
    if (newPassword.length < 8) {
      setChangePasswordMessage({
        text: "New password must be at least 8 characters long.",
        type: "error",
      });
      return;
    }
    try {
      await apiClient.post("/users/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_new_password: confirmNewPassword,
      });
      setChangePasswordMessage({
        text: "Password changed successfully!",
        type: "success",
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setTimeout(() => {
        setShowChangePassword(false);
        setChangePasswordMessage({ text: "", type: "error" });
      }, 2000);
    } catch (err) {
      const backendError =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        (err.response?.data?.non_field_errors
          ? err.response.data.non_field_errors.join(" ")
          : null) ||
        (err.response?.data?.new_password
          ? `New Password: ${err.response.data.new_password.join(" ")}`
          : null) ||
        (err.response?.data?.current_password
          ? `Current Password: ${err.response.data.current_password.join(" ")}`
          : null) ||
        "Failed to change password.";
      setChangePasswordMessage({ text: backendError, type: "error" });
      if (err.response?.status === 401) logout();
    }
  };

  // --- Account Settings Functions ---
  const fetchEnrolledTeachers = async () => {
    setLoadingTeachers(true);
    try {
      // Get teachers from accepted guide requests
      const { data } = await apiClient.get("/social/my-teachers/");
      setEnrolledTeachers(data);
    } catch (err) {
      console.error("Error fetching enrolled teachers:", err);
    } finally {
      setLoadingTeachers(false);
    }
  };

  const fetchMyStudents = async () => {
    setLoadingStudents(true);
    try {
      // Get students from accepted guide requests
      const { data } = await apiClient.get("/social/my-students/");
      setMyStudents(data);
    } catch (err) {
      console.error("Error fetching students:", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleSaveAccountSettings = async () => {
    setSettingsSaving(true);
    try {
      // Save preferences to backend (you'll need to add these fields to the Profile model)
      await apiClient.patch("/users/profile/", {
        email_notifications: emailNotifications,
        mail_magazine_enabled: mailMagazineEnabled,
        profile_visibility: profileVisibility,
      });
      alert("Settings saved successfully!");
    } catch (err) {
      console.error("Error saving settings:", err);
      alert("Failed to save settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (
      !confirm(
        "Are you sure you want to deactivate your account? You can reactivate it by logging in again."
      )
    ) {
      return;
    }
    try {
      await apiClient.post("/users/deactivate/", { reason: deactivateReason });
      alert("Your account has been deactivated. You will be logged out.");
      logout();
      router.push("/");
    } catch (err) {
      console.error("Error deactivating account:", err);
      alert("Failed to deactivate account");
    }
  };

  const handleDeleteAccount = async () => {
    const confirmText = "DELETE";
    const userInput = prompt(
      `This action cannot be undone! Type "${confirmText}" to permanently delete your account:`
    );

    if (userInput !== confirmText) {
      alert("Account deletion cancelled.");
      return;
    }

    try {
      await apiClient.delete("/users/profile/");
      alert("Your account has been permanently deleted.");
      logout();
      router.push("/");
    } catch (err) {
      console.error("Error deleting account:", err);
      alert("Failed to delete account");
    }
  };

  // --- Render Logic ---
  if (isLoadingProfile && !profile) {
    // Show full page loader only if profile is not yet available
    return (
      <div className={`${styles.profilePage} flex items-center justify-center`}>
        <div className={styles.loadingState}>
          <FaSpinner className={styles.spinner} size={30} /> Loading Profile...
        </div>
      </div>
    );
  }

  if (!profile) {
    // If profile fetch failed
    return (
      <div className={`${styles.profilePage} text-center`}>
        <p className={styles.errorState}>
          {error || "Could not load profile data. Please try logging in again."}
        </p>
        <button
          onClick={() => router.push("/login")}
          className={`${styles.sidebarButton} ${styles.publicProfileBtn} mt-6 mx-auto w-auto px-6`}
        >
          Go to Login
        </button>
      </div>
    );
  }

  // Consolidate sidebar errors to display in one place if an action is active
  const sidebarActionError =
    error ||
    emailError ||
    (changePasswordMessage.text && changePasswordMessage.type === "error"
      ? changePasswordMessage.text
      : "");

  return (
    <div className={styles.profilePage}>
      <div className={styles.profileContainer}>
        {/* Display general error if it's related to an active sidebar form */}
        {sidebarActionError &&
          (previewUrl ||
            selectedFile ||
            editingEmail ||
            showChangePassword) && (
            <div className={`${styles.errorState} mb-6 text-sm`}>
              {" "}
              {/* Ensure this class is styled for errors */}
              <p>{sidebarActionError}</p>
            </div>
          )}

        <div className={styles.profileLayout}>
          <aside className={styles.profileSidebar}>
            <div className={styles.sidebarContent}>
              <div
                className={styles.hexagonContainer}
                onClick={handleProfileImageClick}
                title="Change profile picture"
              >
                <img
                  src={
                    previewUrl ||
                    profile.profile_image_url?.trim() ||
                    `https://placehold.co/160x160/FFC107/1B2735?text=${profile.username[0].toUpperCase()}`
                  }
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src =
                      "https://placehold.co/160x160/DEE2E6/5A6268?text=Error";
                  }}
                  alt={profile.username || "User"}
                  className={styles.hexagonImage}
                />
                <div className={styles.changeImageButton}>
                  <FaCamera size={16} />
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                />
              </div>

              {previewUrl && (
                <div className={styles.imageUploadActions}>
                  <button
                    onClick={handleUploadImage}
                    className={`${styles.uploadBtn} ${styles["imageUploadActions button"]}`}
                  >
                    Upload
                  </button>
                  <button
                    onClick={handleCancelUpload}
                    className={`${styles.cancelBtn} ${styles["imageUploadActions button"]}`}
                  >
                    Cancel
                  </button>
                </div>
              )}

              <h1 className={styles.username}>
                {profile.display_name?.trim() || profile.username}
              </h1>
              <p className={styles.joinedDate}>
                {" "}
                Joined:{" "}
                {new Date(profile.date_joined).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}{" "}
              </p>

              <div className={styles.scoreContainer}>
                <div className={styles.scoreItem}>
                  <FaBookReader size={22} />
                  <div>
                    <span className={styles.scoreValue}>
                      {scoresLoading ? (
                        <FaSpinner className={styles.spinner} />
                      ) : (
                        scores.learning_score
                      )}
                    </span>
                    <div className={styles.scoreLabel}>Learning Score</div>
                  </div>
                </div>
                <div className={styles.scoreItem}>
                  <FaAward size={22} />
                  <div>
                    <span className={styles.scoreValue}>
                      {scoresLoading ? (
                        <FaSpinner className={styles.spinner} />
                      ) : (
                        scores.impact_score
                      )}
                    </span>
                    <div className={styles.scoreLabel}>Impact Score</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5 mt-5">
                {" "}
                {/* Tailwind for simple spacing */}
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
                      <button
                        onClick={handleEmailEditToggle}
                        title="Edit Email"
                        className={styles.editIconButton}
                      >
                        {" "}
                        <FaEdit size={16} />{" "}
                      </button>
                    )}
                  </div>
                  {editingEmail ? (
                    <div>
                      <input
                        type="email"
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        className={styles.infoInput}
                      />
                      {emailError && (
                        <p className={`${styles.errorState} text-xs !p-2 mt-2`}>
                          {emailError}
                        </p>
                      )}
                      <div className={styles.emailEditActions}>
                        <button
                          onClick={handleEmailSave}
                          className={`${styles.sidebarButton} ${styles.uploadBtn} !mt-0 !py-1.5 !px-3`}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEmailEditToggle}
                          className={`${styles.sidebarButton} ${styles.cancelBtn} !bg-slate-500 hover:!bg-slate-600 !mt-0 !py-1.5 !px-3`}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <span className={styles.infoValue} title={profile.email}>
                      {profile.email}
                    </span>
                  )}
                </div>
                {/* Bio - Editable for students, hidden for teachers */}
                {!isTeacherOrAdmin && (
                  <div className={styles.infoSection}>
                    <div className={styles.infoLabelContainer}>
                      <span className={styles.infoLabel}>Bio:</span>
                      {!editingBio && (
                        <button
                          onClick={handleBioEditToggle}
                          title="Edit Bio"
                          className={styles.editIconButton}
                        >
                          <FaEdit size={16} />
                        </button>
                      )}
                    </div>
                    {editingBio ? (
                      <div>
                        <textarea
                          value={newBio}
                          onChange={(e) => setNewBio(e.target.value)}
                          className={styles.bioTextarea}
                          placeholder="Tell us about yourself..."
                          rows={4}
                          maxLength={500}
                        />
                        {bioError && (
                          <p
                            className={`${styles.errorState} text-xs !p-2 mt-2`}
                          >
                            {bioError}
                          </p>
                        )}
                        <div className={styles.emailEditActions}>
                          <button
                            onClick={handleBioSave}
                            className={`${styles.sidebarButton} ${styles.uploadBtn} !mt-0 !py-1.5 !px-3`}
                          >
                            Save
                          </button>
                          <button
                            onClick={handleBioEditToggle}
                            className={`${styles.sidebarButton} ${styles.cancelBtn} !bg-slate-500 hover:!bg-slate-600 !mt-0 !py-1.5 !px-3`}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <BioRenderer 
                        bio={profile.bio}
                        sectionClass={styles.bioSection}
                        contentClass={styles.bioContent}
                      />
                    )}
                  </div>
                )}
              </div>

              <Link
                href={`/guide/${profile.username}`}
                className={`${styles.sidebarButton} ${styles.publicProfileBtn}`}
              >
                {" "}
                View Public Profile{" "}
              </Link>
              <button
                onClick={toggleChangePasswordForm}
                className={`${styles.sidebarButton} ${styles.changePasswordBtn}`}
              >
                {showChangePassword
                  ? "Cancel Password Change"
                  : "Change Password"}
              </button>

              {showChangePassword && (
                <form
                  onSubmit={handleChangePassword}
                  className={styles.changePasswordForm}
                >
                  <div>
                    <label htmlFor="currentPasswordProf">
                      Current Password
                    </label>
                    <input
                      type="password"
                      id="currentPasswordProf"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="newPasswordProf">New Password</label>
                    <input
                      type="password"
                      id="newPasswordProf"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label htmlFor="confirmNewPasswordProf">
                      Confirm New Password
                    </label>
                    <input
                      type="password"
                      id="confirmNewPasswordProf"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                    />
                  </div>
                  {changePasswordMessage.text && (
                    <p
                      className={
                        changePasswordMessage.type === "success"
                          ? styles.successMessage
                          : `${styles.errorState} !text-xs !p-2`
                      }
                    >
                      {" "}
                      {changePasswordMessage.text}{" "}
                    </p>
                  )}
                  <button
                    type="submit"
                    className={`${styles.sidebarButton} ${styles.updatePasswordBtn}`}
                  >
                    {" "}
                    Update Password{" "}
                  </button>
                </form>
              )}
            </div>
            <button
              onClick={logout}
              className={`${styles.sidebarButton} ${styles.logoutBtn}`}
            >
              {" "}
              Logout{" "}
            </button>
          </aside>

          <main className={styles.profileMainContent}>
            <nav className={styles.tabNavigation}>
              {["courses", "lessons", "quizzes"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                  }}
                  className={`${styles.tabButton} ${
                    activeTab === tab ? styles.tabButtonActive : ""
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
              {isTeacherOrAdmin && (
                <button
                  onClick={() => setActiveTab("teacher")}
                  className={`${styles.tabButton} ${
                    activeTab === "teacher" ? styles.tabButtonActive : ""
                  } flex items-center gap-2`}
                  title="Teacher Settings"
                >
                  <FaChalkboardTeacher size={16} />
                  Teacher
                </button>
              )}
              <button
                onClick={() => setActiveTab("settings")}
                className={`${styles.tabButton} ${
                  activeTab === "settings" ? styles.tabButtonActive : ""
                } flex items-center gap-2`}
                title="Account Settings"
              >
                <FaCog size={16} />
                Settings
              </button>
              {isTeacherOrAdmin && (
                <button
                  onClick={() => router.push("/profile/mail-magazine")}
                  className={`${styles.tabButton} flex items-center gap-2`}
                  title="Manage Mail Magazine"
                >
                  <FaEnvelope size={16} />
                  Mail Magazine
                </button>
              )}
            </nav>

            <div className="mt-6">
              {" "}
              {/* Content for tabs */}
              {activeTab === "courses" && (
                <div>
                  <h2 className={styles.sectionTitle}>Your Enrolled Courses</h2>
                  {coursesError && (
                    <div className={`${styles.errorState} mb-4`}>
                      {coursesError}
                    </div>
                  )}
                  {coursesLoading && courses.length === 0 && !coursesError ? (
                    <div className={styles.loadingState}>
                      <FaSpinner className={styles.spinner} size={24} /> Loading
                      Courses...
                    </div>
                  ) : courses.length > 0 ? (
                    <div className={styles.cardsGrid}>
                      {courses.slice(0, displayedCoursesCount).map((course) => (
                        <div key={course.id} className={styles.card}>
                          <div className={styles.cardImageContainer}>
                            {course.cover_image ? (
                              <img
                                src={course.cover_image}
                                alt={course.title || "Course"}
                                onError={(e) => {
                                  e.target.onerror = null;
                                  e.target.src = `https://placehold.co/600x400/DEE2E6/1B2735?text=Course`;
                                }}
                              />
                            ) : (
                              <FaChalkboardTeacher
                                size={50}
                                className={styles.cardImagePlaceholderIcon}
                              />
                            )}
                          </div>
                          <div className={styles.cardContent}>
                            <h3
                              className={styles.cardTitle}
                              title={course.title}
                            >
                              {course.title}
                            </h3>
                            <p className={styles.cardDescription}>
                              {" "}
                              {stripHTML(course.description) ||
                                "No description."}{" "}
                            </p>
                            <button
                              onClick={() =>
                                router.push(`/courses/${course.permalink}`)
                              }
                              className={styles.cardButton}
                            >
                              {" "}
                              View Course{" "}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !coursesLoading &&
                    !coursesError && (
                      <p className="text-center py-10 text-slate-500">
                        You haven&apos;t enrolled in any courses yet.
                      </p>
                    )
                  )}
                  {isCoursesLoadingMore && (
                    <div className={`${styles.loadingState} mt-4`}>Loading</div>
                  )}
                  {!isCoursesLoadingMore &&
                    displayedCoursesCount < totalCourses && (
                      <div className={styles.loadMoreButtonContainer}>
                        <button
                          onClick={() =>
                            handleLoadMore(
                              displayedCoursesCount,
                              setDisplayedCoursesCount,
                              totalCourses,
                              ITEMS_PER_LOAD,
                              setIsCoursesLoadingMore,
                              isCoursesLoadingMore
                            )
                          }
                          className={styles.loadMoreButton}
                          disabled={isCoursesLoadingMore}
                        >
                          {isCoursesLoadingMore ? "Loading" : "Load More"}{" "}
                          <FaChevronDown />
                        </button>
                      </div>
                    )}
                </div>
              )}
              {activeTab === "lessons" && (
                <div>
                  <h2 className={styles.sectionTitle}>Your Accessed Lessons</h2>
                  {lessonsError && (
                    <div className={`${styles.errorState} mb-4`}>
                      {lessonsError}
                    </div>
                  )}
                  {lessonsLoading && lessons.length === 0 && !lessonsError ? (
                    <div className={styles.loadingState}>
                      <FaSpinner className={styles.spinner} size={24} /> Loading
                      Lessons...
                    </div>
                  ) : lessons.length > 0 ? (
                    <div className={styles.cardsGrid}>
                      {lessons.slice(0, displayedLessonsCount).map((lesson) => (
                        <div key={lesson.id} className={styles.card}>
                          <div className={styles.cardImageContainer}>
                            {" "}
                            <FaBookOpen
                              size={50}
                              className={styles.cardImagePlaceholderIcon}
                            />{" "}
                          </div>
                          <div className={styles.cardContent}>
                            <h3
                              className={styles.cardTitle}
                              title={lesson.title}
                            >
                              {lesson.title}
                            </h3>
                            <div
                              className={`${styles.cardDescription} prose prose-sm max-w-none`}
                              dangerouslySetInnerHTML={{
                                __html:
                                  stripHTML(lesson.content).substring(0, 150) +
                                    (stripHTML(lesson.content).length > 150
                                      ? "..."
                                      : "") || "No content.",
                              }}
                            />
                            <Link href={`/lessons/${lesson.permalink}`}>
                              <button className={styles.cardButton}>
                                Read Full Lesson
                              </button>
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !lessonsLoading &&
                    !lessonsError && (
                      <p className="text-center py-10 text-slate-500">
                        You haven&apos;t accessed any lessons yet.
                      </p>
                    )
                  )}
                  {isLessonsLoadingMore && (
                    <div className={`${styles.loadingState} mt-4`}>Loading</div>
                  )}
                  {!isLessonsLoadingMore &&
                    displayedLessonsCount < totalLessons && (
                      <div className={styles.loadMoreButtonContainer}>
                        <button
                          onClick={() =>
                            handleLoadMore(
                              displayedLessonsCount,
                              setDisplayedLessonsCount,
                              totalLessons,
                              ITEMS_PER_LOAD,
                              setIsLessonsLoadingMore,
                              isLessonsLoadingMore
                            )
                          }
                          className={styles.loadMoreButton}
                          disabled={isLessonsLoadingMore}
                        >
                          {isLessonsLoadingMore ? "Loading" : "Load More"}{" "}
                          <FaChevronDown />
                        </button>
                      </div>
                    )}
                </div>
              )}
              {activeTab === "quizzes" && (
                <div>
                  <h2 className={styles.sectionTitle}>
                    Your Attempted Quizzes
                  </h2>
                  {quizzesError && (
                    <div className={`${styles.errorState} mb-4`}>
                      {quizzesError}
                    </div>
                  )}
                  {quizzesLoading && quizzes.length === 0 && !quizzesError ? (
                    <div className={styles.loadingState}>
                      <FaSpinner className={styles.spinner} size={24} /> Loading
                      Quizzes...
                    </div>
                  ) : quizzes.length > 0 ? (
                    <div className="space-y-5">
                      {quizzes.slice(0, displayedQuizzesCount).map((quiz) => (
                        <div key={quiz.id} className={styles.listItem}>
                          <div className={styles.listItemContent}>
                            <h3 className={styles.listItemTitle}>
                              <FaQuestionCircle className="text-[color:var(--primary-dark)] flex-shrink-0" />
                              {quiz.title}
                            </h3>
                            <p className={styles.listItemDescription}>
                              {" "}
                              {stripHTML(quiz.question) ||
                                "No question preview."}{" "}
                            </p>
                          </div>
                          <Link
                            href={quizPermalinkToUrl(quiz.permalink)}
                            className={`${styles.cardButton} ${styles.listItemButton}`}
                          >
                            View Quiz
                          </Link>
                        </div>
                      ))}
                    </div>
                  ) : (
                    !quizzesLoading &&
                    !quizzesError && (
                      <p className="text-center py-10 text-slate-500">
                        You haven&apos;t attempted any quizzes yet.
                      </p>
                    )
                  )}
                  {isQuizzesLoadingMore && (
                    <div className={`${styles.loadingState} mt-4`}>Loading</div>
                  )}
                  {!isQuizzesLoadingMore &&
                    displayedQuizzesCount < totalQuizzes && (
                      <div className={styles.loadMoreButtonContainer}>
                        <button
                          onClick={() =>
                            handleLoadMore(
                              displayedQuizzesCount,
                              setDisplayedQuizzesCount,
                              totalQuizzes,
                              ITEMS_PER_LOAD,
                              setIsQuizzesLoadingMore,
                              isQuizzesLoadingMore
                            )
                          }
                          className={styles.loadMoreButton}
                          disabled={isQuizzesLoadingMore}
                        >
                          {isQuizzesLoadingMore ? "Loading" : "Load More"}{" "}
                          <FaChevronDown />
                        </button>
                      </div>
                    )}
                </div>
              )}
              {/* Teacher Settings Tab */}
              {activeTab === "teacher" && isTeacherOrAdmin && (
                <div className={teacherStyles.teacherDashboard}>
                  <div className={teacherStyles.dashboardContainer}>
                    <div className={teacherStyles.dashboardHeader}>
                      <h1>Teacher Dashboard</h1>
                      <p>
                        Manage your teaching profile and invite other educators
                        to join Zporta Academy
                      </p>
                    </div>

                    {/* Teacher Profile Card */}
                    <div className={teacherStyles.profileCard}>
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaChalkboardTeacher />
                        </div>
                        <div className={teacherStyles.cardTitle}>
                          <h3>Teacher Profile</h3>
                          <p>Update your professional information</p>
                        </div>
                      </div>

                      {teacherProfileError && (
                        <div className={teacherStyles.alertError}>
                          {teacherProfileError}
                        </div>
                      )}

                      <div className={teacherStyles.formGroup}>
                        <label className={teacherStyles.formLabel}>
                          Teaching Bio
                        </label>
                        <textarea
                          value={teacherBio}
                          onChange={(e) => setTeacherBio(e.target.value)}
                          onBlur={handleSaveTeacherProfile}
                          className={teacherStyles.formTextarea}
                          placeholder="Share your teaching philosophy, experience, and what makes your classes special..."
                        />
                        <p className={teacherStyles.formHint}>
                          💼 This will be displayed on your public teacher
                          profile
                        </p>
                      </div>

                      <div className={teacherStyles.formGroup}>
                        <label className={teacherStyles.formLabel}>
                          Specialization / Subjects
                        </label>
                        <input
                          type="text"
                          value={teacherSpecialization}
                          onChange={(e) =>
                            setTeacherSpecialization(e.target.value)
                          }
                          onBlur={handleSaveTeacherProfile}
                          className={teacherStyles.formInput}
                          placeholder="e.g., Japanese Language, Web Development, Mathematics"
                        />
                        <p className={teacherStyles.formHint}>
                          🎓 Your areas of expertise
                        </p>
                      </div>

                      <div className={teacherStyles.gridCols3}>
                        <div className={teacherStyles.formGroup}>
                          <label className={teacherStyles.formLabel}>
                            Website
                          </label>
                          <input
                            type="url"
                            value={teacherWebsite}
                            onChange={(e) => setTeacherWebsite(e.target.value)}
                            onBlur={handleSaveTeacherProfile}
                            className={teacherStyles.formInput}
                            placeholder="https://yoursite.com"
                          />
                        </div>

                        <div className={teacherStyles.formGroup}>
                          <label className={teacherStyles.formLabel}>
                            LinkedIn
                          </label>
                          <input
                            type="url"
                            value={teacherLinkedin}
                            onChange={(e) => setTeacherLinkedin(e.target.value)}
                            onBlur={handleSaveTeacherProfile}
                            className={teacherStyles.formInput}
                            placeholder="linkedin.com/in/..."
                          />
                        </div>

                        <div className={teacherStyles.formGroup}>
                          <label className={teacherStyles.formLabel}>
                            Twitter/X
                          </label>
                          <input
                            type="url"
                            value={teacherTwitter}
                            onChange={(e) => setTeacherTwitter(e.target.value)}
                            onBlur={handleSaveTeacherProfile}
                            className={teacherStyles.formInput}
                            placeholder="twitter.com/..."
                          />
                        </div>
                      </div>

                      {/* Showcase Images Gallery */}
                      <div className={teacherStyles.formGroup}>
                        <label className={teacherStyles.formLabel}>
                          Showcase Gallery (Portfolio)
                        </label>
                        <p className={teacherStyles.formHint}>
                          🖼️ Upload up to 3 images to showcase your work,
                          classroom, or achievements. These appear on your
                          public profile.
                        </p>

                        <div className={teacherStyles.showcaseGallery}>
                          {/* Showcase Image 1 */}
                          <div className={teacherStyles.showcaseImageSlot}>
                            {showcaseImage1 ? (
                              <div
                                className={teacherStyles.showcaseImagePreview}
                              >
                                <img src={showcaseImage1} alt="Showcase 1" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShowcaseImage(1)}
                                  className={teacherStyles.showcaseImageDelete}
                                  disabled={showcaseImageUploadProgress.image1}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <label
                                className={teacherStyles.showcaseImageUpload}
                              >
                                {showcaseImageUploadProgress.image1 ? (
                                  <span>Uploading...</span>
                                ) : (
                                  <>
                                    <span className={teacherStyles.uploadIcon}>
                                      📸
                                    </span>
                                    <span>Upload Image 1</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleShowcaseImageUpload(
                                          1,
                                          e.target.files[0]
                                        )
                                      }
                                      style={{ display: "none" }}
                                    />
                                  </>
                                )}
                              </label>
                            )}

                            {/* Caption and Tags for Image 1 */}
                            {showcaseImage1 && (
                              <div className={teacherStyles.showcaseMeta}>
                                <div className={teacherStyles.captionGroup}>
                                  <input
                                    type="text"
                                    value={showcaseCaption1}
                                    onChange={(e) =>
                                      setShowcaseCaption1(e.target.value)
                                    }
                                    onBlur={() =>
                                      handleSaveShowcaseCaption(
                                        1,
                                        showcaseCaption1
                                      )
                                    }
                                    placeholder="Add caption (max 200 characters)"
                                    maxLength={200}
                                    className={teacherStyles.captionInput}
                                  />
                                  <span className={teacherStyles.charCount}>
                                    {showcaseCaption1.length}/200
                                  </span>
                                </div>

                                <div className={teacherStyles.tagSelector}>
                                  <label className={teacherStyles.tagLabel}>
                                    Tags:
                                  </label>

                                  {/* Selected Tags as Chips */}
                                  <div className={teacherStyles.selectedTags}>
                                    {showcaseTags1.map((tagId) => {
                                      const tag = availableTags.find(
                                        (t) => t.id === tagId
                                      );
                                      return tag ? (
                                        <span
                                          key={tagId}
                                          className={teacherStyles.tagChip}
                                        >
                                          {tag.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveTag(1, tagId)
                                            }
                                            className={teacherStyles.tagRemove}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>

                                  {/* Tag Input with Autocomplete */}
                                  <div
                                    className={teacherStyles.tagInputWrapper}
                                  >
                                    <input
                                      type="text"
                                      value={tagInput1}
                                      onChange={(e) =>
                                        handleTagInputChange(1, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddTag(1, tagInput1);
                                        }
                                      }}
                                      placeholder="Type to search or create tags..."
                                      className={teacherStyles.tagInput}
                                    />

                                    {/* Autocomplete Suggestions */}
                                    {showSuggestions1 &&
                                      tagSuggestions1.length > 0 && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          {tagSuggestions1.map((tag) => (
                                            <div
                                              key={tag.id}
                                              className={
                                                teacherStyles.tagSuggestion
                                              }
                                              onClick={() =>
                                                handleAddTag(1, tag.name)
                                              }
                                            >
                                              {tag.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                    {/* Create new tag option */}
                                    {showSuggestions1 &&
                                      tagInput1.trim() &&
                                      !tagSuggestions1.find(
                                        (t) =>
                                          t.name.toLowerCase() ===
                                          tagInput1.toLowerCase()
                                      ) && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          <div
                                            className={`${teacherStyles.tagSuggestion} ${teacherStyles.createNew}`}
                                            onClick={() =>
                                              handleAddTag(1, tagInput1)
                                            }
                                          >
                                            + Create &quot;{tagInput1}&quot;
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Showcase Image 2 */}
                          <div className={teacherStyles.showcaseImageSlot}>
                            {showcaseImage2 ? (
                              <div
                                className={teacherStyles.showcaseImagePreview}
                              >
                                <img src={showcaseImage2} alt="Showcase 2" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShowcaseImage(2)}
                                  className={teacherStyles.showcaseImageDelete}
                                  disabled={showcaseImageUploadProgress.image2}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <label
                                className={teacherStyles.showcaseImageUpload}
                              >
                                {showcaseImageUploadProgress.image2 ? (
                                  <span>Uploading...</span>
                                ) : (
                                  <>
                                    <span className={teacherStyles.uploadIcon}>
                                      📸
                                    </span>
                                    <span>Upload Image 2</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleShowcaseImageUpload(
                                          2,
                                          e.target.files[0]
                                        )
                                      }
                                      style={{ display: "none" }}
                                    />
                                  </>
                                )}
                              </label>
                            )}

                            {/* Caption and Tags for Image 2 */}
                            {showcaseImage2 && (
                              <div className={teacherStyles.showcaseMeta}>
                                <div className={teacherStyles.captionGroup}>
                                  <input
                                    type="text"
                                    value={showcaseCaption2}
                                    onChange={(e) =>
                                      setShowcaseCaption2(e.target.value)
                                    }
                                    onBlur={() =>
                                      handleSaveShowcaseCaption(
                                        2,
                                        showcaseCaption2
                                      )
                                    }
                                    placeholder="Add caption (max 200 characters)"
                                    maxLength={200}
                                    className={teacherStyles.captionInput}
                                  />
                                  <span className={teacherStyles.charCount}>
                                    {showcaseCaption2.length}/200
                                  </span>
                                </div>

                                <div className={teacherStyles.tagSelector}>
                                  <label className={teacherStyles.tagLabel}>
                                    Tags:
                                  </label>

                                  {/* Selected Tags as Chips */}
                                  <div className={teacherStyles.selectedTags}>
                                    {showcaseTags2.map((tagId) => {
                                      const tag = availableTags.find(
                                        (t) => t.id === tagId
                                      );
                                      return tag ? (
                                        <span
                                          key={tagId}
                                          className={teacherStyles.tagChip}
                                        >
                                          {tag.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveTag(2, tagId)
                                            }
                                            className={teacherStyles.tagRemove}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>

                                  {/* Tag Input with Autocomplete */}
                                  <div
                                    className={teacherStyles.tagInputWrapper}
                                  >
                                    <input
                                      type="text"
                                      value={tagInput2}
                                      onChange={(e) =>
                                        handleTagInputChange(2, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddTag(2, tagInput2);
                                        }
                                      }}
                                      placeholder="Type to search or create tags..."
                                      className={teacherStyles.tagInput}
                                    />

                                    {/* Autocomplete Suggestions */}
                                    {showSuggestions2 &&
                                      tagSuggestions2.length > 0 && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          {tagSuggestions2.map((tag) => (
                                            <div
                                              key={tag.id}
                                              className={
                                                teacherStyles.tagSuggestion
                                              }
                                              onClick={() =>
                                                handleAddTag(2, tag.name)
                                              }
                                            >
                                              {tag.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                    {/* Create new tag option */}
                                    {showSuggestions2 &&
                                      tagInput2.trim() &&
                                      !tagSuggestions2.find(
                                        (t) =>
                                          t.name.toLowerCase() ===
                                          tagInput2.toLowerCase()
                                      ) && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          <div
                                            className={`${teacherStyles.tagSuggestion} ${teacherStyles.createNew}`}
                                            onClick={() =>
                                              handleAddTag(2, tagInput2)
                                            }
                                          >
                                            + Create &quot;{tagInput2}&quot;
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Showcase Image 3 */}
                          <div className={teacherStyles.showcaseImageSlot}>
                            {showcaseImage3 ? (
                              <div
                                className={teacherStyles.showcaseImagePreview}
                              >
                                <img src={showcaseImage3} alt="Showcase 3" />
                                <button
                                  type="button"
                                  onClick={() => handleDeleteShowcaseImage(3)}
                                  className={teacherStyles.showcaseImageDelete}
                                  disabled={showcaseImageUploadProgress.image3}
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <label
                                className={teacherStyles.showcaseImageUpload}
                              >
                                {showcaseImageUploadProgress.image3 ? (
                                  <span>Uploading...</span>
                                ) : (
                                  <>
                                    <span className={teacherStyles.uploadIcon}>
                                      📸
                                    </span>
                                    <span>Upload Image 3</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      onChange={(e) =>
                                        handleShowcaseImageUpload(
                                          3,
                                          e.target.files[0]
                                        )
                                      }
                                      style={{ display: "none" }}
                                    />
                                  </>
                                )}
                              </label>
                            )}

                            {/* Caption and Tags for Image 3 */}
                            {showcaseImage3 && (
                              <div className={teacherStyles.showcaseMeta}>
                                <div className={teacherStyles.captionGroup}>
                                  <input
                                    type="text"
                                    value={showcaseCaption3}
                                    onChange={(e) =>
                                      setShowcaseCaption3(e.target.value)
                                    }
                                    onBlur={() =>
                                      handleSaveShowcaseCaption(
                                        3,
                                        showcaseCaption3
                                      )
                                    }
                                    placeholder="Add caption (max 200 characters)"
                                    maxLength={200}
                                    className={teacherStyles.captionInput}
                                  />
                                  <span className={teacherStyles.charCount}>
                                    {showcaseCaption3.length}/200
                                  </span>
                                </div>

                                <div className={teacherStyles.tagSelector}>
                                  <label className={teacherStyles.tagLabel}>
                                    Tags:
                                  </label>

                                  {/* Selected Tags as Chips */}
                                  <div className={teacherStyles.selectedTags}>
                                    {showcaseTags3.map((tagId) => {
                                      const tag = availableTags.find(
                                        (t) => t.id === tagId
                                      );
                                      return tag ? (
                                        <span
                                          key={tagId}
                                          className={teacherStyles.tagChip}
                                        >
                                          {tag.name}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleRemoveTag(3, tagId)
                                            }
                                            className={teacherStyles.tagRemove}
                                          >
                                            ×
                                          </button>
                                        </span>
                                      ) : null;
                                    })}
                                  </div>

                                  {/* Tag Input with Autocomplete */}
                                  <div
                                    className={teacherStyles.tagInputWrapper}
                                  >
                                    <input
                                      type="text"
                                      value={tagInput3}
                                      onChange={(e) =>
                                        handleTagInputChange(3, e.target.value)
                                      }
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                          handleAddTag(3, tagInput3);
                                        }
                                      }}
                                      placeholder="Type to search or create tags..."
                                      className={teacherStyles.tagInput}
                                    />

                                    {/* Autocomplete Suggestions */}
                                    {showSuggestions3 &&
                                      tagSuggestions3.length > 0 && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          {tagSuggestions3.map((tag) => (
                                            <div
                                              key={tag.id}
                                              className={
                                                teacherStyles.tagSuggestion
                                              }
                                              onClick={() =>
                                                handleAddTag(3, tag.name)
                                              }
                                            >
                                              {tag.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}

                                    {/* Create new tag option */}
                                    {showSuggestions3 &&
                                      tagInput3.trim() &&
                                      !tagSuggestions3.find(
                                        (t) =>
                                          t.name.toLowerCase() ===
                                          tagInput3.toLowerCase()
                                      ) && (
                                        <div
                                          className={
                                            teacherStyles.tagSuggestions
                                          }
                                        >
                                          <div
                                            className={`${teacherStyles.tagSuggestion} ${teacherStyles.createNew}`}
                                            onClick={() =>
                                              handleAddTag(3, tagInput3)
                                            }
                                          >
                                            + Create &quot;{tagInput3}&quot;
                                          </div>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className={teacherStyles.autoSaveNotice}>
                        <p>
                          <strong>Auto-save enabled:</strong> Changes are saved
                          automatically when you click away from each field
                        </p>
                      </div>
                    </div>

                    {/* Teacher Invitation Section */}
                    <div className={teacherStyles.invitationCard}>
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaEnvelope />
                        </div>
                        <div className={teacherStyles.cardTitle}>
                          <h3>Invite Teachers</h3>
                          <p>Help grow our teaching community</p>
                        </div>
                      </div>

                      {!canInvite ? (
                        <div className={teacherStyles.lockedCard}>
                          <div className={teacherStyles.lockedIcon}>🔒</div>
                          <h4>Invitation Permission Required</h4>
                          <p>
                            You need special permission to invite other teachers
                            to the platform.
                          </p>
                          <p className="small">
                            Please contact an administrator to request
                            invitation privileges.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className={teacherStyles.statsBar}>
                            <div className={teacherStyles.statBox}>
                              <p>Remaining Invitations</p>
                              <div className={teacherStyles.statValue}>
                                {remainingInvitations}
                              </div>
                            </div>
                            <div className={teacherStyles.statBox}>
                              <p>Sent This Month</p>
                              <div className={teacherStyles.statValue}>
                                {3 - remainingInvitations}
                              </div>
                            </div>
                          </div>

                          {invitationError && (
                            <div className={teacherStyles.alertError}>
                              {invitationError}
                            </div>
                          )}

                          {invitationSuccess && (
                            <div className={teacherStyles.alertSuccess}>
                              {invitationSuccess}
                            </div>
                          )}

                          <form
                            onSubmit={handleSendInvitation}
                            className={teacherStyles.invitationForm}
                          >
                            <div className={teacherStyles.formRow}>
                              <div className={teacherStyles.formGroup}>
                                <label className={teacherStyles.formLabel}>
                                  Email Address *
                                </label>
                                <input
                                  type="email"
                                  value={invitationEmail}
                                  onChange={(e) =>
                                    setInvitationEmail(e.target.value)
                                  }
                                  className={teacherStyles.formInput}
                                  placeholder="colleague@example.com"
                                  required
                                />
                              </div>

                              <button
                                type="submit"
                                className={teacherStyles.submitButton}
                                disabled={remainingInvitations === 0}
                              >
                                {remainingInvitations === 0
                                  ? "🚫 No Invitations Left"
                                  : "📨 Send Invitation"}
                              </button>
                            </div>

                            <div className={teacherStyles.formGroup}>
                              <label className={teacherStyles.formLabel}>
                                Personal Message (Optional)
                              </label>
                              <textarea
                                value={invitationMessage}
                                onChange={(e) =>
                                  setInvitationMessage(e.target.value)
                                }
                                className={teacherStyles.formTextarea}
                                placeholder="Add a personal note to make your invitation more welcoming..."
                              />
                              <p className={teacherStyles.formHint}>
                                💌 Make it personal - invitees are more likely
                                to accept!
                              </p>
                            </div>
                          </form>

                          {/* Sent Invitations List */}
                          <div className={teacherStyles.historySection}>
                            <h4>Invitation History</h4>

                            {invitationsLoading ? (
                              <div className={teacherStyles.loadingState}>
                                <div className={teacherStyles.spinner}></div>
                                <p>Loading invitations...</p>
                              </div>
                            ) : invitations.length > 0 ? (
                              <div className={teacherStyles.invitationList}>
                                {invitations.map((inv) => (
                                  <div
                                    key={inv.id}
                                    className={teacherStyles.invitationItem}
                                  >
                                    <div
                                      className={teacherStyles.invitationInfo}
                                    >
                                      <div
                                        className={
                                          teacherStyles.invitationEmail
                                        }
                                      >
                                        {inv.invitee_email}
                                      </div>
                                      <div
                                        className={teacherStyles.invitationMeta}
                                      >
                                        <span
                                          className={`${
                                            teacherStyles.statusBadge
                                          } ${
                                            inv.status === "accepted"
                                              ? teacherStyles.statusAccepted
                                              : inv.status === "expired"
                                              ? teacherStyles.statusExpired
                                              : inv.status === "cancelled"
                                              ? teacherStyles.statusCancelled
                                              : teacherStyles.statusPending
                                          }`}
                                        >
                                          {inv.status === "accepted" && "✓ "}
                                          {inv.status === "expired" && "⏰ "}
                                          {inv.status === "pending" && "⏳ "}
                                          {inv.status.toUpperCase()}
                                        </span>
                                        <span
                                          className={
                                            teacherStyles.invitationDate
                                          }
                                        >
                                          Sent{" "}
                                          {new Date(
                                            inv.created_at
                                          ).toLocaleDateString()}
                                        </span>
                                        {inv.is_expired &&
                                          !["accepted", "cancelled"].includes(
                                            inv.status
                                          ) && (
                                            <span
                                              className={
                                                teacherStyles.invitationDate
                                              }
                                              style={{
                                                color: "#dc2626",
                                                fontWeight: "600",
                                              }}
                                            >
                                              Expired
                                            </span>
                                          )}
                                      </div>
                                    </div>
                                    {inv.status === "pending" &&
                                      !inv.is_expired && (
                                        <button
                                          onClick={() =>
                                            handleCancelInvitation(inv.id)
                                          }
                                          className={teacherStyles.cancelButton}
                                        >
                                          Cancel
                                        </button>
                                      )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className={teacherStyles.emptyState}>
                                <div className={teacherStyles.emptyIcon}>
                                  📬
                                </div>
                                <p>No invitations sent yet</p>
                                <p className="small">
                                  Start inviting talented teachers to join the
                                  platform!
                                </p>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {/* Account Settings Tab */}
              {activeTab === "settings" && (
                <div className={teacherStyles.teacherDashboard}>
                  <div className={teacherStyles.dashboardHeader}>
                    <h2 className={teacherStyles.dashboardTitle}>
                      <FaCog /> Account Settings & Privacy
                    </h2>
                    <p className={teacherStyles.dashboardSubtitle}>
                      Manage your account preferences, privacy, and security
                      settings
                    </p>
                  </div>

                  <div className={teacherStyles.settingsContainer}>
                    {/* Privacy & Visibility */}
                    <div className={teacherStyles.settingsCard}>
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaShieldAlt />
                        </div>
                        <div>
                          <h3>Privacy & Visibility</h3>
                          <p>Control who can see your profile and activities</p>
                        </div>
                      </div>

                      <div className={teacherStyles.settingsGroup}>
                        <label className={teacherStyles.settingLabel}>
                          <div>
                            <strong>Profile Visibility</strong>
                            <p className={teacherStyles.settingDescription}>
                              Choose who can view your public profile
                            </p>
                          </div>
                          <select
                            value={profileVisibility}
                            onChange={(e) =>
                              setProfileVisibility(e.target.value)
                            }
                            className={teacherStyles.settingSelect}
                          >
                            <option value="public">Everyone (Public)</option>
                            <option value="registered">
                              Registered Users Only
                            </option>
                            <option value="private">Only Me (Private)</option>
                          </select>
                        </label>
                      </div>
                    </div>

                    {/* Notification Preferences */}
                    <div className={teacherStyles.settingsCard}>
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaBell />
                        </div>
                        <div>
                          <h3>Notifications</h3>
                          <p>Manage how you receive updates</p>
                        </div>
                      </div>

                      <div className={teacherStyles.settingsGroup}>
                        <label className={teacherStyles.settingToggle}>
                          <div>
                            <strong>Email Notifications</strong>
                            <p className={teacherStyles.settingDescription}>
                              Receive email updates about your account activity
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={emailNotifications}
                            onChange={(e) =>
                              setEmailNotifications(e.target.checked)
                            }
                            className={teacherStyles.toggle}
                          />
                        </label>

                        <label className={teacherStyles.settingToggle}>
                          <div>
                            <strong>Mail Magazine Subscription</strong>
                            <p className={teacherStyles.settingDescription}>
                              Receive educational content from teachers you
                              follow
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={mailMagazineEnabled}
                            onChange={(e) =>
                              setMailMagazineEnabled(e.target.checked)
                            }
                            className={teacherStyles.toggle}
                          />
                        </label>

                        {mailMagazineEnabled && (
                          <div className={teacherStyles.nestedSettings}>
                            <h4
                              style={{
                                marginBottom: "12px",
                                fontSize: "1rem",
                                fontWeight: "600",
                              }}
                            >
                              Teachers You&apos;re Learning From
                            </h4>
                            {loadingTeachers ? (
                              <div
                                style={{ textAlign: "center", padding: "20px" }}
                              >
                                <FaSpinner className={teacherStyles.spinner} />{" "}
                                Loading teachers...
                              </div>
                            ) : enrolledTeachers.length > 0 ? (
                              <div className={teacherStyles.teacherList}>
                                {enrolledTeachers.map((teacher) => (
                                  <div
                                    key={teacher.id}
                                    className={teacherStyles.userListItem}
                                  >
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "12px",
                                        flex: 1,
                                      }}
                                    >
                                      <img
                                        src={
                                          teacher.profile_picture_url ||
                                          "/default-avatar.png"
                                        }
                                        alt={teacher.display_name}
                                        className={teacherStyles.userAvatar}
                                      />
                                      <div>
                                        <div className={teacherStyles.userName}>
                                          {teacher.display_name}
                                        </div>
                                        <div className={teacherStyles.userMeta}>
                                          @{teacher.username}
                                        </div>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        router.push(
                                          `/guide/${teacher.username}`
                                        )
                                      }
                                      className={teacherStyles.viewProfileBtn}
                                    >
                                      <FaEye /> View Profile
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className={teacherStyles.emptyText}>
                                You haven&apos;t enrolled in any courses yet.
                                Start learning to see your teachers here!
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* My Students - For Teachers */}
                    {isTeacherOrAdmin && (
                      <div className={teacherStyles.settingsCard}>
                        <div className={teacherStyles.cardHeader}>
                          <div className={teacherStyles.cardIcon}>
                            <FaChalkboardTeacher />
                          </div>
                          <div>
                            <h3>My Students</h3>
                            <p>Students enrolled in your courses</p>
                          </div>
                        </div>

                        <div className={teacherStyles.settingsGroup}>
                          {loadingStudents ? (
                            <div
                              style={{ textAlign: "center", padding: "20px" }}
                            >
                              <FaSpinner className={teacherStyles.spinner} />{" "}
                              Loading students...
                            </div>
                          ) : myStudents.length > 0 ? (
                            <div className={teacherStyles.studentList}>
                              {myStudents.map((student) => (
                                <div
                                  key={student.id}
                                  className={teacherStyles.userListItem}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "12px",
                                      flex: 1,
                                    }}
                                  >
                                    <img
                                      src={
                                        student.profile_picture_url ||
                                        "/default-avatar.png"
                                      }
                                      alt={student.display_name}
                                      className={teacherStyles.userAvatar}
                                    />
                                    <div>
                                      <div className={teacherStyles.userName}>
                                        {student.display_name}
                                      </div>
                                      <div className={teacherStyles.userMeta}>
                                        @{student.username}
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() =>
                                      router.push(`/guide/${student.username}`)
                                    }
                                    className={teacherStyles.viewProfileBtn}
                                  >
                                    <FaEye /> View Profile
                                  </button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className={teacherStyles.emptyText}>
                              No students enrolled in your courses yet. Keep
                              creating great content!
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Learning Preferences */}
                    <div className={teacherStyles.settingsCard}>
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaBookOpen />
                        </div>
                        <div>
                          <h3>Learning Preferences</h3>
                          <p>Customize your learning experience</p>
                        </div>
                      </div>

                      <div className={teacherStyles.settingsGroup}>
                        <button
                          onClick={() => router.push("/setup")}
                          className={teacherStyles.linkButton}
                        >
                          <FaBookOpen /> Manage Subjects & Language Preferences
                        </button>
                        <p className={teacherStyles.helpText}>
                          Select subjects you&apos;re interested in and your
                          preferred learning language
                        </p>

                        {isTeacherOrAdmin && (
                          <>
                            <button
                              onClick={() => router.push("/profile")}
                              className={teacherStyles.linkButton}
                            >
                              <FaChalkboardTeacher /> View My Students
                            </button>
                            <p className={teacherStyles.helpText}>
                              See all students enrolled in your courses
                            </p>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Save Settings Button */}
                    <div className={teacherStyles.saveButtonContainer}>
                      <button
                        onClick={handleSaveAccountSettings}
                        className={teacherStyles.submitButton}
                        disabled={settingsSaving}
                      >
                        {settingsSaving ? (
                          <>
                            <FaSpinner className={teacherStyles.spinner} />{" "}
                            Saving...
                          </>
                        ) : (
                          <>💾 Save Settings</>
                        )}
                      </button>
                    </div>

                    {/* Danger Zone */}
                    <div
                      className={`${teacherStyles.settingsCard} ${teacherStyles.dangerZone}`}
                    >
                      <div className={teacherStyles.cardHeader}>
                        <div className={teacherStyles.cardIcon}>
                          <FaTrash />
                        </div>
                        <div>
                          <h3>Danger Zone</h3>
                          <p>Irreversible actions that affect your account</p>
                        </div>
                      </div>

                      <div className={teacherStyles.dangerActions}>
                        <div className={teacherStyles.dangerAction}>
                          <div>
                            <strong>Deactivate Account</strong>
                            <p className={teacherStyles.settingDescription}>
                              Temporarily disable your account. You can
                              reactivate it anytime by logging in.
                            </p>
                          </div>
                          <button
                            onClick={() => setShowDeactivateModal(true)}
                            className={teacherStyles.dangerButton}
                          >
                            Deactivate
                          </button>
                        </div>

                        <div className={teacherStyles.dangerAction}>
                          <div>
                            <strong>Delete Account</strong>
                            <p className={teacherStyles.settingDescription}>
                              Permanently delete your account and all associated
                              data. This cannot be undone.
                            </p>
                          </div>
                          <button
                            onClick={handleDeleteAccount}
                            className={`${teacherStyles.dangerButton} ${teacherStyles.deleteButton}`}
                          >
                            Delete Forever
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </main>
        </div>

        {/* Deactivate Account Modal */}
        {showDeactivateModal && (
          <div
            className={teacherStyles.modal}
            onClick={() => setShowDeactivateModal(false)}
          >
            <div
              className={teacherStyles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <h3>Deactivate Account</h3>
              <p>
                Are you sure you want to deactivate your account? You can
                reactivate it by logging in again.
              </p>

              <textarea
                value={deactivateReason}
                onChange={(e) => setDeactivateReason(e.target.value)}
                placeholder="(Optional) Tell us why you're leaving..."
                className={teacherStyles.formTextarea}
                rows={4}
              />

              <div className={teacherStyles.modalActions}>
                <button
                  onClick={handleDeactivateAccount}
                  className={teacherStyles.dangerButton}
                >
                  Yes, Deactivate
                </button>
                <button
                  onClick={() => setShowDeactivateModal(false)}
                  className={teacherStyles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
