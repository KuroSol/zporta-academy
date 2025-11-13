import React, { useEffect, useState, useContext, useRef, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FaPlus, FaBook, FaQuestion, FaSpinner, FaBookOpen, FaTimes, FaEdit, FaTrash, FaCheckCircle, FaExclamationTriangle, FaArrowUp, FaArrowDown, FaGripVertical } from "react-icons/fa";
import CustomEditor from "./Editor/CustomEditor";
import CreateSubjectSelect from "./Admin/CreateSubjectSelect";
import styles from "./CourseDetail.module.css"; // This should point to the new responsive CSS
import { loadStripe } from "@stripe/stripe-js";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api.js";
import "./Editor/ViewerAccordion.css"; // Keep this if your CustomEditor relies on it

const stripePromise = loadStripe(
  "pk_test_51KuSZdAyDb4VsWsQVWaz6RYSufh5e8ns6maCvV4b0g1waYUL4TvvgrB14G73tirboPQ67w3l8n8Tt631kACShVaT003wDftkeU"
);

// --- Helper Functions (From your original file, UNCHANGED) ---
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

  // --- State Variables (From your original file, UNCHANGED) ---
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

  // --- Refs (From your original file, UNCHANGED) ---
  const editorRef = useRef(null);
  const courseDescriptionDisplayRef = useRef(null);

  // --- Context (From your original file, UNCHANGED) ---
  const { user, token, logout } = useContext(AuthContext);

  // --- All original useEffects and handlers remain UNCHANGED ---
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

  const handleBulkPublishLessons = async () => {
    if (!permalink) return;
    const confirmBulk = window.confirm("Publish all draft lessons attached to this course? This will make them publicly visible.");
    if (!confirmBulk) return;
    try {
      const res = await apiClient.post(`/courses/${permalink}/lessons/bulk-publish/`);
      const count = res.data?.published_count ?? 0;
      alert(count > 0 ? `Published ${count} lesson(s).` : `No draft lessons to publish.`);
      // Refresh course data to update lessons list/status
      const refreshed = await apiClient.get(`/courses/${permalink}/`);
      if (refreshed.data?.course) {
        setCourse(refreshed.data.course);
        setLessons(refreshed.data.lessons || []);
        setQuizzes(refreshed.data.quizzes || []);
      }
    } catch (err) {
      const apiErrorMessage = err.response?.data?.error || err.response?.data?.detail || err.message;
      alert(`Bulk publish failed: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Fetch latest lessons for the owner (includes drafts if server exposes them)
  const fetchDraftCourseLessons = useCallback(async () => {
    try {
      const refreshed = await apiClient.get(`/courses/${permalink}/`);
      if (refreshed.data?.lessons) {
        setLessons(refreshed.data.lessons);
      }
      if (refreshed.data?.course) {
        setCourse(refreshed.data.course);
      }
    } catch (err) {
      console.warn("Could not refresh draft lessons:", err.response?.data || err.message);
    }
  }, [permalink]);

  // Publish a single attached lesson (owner-only)
  const handlePublishSingleLesson = async (lesson) => {
    if (!lesson?.permalink) return;
    if (course?.is_draft) {
      alert("Publish the course first, then publish its lessons.");
      return;
    }
    const confirmOne = window.confirm(`Publish lesson: "${lesson.title}"?`);
    if (!confirmOne) return;
    try {
      await apiClient.post(`/lessons/${lesson.permalink}/publish/`);
      // Update local list to reflect published status
      setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'published' } : l));
    } catch (err) {
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      alert(`Failed to publish lesson: ${apiErrorMessage || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Reorder lessons (owner-only)
  const handleReorderLessons = async (newOrder) => {
    if (!permalink || !newOrder || newOrder.length === 0) return;
    try {
      const response = await apiClient.post(`/courses/${permalink}/lessons/reorder/`, {
        order: newOrder
      });
      // Update local state with the reordered lessons from API response
      if (response.data?.lessons) {
        setLessons(response.data.lessons);
      }
    } catch (err) {
      console.error("Error reordering lessons:", err.response?.data || err.message);
      alert(`Failed to reorder lessons: ${err.response?.data?.error || err.message}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout();
      }
    }
  };

  // Move lesson up in the list
  const moveLessonUp = (index) => {
    if (index === 0) return;
    const newLessons = [...lessons];
    [newLessons[index - 1], newLessons[index]] = [newLessons[index], newLessons[index - 1]];
    const newOrder = newLessons.map(l => l.id);
    setLessons(newLessons);
    handleReorderLessons(newOrder);
  };

  // Move lesson down in the list
  const moveLessonDown = (index) => {
    if (index === lessons.length - 1) return;
    const newLessons = [...lessons];
    [newLessons[index], newLessons[index + 1]] = [newLessons[index + 1], newLessons[index]];
    const newOrder = newLessons.map(l => l.id);
    setLessons(newLessons);
    handleReorderLessons(newOrder);
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
      // When editing, fetch draft detail to include draft lessons as well
      fetchDraftCourseLessons();
    }
  }, [editMode, course, subjects, fetchDraftCourseLessons]);


  // --- Render Logic ---
  if (loading) return (
      <div className={styles.loadingContainer}>
        <FaSpinner className={styles.spinner} />
        <p>Loading Course Details...</p>
      </div>
    );

  if (error && !course) return <div className={styles.errorContainer}><p>{error}</p></div>;
  if (!course) return <div className={styles.loadingContainer}><p>Course data not available.</p></div>

  // --- RENDER Creator Edit View ---
  if (isCreator && editMode) {
    const draftCount = Array.isArray(lessons) ? lessons.filter(l => l.status === 'draft').length : 0;
    const publishedCount = Array.isArray(lessons) ? lessons.filter(l => l.status === 'published').length : 0;
    return (
        <div className={styles.courseDetailContainer}>
            <form onSubmit={handleSaveEdit} className={styles.editForm}>
                <h1 className={styles.formHeader}>Manage Course</h1>
                
                {error && <p className={styles.formError}>{error}</p>}

                <div className={styles.formGroup}>
                    <label htmlFor="courseTitleEdit">Course Title</label>
                    <input
                        id="courseTitleEdit" type="text"
                        value={editCourse.title || ""}
                        onChange={e => setEditCourse({ ...editCourse, title: e.target.value })}
                        required className={styles.inputField}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="courseSubjectEdit">Subject</label>
                    <CreateSubjectSelect
                        id="courseSubjectEdit"
                        value={editCourse.subject}
                        onChange={sel => setEditCourse({ ...editCourse, subject: sel })}
                        required
                    />
                </div>

                <div className={styles.formGroup}>
                    <label htmlFor="courseTagsEdit">Tags (comma-separated)</label>
                    <input
                        id="courseTagsEdit" type="text"
                        value={editCourse.tags || ""}
                        onChange={e => setEditCourse({ ...editCourse, tags: e.target.value })}
                        className={styles.inputField}
                    />
                </div>

                <div className={styles.formGroup}>
                    <label>Course Content</label>
                    <CustomEditor
                        ref={editorRef}
                        initialContent={editCourse.description || ""}
                        mediaCategory="course"
                        editable={true}
                    />
                </div>

                <div className={styles.formActions}>
                    <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>Save Changes</button>
                    <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleCancelEdit}>Cancel</button>
                </div>
            </form>

            <div className={`${styles.adminSection} ${styles.accordionContainer}`}>
                <h2 className={styles.sectionTitle}>Manage Content</h2>
                <div className={styles.accordionItem}>
                    <h3 className={styles.accordionHeader}>Attached Lessons ({lessons.length})</h3>
                    <div className={styles.accordionContent}>
                        {lessons.length > 0 ? (
                            <ul className={styles.attachedList}>
                                {lessons.map((l, index) => (
                                    <li key={l.id}>
                                        <div className={styles.lessonReorderControls}>
                                            <button 
                                                onClick={() => moveLessonUp(index)} 
                                                disabled={index === 0 || isLocked}
                                                className={styles.reorderBtn}
                                                title="Move up"
                                            >
                                                <FaArrowUp />
                                            </button>
                                            <button 
                                                onClick={() => moveLessonDown(index)} 
                                                disabled={index === lessons.length - 1 || isLocked}
                                                className={styles.reorderBtn}
                                                title="Move down"
                                            >
                                                <FaArrowDown />
                                            </button>
                                        </div>
                                        <span className={styles.lessonTitle}>{l.title}</span>
                                        <span className={`${styles.statusPill} ${l.status === 'published' ? styles.statusPublished : styles.statusDraft}`} style={{ marginLeft: 8 }}>
                                          {l.status === 'published' ? 'Published' : 'Draft'}
                                        </span>
                                        {l.status === 'draft' && (
                                          course.is_draft ? (
                                            <button className={`${styles.btn} ${styles.btnSecondary}`} style={{ marginLeft: 8 }} disabled title="Publish the course first">Publish</button>
                                          ) : (
                                            <button onClick={() => handlePublishSingleLesson(l)} className={`${styles.btn} ${styles.btnSuccess}`} style={{ marginLeft: 8 }}>Publish</button>
                                          )
                                        )}
                                        <button onClick={() => handleDetachLesson(l.id)} className={styles.detachBtn} title="Detach Lesson" disabled={isLocked}><FaTimes/></button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p>No lessons attached.</p>}
                        <form onSubmit={handleAddLesson} className={styles.addContentForm}>
                            <select value={selectedLesson} onChange={e => { setSelectedLesson(e.target.value); setAddLessonError(''); }} className={styles.dropdown} disabled={isLocked}>
                                <option value="">Select a lesson to add...</option>
                                {userLessonsForDropdown.map(l => {
                                    const isAttachedElsewhere = l.course && l.course !== course.id;
                                    return <option key={l.id} value={l.id} disabled={isAttachedElsewhere}>{l.title}{isAttachedElsewhere ? ' (In another course)' : ''}</option>;
                                })}
                            </select>
                            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!selectedLesson || isLocked}><FaPlus/> Add</button>
                        </form>
                        {addLessonError && <p className={styles.formError}>{addLessonError}</p>}
                    </div>
                </div>

                <div className={styles.accordionItem}>
                    <h3 className={styles.accordionHeader}>Attached Quizzes ({quizzes.length})</h3>
                    <div className={styles.accordionContent}>
                        {quizzes.length > 0 ? (
                            <ul className={styles.attachedList}>
                                {quizzes.map(q => (
                                    <li key={q.id}>
                                        <span>{q.title}</span>
                                        <button onClick={() => handleDetachQuiz(q.id)} className={styles.detachBtn} title="Detach Quiz" disabled={isLocked}><FaTimes/></button>
                                    </li>
                                ))}
                            </ul>
                        ) : <p>No quizzes attached.</p>}
                        <form onSubmit={handleAddQuiz} className={styles.addContentForm}>
                            <select value={selectedQuiz} onChange={e => { setSelectedQuiz(e.target.value); setAddQuizError(''); }} className={styles.dropdown} disabled={isLocked}>
                                <option value="">Select a quiz to attach...</option>
                                {availableQuizzesForDropdown.map(q => {
                                    const isAttachedElsewhere = q.course && q.course !== course.id;
                                    return <option key={q.id} value={q.id} disabled={isAttachedElsewhere}>{q.title}{isAttachedElsewhere ? ' (In another course)' : ''}</option>;
                                })}
                            </select>
                            <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`} disabled={!selectedQuiz || isLocked}><FaPlus/> Add</button>
                        </form>
                        {addQuizError && <p className={styles.formError}>{addQuizError}</p>}
                    </div>
                </div>
            </div>

            <div className={styles.adminSection}>
                 <h2 className={styles.sectionTitle}>Status & Actions</h2>
                 <div className={styles.statusBox}>
                    <p>Status: {course.is_draft ? <span className={`${styles.statusPill} ${styles.statusDraft}`}>Draft</span> : <span className={`${styles.statusPill} ${styles.statusPublished}`}>Published</span>} {isLocked && "🔒"}</p>
                    {!isLocked && (course.is_draft ? 
                        <button onClick={handlePublishCourse} disabled={isUpdatingStatus} className={`${styles.btn} ${styles.btnSuccess}`}><FaCheckCircle/> {isUpdatingStatus ? 'Publishing...' : 'Publish'}</button> :
                        <button onClick={handleUnpublishCourse} disabled={isUpdatingStatus} className={`${styles.btn} ${styles.btnWarning}`}><FaExclamationTriangle/> {isUpdatingStatus ? 'Working...' : 'Set to Draft'}</button>
                    )}
                    {statusUpdateMessage && <p className={styles.statusMessage}>{statusUpdateMessage}</p>}
                 </div>
            <div className={styles.statusBox}>
             <p>Lessons — Published: <strong>{publishedCount}</strong> • Draft: <strong>{draftCount}</strong></p>
             {!course.is_draft && draftCount > 0 && (
               <button onClick={handleBulkPublishLessons} className={`${styles.btn} ${styles.btnPrimary}`}>Publish all draft lessons</button>
             )}
             {course.is_draft && draftCount > 0 && (
               <p className={styles.statusMessage}>Publish the course first to bulk publish lessons.</p>
             )}
            </div>
            </div>

            <div className={`${styles.adminSection} ${styles.dangerZone}`}>
                <h2 className={styles.sectionTitle}>Danger Zone</h2>
                <div className={styles.dangerContent}>
                    <p>This action is permanent and cannot be undone.</p>
                    <button onClick={handleDeleteCourse} className={`${styles.btn} ${styles.btnDanger}`} disabled={isLocked}><FaTrash /> Delete Course</button>
                </div>
            </div>
        </div>
    );
  }

  // --- RENDER Read-Only Student View ---
  return (
    <div className={styles.courseDetailContainer}>
        <header className={styles.header}>
            {course.cover_image ? (
                <img src={course.cover_image} alt={course.title} className={styles.coverImage} onError={(e) => e.target.style.display='none'}/>
            ) : (
                <div className={`${styles.coverImage} ${styles.coverImagePlaceholder}`}>
                    <FaBook size={50} />
                </div>
            )}
             <div className={styles.headerOverlay}>
                <div className={styles.headerContent}>
                    <span className={styles.subjectPill}>{course.subject_name}</span>
                    <h1 className={styles.courseTitle}>{course.title}</h1>
                    <div className={styles.tagContainer}>
                        {course.tags?.map(tag => <span key={tag} className={styles.tag}>#{tag}</span>)}
                    </div>
                </div>
             </div>
        </header>

        <div className={styles.mainContent}>
            <div className={styles.leftColumn}>
                <section className={styles.contentSection}>
                    <h2 className={styles.sectionTitle}>About this course</h2>
                    <div
                        className={styles.description}
                        ref={courseDescriptionDisplayRef}
                        dangerouslySetInnerHTML={{ __html: sanitizeContentViewerHTML(course.description) }}
                    />
                </section>

                {lessons.length > 0 && (
                    <section className={styles.contentSection}>
                        <h2 className={styles.sectionTitle}><FaBook /> Lessons</h2>
                        <ul className={styles.contentList}>
                            {lessons.map(lesson => (
                                <li key={lesson.id}>
                                    <span>{lesson.title}</span>
                                    {(enrolled || isCreator) && (
                                        <button onClick={() => navigate(`/lessons/${lesson.permalink}`)} className={`${styles.btn} ${styles.btnIcon}`}>
                                            <FaBookOpen /> Study
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                 {quizzes.length > 0 && (
                    <section className={styles.contentSection}>
                        <h2 className={styles.sectionTitle}><FaQuestion /> Quizzes</h2>
                        <ul className={styles.contentList}>
                            {quizzes.map(quiz => (
                                <li key={quiz.id}>
                                    <span>{quiz.title}</span>
                                    {(enrolled || isCreator) && (
                                        <button onClick={() => navigate(`/quizzes/take/${quiz.id}`)} className={`${styles.btn} ${styles.btnIcon}`}>
                                            <FaQuestion /> Take Quiz
                                        </button>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
            </div>

            <aside className={styles.rightColumn}>
                <div className={styles.sidebarCard}>
                    {isCreator ? (
                         <button onClick={handleEditClick} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}>
                            <FaEdit /> Manage Course
                        </button>
                    ) : (
                        <>
                            {enrolled ? (
                                <button className={`${styles.btn} ${styles.btnSuccess} ${styles.btnBlock}`} disabled>
                                    <FaCheckCircle /> Enrolled
                                </button>
                            ) : (
                                <button onClick={handleEnroll} disabled={course.is_draft} className={`${styles.btn} ${styles.btnPrimary} ${styles.btnBlock}`}>
                                    {course.course_type === 'premium' ? `Enroll for $${course.price}` : 'Enroll for Free'}
                                </button>
                            )}
                            {enrollMessage && <p className={styles.enrollMessage}>{enrollMessage}</p>}
                            {course.is_draft && <p className={styles.enrollMessage}>Enrollment is currently closed.</p>}
                        </>
                    )}
                </div>
            </aside>
        </div>
    </div>
  );
};

export default CourseDetail;
