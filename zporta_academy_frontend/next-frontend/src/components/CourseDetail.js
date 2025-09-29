/**
 * @file CourseDetail.js
 * @description A comprehensive component to display and manage a course.
 * This component handles both the public-facing student view and a private,
 * feature-rich administrative/edit view for the course creator. It manages
 * data fetching, state, user interactions, and API calls for updating,
 * publishing, and deleting a course. The edit mode is a multi-step wizard
 * for a clear and user-friendly workflow.
 */

import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/router";
import { 
    FaPlus, FaBook, FaQuestion, FaSpinner, FaTimes, FaEdit, FaTrash, 
    FaCheckCircle, FaExclamationTriangle, FaArrowLeft, FaEye, FaSave, 
    FaWindowClose, FaStar, FaRegStar, FaLock, FaUnlock, FaCrown 
} from "react-icons/fa";
import CustomEditor from "./Editor/CustomEditor";
import CreateSubjectSelect from "./admin/CreateSubjectSelect";
import styles from "@/styles/CourseDetail.module.css";
import Modal from "@/components/Modal/Modal";
import CreateLesson from "@/components/admin/CreateLesson";
import CreateQuiz from "@/components/admin/CreateQuiz";
import { loadStripe } from "@stripe/stripe-js";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";
import "@/styles/Editor/ViewerAccordion.module.css"; // Ensure accordion styles are available.

/**
 * @constant {Promise<Stripe>} stripePromise
 * @description Initializes Stripe.js with the public key for payment processing.
 * Falls back to a test key if the environment variable is not set.
 */
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "pk_test_51KuSZdAyDb4VsWsQVWaz6RYSufh5e8ns6maCvV4b0g1waYUL4TvvgrB14G73tirboPQ67w3l8n8Tt631kACShVaT003wDftkeU"
);

// #region Helper Functions & Components

/**
 * @function sanitizeAndInitializeContentViewer
 * @description Sanitizes HTML content from the editor to be safely displayed in a viewer.
 * It removes `contenteditable` attributes and initializes any custom interactive elements
 * like accordions within the content.
 * @param {HTMLElement} containerElement - The DOM element to render the HTML into.
 * @param {string} htmlString - The raw HTML string from the course description.
 */
const sanitizeAndInitializeContentViewer = (containerElement, htmlString) => {
    if (!containerElement || typeof htmlString !== 'string') return;
    
    // Sanitize by removing contentEditable attributes to prevent user editing in view mode.
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    doc.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute("contenteditable"));
    containerElement.innerHTML = doc.body.innerHTML;

    // Initialize custom accordion elements within the sanitized content.
    const accordions = containerElement.querySelectorAll(".accordion-item");
    accordions.forEach(accordion => {
        const header = accordion.querySelector(".accordion-header");
        // Ensure event listener is attached only once.
        if (header && !header.hasAttribute('data-accordion-listener')) {
            header.setAttribute('data-accordion-listener', 'true');
            header.addEventListener("click", () => {
                accordion.classList.toggle("is-open");
            });
        }
    });
};

/**
 * @component MessageDisplay
 * @description A small, reusable component for displaying feedback messages (errors, success, info).
 * @param {{ message: { text: string, type: string } }} props
 */
const MessageDisplay = ({ message }) => {
    if (!message || !message.text) return null;
    return <p className={`${styles.message} ${styles[message.type]}`}>{message.text}</p>;
};

// #endregion --- End of Helpers ---


/**
 * @component CourseDetail
 * @description The main component for the course detail page.
 * @param {{ initialCourse: object, initialLessons: Array, initialQuizzes: Array }} props
 * - initialCourse: Course data pre-fetched via SSR/SSG.
 * - initialLessons: Lessons data pre-fetched.
 * - initialQuizzes: Quizzes data pre-fetched.
 */
