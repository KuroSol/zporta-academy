import React, { useEffect, useState, useContext, useRef, useLayoutEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaBook, FaQuestion, FaSpinner, FaBookOpen, FaTimes } from "react-icons/fa";
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

// --- Helper Functions (Unchanged) ---
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

    if (header.__accordionClickHandler__) {
      header.removeEventListener("click", header.__accordionClickHandler__);
    }
    header.addEventListener("click", clickHandler);
    header.__accordionClickHandler__ = clickHandler;

    contents.forEach((content) => {
      requestAnimationFrame(() => {
        initializeAccordions(content);
      });
    });
  });
}

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
    return htmlString;
  }
};

// --- Main Course Detail Component ---
const CourseDetail = () => {
  const { username, date, subject, courseTitle } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const permalink = `${username}/${date}/${subject}/${courseTitle}`;
  const isEditRoute = location.pathname.startsWith("/admin/courses/edit/");

  // --- State Variables (Original) ---
  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [userLessonsForDropdown, setUserLessonsForDropdown] = useState([])
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedLesson, setSelectedLesson] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState("");
  const [addLessonError, setAddLessonError] = useState("");
  const [enrollmentId, setEnrollmentId] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [availableQuizzesForDropdown, setAvailableQuizzesForDropdown] = useState([]);
  const [selectedQuiz, setSelectedQuiz] = useState("");
  const [addQuizError, setAddQuizError] = useState("");
  const [isLocked, setIsLocked] = useState(false);
  const [editMode, setEditMode] = useState(isEditRoute);
  const [editCourse, setEditCourse] = useState({});
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusUpdateMessage, setStatusUpdateMessage] = useState("");

  // --- Refs (Original + New) ---
  const editorRef = useRef(null);
  const courseDescriptionDisplayRef = useRef(null);
  // --- NEW Refs for scaling ---
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);

  // --- Context (Original) ---
  const { user, token, logout } = useContext(AuthContext);

  // --- NEW Scaling Logic ---
  useLayoutEffect(() => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper) return;

    // This width must match the `width` in the new CSS file.
    const designWidth = 1000;

    const handleResize = () => {
      const availableWidth = wrapper.offsetWidth;
      const scale = Math.min(1, availableWidth / designWidth);

      container.style.transform = `scale(${scale})`;
      container.style.transformOrigin = 'top center';
      wrapper.style.height = `${container.offsetHeight * scale}px`;
    };

    wrapper.style.display = 'flex';
    wrapper.style.justifyContent = 'center';

    const observer = new MutationObserver(handleResize);
    observer.observe(container, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
    });
    
    window.addEventListener('resize', handleResize);
    handleResize(); // Initial call

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, [loading]); // Re-calculates when loading state changes

  // --- All original useEffects and handlers remain unchanged ---
  useEffect(() => {
    if (!permalink) {
      setError("Course identifier (permalink) is missing.");
      setLoading(false);
      return;
    }
    if (!token) {
      setError("Please log in to view course details.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setStatusUpdateMessage("");

    const fetchInitialData = async () => {
      let courseId = null;
      try {
        const [courseRes, userLessonsRes, subjectsRes, userQuizzesRes] = await Promise.allSettled([
          apiClient.get(`/courses/${permalink}/`),
          apiClient.get("/lessons/my/"),
          apiClient.get("/subjects/"),
          apiClient.get("/quizzes/my/")
        ]);

        if (courseRes.status === 'fulfilled' && courseRes.value.data?.course) {
          const fetchedCourse = courseRes.value.data.course;
          const attachedLessons = courseRes.value.data.lessons || [];
          const attachedQuizzes = courseRes.value.data.quizzes || [];

          setCourse(fetchedCourse);
          setLessons(attachedLessons);
          setQuizzes(attachedQuizzes);
          setIsLocked(fetchedCourse.is_locked || false);
          courseId = fetchedCourse.id;
        } else {
          throw new Error(courseRes.reason?.response?.data?.detail || courseRes.reason?.message || 'Course not found or failed to load.');
        }

        if (courseId && userLessonsRes.status === 'fulfilled' && Array.isArray(userLessonsRes.value.data)) {
        const lessonsForDropdown = userLessonsRes.value.data.filter(
          (lesson) => lesson.course !== courseId
          );
          setUserLessonsForDropdown(lessonsForDropdown);
        } else if (userLessonsRes.status !== 'fulfilled') {
          console.error("Error fetching user lessons:", userLessonsRes.reason?.response?.data || userLessonsRes.reason?.message);
          setUserLessonsForDropdown([]);
        } else {
          setUserLessonsForDropdown([]);
        }

         if (userQuizzesRes.status === 'fulfilled' && Array.isArray(userQuizzesRes.value.data)) {
            const quizzesForDropdown = userQuizzesRes.value.data.filter(
                (quiz) => quiz.course !== courseId
              );
              setAvailableQuizzesForDropdown(quizzesForDropdown);
          } else {
            console.error("Invalid format or error fetching user quizzes:", userQuizzesRes.reason?.response?.data || userQuizzesRes.reason?.message || userQuizzesRes.value?.data);
            setAvailableQuizzesForDropdown([]);
          }


        if (subjectsRes.status === 'fulfilled' && Array.isArray(subjectsRes.value.data)) {
          setSubjects(subjectsRes.value.data);
        } else {
          console.error("Invalid format or error fetching subjects:", subjectsRes.reason?.response?.data || subjectsRes.reason?.message || subjectsRes.value?.data);
          setSubjects([]);
        }

      } catch (err) {
        console.error("Error fetching initial course data:", err);
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
  }, [permalink, token, logout, navigate]);

  const isCreator = user && course && user.username.toLowerCase() === course.created_by.toLowerCase();

   useEffect(() => {
     if (
       course &&
       isCreator &&
       !editMode &&
       (isEditRoute || course.is_draft)
     ) {
       const subjectObj = subjects.find(s => s.id === course.subject) || { id: course.subject, name: "Unknown Subject" };

       setEditCourse({
         title: course.title || '',
         description: course.description || '',
         subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null,
         tags: Array.isArray(course.tags) ? course.tags.join(", ") : "",
       });
       setEditMode(true);
     }
   }, [course, subjects, isCreator, isEditRoute, editMode]);


  useEffect(() => {
    if (!editMode && course?.description && courseDescriptionDisplayRef.current) {
      const container = courseDescriptionDisplayRef.current;
      let animationFrameId = null;

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

      animationFrameId = requestAnimationFrame(() => {
        if (courseDescriptionDisplayRef.current) {
          initializeAccordions(courseDescriptionDisplayRef.current);
        }
      });

      return () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
        }
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
  }, [editMode, course?.description]);



  useEffect(() => {
    if (course?.id && token) {
      const fetchEnrollmentStatus = async () => {
        try {
          const response = await apiClient.get("/enrollments/user/");
          if (response.data && Array.isArray(response.data)) {
           const match = response.data.find(
             e => e.enrollment_type === "course" && e.object_id === course.id
           );
           if (match) {
             setEnrollmentId(match.id);
             setEnrolled(true);
           } else {
             setEnrollmentId(null);
             setEnrolled(false);
           }
          } else {
            console.warn("Enrollment data received but not in expected format:", response.data);
            setEnrollmentId(null);
            setEnrolled(false);
          }
        } catch (err) {
          console.error("Error fetching enrollment status:", err);
          setEnrollmentId(null);
          setEnrolled(false);
        }
      };
      fetchEnrollmentStatus();
    } else {
      setEnrollmentId(null);
      setEnrolled(false);
    }
  }, [course, token]);


  useEffect(() => {
    if (enrolled && enrollmentId) {
      navigate(`/courses/enrolled/${enrollmentId}`, { replace: true });
    }
  }, [enrolled, enrollmentId, navigate]);

  // --- All handlers from original file ---
  const handleEnroll = async () => {
    if (!course?.id) {
      console.error("Enrollment attempted without course ID.");
      setEnrollMessage("Cannot enroll: Course ID missing.");
      return;
    }
    localStorage.setItem("courseId", course.id);
    setEnrollMessage("Processing enrollment...");

    if (course.course_type === "premium") {
      try {
        const response = await apiClient.post("/payments/create-checkout-session/", {
          course_id: course.id,
        });
        const data = response.data;
        if (data && data.sessionId) {
          const stripe = await stripePromise;
          const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
          if (stripeError) {
            console.error("Stripe redirect error:", stripeError.message);
            setEnrollMessage(`Payment initiation failed: ${stripeError.message}`);
          }
        } else {
          console.error("API Error: Checkout session ID not received.", data);
          setEnrollMessage(`Payment setup failed: ${data?.error || "Missing session ID."}`);
        }
      } catch (err) {
        console.error("Create checkout session error:", err.response ? err.response.data : err.message);
        setEnrollMessage(`Payment setup error: ${err.response?.data?.error || err.message || "Please try again."}`);
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
        }
      }
    }
    else {
      try {
        const enrollmentData = {
          object_id: course.id,
          enrollment_type: "course",
        };
     const response = await apiClient.post("/enrollments/", enrollmentData);
     const newEnrollment = response.data;
     setEnrollmentId(newEnrollment.id);
     setEnrolled(true);
     navigate(`/courses/enrolled/${newEnrollment.id}`, { replace: true });
      } catch (err) {
        console.error("Free enrollment error:", err.response ? err.response.data : err.message);
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setEnrollMessage(`Enrollment failed: ${apiErrorMessage || "Please try again."}`);
        setEnrolled(false);
        if (err.response?.status === 401 || err.response?.status === 403) {
          logout();
        }
      }
    }
  };

  const handleAddLesson = async (e) => {
    e.preventDefault();
    if (!selectedLesson || !permalink) return;
    setAddLessonError("");

    try {
      const response = await apiClient.post(`/courses/${permalink}/add-lesson/`, {
        lesson_id: selectedLesson,
      });

      const addedLesson = response.data?.lesson || response.data;

      if (addedLesson && addedLesson.id) {
        setLessons(prevLessons => [...prevLessons, addedLesson]);
        setUserLessonsForDropdown((prevUserLessons) =>
          prevUserLessons.filter((lesson) => lesson.id !== parseInt(selectedLesson))
        );
        setSelectedLesson("");
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

  const handleDetachLesson = async (lessonId) => {
    if (!permalink || !lessonId) return;
    const confirmDetach = window.confirm("Are you sure you want to detach this lesson from the course?");
    if (!confirmDetach) return;

    try {
       await apiClient.post(`/courses/${permalink}/detach-lesson/`, {
        lesson_id: lessonId,
      });

      const detachedLessonDetails = lessons.find((lesson) => lesson.id === lessonId);

      setLessons((prevLessons) => prevLessons.filter((lesson) => lesson.id !== lessonId));

      if (detachedLessonDetails) {
        setUserLessonsForDropdown((prevUserLessons) => {
          if (!prevUserLessons.some((lesson) => lesson.id === detachedLessonDetails.id)) {
            return [...prevUserLessons, detachedLessonDetails];
          }
          return prevUserLessons;
        });
      } else {
        console.warn("Could not find details of the detached lesson to add back to dropdown.");
      }

      alert("Lesson detached successfully.");

    } catch (err) {
      console.error("Error detaching lesson:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      alert(`Failed to detach lesson: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

   const handleAddQuiz = async (e) => {
     e.preventDefault();
     if (!selectedQuiz || !permalink) return;
     setAddQuizError("");

     try {
       const response = await apiClient.post(`/courses/${permalink}/add-quiz/`, {
         quiz_id: selectedQuiz,
       });
       const addedQuiz = response.data?.quiz || response.data;

       if (addedQuiz && addedQuiz.id) {
         setQuizzes(prevQuizzes => [...prevQuizzes, addedQuiz]);
         setAvailableQuizzesForDropdown((prevAvailable) =>
           prevAvailable.filter((quiz) => quiz.id !== parseInt(selectedQuiz))
         );
         setSelectedQuiz("");
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

   const handleDetachQuiz = async (quizId) => {
        if (!permalink || !quizId) return;
     const confirmDetach = window.confirm("Are you sure you want to detach this quiz from the course?");
     if (!confirmDetach) return;

     try {
       await apiClient.post(`/courses/${permalink}/detach-quiz/`, {
         quiz_id: quizId,
       });

       const detachedQuizDetails = quizzes.find((quiz) => quiz.id === quizId);

       setQuizzes((prevQuizzes) => prevQuizzes.filter((quiz) => quiz.id !== quizId));

       if (detachedQuizDetails) {
         setAvailableQuizzesForDropdown((prevAvailable) => {
           if (!prevAvailable.some((quiz) => quiz.id === detachedQuizDetails.id)) {
             return [...prevAvailable, detachedQuizDetails];
           }
           return prevAvailable;
         });
       } else {
         console.warn("Could not find details of the detached quiz to add back to dropdown.");
       }

       alert("Quiz detached successfully.");

     } catch (err) {
       console.error("Error detaching quiz:", err.response ? err.response.data : err.message);
       const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
       alert(`Failed to detach quiz: ${apiErrorMessage || "Please try again."}`);
       if (err.response?.status === 401 || err.response?.status === 403) {
         logout();
       }
     }
   };

  const handleEditClick = () => {
    if (!course) return;
    const subjectObj = subjects.find((subj) => subj.id === course.subject) || { id: course.subject, name: "Unknown Subject" };
    setEditCourse({
      title: course.title || '',
      description: course.description || '',
      subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null,
      tags: course.tags && Array.isArray(course.tags) ? course.tags.join(", ") : "",
    });
    setEditMode(true);
    setStatusUpdateMessage("");
    setError("");
  };

  const handleCancelEdit = () => {
    setEditMode(false);
    setEditCourse({});
    setError("");
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editCourse || !course || !editorRef.current) {
        setError("Cannot save: Form data, course data, or editor is missing.");
        return;
    };

    const updatedDescription = editorRef.current.getContent();

    if (!editCourse.title?.trim() || !editCourse.subject?.value) {
        setError("Title and Subject are required.");
        return;
    }

    const payload = {
      title: editCourse.title,
      subject: editCourse.subject.value,
      tags: editCourse.tags ? editCourse.tags.split(",").map((tag) => tag.trim()).filter(tag => tag) : [],
      description: updatedDescription,
    };

    setError("");

    try {
      const response = await apiClient.put(`/courses/${permalink}/update/`, payload);
      const updatedCourseData = response.data;

      setCourse(updatedCourseData);
      setLessons(updatedCourseData.lessons || []);
      setQuizzes(updatedCourseData.quizzes || []);

      setEditMode(false);
      alert("Course content updated successfully.");

    } catch (err) {
      console.error("Error updating course content:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || JSON.stringify(err.response?.data) || err.message || "Unknown error";
      setError(`Error updating course: ${apiErrorMessage}`);
    }
  };

  const handleDeleteCourse = async () => {
    if (!course?.id || isLocked) {
        alert("Course cannot be deleted (missing ID or locked).");
        return;
    };
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this course? This action cannot be undone and will detach all lessons and quizzes."
    );
    if (!confirmDelete) return;

    try {
      await apiClient.delete(`/courses/${permalink}/delete/`);
      alert("Course deleted successfully.");
      navigate("/courses");
    } catch (err) {
      console.error("Error deleting course:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.message || "Please try again.";
      alert(`Error deleting course: ${apiErrorMessage}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  const handlePublishCourse = async () => {
    if (!course || isLocked) return;

    const confirmPublish = window.confirm("Are you sure you want to publish this course? Students will be able to enroll.");
    if (!confirmPublish) return;

    setIsUpdatingStatus(true);
    setStatusUpdateMessage("Publishing...");

    try {
      await apiClient.post(`/courses/${permalink}/publish/`);
       setCourse(prevCourse => ({ ...prevCourse, is_draft: false }));
       setStatusUpdateMessage("Course published successfully!");

    } catch (err) {
      console.error("Error publishing course:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.message || "Please try again.";
      setStatusUpdateMessage(`Error publishing: ${apiErrorMessage}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleUnpublishCourse = async () => {
    if (!course || isLocked) return;

    const confirmUnpublish = window.confirm("Are you sure you want to unpublish this course and set it back to a draft?");
    if (!confirmUnpublish) return;

    setIsUpdatingStatus(true);
    setStatusUpdateMessage("Setting to draft...");

    try {
      const payload = { is_draft: true };
      const response = await apiClient.put(`/courses/${permalink}/update/`, payload);

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
      setIsUpdatingStatus(false);
    }
  };

  useEffect(() => {
    if (editMode && course) {
      const subjectObj = subjects.find((s) => s.id === course.subject) || { id: course.subject, name: "" };
      setEditCourse(prevEdit => ({
        ...prevEdit,
        title: course.title,
        description: course.description,
        subject: subjectObj.id ? { value: subjectObj.id, label: subjectObj.name } : null,
        tags: Array.isArray(course.tags) ? course.tags.join(", ") : "",
      }));
    }
  }, [editMode, course, subjects]);


  // --- Render Logic ---
  if (loading) return (
      <div className={styles.loadingMessage}>
        <FaSpinner className={styles.spinner} /> Loading Course Details…
      </div>
    );
  if (error && !editMode) return <p className={styles.errorMessage}>{error}</p>;
  if (!course) return <p className={styles.loadingMessage}>Course data not available.</p>;


  return (
    // The new wrapper div handles positioning for the scaling container.
    <div ref={wrapperRef} className={styles.scaleWrapper}>
        {/* The original container now has a ref and will be scaled by the JS logic. */}
        <div ref={containerRef} className={styles.courseDetailContainer}>
            {/* --- Edit Mode View --- */}
            {editMode && isCreator ? (
            <div className={styles.editCourseForm}>
                <h2>Manage Course</h2>
                <form onSubmit={handleSaveEdit}>
                <div className={styles.formGroup}>
                    <label htmlFor="courseTitleEdit">Title:</label>
                    <input
                    id="courseTitleEdit"
                    type="text"
                    value={editCourse.title || ""}
                    onChange={e => setEditCourse({ ...editCourse, title: e.target.value })}
                    required
                    className={styles.inputField}
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="courseDescriptionEdit">Content:</label>
                    <CustomEditor
                    id="courseDescriptionEdit"
                    ref={editorRef}
                    initialContent={editCourse.description || ""}
                    mediaCategory="course"
                    editable={true}
                    />
                    {error && <p className={`${styles.error} ${styles.formError}`}>{error}</p>}
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="courseSubjectEdit">Subject:</label>
                    <CreateSubjectSelect
                    id="courseSubjectEdit"
                    value={editCourse.subject}
                    onChange={sel => setEditCourse({ ...editCourse, subject: sel })}
                    required
                    />
                </div>
                <div className={styles.formGroup}>
                    <label htmlFor="courseTagsEdit">Tags (comma separated):</label>
                    <input
                    id="courseTagsEdit"
                    type="text"
                    value={editCourse.tags || ""}
                    onChange={e => setEditCourse({ ...editCourse, tags: e.target.value })}
                    className={styles.inputField}
                    />
                </div>
                {error && <p className={`${styles.error} ${styles.formError}`}>{error}</p>}
                <div className={styles.formActions}>
                    <button type="submit" className={styles.saveBtn}>Save Content Changes</button>
                    <button type="button" className={styles.cancelBtn} onClick={handleCancelEdit}>Cancel Edit</button>
                </div>
                </form>

                <div className={styles.courseStatusActions}>
                <h4>Status</h4>
                <p>
                    Current Status: {course.is_draft
                    ? <strong style={{ color: '#f0ad4e' }}>Draft</strong>
                    : <strong style={{ color: '#5cb85c' }}>Published</strong>}
                    {isLocked && <span className={styles.lockedBadge}>🔒 Locked</span>}
                </p>
                {!isLocked && (
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

                <div className={styles.addContentSection}>
                <h4>Manage Content</h4>
                <div className={styles.attachedContentList}>
                    <h5>Currently Attached Lessons ({lessons.length})</h5>
                    {lessons.length > 0 ? (
                        <ul>
                            {lessons.map(lesson => (
                                <li key={lesson.id} className={styles.attachedItem}>
                                    <span>{lesson.title}</span>
                                    <button
                                        onClick={() => handleDetachLesson(lesson.id)}
                                        className={styles.detachBtn}
                                        disabled={isLocked}
                                        title="Detach Lesson"
                                    >
                                        <FaTimes />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.noContentMessage}>No lessons attached yet.</p>
                    )}
                </div>
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
                    {userLessonsForDropdown.map(l => {
                        const isAttachedElsewhere = l.course && l.course !== course.id;
                        const displayText = isAttachedElsewhere
                            ? `${l.title} (Attached to: ${l.course_data?.title || 'Another Course'})`
                            : l.title;
                        return (
                            <option
                                key={l.id}
                                value={l.id}
                                disabled={isAttachedElsewhere}
                                className={isAttachedElsewhere ? styles.disabledOption : ''}
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
                <hr className={styles.sectionDivider} />
                <div className={styles.attachedContentList}>
                    <h5>Currently Attached Quizzes ({quizzes.length})</h5>
                    {quizzes.length > 0 ? (
                        <ul>
                            {quizzes.map(quiz => (
                                <li key={quiz.id} className={styles.attachedItem}>
                                    <span>{quiz.title}</span>
                                    <button
                                        onClick={() => handleDetachQuiz(quiz.id)}
                                        className={styles.detachBtn}
                                        disabled={isLocked}
                                        title="Detach Quiz"
                                    >
                                        <FaTimes />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.noContentMessage}>No quizzes attached yet.</p>
                    )}
                </div>
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
                    {availableQuizzesForDropdown.map(q => {
                        const isAttachedElsewhere = q.course && q.course !== course.id;
                        const displayText = isAttachedElsewhere
                            ? `${q.title} (Attached to: ${q.course_data?.title || 'Another Course'})`
                            : q.title;
                        return (
                            <option
                                key={q.id}
                                value={q.id}
                                disabled={isAttachedElsewhere}
                                className={isAttachedElsewhere ? styles.disabledOption : ''}
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

                <div className={styles.dangerZone}>
                <h4>Danger Zone</h4>
                <button className={styles.courseDeleteBtn} onClick={handleDeleteCourse} disabled={isLocked}>
                    Delete This Course Permanently
                </button>
                <p className={styles.warningText}>This action cannot be undone.</p>
                </div>

            </div>

            ) : (
            /* --- Read-only View --- */
            <>
                <h1 className={styles.courseTitle}>{course.title}</h1>
                
                {course?.cover_image ? (
                <img
                    src={course.cover_image}
                    alt={course.title}
                    className={styles.courseImage}
                />
                ) : (
                <div className={styles.courseImagePlaceholder}>
                    <FaBook size="40"/>
                    <span>No Course Image</span>
                </div>
                )}

                <div className={styles.courseMeta}>
                    {course.subject_name && <span className={styles.metaItem}><strong>Subject:</strong> {course.subject_name}</span>}
                    {course.tags?.length > 0 && (
                        <div className={styles.metaItem}>
                            <strong>Tags:</strong> 
                            <div className={styles.tagContainer}>
                                {course.tags.map(tag => <span key={tag} className={styles.tag}>#{tag}</span>)}
                            </div>
                        </div>
                    )}
                </div>

                <div
                className={`${styles.courseDescription} displayed-content`}
                ref={courseDescriptionDisplayRef}
                dangerouslySetInnerHTML={{
                    __html: sanitizeContentViewerHTML(course.description),
                }}
                />

                {lessons.length > 0 && (
                <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}><FaBook /> Lessons in this Course</h2>
                    <ul className={styles.contentList}>
                    {lessons.map(lesson => (
                        <li key={lesson.id} className={styles.contentItem}>
                        <span>{lesson.title}</span>
                        {(enrolled || isCreator) && (
                            <button
                                className={styles.actionButton}
                                onClick={() => navigate(`/lessons/${lesson.permalink}`)}
                                title={`Study lesson: ${lesson.title}`}
                            >
                                <FaBookOpen/> Study
                            </button>
                        )}
                        </li>
                    ))}
                    </ul>
                </section>
                )}

                {quizzes.length > 0 && (
                <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}><FaQuestion /> Quizzes in this Course</h2>
                    <ul className={styles.contentList}>
                    {quizzes.map(quiz => (
                        <li key={quiz.id} className={styles.contentItem}>
                        <span>{quiz.title}</span>
                        {(enrolled || isCreator) && (
                            <button
                                className={styles.actionButton}
                                onClick={() => navigate(`/quizzes/take/${quiz.id}`)}
                                title={`Take quiz: ${quiz.title}`}
                            >
                                <FaQuestion/> Take Quiz
                            </button>
                        )}
                        </li>
                    ))}
                    </ul>
                </section>
                )}

                {!isCreator && (
                <div className={styles.enrollSection}>
                    {enrolled ? (
                    <button className={styles.enrolledButton} disabled>
                        Enrolled
                    </button>
                    ) : (
                    <button className={styles.enrollButton} onClick={handleEnroll} disabled={course.is_draft}>
                        {course.course_type === "premium" ? `Buy Course ($${course.price || 'N/A'})` : "Enroll Now"}
                    </button>
                    )}
                    {enrollMessage && <p className={styles.enrollMessage}>{enrollMessage}</p>}
                    {course.is_draft && <p className={styles.enrollMessage}>This course is a draft and cannot be enrolled in yet.</p>}
                </div>
                )}

                {isCreator && !editMode && (
                    <div className={styles.manageButtonContainer}>
                        <button onClick={handleEditClick} className={styles.manageButton}>
                            Manage Course Content & Settings
                        </button>
                    </div>
                )}
            </>
            )}
        </div>
    </div>
  );
};

export default CourseDetail;
