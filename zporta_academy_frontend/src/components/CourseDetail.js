import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaBook, FaQuestion, FaSpinner, FaBookOpen, FaTimes } from "react-icons/fa"; // Added FaTimes for detach icon
import CustomEditor from "./Editor/CustomEditor";
import CreateSubjectSelect from "./Admin/CreateSubjectSelect";
import styles from "./CourseDetail.module.css";

import { loadStripe } from "@stripe/stripe-js";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api.js";
import "./Editor/ViewerAccordion.css";

const stripePromise = loadStripe(
  "pk_test_51KuSZdAyDb4VsWsQVWaz6RYSufh5e8ns6maCvV4b0g1waYUL4TvvgrB14G73tirboPQ67w3l8n8Tt631kACShVaT003wDftkeU"
);

// Accordion Initialization Function (Unchanged)
function initializeAccordions(containerElement) {
  if (!containerElement) return;
  const accordions = containerElement.querySelectorAll(".accordion-item");

  accordions.forEach((accordion) => {
    const header   = accordion.querySelector(".accordion-header");
    const contents = accordion.querySelectorAll(".accordion-content");
    const defaultState = accordion.getAttribute("data-default-state") || "closed";

    if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") {
      return;
    }
    accordion.dataset.accordionInitialized = "true";

    if (defaultState === "open") {
      accordion.classList.add("is-open");
    } else {
      accordion.classList.remove("is-open");
    }

    const clickHandler = () => {
      accordion.classList.toggle("is-open");
    };

    // Cleanup previous listener before adding new one
    if (header.__accordionClickHandler__) {
      header.removeEventListener("click", header.__accordionClickHandler__);
    }
    header.addEventListener("click", clickHandler);
    header.__accordionClickHandler__ = clickHandler; // Store reference for cleanup

    // Initialize nested accordions
    contents.forEach((content) => {
      requestAnimationFrame(() => {
        initializeAccordions(content);
      });
    });
  });
}

// HTML Sanitization Function (Unchanged)
const sanitizeContentViewerHTML = (htmlString) => {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const editableElements = doc.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach((el) => {
      el.removeAttribute("contenteditable");
    });
    return doc.body.innerHTML;
  } catch (error) {
    console.error("Error sanitizing HTML for viewer:", error);
    return htmlString; // Fallback
  }
};