const CourseDetail = ({ initialCourse = null, initialLessons = [], initialQuizzes = [] }) => {
    // --- Hooks Initialization ---
    const router = useRouter();
    const { user, token, logout } = useContext(AuthContext);

    /**
     * @constant {string|null} permalink
     * @description A memoized value for the course permalink, constructed from URL query parameters.
     * This is the unique identifier for the course in API calls.
     */
    const permalink = useMemo(() => {
        const { username, date, subject, slug: courseTitle } = router.query || {};
        return (username && date && subject && courseTitle) 
            ? `${username}/${date}/${subject}/${courseTitle}` 
            : null;
    }, [router.query]);
    
    /**
     * @constant {boolean} isEditRoute
     * @description True if the current URL path is for editing a course.
     */
    const isEditRoute = (router.asPath || "").startsWith("/admin/courses/edit/");
    
    /**
     * @constant {boolean} viewAsPublic
     * @description True if the `as_public` query parameter is set, forcing a student's view.
     */
    const viewAsPublic = ["1","true"].includes(String(router.query.as_public).toLowerCase());

    // #region State Management

    // --- Core Data State (for both views) ---
    /** @state {object|null} course - The main course object containing all details. */
    const [course, setCourse] = useState(initialCourse);
    /** @state {Array} lessons - The list of lesson objects attached to the course. */
    const [lessons, setLessons] = useState(initialLessons);
    /** @state {Array} quizzes - The list of quiz objects attached to the course. */
    const [quizzes, setQuizzes] = useState(initialQuizzes);
    /** @state {boolean} enrolled - The enrollment status of the current user. */
    const [enrolled, setEnrolled] = useState(false);

    // --- Page Status State ---
    /** @state {boolean} loading - True while initial data is being fetched on the client. */
    const [loading, setLoading] = useState(!initialCourse);
    /** @state {string} error - Holds any critical error message that prevents the page from rendering. */
    const [error, setError] = useState("");
    /** @state {{text: string, type: string}} message - Holds non-critical feedback for the user (e.g., success/error on save). */
    const [message, setMessage] = useState({ text: "", type: "error" });

    // --- Edit Mode State ---
    /** @state {boolean} editMode - Toggles the entire component between read-only and edit views. */
    const [editMode, setEditMode] = useState(false);
    /** @state {number} currentEditStep - Tracks the current step in the edit mode wizard. */
    const [currentEditStep, setCurrentEditStep] = useState(1);
    /** @state {object} editData - A comprehensive object holding all modified form data during an edit session. */
    const [editData, setEditData] = useState({});
    /** @state {Array} subjects - List of all available subjects for the subject dropdown in edit mode. */
    const [subjects, setSubjects] = useState([]);
    const [availableLessons, setAvailableLessons] = useState([]);
    const [availableQuizzes, setAvailableQuizzes] = useState([]);
    const refreshContentLists = useCallback(async () => {
        try {
            const [lessRes, quizRes] = await Promise.all([
                apiClient.get("/lessons/my/"),
                apiClient.get("/quizzes/my/")
            ]);
            const courseId = course?.id ?? null;
            const attachedLessonIds = new Set((lessons || []).map(l => l.id));
            const attachedQuizIds   = new Set((quizzes || []).map(q => q.id));

            const availLessons = Array.isArray(lessRes.data)
              ? lessRes.data.filter(l => !attachedLessonIds.has(l.id) && l.course !== courseId)
              : [];
            const availQuizzes = Array.isArray(quizRes.data)
              ? quizRes.data.filter(q => !attachedQuizIds.has(q.id) && q.course !== courseId && !q.lesson)
              : [];
            setAvailableLessons(availLessons);
            setAvailableQuizzes(availQuizzes);
        } catch (e) {
            console.error("Failed to refresh content lists:", e.response?.data || e.message);
        }
    }, [course?.id, lessons, quizzes]);
    /** @state {string|null} coverImagePreview - Holds the data URL for the newly uploaded cover image preview. */
    const [coverImagePreview, setCoverImagePreview] = useState(null);

    // --- Modal State ---
    /** @state {boolean} isLessonModalOpen - Controls the visibility of the "Create New Lesson" modal. */
    const [isLessonModalOpen, setIsLessonModalOpen] = useState(false);
    /** @state {boolean} isQuizModalOpen - Controls the visibility of the "Create New Quiz" modal. */
    const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

    
  // Ensure popups do not persist outside management
  useEffect(() => {
    if (!editMode) {
      setIsLessonModalOpen(false);
      setIsQuizModalOpen(false);
    }
  }, [editMode]);

    // --- Refs ---
    /** @ref {object} editorRef - A ref to access the CustomEditor component instance to get its content. */
    const editorRef = useRef(null);
    /** @ref {HTMLElement} descriptionViewerRef - A ref to the div that renders the course description in read-only mode. */
    const descriptionViewerRef = useRef(null);

    /**
     * @constant {boolean} isCreator
     * @description A memoized boolean indicating if the currently logged-in user is the creator of the course.
     */
    const isCreator = useMemo(() => 
        user && course && user.username.toLowerCase() === course.created_by.toLowerCase(), 
    [user, course]);
    
    // #region Data Fetching and Initialization

    /**
     * @callback fetchCourseData
     * @description Fetches the primary course data from the API based on the permalink.
     * This is used for client-side navigation.
     */
    const fetchCourseData = useCallback(async () => {
        if (!permalink) return;
        setLoading(true);
        setError("");
        try {
            const res = await apiClient.get(`/courses/${permalink}/`);
            const { course: fetchedCourse, lessons: fetchedLessons, quizzes: fetchedQuizzes } = res.data;
            
            setCourse(fetchedCourse);
            setLessons(fetchedLessons || []);
            setQuizzes(fetchedQuizzes || []);

            if (token) fetchEnrollmentStatus(fetchedCourse.id);

        } catch (err) {
            handleApiError(err, "Course not found or failed to load.");
        } finally {
            setLoading(false);
        }
    }, [permalink, token]);

    /**
     * @callback fetchEnrollmentStatus
     * @description Fetches the current user's enrollment status for this specific course.
     * @param {number} courseId - The ID of the course to check.
     */
    const fetchEnrollmentStatus = useCallback(async (courseId) => {
        if (viewAsPublic) { 
            setEnrolled(false); 
            return; 
        }
        try {
            const res = await apiClient.get("/enrollments/user/");
            const isEnrolled = res.data?.some(e => e.enrollment_type === "course" && e.object_id === courseId);
            setEnrolled(isEnrolled);
        } catch (err) {
            console.error("Could not fetch enrollment status:", err);
            setEnrolled(false);
        }
    }, [viewAsPublic]);

    /**
     * `useEffect` for initial data load on the client.
     */
    useEffect(() => {
        if (permalink && !initialCourse) {
            fetchCourseData();
        } else if (course && token && !initialCourse) {
            // This handles the case where the course was from SSR but we still need to check enrollment on client.
            fetchEnrollmentStatus(course.id);
        }
        // keep dropdowns fresh
        // ignore errors silently when course not ready yet
        refreshContentLists();
    }, [permalink, initialCourse, token, fetchCourseData, refreshContentLists]);

    /**
     * @callback initializeEditMode
     * @description Prepares the component for edit mode by fetching necessary resources (subjects, user's lessons/quizzes)
     * and populating the `editData` state with the current course's data.
     */
    const initializeEditMode = useCallback(async () => {
        if (!isCreator || !course) return;

        showMessage("Loading editing tools...", "info", 10000);
        try {
            const [subjectsRes, userLessonsRes, userQuizzesRes] = await Promise.all([
                apiClient.get("/subjects/"),
                apiClient.get("/lessons/my/"),
                apiClient.get("/quizzes/my/"),
            ]);
            
            setSubjects(subjectsRes.data || []);
            // Filter out already-attached or bound elsewhere
            const courseId = course.id;
            const attachedLessonIds = new Set((lessons || []).map(l => l.id));
            const attachedQuizIds   = new Set((quizzes || []).map(q => q.id));
            setAvailableLessons(
              (userLessonsRes.data || []).filter(l => !attachedLessonIds.has(l.id) && l.course !== courseId)
            );
            setAvailableQuizzes(
              (userQuizzesRes.data || []).filter(q => !attachedQuizIds.has(q.id) && q.course !== courseId && !q.lesson)
            );

            // Populate the edit state object.
            setEditData({
                title: course.title || "",
                subject: course.subject || "",
                description: course.description || "",
                coverImageFile: null, // For new file uploads
                selectedLessons: lessons.map(l => l.id),
                selectedQuizzes: quizzes.map(q => q.id),
                isDraft: course.is_draft,
                testers: (course.allowed_testers || []).join(", "),
            });
            setCoverImagePreview(course.cover_image || null);
            setCurrentEditStep(1);
            setEditMode(true);
            setMessage({}); // Clear loading message
        } catch (err) {
            handleApiError(err, "Failed to load resources required for editing.");
        }
    }, [isCreator, course, lessons, quizzes]);
    
    /**
     * `useEffect` to automatically trigger edit mode if the user is the creator and on the correct admin route.
     */
    useEffect(() => {
        if (isEditRoute && !editMode && course && isCreator && !viewAsPublic) {
            initializeEditMode();
            refreshContentLists();
        }
     }, [isEditRoute, editMode, course, isCreator, viewAsPublic, initializeEditMode, refreshContentLists]);


    /**
     * `useEffect` to manage the sanitation and accordion initialization of the course description viewer.
     * It runs only when not in edit mode and when the course description changes.
     */
    useEffect(() => {
        if (!editMode && descriptionViewerRef.current && course?.description) {
            sanitizeAndInitializeContentViewer(descriptionViewerRef.current, course.description);
        }
    }, [editMode, course?.description]);
    
    // #endregion

    // #region Utility & Feedback Handlers

    /**
     * @function handleApiError
     * @description A centralized function to handle errors from API calls. It logs the error,
     * sets a user-facing error message, and logs the user out on authentication failures.
     * @param {Error} err - The error object from the API call.
     * @param {string} defaultMessage - A fallback message to show the user.
     */
    const handleApiError = (err, defaultMessage) => {
        console.error("API Error:", err.response?.data || err.message);
        const status = err.response?.status;
        const apiMessage = err.response?.data?.detail || JSON.stringify(err.response?.data);
        setMessage({ text: apiMessage || defaultMessage, type: "error" });
        if (status === 401 || status === 403) {
            logout();
            router.push("/login");
        }
    };

    /**
     * @function showMessage
     * @description A utility to display a temporary feedback message to the user.
     * @param {string} text - The message content.
     * @param {'success'|'error'|'info'|'warning'} [type='success'] - The type of message.
     * @param {number} [duration=4000] - How long the message should be visible in milliseconds.
     */
    const showMessage = (text, type = 'success', duration = 4000) => {
        setMessage({ text, type });
        if (duration > 0) {
           setTimeout(() => setMessage({ text: "", type: "error" }), duration);
        }
    };

    // #endregion

    // #region Event Handlers (Read Mode)

    /**
     * @function handleEnroll
     * @description Handles the course enrollment process for both free and premium courses.
     * For premium courses, it initiates a Stripe checkout session.
     */
    const handleEnroll = async () => {
        if (!course?.id || !token) {
           return showMessage("You must be logged in to enroll.", "error");
        }
        
        showMessage("Processing your enrollment...", "info", 10000);

        if (course.course_type === "premium") {
            try {
                const response = await apiClient.post("/payments/create-checkout-session/", { course_id: course.id });
                const { sessionId } = response.data;
                if (sessionId) {
                    const stripe = await stripePromise;
                    await stripe.redirectToCheckout({ sessionId });
                } else {
                    throw new Error("Missing session ID.");
                }
            } catch (err) {
                handleApiError(err, "Could not initiate payment.");
            }
        } else { // Free course
            try {
                await apiClient.post("/enrollments/", { object_id: course.id, enrollment_type: "course" });
                setEnrolled(true);
                showMessage("Successfully enrolled!", "success");
            } catch (err) {
                handleApiError(err, "Could not enroll in the course.");
            }
        }
    };
    
    // #endregion

    // #region Event Handlers (Edit Mode)

    /**
     * @function handleEditInputChange
     * @description Generic handler for simple input changes in the edit form.
     * @param {string} field - The key in the `editData` state to update.
     * @returns {function(Event): void} - The event handler function.
     */
    const handleEditInputChange = (field) => (e) => {
        setEditData(prev => ({ ...prev, [field]: e.target.value }));
    };
    
    /**
     * @function handleEditCoverImageChange
     * @description Handles the selection of a new cover image file. Validates the file
     * and creates a local preview.
     * @param {Event} e - The file input change event.
     */
    const handleEditCoverImageChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
             return showMessage('Cover image cannot exceed 5MB.', 'error');
        }
        setEditData(prev => ({ ...prev, coverImageFile: file }));
        const reader = new FileReader();
        reader.onloadend = () => setCoverImagePreview(reader.result);
        reader.readAsDataURL(file);
    };

    /**
     * @function handleContentToggle
     * @description Handles toggling the selection of lessons or quizzes in the edit form.
     * @param {number} id - The ID of the lesson or quiz.
     * @param {'selectedLessons'|'selectedQuizzes'} field - The state field to update.
     */
    const handleContentToggle = (id, field) => {
        setEditData(prev => ({
            ...prev,
            [field]: prev[field].includes(id)
                ? prev[field].filter(itemId => itemId !== id)
                : [...prev[field], id]
        }));
    };

    
    // Immediate detach actions for items already attached to this course
    const handleDetachLessonImmediate = async (lessonId) => {
        if (!permalink || !lessonId) return;
        if (!window.confirm("Detach this lesson from the course?")) return;
        try {
            await apiClient.post(`/courses/${permalink}/detach-lesson/`, { lesson_id: lessonId });
            // remove from attached and make it selectable again
            setLessons(prev => prev.filter(l => l.id !== lessonId));
            setEditData(prev => ({ ...prev, selectedLessons: prev.selectedLessons.filter(id => id !== lessonId) }));
            await refreshContentLists();
            showMessage("Lesson detached.", "success");
        } catch (err) {
            handleApiError(err, "Failed to detach lesson.");
        }
    };

    const handleDetachQuizImmediate = async (quizId) => {
        if (!permalink || !quizId) return;
        if (!window.confirm("Detach this quiz from the course?")) return;
        try {
            await apiClient.post(`/courses/${permalink}/detach-quiz/`, { quiz_id: quizId });
            setQuizzes(prev => prev.filter(q => q.id !== quizId));
            setEditData(prev => ({ ...prev, selectedQuizzes: prev.selectedQuizzes.filter(id => id !== quizId) }));
            await refreshContentLists();
            showMessage("Quiz detached.", "success");
        } catch (err) {
            handleApiError(err, "Failed to detach quiz.");
        }
    };
    /**
     * @function validateEditStep
     * @description Validates the inputs for a given step in the edit wizard.
     * @param {number} step - The step number to validate.
     * @returns {string|null} - An error message string if validation fails, otherwise null.
     */
    const validateEditStep = (step) => {
        switch (step) {
            case 1:
                if (!editData.title.trim()) return "Course Title is required.";
                if (!editData.subject) return "Please select a Subject.";
                return null;
            case 2:
                const desc = editorRef.current?.getContent() || editData.description;
                if (!desc || !desc.trim() || desc === "<p><br></p>") return "Course Description cannot be empty.";
                // Sync state on successful validation, important for preview and final save.
                if (desc !== editData.description) {
                    setEditData(prev => ({...prev, description: desc}));
                }
                return null;
            default:
                return null;
        }
    };
    
    /**
     * @function handleEditStepChange
     * @description Handler for the "Next" button in the edit wizard. Validates the current
     * step before allowing progression to the next.
     * @param {number} nextStep - The step to navigate to.
     */
    const handleEditStepChange = (nextStep) => {
        const errorMsg = validateEditStep(currentEditStep);
        if (errorMsg) {
            return showMessage(errorMsg, 'error');
        }
        setCurrentEditStep(nextStep);
    };

    /**
     * @function handleSaveChanges
     * @description The final save handler. It collects all data from the `editData` state,
     * constructs a FormData object, and sends a PATCH request to the backend to update the course.
     */
    const handleSaveChanges = async () => {
        // Final validation before submitting
        for (let i = 1; i <= 4; i++) {
            const validationError = validateEditStep(i);
            if (validationError) {
                setCurrentEditStep(i);
                return showMessage(validationError, 'error');
            }
        }

        showMessage("Saving changes...", "info", 0); // Indefinite message

        // 3.1 Sync content attachments first (diff -> attach/detach)
        try {
            const currentLessonIds = (lessons || []).map(l => l.id);
            const currentQuizIds   = (quizzes || []).map(q => q.id);
            const nextLessonIds    = editData.selectedLessons || [];
            const nextQuizIds      = editData.selectedQuizzes || [];

            const addLessonIds    = nextLessonIds.filter(id => !currentLessonIds.includes(id));
            const removeLessonIds = currentLessonIds.filter(id => !nextLessonIds.includes(id));
            const addQuizIds      = nextQuizIds.filter(id => !currentQuizIds.includes(id));
            const removeQuizIds   = currentQuizIds.filter(id => !nextQuizIds.includes(id));

            // Attach lessons
            for (const id of addLessonIds) {
                await apiClient.post(`/courses/${permalink}/add-lesson/`, { lesson_id: id });
            }
            // Detach lessons
            for (const id of removeLessonIds) {
                await apiClient.post(`/courses/${permalink}/detach-lesson/`, { lesson_id: id });
            }
            // Attach quizzes
            for (const id of addQuizIds) {
                await apiClient.post(`/courses/${permalink}/add-quiz/`, { quiz_id: id });
            }
            // Detach quizzes
            for (const id of removeQuizIds) {
                await apiClient.post(`/courses/${permalink}/detach-quiz/`, { quiz_id: id });
            }
        } catch (err) {
            return handleApiError(err, "Failed to update attached lessons/quizzes.");
        }
        
        const formData = new FormData();
        formData.append('title', editData.title);
        formData.append('subject', editData.subject);
        formData.append('description', editData.description);
        if (editData.coverImageFile) {
            formData.append('cover_image', editData.coverImageFile);
        }
        
        formData.append('is_draft', editData.isDraft);
        if(!editData.isDraft) {
            (editData.testers || "").split(',').map(t => t.trim()).filter(Boolean).forEach(tester => {
                formData.append('allowed_testers', tester);
            });
        }
        
        // Backend expects a JSON string for list updates via FormData

        try {
            const res = await apiClient.patch(`/courses/${permalink}/update/`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Refresh after save to reflect server truth
            await fetchCourseData();
            setEditMode(false); // Exit edit mode
            showMessage("Course updated successfully!", "success");
            // Clean up URL, removing admin-specific path
            router.replace(`/courses/${permalink}`, undefined, { shallow: true });
        } catch (err) {
            handleApiError(err, "Failed to save changes. Please check the form and try again.");
        }
    };
    
    /**
     * @function handleDeleteCourse
     * @description Handles the permanent deletion of the course after user confirmation.
     */
    const handleDeleteCourse = async () => {
        if (!window.confirm("Are you absolutely sure you want to delete this course? This action is permanent and cannot be undone.")) return;
        
        showMessage("Deleting course...", "info", 10000);
        try {
            await apiClient.delete(`/courses/${permalink}/delete/`);
            showMessage("Course has been successfully deleted.", "success");
            router.push("/admin/dashboard"); // Redirect away from the now-deleted course
        } catch (err) {
            handleApiError(err, "Failed to delete the course.");
        }
    };

    // #endregion

    // #region Render Logic

    // --- Loading & Error States ---
    if (loading) {
        return <div className={styles.utilityContainer}><FaSpinner className={styles.spinner} /><span>Loading Course...</span></div>;
    }
    if (error && !course) {
        return <div className={styles.utilityContainer}>{error}</div>;
    }
    if (!course) {
        return <div className={styles.utilityContainer}>Course could not be found.</div>;
    }

    /**
     * @constant {Array<object>} EDIT_STEPS
     * @description Configuration for the steps in the edit mode wizard.
     */
    const EDIT_STEPS = [
        { id: 1, title: 'Course Details' },
        { id: 2, title: 'Description' },
        { id: 3, title: 'Manage Content' },
        { id: 4, title: 'Settings & Publish' }
    ];

    // --- RENDER: EDIT MODE ---
    if (editMode && isCreator) {
        return (
            <div className={styles.editPageContainer}>
                <div className={styles.editHeader}>
                    <h1>Editing: <span className={styles.headerCourseTitle}>{course.title}</span></h1>
                    <button onClick={() => setEditMode(false)} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}><FaWindowClose/> Cancel</button>
                </div>

                <div className={styles.stepper}>
                    {EDIT_STEPS.map((step, index) => (
                        <React.Fragment key={step.id}>
                            <div 
                                className={`${styles.stepItem} ${currentEditStep === step.id ? styles.active : ''}`} 
                                onClick={() => {
                                    // Allow navigation to previous steps only after validation
                                    if(step.id < currentEditStep) {
                                        const errorMsg = validateEditStep(currentEditStep);
                                        if (errorMsg) return showMessage(errorMsg, 'error');
                                        setCurrentEditStep(step.id);
                                    }
                                }}
                            >
                                <div className={styles.stepCounter}>{step.id}</div>
                                <div className={styles.stepTitle}>{step.title}</div>
                            </div>
                            {index < EDIT_STEPS.length - 1 && <div className={styles.stepConnector}></div>}
                        </React.Fragment>
                    ))}
                </div>
                
                <MessageDisplay message={message} />

                <div className={styles.editStepContent}>
                    {currentEditStep === 1 && (
                        <div className={styles.formSection}>
                            <div className={styles.formGrid}>
                               <div className={styles.formGroup}>
                                    <label htmlFor="editTitle">Course Title</label>
                                    <input id="editTitle" type="text" value={editData.title || ''} onChange={handleEditInputChange('title')} className={styles.inputField} />
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="editSubject">Subject</label>
                                    <select id="editSubject" value={editData.subject || ''} onChange={handleEditInputChange('subject')} className={styles.selectField}>
                                        <option value="">Select Subject</option>
                                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="editCoverImage">Cover Image</label>
                                {coverImagePreview && <img src={coverImagePreview} alt="Cover preview" className={styles.coverPreview} />}
                                <input id="editCoverImage" type="file" accept="image/*" onChange={handleEditCoverImageChange} />
                            </div>
                        </div>
                    )}
                    {currentEditStep === 2 && (
                        <div className={styles.formSection}>
                            <label>Course Description</label>
                             <div className={styles.editorContainer}>
                                <CustomEditor ref={editorRef} initialContent={editData.description || ''} mediaCategory="course" />
                            </div>
                        </div>
                    )}
                    {currentEditStep === 3 && (
                        <div className={styles.formSection}>
                             <div className={styles.contentSelectionGrid}>
                                <div>
                                    <div className={styles.contentHeaderRow}>
                                      <h3 className={styles.contentHeader}>Attached Lessons ({lessons.length})</h3>
                                      <button
                                        type="button"
                                        onClick={() => setIsLessonModalOpen(true)}
                                        className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                                        title="Create a new lesson"
                                      >
                                        <FaPlus/> Create Lesson
                                      </button>
                                    </div>
                                    <div className={styles.scrollableBox}>
                                      {lessons.length ? (
                                        lessons.map(l => (
                                          <div key={l.id} className={styles.attachedRow}>
                                            <span className={styles.attachedTitle}>{l.title}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleDetachLessonImmediate(l.id)}
                                              className={styles.detachBtn}
                                              title="Detach"
                                            >
                                              <FaTimes/>
                                            </button>
                                          </div>
                                        ))
                                      ) : <p>No lessons attached.</p>}
                                    </div>
                                    <h4 className={styles.contentSubheader}>Available Lessons</h4>
                                    <div className={styles.scrollableBox}>
                                        {availableLessons.length > 0 ? availableLessons.map(l => (
                                            <div key={l.id} className={styles.contentItem}>
                                                <input type="checkbox" id={`lesson-${l.id}`} checked={editData.selectedLessons.includes(l.id)} onChange={() => handleContentToggle(l.id, 'selectedLessons')} disabled={l.course && l.course !== course.id} />
                                                <label htmlFor={`lesson-${l.id}`}>{l.title} {l.course && l.course !== course.id && <span className={styles.usedElsewhere}>(Used in another course)</span>}</label>
                                            </div>
                                        )) : <p>No lessons available.</p>}
                                    </div>
                                </div>
                                <div>
                                    <div className={styles.contentHeaderRow}>
                                      <h3 className={styles.contentHeader}>Attached Quizzes ({quizzes.length})</h3>
                                      <button
                                        type="button"
                                        onClick={() => setIsQuizModalOpen(true)}
                                        className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                                        title="Create a new quiz"
                                      >
                                        <FaPlus/> Create Quiz
                                      </button>
                                    </div>
                                    <div className={styles.scrollableBox}>
                                      {quizzes.length ? (
                                        quizzes.map(q => (
                                          <div key={q.id} className={styles.attachedRow}>
                                            <span className={styles.attachedTitle}>{q.title}</span>
                                            <button
                                              type="button"
                                              onClick={() => handleDetachQuizImmediate(q.id)}
                                              className={styles.detachBtn}
                                              title="Detach"
                                            >
                                              <FaTimes/>
                                            </button>
                                          </div>
                                        ))
                                      ) : <p>No quizzes attached.</p>}
                                    </div>
                                    <h4 className={styles.contentSubheader}>Available Quizzes</h4>
                                     <div className={styles.scrollableBox}>
                                        {availableQuizzes.length > 0 ? availableQuizzes.map(q => (
                                            <div key={q.id} className={styles.contentItem}>
                                                <input type="checkbox" id={`quiz-${q.id}`} checked={editData.selectedQuizzes.includes(q.id)} onChange={() => handleContentToggle(q.id, 'selectedQuizzes')} disabled={(q.course && q.course !== course.id) || q.lesson} />
                                                <label htmlFor={`quiz-${q.id}`}>{q.title} {((q.course && q.course !== course.id) || q.lesson) && <span className={styles.usedElsewhere}>(Used elsewhere)</span>}</label>
                                            </div>
                                        )) : <p>No quizzes available.</p>}
                                    </div>
                                </div>
                             </div>
                        </div>
                    )}
                    {currentEditStep === 4 && (
                        <div>
                            <div className={styles.formSection}>
                                <h3>Settings</h3>
                                <div className={styles.formGroup}>
                                    <label>Course Status</label>
                                    <div className={styles.radioGroup}>
                                        <label><input type="radio" name="isDraft" checked={!editData.isDraft} onChange={() => setEditData(p => ({...p, isDraft: false}))} /> Published</label>
                                        <label><input type="radio" name="isDraft" checked={editData.isDraft} onChange={() => setEditData(p => ({...p, isDraft: true}))} /> Draft</label>
                                    </div>
                                    <small className={styles.fieldNote}>Published courses are visible and enrollable by students. Drafts are only visible to you.</small>
                                </div>
                                <div className={styles.formGroup}>
                                    <label htmlFor="editTesters">Testers (Usernames, comma-separated)</label>
                                    <input id="editTesters" type="text" value={editData.testers || ''} onChange={handleEditInputChange('testers')} className={styles.inputField} disabled={editData.isDraft} />
                                    {editData.isDraft && <small className={styles.fieldNote}>Testers can only be assigned to published courses. They get free access.</small>}
                                </div>
                            </div>
                            <div className={`${styles.formSection} ${styles.dangerZone}`}>
                                <h3>Danger Zone</h3>
                                <p>This action is permanent and cannot be undone. All associated user enrollments will be lost.</p>
                                <button onClick={handleDeleteCourse} className={`${styles.zportaBtn} ${styles.btnDanger}`}><FaTrash /> Delete This Course</button>
                            </div>
                        </div>
                    )}
                </div>

                <div className={styles.editNavigation}>
                    <button onClick={() => setCurrentEditStep(p => p > 1 ? p - 1 : p)} disabled={currentEditStep === 1} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}><FaArrowLeft/> Back</button>
                    {currentEditStep < EDIT_STEPS.length ? (
                        <button onClick={() => handleEditStepChange(currentEditStep + 1)} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}>Next Step</button>
                    ) : (
                        <button onClick={handleSaveChanges} className={`${styles.zportaBtn} ${styles.btnSuccess}`}><FaSave /> Save All Changes</button>
                    )}
                </div>
                
                {/* Edit-only creation modals */}
                <Modal isOpen={isLessonModalOpen} onClose={() => setIsLessonModalOpen(false)} title="Create New Lesson">
                  <CreateLesson
                    onSuccess={(newLesson) => {
                      setIsLessonModalOpen(false);
                      refreshContentLists();
                      if (newLesson?.id) {
                        setEditData(prev => ({ ...prev, selectedLessons: Array.from(new Set([...(prev.selectedLessons||[]), newLesson.id])) }));
                      }
                    }}
                    onClose={() => setIsLessonModalOpen(false)}
                    isModalMode
                  />
                </Modal>
                <Modal isOpen={isQuizModalOpen} onClose={() => setIsQuizModalOpen(false)} title="Create New Quiz">
                  <CreateQuiz
                    onSuccess={(newQuiz) => {
                      setIsQuizModalOpen(false);
                      refreshContentLists();
                      if (newQuiz?.id) {
                        setEditData(prev => ({ ...prev, selectedQuizzes: Array.from(new Set([...(prev.selectedQuizzes||[]), newQuiz.id])) }));
                      }
                    }}
                    onClose={() => setIsQuizModalOpen(false)}
                    isModalMode
                  />
                </Modal>
            </div>
        );
    }

    // --- RENDER: READ-ONLY / PUBLIC VIEW ---
    return (
        <div className={styles.courseDetailContainer}>
            {isCreator && (
                !viewAsPublic ? (
                    <div className={styles.adminToolbar}>
                        <span><FaCrown /> You are the creator of this course.</span>
                        <div className={styles.adminActions}>
                             <button onClick={() => router.push(`/courses/${permalink}?as_public=true`)} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}><FaEye/> View as Public</button>
                            <button onClick={initializeEditMode} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}><FaEdit /> Manage Course</button>
                        </div>
                    </div>
                ) : (
                    <div className={`${styles.adminToolbar} ${styles.previewMode}`}>
                        <span>You are viewing in Public Preview Mode.</span>
                        <button
                          type="button"
                          onClick={initializeEditMode}
                          className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}
                        >
                          <FaArrowLeft/> Back to Management
                        </button>
                    </div>
                )
            )}

            <header className={styles.header}>
                 <img src={course.cover_image || 'https://placehold.co/1200x400/34495e/ffffff?text=Zporta+Academy'} alt={course.title} className={styles.coverImage} />
                 <div className={styles.headerOverlay}>
                     <div className={styles.headerContent}>
                         <span className={styles.subjectPill}>{course.subject_name}</span>
                         <h1 className={styles.courseTitle}>{course.title}</h1>
                     </div>
                 </div>
             </header>

            <div className={styles.mainContentLayout}>
                <div className={styles.leftColumn}>
                    <section className={styles.contentSection}>
                        <h2>About this Course</h2>
                        <div ref={descriptionViewerRef} className={styles.descriptionViewer}>
                            {/* Content is rendered here by useEffect */}
                        </div>
                    </section>
                    
                    {lessons.length > 0 && (
                        <section className={styles.contentSection}>
                            <h2><FaBook /> Lessons in this Course ({lessons.length})</h2>
                            <ul className={styles.contentList}>
                                {lessons.map(l => <li key={l.id}><a href={`/lessons/${l.permalink}`}>{l.title}</a></li>)}
                            </ul>
                        </section>
                    )}

                     {quizzes.length > 0 && (
                        <section className={styles.contentSection}>
                            <h2><FaQuestion /> Quizzes in this Course ({quizzes.length})</h2>
                            <ul className={styles.contentList}>
                                {quizzes.map(q => <li key={q.id}>{q.title}</li>)}
                            </ul>
                        </section>
                    )}
                </div>
                <aside className={styles.rightColumn}>
                    <div className={styles.sidebarCard}>
                        <h3>{course.course_type === 'premium' ? `$${course.price}` : 'Free'}</h3>
                        {enrolled ? (
                             <button className={`${styles.zportaBtn} ${styles.btnSuccess}`} disabled><FaCheckCircle /> You are enrolled</button>
                        ) : (
                             <button onClick={handleEnroll} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={course.is_draft}>
                                {course.is_draft ? "Enrollment Closed" : "Enroll Now"}
                            </button>
                        )}
                        <div className={styles.courseMeta}>
                            <span>Created by: <strong>{course.created_by}</strong></span>
                            <span>Subject: <strong>{course.subject_name}</strong></span>
                            <span>Last updated: <strong>{new Date(course.updated_at).toLocaleDateString()}</strong></span>
                        </div>
                    </div>
                </aside>
            </div>
        </div>
    );
    // #endregion
};

export default CourseDetail;