// --- Course Detail Component ---
const CourseDetail = () => {
  const { username, date, subject, courseTitle } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permalink = `${username}/${date}/${subject}/${courseTitle}`; // Used for API calls now
  const isEditRoute = location.pathname.startsWith("/admin/courses/edit/");

  // --- State Variables ---
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]); // Lessons currently attached to THIS course
  const [userLessonsForDropdown, setUserLessonsForDropdown] = useState([]) // Lessons owned by user NOT attached to THIS course (for dropdown)
  const [subjects, setSubjects] = useState([]); // All subjects
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(""); // General page errors
  const [selectedLesson, setSelectedLesson] = useState(""); // For 'Add Lesson' dropdown
  const [enrolled, setEnrolled] = useState(false); // User enrollment status
  const [enrollMessage, setEnrollMessage] = useState(""); // Message after enroll attempt
  const [addLessonError, setAddLessonError] = useState(""); // Error adding lesson

  // Quiz state
  const [quizzes, setQuizzes] = useState([]); // Quizzes currently attached to THIS course
  const [availableQuizzesForDropdown, setAvailableQuizzesForDropdown] = useState([]); // Filtered quizzes for the 'Add' dropdown // Quizzes owned by user NOT attached to ANY course (for dropdown)
  const [selectedQuiz, setSelectedQuiz] = useState(""); // For 'Add Quiz' dropdown
  const [addQuizError, setAddQuizError] = useState(""); // Error adding quiz

  // Edit mode state
  const [isLocked, setIsLocked] = useState(false); // Course lock status
  const [editMode, setEditMode] = useState(isEditRoute); // Is the page in edit mode?
  const [editCourse, setEditCourse] = useState({}); // Holds data for the edit form
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false); // Loading state for publish/unpublish
  const [statusUpdateMessage, setStatusUpdateMessage] = useState(""); // Message after status update attempt

  // --- Refs ---
  const editorRef = useRef(null); // Ref for the CustomEditor component
  const courseDescriptionDisplayRef = useRef(null); // Ref for the div displaying course description (for accordion)

  // --- Context ---
  const { user, token, logout } = useContext(AuthContext);
  const loggedInUser = user ? user.username : null;

  // --- Fetch Initial Data ---
  useEffect(() => {
    if (!permalink) {
      setError("Course identifier (permalink) is missing."); // Updated error message
      setLoading(false);
      return;
    }
    if (!token) {
      setError("Please log in to view course details.");
      setLoading(false);
      // Optionally redirect to login: navigate('/login');
      return;
    }

    setLoading(true);
    setError("");
    setStatusUpdateMessage("");

    const fetchInitialData = async () => {
      let courseId = null; // Variable to store course ID after fetching
      try {
        // Fetch course details (includes attached lessons/quizzes), user's lessons, and all subjects
        const [courseRes, userLessonsRes, subjectsRes, userQuizzesRes] = await Promise.allSettled([
          apiClient.get(`/courses/${permalink}/`), // Use permalink to fetch course
          apiClient.get("/lessons/my/"), // Get all lessons created by the user
          apiClient.get("/subjects/"),   // Get all subjects
          apiClient.get("/quizzes/my/")   // Get all quizzes created by the user
        ]);

        // Process Course Data
        if (courseRes.status === 'fulfilled' && courseRes.value.data?.course) {
          const fetchedCourse = courseRes.value.data.course;
          const attachedLessons = courseRes.value.data.lessons || [];
          const attachedQuizzes = courseRes.value.data.quizzes || []; // Assuming quizzes are returned here now

          setCourse(fetchedCourse);
          setLessons(attachedLessons);
          setQuizzes(attachedQuizzes); // Set attached quizzes
          setIsLocked(fetchedCourse.is_locked || false);
          courseId = fetchedCourse.id; // Store the ID for filtering later
        } else {
          // If course fetch failed, throw an error to be caught below
          throw new Error(courseRes.reason?.response?.data?.detail || courseRes.reason?.message || 'Course not found or failed to load.');
        }

        // Process User's Lessons for the 'Add Lesson' Dropdown (only if courseId was obtained)
        if (courseId && userLessonsRes.status === 'fulfilled' && Array.isArray(userLessonsRes.value.data)) {
          // Filter out lessons already attached to *this* course
        const lessonsForDropdown = userLessonsRes.value.data.filter(
          (lesson) => lesson.course !== courseId // Use the stored course ID // Use the stored course ID
          );
          setUserLessonsForDropdown(lessonsForDropdown); // Use the new state sette
        } else if (userLessonsRes.status !== 'fulfilled') {
          console.error("Error fetching user lessons:", userLessonsRes.reason?.response?.data || userLessonsRes.reason?.message);
          setUserLessonsForDropdown([]);
        } else {
          setUserLessonsForDropdown([]); // Reset if courseId is null or data format is wrong
        }

         // Process User's Quizzes for the 'Add Quiz' Dropdown
         if (userQuizzesRes.status === 'fulfilled' && Array.isArray(userQuizzesRes.value.data)) {
            // Filter out quizzes already attached to *any* course
            // NOTE: You might want to change this logic if a quiz can belong to multiple courses
            const quizzesForDropdown = userQuizzesRes.value.data.filter(
                (quiz) => quiz.course !== courseId  // Use the stored course ID
              );
              setAvailableQuizzesForDropdown(quizzesForDropdown); // Use the new state setter
          } else {
            console.error("Invalid format or error fetching user quizzes:", userQuizzesRes.reason?.response?.data || userQuizzesRes.reason?.message || userQuizzesRes.value?.data);
            setAvailableQuizzesForDropdown([]);
          }


        // Process Subjects
        if (subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value.data)) {
          setSubjects(subjectsRes.value.data);
        } else {
          console.error("Invalid format or error fetching subjects:", subjectsRes.reason?.response?.data || subjectsRes.reason?.message || subjectsRes.value?.data);
          setSubjects([]);
        }

      } catch (err) {
        console.error("Error fetching initial course data:", err);
        // Handle specific errors (404, 401/403)
        const status = err.response?.status;
        if (status === 404) {
           setError("Course not found (404).");
        } else if (status === 401 || status === 403) {
           setError("Unauthorized. Please log in again.");
           logout();
           navigate("/login");
        } else {
           setError(`Failed to load course data: ${err.message || "Please try again."}`);
        }
        // Reset state on error
        setCourse(null);
        setLessons([]);
        setUserLessonsForDropdown([]);
        setSubjects([]);
        setQuizzes([]);
        setAvailableQuizzesForDropdown([]);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [permalink, token, logout, navigate]); // Dependencies

  // Determine if the current user is the creator
  const isCreator = user && course && user.username.toLowerCase() === course.created_by.toLowerCase();

  // Effect to automatically enter edit mode if it's the creator's draft or edit route
   useEffect(() => {
     // Condition: course loaded, user is creator, not already in edit mode, AND (on edit route OR it's a draft)
     if (
       course &&
       isCreator &&
       !editMode &&
       (isEditRoute || course.is_draft)
     ) {
       // Find the subject object for the dropdown default value
       const subjectObj = subjects.find(s => s.id === course.subject) || { id: course.subject, name: "Unknown Subject" };

       // Pre-fill the edit form state
       setEditCourse({
         title: course.title || '',
         description: course.description || '',
         subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null, // Format for react-select
         tags: Array.isArray(course.tags) ? course.tags.join(", ") : "",
       });
       setEditMode(true); // Enter edit mode
     }
   }, [course, subjects, isCreator, isEditRoute, editMode]); // Dependencies


  // Accordion Initialization Effect for Course Description
  useEffect(() => {
    // Only run in read mode when description and ref are available
    if (!editMode && course?.description && courseDescriptionDisplayRef.current) {
      const container = courseDescriptionDisplayRef.current;
      let animationFrameId = null;

      // --- Cleanup Phase ---
      const initializedAccordions = container.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
      initializedAccordions.forEach((accordion) => {
        const header = accordion.querySelector(".accordion-header");
        if (header && header.__accordionClickHandler__) {
          header.removeEventListener("click", header.__accordionClickHandler__);
          delete header.__accordionClickHandler__;
        }
        if (accordion.dataset.accordionInitialized) {
            delete accordion.dataset.accordionInitialized;
        }
      });

      // --- Initialization Phase ---
      // Use rAF for better timing after potential DOM updates
      animationFrameId = requestAnimationFrame(() => {
        if (courseDescriptionDisplayRef.current) { // Check ref still exists
          initializeAccordions(courseDescriptionDisplayRef.current);
        }
      });

      // --- Cleanup Function ---
      return () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
        // Perform cleanup again on unmount or dependency change
        if (container) {
            const accordionsToClean = container.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
             accordionsToClean.forEach((accordion) => {
                 const header = accordion.querySelector(".accordion-header");
                 if (header && header.__accordionClickHandler__) {
                     header.removeEventListener("click", header.__accordionClickHandler__);
                     delete header.__accordionClickHandler__;
                 }
                 if (accordion.dataset.accordionInitialized) {
                     delete accordion.dataset.accordionInitialized;
                 }
             });
        }
      };
    }
  }, [editMode, course?.description]); // Dependencies


  // Enrollment Status Fetch Effect
  useEffect(() => {
    if (course?.id && token) { // Only run if course and token exist
      const fetchEnrollmentStatus = async () => {
        try {
          const response = await apiClient.get("/enrollments/user/");
          if (response.data && Array.isArray(response.data)) {
            const enrollments = response.data;
            // Check if there's an enrollment matching this course ID
            const isEnrolled = enrollments.some(
                (e) => e.enrollment_type === "course" && e.object_id === course.id
            );
            setEnrolled(isEnrolled);
          } else {
            console.warn("Enrollment data received but not in expected format:", response.data);
            setEnrolled(false);
          }
        } catch (err) {
          console.error("Error fetching enrollment status:", err.response ? err.response.data : err.message);
          setEnrolled(false);
          if (err.response?.status === 401 || err.response?.status === 403) {
            // Handle unauthorized access, maybe logout or show message
             // logout(); // Example action
          }
        }
      };
      fetchEnrollmentStatus();
    } else {
      // If no course ID or token, assume not enrolled
      setEnrolled(false);
    }
  }, [course, token]); // Dependencies: course object and token


  // --- Handlers ---

  // Enroll Handler (Handles Free & Premium)
  const handleEnroll = async () => {
    if (!course?.id) {
      console.error("Enrollment attempted without course ID.");
      setEnrollMessage("Cannot enroll: Course ID missing.");
      return;
    }
    localStorage.setItem("courseId", course.id); // Store course ID for potential post-payment redirect handling
    setEnrollMessage("Processing enrollment..."); // Provide feedback

    // --- Premium Course: Redirect to Stripe Checkout ---
    if (course.course_type === "premium") {
      try {
        // Request a checkout session from the backend
        const response = await apiClient.post("/payments/create-checkout-session/", {
          course_id: course.id,
        });
        const data = response.data;
        if (data && data.sessionId) {
          // Redirect to Stripe checkout page
          const stripe = await stripePromise;
          const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (stripeError) {
            console.error("Stripe redirect error:", stripeError.message);
            setEnrollMessage(`Payment initiation failed: ${stripeError.message}`);
          }
          // If redirect is successful, the user leaves this page.
          // Enrollment confirmation should happen via webhook or on redirect back.
        } else {
          // Handle cases where the backend didn't return a session ID
          console.error("API Error: Checkout session ID not received.", data);
          setEnrollMessage(`Payment setup failed: ${data?.error || "Missing session ID."}`);
        }
      } catch (err) {
        console.error("Create checkout session error:", err.response ? err.response.data : err.message);
        setEnrollMessage(`Payment setup error: ${err.response?.data?.error || err.message || "Please try again."}`);
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout(); // Log out if unauthorized
        }
      }
    }
    // --- Free Course: Enroll Directly via API ---
    else {
      try {
        const enrollmentData = {
          object_id: course.id,
          enrollment_type: "course",
        };
        await apiClient.post("/enrollments/", enrollmentData);
        setEnrolled(true); // Update state immediately
        setEnrollMessage("Enrollment successful!");
      } catch (err) {
        console.error("Free enrollment error:", err.response ? err.response.data : err.message);
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setEnrollMessage(`Enrollment failed: ${apiErrorMessage || "Please try again."}`);
        setEnrolled(false); // Ensure state reflects failure
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout(); // Log out if unauthorized
        }
      }
    }
  };

  // Add Lesson Handler
  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!selectedLesson || !permalink) return; // Guard clause - use permalink
    setAddLessonError(""); // Clear previous error

    try {
      // API call to associate the selected lesson with the current course
      // *** FIX: Use permalink in the URL ***
      const response = await apiClient.post(`/courses/${permalink}/add-lesson/`, {
        lesson_id: selectedLesson,
      });

      const addedLesson = response.data?.lesson || response.data; // Adjust based on your API response structure

      if (addedLesson && addedLesson.id) {
        // Add the newly attached lesson to the local 'lessons' state
        setLessons(prevLessons => [...prevLessons, addedLesson]);
        // Remove the added lesson from the 'available' list in the dropdown
        setUserLessonsForDropdown((prevUserLessons) =>
          prevUserLessons.filter((lesson) => lesson.id !== parseInt(selectedLesson))
        );
        setSelectedLesson(""); // Reset dropdown
      } else {
        console.error("Add lesson API response missing expected data:", response.data);
        setAddLessonError("Failed to update lesson list after adding. Response format unexpected.");
      }
    } catch (err) {
      console.error("Error attaching lesson:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      setAddLessonError(`Failed to attach lesson: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Detach Lesson Handler
  const handleDetachLesson = async (lessonId) => {
    if (!permalink || !lessonId) return; // Guard clause - use permalink
    const confirmDetach = window.confirm("Are you sure you want to detach this lesson from the course?");
    if (!confirmDetach) return;

    try {
      // API call to detach the lesson
      // *** FIX: Use permalink in the URL ***
       await apiClient.post(`/courses/${permalink}/detach-lesson/`, {
        lesson_id: lessonId,
      });

      // Find the details of the lesson being detached
      const detachedLessonDetails = lessons.find((lesson) => lesson.id === lessonId);

      // Remove the lesson from the local 'lessons' state (attached lessons)
      setLessons((prevLessons) => prevLessons.filter((lesson) => lesson.id !== lessonId));

      // Add the detached lesson back to the 'userLessonsForDropdown' state (available lessons dropdown)
      if (detachedLessonDetails) {
        setUserLessonsForDropdown((prevUserLessons) => {
          // Avoid adding duplicates if it somehow already exists
          if (!prevUserLessons.some((lesson) => lesson.id === detachedLessonDetails.id)) {
            return [...prevUserLessons, detachedLessonDetails];
          }
          return prevUserLessons;
        });
      } else {
        console.warn("Could not find details of the detached lesson to add back to dropdown.");
        // Consider re-fetching userLessonsForDropdown here as a fallback if details aren't found
      }

      alert("Lesson detached successfully."); // Success feedback

    } catch (err) {
      console.error("Error detaching lesson:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      alert(`Failed to detach lesson: ${apiErrorMessage || "Please try again."}`); // Error feedback
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Add Quiz Handler
   const handleAddQuiz = async (e) => {
     e.preventDefault();
     if (!selectedQuiz || !permalink) return; // Guard clause - use permalink
     setAddQuizError("");

     try {
       // *** FIX: Use permalink in the URL ***
       const response = await apiClient.post(`/courses/${permalink}/add-quiz/`, {
         quiz_id: selectedQuiz,
       });
       const addedQuiz = response.data?.quiz || response.data; // Adjust based on API response

       if (addedQuiz && addedQuiz.id) {
         // Add to local 'quizzes' state (attached quizzes)
         setQuizzes(prevQuizzes => [...prevQuizzes, addedQuiz]);
         // Remove from 'availableQuizzesForDropdown' state (dropdown)
         setAvailableQuizzesForDropdown((prevAvailable) =>
           prevAvailable.filter((quiz) => quiz.id !== parseInt(selectedQuiz))
         );
         setSelectedQuiz(""); // Reset dropdown
       } else {
         console.error("Add quiz API response missing expected data:", response.data);
         setAddQuizError("Failed to update quiz list after adding. Response format unexpected.");
       }
     } catch (err) {
       console.error("Error attaching quiz:", err.response ? err.response.data : err.message);
       const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
       setAddQuizError(`Failed to attach quiz: ${apiErrorMessage || "Please try again."}`);
       if (err.response?.status === 401 || err.response?.status === 403) {
         logout();
       }
     }
   };

  // Detach Quiz Handler
   const handleDetachQuiz = async (quizId) => {
        if (!permalink || !quizId) return; // Guard clause - use permalink
     const confirmDetach = window.confirm("Are you sure you want to detach this quiz from the course?");
     if (!confirmDetach) return;

     try {
       // *** FIX: Use permalink in the URL ***
       await apiClient.post(`/courses/${permalink}/detach-quiz/`, {
         quiz_id: quizId,
       });

       // Find details of the detached quiz
       const detachedQuizDetails = quizzes.find((quiz) => quiz.id === quizId);

       // Remove from local 'quizzes' state (attached quizzes)
       setQuizzes((prevQuizzes) => prevQuizzes.filter((quiz) => quiz.id !== quizId));

       // Add back to 'availableQuizzesForDropdown' state (dropdown)
       if (detachedQuizDetails) {
         setAvailableQuizzesForDropdown((prevAvailable) => {
           // Avoid duplicates
           if (!prevAvailable.some((quiz) => quiz.id === detachedQuizDetails.id)) {
             return [...prevAvailable, detachedQuizDetails];
           }
           return prevAvailable;
         });
       } else {
         console.warn("Could not find details of the detached quiz to add back to dropdown.");
         // Consider re-fetching availableQuizzesForDropdown as a fallback
       }

       alert("Quiz detached successfully."); // Success feedback

     } catch (err) {
       console.error("Error detaching quiz:", err.response ? err.response.data : err.message);
       const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
       alert(`Failed to detach quiz: ${apiErrorMessage || "Please try again."}`); // Error feedback
       if (err.response?.status === 401 || err.response?.status === 403) {
         logout();
       }
     }
   };

  // Edit Mode Click Handler (Enters Edit Mode)
  const handleEditClick = () => {
    if (!course) return; // Should not happen if button is visible, but good practice
    // Find the subject object for the dropdown
    const subjectObj = subjects.find((subj) => subj.id === course.subject) || { id: course.subject, name: "Unknown Subject" };
    // Pre-fill the edit form state
    setEditCourse({
      title: course.title || '',
      description: course.description || '',
      subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null,
      tags: course.tags && Array.isArray(course.tags) ? course.tags.join(", ") : "",
    });
    setEditMode(true); // Enter edit mode
    setStatusUpdateMessage(""); // Clear any status messages
    setError(""); // Clear general errors
  };

  // Cancel Edit Handler
  const handleCancelEdit = () => {
    setEditMode(false); // Exit edit mode
    setEditCourse({}); // Clear edit form state
    setError(""); // Clear potential form errors
  };

  // Save Edit Handler (Updates Course Content/Metadata)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editCourse || !course || !editorRef.current) {
        setError("Cannot save: Form data, course data, or editor is missing.");
        return;
    };

    // Get current content from the editor
    const updatedDescription = editorRef.current.getContent();

    // Validate required fields (example: title and subject)
    if (!editCourse.title?.trim() || !editCourse.subject?.value) {
        setError("Title and Subject are required.");
        return;
    }


    // Prepare payload - only include fields managed by this form
    const payload = {
      title: editCourse.title,
      subject: editCourse.subject.value, // Send only the subject ID
      tags: editCourse.tags ? editCourse.tags.split(",").map((tag) => tag.trim()).filter(tag => tag) : [], // Process tags
      description: updatedDescription,
      // DO NOT send is_draft here - use separate publish/unpublish actions
    };

    setError(""); // Clear previous errors before API call

    try {
      // Use PUT request to the update endpoint
      // *** FIX: Use permalink in the URL ***
      const response = await apiClient.put(`/courses/${permalink}/update/`, payload);
      const updatedCourseData = response.data;

      // Update local course state with the full response from the backend
      // This ensures the view reflects the saved data, including potentially unchanged fields like is_draft
      setCourse(updatedCourseData);
      setLessons(updatedCourseData.lessons || []); // Update lessons if returned
      setQuizzes(updatedCourseData.quizzes || []); // Update quizzes if returned

      setEditMode(false); // Exit edit mode on success
      alert("Course content updated successfully.");

    } catch (err) {
      console.error("Error updating course content:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message || "Unknown error";
      // Display error message to the user within the form
      setError(`Error updating course: ${apiErrorMessage}`);
      // Keep editMode true so the user sees the error and can retry
    }
  };

  // Delete Course Handler
  const handleDeleteCourse = async () => {
    if (!course?.id || isLocked) { // Keep using ID for delete confirmation if needed, but permalink for API
        alert("Course cannot be deleted (missing ID or locked).");
        return;
    };
    // Confirmation dialog
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this course? This action cannot be undone and will detach all lessons and quizzes."
    );
    if (!confirmDelete) return;

    try {
       // *** FIX: Use permalink in the URL ***
      await apiClient.delete(`/courses/${permalink}/delete/`);
      alert("Course deleted successfully.");
      navigate("/courses"); // Navigate away after successful deletion
    } catch (err) {
      console.error("Error deleting course:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.message || "Please try again.";
      alert(`Error deleting course: ${apiErrorMessage}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Publish Course Handler
  const handlePublishCourse = async () => {
    if (!course || isLocked) return; // Cannot publish if no course or locked

    const confirmPublish = window.confirm("Are you sure you want to publish this course? Students will be able to enroll.");
    if (!confirmPublish) return;

    setIsUpdatingStatus(true); // Set loading state
    setStatusUpdateMessage("Publishing...");

    try {
      // Assumes a dedicated POST endpoint for the publish action
      // *** FIX: Use permalink in the URL ***
      await apiClient.post(`/courses/${permalink}/publish/`);

      // OPTION 1 (Safer): Refetch course data to ensure consistency
      // const refetchResponse = await apiClient.get(`/courses/${permalink}/`);
      // if (refetchResponse.data && refetchResponse.data.course) {
      //   setCourse(refetchResponse.data.course); // Update with fresh data
      //   setStatusUpdateMessage("Course published successfully!");
      // } else {
      //   throw new Error("Failed to refetch course details after publishing.");
      // }

      // OPTION 2 (Simpler): Manually update local state if API only toggles the flag
       setCourse(prevCourse => ({ ...prevCourse, is_draft: false })); // Assume is_draft becomes false
       setStatusUpdateMessage("Course published successfully!");


    } catch (err) {
      console.error("Error publishing course:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.message || "Please try again.";
      setStatusUpdateMessage(`Error publishing: ${apiErrorMessage}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setIsUpdatingStatus(false); // Clear loading state
      // Optional: Clear message after a delay
      // setTimeout(() => setStatusUpdateMessage(""), 5000);
    }
  };

  // Unpublish Course Handler (Set back to Draft)
  const handleUnpublishCourse = async () => {
    if (!course || isLocked) return; // Cannot unpublish if no course or locked

    const confirmUnpublish = window.confirm("Are you sure you want to unpublish this course and set it back to a draft?");
    if (!confirmUnpublish) return;

    setIsUpdatingStatus(true); // Set loading state
    setStatusUpdateMessage("Setting to draft...");

    try {
      // Assumes using the existing PUT update endpoint is sufficient
      // If you have a dedicated /unpublish/ endpoint, use that instead.
      const payload = { is_draft: true }; // Only send the flag to change
      // *** FIX: Use permalink in the URL ***
      const response = await apiClient.put(`/courses/${permalink}/update/`, payload);

      // Update local state with the full response from the backend
      setCourse(response.data);
      setStatusUpdateMessage("Course set to draft successfully!");

    } catch (err) {
      console.error("Error unpublishing course:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.message || "Please try again.";
      setStatusUpdateMessage(`Error setting to draft: ${apiErrorMessage}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setIsUpdatingStatus(false); // Clear loading state
       // Optional: Clear message after a delay
      // setTimeout(() => setStatusUpdateMessage(""), 5000);
    }
  };

  // Effect to update edit form state if course data changes while in edit mode
  useEffect(() => {
    if (editMode && course) {
      const subjectObj = subjects.find((s) => s.id === course.subject) || { id: course.subject, name: "" };
      setEditCourse(prevEdit => ({
        ...prevEdit, // Keep potentially unsaved changes if desired, or reset fully:
        title: course.title,
        description: course.description,
        subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null,
        tags: Array.isArray(course.tags) ? course.tags.join(", ") : "",
      }));
    }
  }, [editMode, course, subjects]); // Rerun if course or subjects change while editing


  // --- Loading / Error / Not Found States ---
  if (loading) return (
      <div className={styles.loadingMessage}>
        <FaSpinner className={styles.spinner} /> Loading Course Details…
      </div>
    );
  // Show general page error only when NOT in edit mode (form handles its own errors)
  if (error && !editMode) return <p className={styles.errorMessage}>{error}</p>;
  if (!course) return <p className={styles.loadingMessage}>Course data not available.</p>; // Or a more specific 'Not Found' message if error state indicates 404


  // --- Render Logic ---
  return (
    <div className={styles.courseDetailContainer}>

      {/* --- Edit Mode View --- */}
      {editMode && isCreator ? (
        <div className={styles.editCourseForm}>
          <h2>Manage Course</h2>

          {/* --- Edit Form --- */}
          <form onSubmit={handleSaveEdit}>
            {/* Title */}
            <div className={styles.formGroup}>
              <label htmlFor="courseTitleEdit">Title:</label>
              <input
                id="courseTitleEdit"
                type="text"
                value={editCourse.title || ""}
                onChange={e => setEditCourse({ ...editCourse, title: e.target.value })}
                required
                className={styles.inputField} // Add consistent styling
              />
            </div>

            {/* Content Editor */}
            <div className={styles.formGroup}>
              <label htmlFor="courseDescriptionEdit">Content:</label>
              <CustomEditor
                id="courseDescriptionEdit" // Add id for label association
                ref={editorRef}
                initialContent={editCourse.description || ""}
                mediaCategory="course"
                editable={true}
              />
               {/* Display validation error for the form */}
               {error && <p className={`${styles.error} ${styles.formError}`}>{error}</p>}
            </div>

            {/* Subject */}
            <div className={styles.formGroup}>
              <label htmlFor="courseSubjectEdit">Subject:</label>
              <CreateSubjectSelect
                id="courseSubjectEdit"
                value={editCourse.subject}
                onChange={sel => setEditCourse({ ...editCourse, subject: sel })}
                required
              />
            </div>

            {/* Tags */}
            <div className={styles.formGroup}>
              <label htmlFor="courseTagsEdit">Tags (comma separated):</label>
              <input
                id="courseTagsEdit"
                type="text"
                value={editCourse.tags || ""}
                onChange={e => setEditCourse({ ...editCourse, tags: e.target.value })}
                className={styles.inputField} // Add consistent styling
              />
            </div>
             {/* Form-level error message display */}
             {error && <p className={`${styles.error} ${styles.formError}`}>{error}</p>}

          {/* Save/Cancel Buttons (Moved here, submit handled by form's onSubmit) */}
          <div className={styles.formActions}>
              <button type="submit" className={styles.saveBtn}>Save Content Changes</button>
              <button type="button" className={styles.cancelBtn} onClick={handleCancelEdit}>Cancel Edit</button>
          </div>
          </form> {/* End of the main edit form */}


          {/* --- Course Status Section --- */}
          <div className={styles.courseStatusActions}>
            <h4>Status</h4>
            <p>
              Current Status: {course.is_draft
                ? <strong style={{ color: 'orange' }}>Draft</strong>
                : <strong style={{ color: 'green' }}>Published</strong>}
                 {isLocked && <span className={styles.lockedBadge}>🔒 Locked</span>}
            </p>
            {/* Publish/Unpublish Buttons */}
            {!isLocked && ( // Only show if not locked
                <>
                 {course.is_draft
                    ? <button onClick={handlePublishCourse} disabled={isUpdatingStatus} className={styles.publishBtn}>
                        {isUpdatingStatus ? 'Publishing…' : 'Publish Now'}
                      </button>
                    : <button onClick={handleUnpublishCourse} disabled={isUpdatingStatus} className={styles.unpublishBtn}>
                        {isUpdatingStatus ? 'Working…' : 'Set to Draft'}
                      </button>
                 }
                </>
            )}
            {statusUpdateMessage && <p className={styles.message}>{statusUpdateMessage}</p>}
          </div>


          {/* --- Attach/Detach Content Section --- */}
          <div className={styles.addContentSection}>
            <h4>Manage Content</h4>

             {/* Display Currently Attached Lessons */}
             <div className={styles.attachedContentList}>
                <h5>Currently Attached Lessons ({lessons.length})</h5>
                {lessons.length > 0 ? (
                    <ul>
                        {lessons.map(lesson => (
                            <li key={lesson.id} className={styles.attachedItem}>
                                <span>{lesson.title}</span>
                                <button
                                    onClick={() => handleDetachLesson(lesson.id)}
                                    className={styles.detachBtn} // Use specific detach style
                                    disabled={isLocked}
                                    title="Detach Lesson"
                                >
                                    <FaTimes /> {/* Detach Icon */}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No lessons attached yet.</p>
                )}
            </div>

            {/* Add Lesson Form */}
            <div className={styles.addContentForm}>
                <h5><FaPlus /> Add a Lesson</h5>
                <form onSubmit={handleAddLesson}>
                <select
                    value={selectedLesson}
                    onChange={e => { setSelectedLesson(e.target.value); setAddLessonError(''); }}
                    className={styles.dropdown}
                    disabled={isLocked}
                >
                    <option value="">Select a lesson to add...</option>
                    {/* Ensure userLessonsForDropdown only contains lessons NOT already attached */}
                    {/* Map over lessons available for dropdown */}
                {userLessonsForDropdown.map(l => {
                    const isAttachedElsewhere = l.course && l.course !== course.id; // Check if attached to a DIFFERENT course
                    const displayText = isAttachedElsewhere
                        // *** Assumes l.course_data exists if l.course is present ***
                        // Adjust 'Another Course' if course_data might be missing
                        ? `${l.title} (Attached to: ${l.course_data?.title || 'Another Course'})`
                        : l.title; // Otherwise, just the title
                    return (
                        <option
                            key={l.id}
                            value={l.id}
                            disabled={isAttachedElsewhere} // Disable if attached elsewhere
                            className={isAttachedElsewhere ? styles.disabledOption : ''} // Optional: Add class for styling disabled options
                        >
                            {displayText}
                        </option>
                    );
                })}
                </select>
                <button type="submit" disabled={!selectedLesson || isLocked} className={styles.addBtn}>Add Lesson</button>
                </form>
                {addLessonError && <p className={`${styles.error} ${styles.formError}`}>{addLessonError}</p>}
            </div>

            <hr className={styles.sectionDivider} /> {/* Divider */}

            {/* Display Currently Attached Quizzes */}
             <div className={styles.attachedContentList}>
                <h5>Currently Attached Quizzes ({quizzes.length})</h5>
                {quizzes.length > 0 ? (
                    <ul>
                        {quizzes.map(quiz => (
                            <li key={quiz.id} className={styles.attachedItem}>
                                <span>{quiz.title}</span>
                                <button
                                    onClick={() => handleDetachQuiz(quiz.id)}
                                    className={styles.detachBtn} // Use specific detach style
                                    disabled={isLocked}
                                    title="Detach Quiz"
                                >
                                     <FaTimes /> {/* Detach Icon */}
                                </button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No quizzes attached yet.</p>
                )}
            </div>

            {/* Add Quiz Form */}
             <div className={styles.addContentForm}>
                <h5><FaPlus /> Attach a Quiz</h5>
                <form onSubmit={handleAddQuiz}>
                <select
                    value={selectedQuiz}
                    onChange={e => { setSelectedQuiz(e.target.value); setAddQuizError(''); }}
                    className={styles.dropdown}
                    disabled={isLocked}
                >
                    <option value="">Select a quiz to attach...</option>
                     {/* Ensure availableQuizzesForDropdown only contains quizzes NOT already attached */}
                     +                 {/* Map over quizzes available for dropdown */}
                {availableQuizzesForDropdown.map(q => {
                     const isAttachedElsewhere = q.course && q.course !== course.id; // Check if attached to a DIFFERENT course
                     const displayText = isAttachedElsewhere
                        // *** Assumes q.course_data exists if q.course is present ***
                        // Adjust 'Another Course' if course_data might be missing
                        ? `${q.title} (Attached to: ${q.course_data?.title || 'Another Course'})`
                        : q.title; // Otherwise, just the title
                     return (
                        <option
                            key={q.id}
                            value={q.id}
                            disabled={isAttachedElsewhere} // Disable if attached elsewhere
                            className={isAttachedElsewhere ? styles.disabledOption : ''} // Optional styling class
                        >
                            {displayText}
                        </option>
                     );
                })}
                </select>
                <button type="submit" disabled={!selectedQuiz || isLocked} className={styles.addBtn}>Attach Quiz</button>
                </form>
                {addQuizError && <p className={`${styles.error} ${styles.formError}`}>{addQuizError}</p>}
            </div>
          </div>


          {/* --- Delete Course Section --- */}
          <div className={styles.courseContentActions}>
             <h4>Danger Zone</h4>
            <button className={styles.courseDeleteBtn} onClick={handleDeleteCourse} disabled={isLocked}>
                Delete This Course Permanently
            </button>
             <p className={styles.warningText}>This action cannot be undone.</p>
          </div>

        </div> /* End of editCourseForm */

      ) : (
        /* --- Read-only View --- */
        <>
          {/* Title */}
          <h1 className={styles.courseTitle}>{course.title}</h1>
          
          {course?.cover_image ? (
            <img
              src={course.cover_image}
              alt={course.title}
              className={styles.courseImage}
            />
          ) : (
            <div className={styles.courseImagePlaceholder}>
              No Image Available
            </div>
          )}

          {/* Subject/Tags Info */}
          <div className={styles.courseInfo}>
             {course.subject_name && <span>Subject: {course.subject_name}</span>}
             {course.tags?.length > 0 && (
                <span style={{ marginLeft: course.subject_name ? '15px' : '0' }}>
                    Tags: {course.tags.map(tag => <span key={tag} className={styles.tag}>#{tag}</span>)}
                </span>
             )}
          </div>

          {/* Description (with Accordion support) */}
          <div
            className={`${styles.courseDescription} displayed-content`} // Ensure displayed-content class is present for ViewerAccordion.css
            ref={courseDescriptionDisplayRef}
            dangerouslySetInnerHTML={{
              __html: sanitizeContentViewerHTML(course.description),
            }}
          />

          {/* Lessons List (Read-only) */}
          {lessons.length > 0 && (
            <section className={styles.lessonsSection}> {/* Added specific class */}
              <h2 className={styles.sectionTitle}><FaBook /> Lessons in this Course</h2>
              <ul className={styles.lessonsList}>
                {lessons.map(lesson => (
                  <li key={lesson.id} className={styles.lessonItem}>
                    <span>{lesson.title}</span>
                    {/* Allow enrolled users or creator to study */}
                    {(enrolled || isCreator) && (
                        <div className={styles.lessonItemActions}>
                        <button
                            className={styles.studyBtn}
                            onClick={() => navigate(`/lessons/${lesson.permalink}`)}
                            title={`Study lesson: ${lesson.title}`}
                        >
                            <FaBookOpen/> Study
                        </button>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

           {/* Quizzes List (Read-only) */}
           {quizzes.length > 0 && (
            <section className={styles.quizzesSection}> {/* Added specific class */}
              <h2 className={styles.sectionTitle}><FaQuestion /> Quizzes in this Course</h2>
              <ul className={styles.quizzesList}> {/* Use a different class if needed */}
                {quizzes.map(quiz => (
                  <li key={quiz.id} className={styles.quizItem}> {/* Use a different class if needed */}
                    <span>{quiz.title}</span>
                     {/* Allow enrolled users or creator to take quiz */}
                     {(enrolled || isCreator) && (
                        <div className={styles.quizItemActions}>
                            {/* Adjust navigation based on how quizzes are accessed */}
                            <button
                                className={styles.studyBtn} // Reuse style or create new
                                onClick={() => navigate(`/quizzes/take/${quiz.id}`)} // Example path
                                title={`Take quiz: ${quiz.title}`}
                            >
                                <FaQuestion/> Take Quiz
                            </button>
                        </div>
                     )}
                  </li>
                ))}
              </ul>
            </section>
          )}


          {/* Enroll / Buy Section (Only for non-creators) */}
          {!isCreator && (
            <div className={styles.enrollSection}>
              {enrolled ? (
                <button className={`${styles.btn} ${styles.enrolled}`} disabled>
                  Enrolled
                </button>
              ) : (
                <button className={`${styles.btn} ${styles.enrollBtn}`} onClick={handleEnroll} disabled={course.is_draft}>
                  {/* Disable enroll if course is draft */}
                  {course.course_type === "premium" ? `Buy Course ($${course.price || 'N/A'})` : "Enroll Now"}
                </button>
              )}
              {enrollMessage && <p className={styles.message}>{enrollMessage}</p>}
               {course.is_draft && <p className={styles.message}> (This course is currently a draft and cannot be enrolled in)</p>}
            </div>
          )}

           {/* Edit Button (Only for creators, shown in read-only view) */}
           {isCreator && !editMode && (
               <div className={styles.editButtonContainer}>
                    <button onClick={handleEditClick} className={styles.courseDetailEditBtn}>
                        Manage Course Content & Settings
                    </button>
               </div>
           )}
        </>
      )}
    </div> // End courseDetailContainer
  );
};

export default CourseDetail;
