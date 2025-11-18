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
import Image from "next/image";
import Link from "next/link";
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
 * @constant {Promise<Stripe>|null} stripePromise
 * @description Initializes Stripe.js with the public key for payment processing.
 * If the env variable is missing, Stripe will be disabled (especially in local dev).
 */
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (!publishableKey && typeof window !== "undefined") {
  // In local dev without env, payments will be disabled but the page still works.
  console.warn("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is not set; Stripe payments are disabled.");
}

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

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
    /** @state {number|null} enrollmentId - The enrollment ID if user is enrolled */
    const [enrollmentId, setEnrollmentId] = useState(null);
    /** @state {string} promoCode - Promo code input for course enrollment */
    const [promoCode, setPromoCode] = useState('');
    /** @state {object|null} promoValidation - Result of promo code validation */
    const [promoValidation, setPromoValidation] = useState(null);

    // --- Page Status State ---
    /** @state {boolean} loading - True while initial data is being fetched on the client. */
    const [loading, setLoading] = useState(!initialCourse);
    /** @state {string} error - Holds any critical error message that prevents the page from rendering. */
    const [error, setError] = useState("");
    /** @state {{text: string, type: string}} message - Holds non-critical feedback for the user (e.g., success/error on save). */
    const [message, setMessage] = useState({ text: "", type: "error" });
    // Discount code creation state (Edit step 4)
    const [discountForm, setDiscountForm] = useState({
        percent_off: 20,
        code: "",
        expires_at: "", // ISO string yyyy-mm-ddThh:mm
        max_redemptions: "",
        first_time_only: true,
    });
    const [lastCreatedCode, setLastCreatedCode] = useState(null);

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

    // --- Accordion State (Public View) ---
    /** @state {string|null} openAccordion - Tracks which accordion is currently open ('description', 'lessons', 'quizzes', or null) */
    const [openAccordion, setOpenAccordion] = useState('description');
    
    /**
     * @function toggleAccordion
     * @description Toggles accordion sections - closes current if same section clicked, otherwise opens new section
     * @param {string} section - The section to toggle ('description', 'lessons', 'quizzes')
     */
    const toggleAccordion = (section) => {
        setOpenAccordion(prev => prev === section ? null : section);
    };

    // --- Drag and Drop State for Lesson Reordering ---
    /** @state {number|null} draggedLessonIndex - Tracks the index of the lesson being dragged */
    const [draggedLessonIndex, setDraggedLessonIndex] = useState(null);
    /** @state {number|null} dragOverIndex - Tracks which lesson position the dragged item is hovering over */
    const [dragOverIndex, setDragOverIndex] = useState(null);

    
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

    // #region Utility & Feedback Handlers

    /**
     * @function handleApiError
     * @description A centralized function to handle errors from API calls. It logs the error,
     * sets a user-facing error message, and logs the user out on authentication failures.
     * @param {Error} err - The error object from the API call.
     * @param {string} defaultMessage - A fallback message to show the user.
     */
    const handleApiError = useCallback((err, defaultMessage) => {
        console.error("API Error:", err.response?.data || err.message);
        const status = err.response?.status;
        const apiMessage = err.response?.data?.detail || JSON.stringify(err.response?.data);
        setMessage({ text: apiMessage || defaultMessage, type: "error" });
        if (status === 401 || status === 403) {
            logout();
            router.push("/login");
        }
    }, [logout, router]);

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
    
    // #region Data Fetching and Initialization

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
            const enrollment = res.data?.find(e => e.enrollment_type === "course" && e.object_id === courseId);
            if (enrollment) {
                setEnrolled(true);
                setEnrollmentId(enrollment.id);
            } else {
                setEnrolled(false);
                setEnrollmentId(null);
            }
        } catch (err) {
            console.error("Could not fetch enrollment status:", err);
            setEnrolled(false);
            setEnrollmentId(null);
        }
    }, [viewAsPublic]);

    /**
     * @callback fetchCourseData
     * @description Fetches the primary course data from the API based on the permalink.
     * This is used for client-side navigation.
     */
    const fetchCourseData = useCallback(async () => {
        if (!permalink) return;
        setLoading(true);
        setError("");
        if (process.env.NODE_ENV === 'development') console.log('[CourseDetail] Fetching course:', permalink);
        try {
            const res = await apiClient.get(`/courses/${permalink}/`);
            const { course: fetchedCourse, lessons: fetchedLessons, quizzes: fetchedQuizzes } = res.data;
            
            setCourse(fetchedCourse);
            setLessons(fetchedLessons || []);
            setQuizzes(fetchedQuizzes || []);

            // Check enrollment status if user is authenticated
            if (token) fetchEnrollmentStatus(fetchedCourse.id);

        } catch (err) {
            handleApiError(err, "Course not found or failed to load.");
        } finally {
            setLoading(false);
        }
    }, [permalink, token, fetchEnrollmentStatus, handleApiError]);

    /**
     * `useEffect` for initial data load on the client.
     */
    useEffect(() => {
        if (permalink && !initialCourse) {
            fetchCourseData();
        }
        // keep dropdowns fresh
        // ignore errors silently when course not ready yet
        refreshContentLists();
    }, [permalink, initialCourse, fetchCourseData, refreshContentLists]);

    /**
     * `useEffect` to check enrollment status whenever user/token/course changes
     */
    useEffect(() => {
        if (course?.id && token && !viewAsPublic) {
            fetchEnrollmentStatus(course.id);
        }
    }, [course?.id, token, viewAsPublic, fetchEnrollmentStatus]);

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
                sellingPoints: Array.isArray(course.selling_points) ? course.selling_points.slice(0,3) : [],
                coverImageFile: null, // For new file uploads
                selectedLessons: lessons.map(l => l.id),
                selectedQuizzes: quizzes.map(q => q.id),
                isDraft: course.is_draft,
                testers: (course.allowed_testers || []).join(", "),
            });
            setCoverImagePreview(course.cover_image || null);
            setCurrentEditStep(1);
            setEditMode(true);
            // Refresh course detail with authenticated request so attached draft lessons are included
            try {
                const res = await apiClient.get(`/courses/${permalink}/`);
                const { course: freshCourse, lessons: freshLessons, quizzes: freshQuizzes } = res.data || {};
                if (freshCourse) setCourse(freshCourse);
                if (Array.isArray(freshLessons)) setLessons(freshLessons);
                if (Array.isArray(freshQuizzes)) setQuizzes(freshQuizzes);
            } catch (refreshErr) {
                console.warn("Could not refresh owner course details:", refreshErr.response?.data || refreshErr.message);
            }
            setMessage({}); // Clear loading message
        } catch (err) {
            handleApiError(err, "Failed to load resources required for editing.");
        }
    }, [isCreator, course, lessons, quizzes, permalink, handleApiError]);
    
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
                const payload = { course_id: course.id };
                if (promoCode.trim()) {
                    payload.promo_code = promoCode.trim().toUpperCase();
                }
                const response = await apiClient.post("/payments/create-checkout-session/", payload);
                const { sessionId, url } = response.data || {};
                if (url) {
                    try { localStorage.setItem('courseId', String(course.id)); } catch {}
                    window.location.href = url; // Directly use hosted Checkout URL
                    return;
                }
                if (sessionId) {
                    try { localStorage.setItem('courseId', String(course.id)); } catch {}
                    const stripe = stripePromise ? await stripePromise : null;
                    if (!stripe) {
                        showMessage("Payments are temporarily unavailable. Please try again later.", "error");
                        return;
                    }
                    const result = await stripe.redirectToCheckout({ sessionId });
                    if (result?.error?.message) {
                        showMessage(result.error.message, "error");
                    }
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
    
    /**
     * @function validatePromoCode
     * @description Validates a promo code for the current course before enrollment
     */
    const validatePromoCode = async () => {
        if (!promoCode.trim() || !course?.id) return;
        try {
            const res = await apiClient.post('/payments/validate-promo-code/', {
                code: promoCode.trim().toUpperCase(),
                course_id: course.id
            });
            setPromoValidation(res.data);
            if (res.data.valid) {
                showMessage(res.data.message || 'Promo code valid!', 'success');
            } else {
                showMessage(res.data.error || 'Invalid promo code', 'error');
            }
        } catch (err) {
            setPromoValidation(null);
            handleApiError(err, 'Failed to validate promo code');
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

    // Publish a single attached draft lesson (owner-only)
    const handlePublishSingleLesson = async (lesson) => {
        if (!lesson?.permalink) return;
        if (course?.is_draft) {
            return showMessage("Publish the course first, then publish its lessons.", "warning");
        }
        if (!window.confirm(`Publish lesson: "${lesson.title}"?`)) return;
        try {
            await apiClient.post(`/lessons/${lesson.permalink}/publish/`);
            // Update local state: mark this lesson as published
            setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, status: 'published' } : l));
            showMessage("Lesson published.", "success");
        } catch (err) {
            handleApiError(err, "Failed to publish lesson.");
        }
    };

    // --- Drag and Drop Handlers for Lesson Reordering ---
    const handleDragStart = (e, index) => {
        setDraggedLessonIndex(index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        if (index !== dragOverIndex) {
            setDragOverIndex(index);
        }
    };

    const handleDragLeave = () => {
        setDragOverIndex(null);
    };

    const handleDrop = async (e, dropIndex) => {
        e.preventDefault();
        
        if (draggedLessonIndex === null || draggedLessonIndex === dropIndex) {
            setDraggedLessonIndex(null);
            setDragOverIndex(null);
            return;
        }

        // Reorder lessons array locally
        const reorderedLessons = [...lessons];
        const [movedLesson] = reorderedLessons.splice(draggedLessonIndex, 1);
        reorderedLessons.splice(dropIndex, 0, movedLesson);

        // Optimistically update UI
        setLessons(reorderedLessons);
        setDraggedLessonIndex(null);
        setDragOverIndex(null);

        // Send new order to backend
        try {
            const lessonOrder = reorderedLessons.map(l => l.id);
            console.log('Reordering lessons for course:', permalink);
            console.log('Lesson order:', lessonOrder);
            console.log('URL:', `/courses/${permalink}/lessons/reorder/`);
            
            const response = await apiClient.post(`/courses/${permalink}/lessons/reorder/`, { order: lessonOrder });
            console.log('Reorder response:', response.data);
            showMessage("Lesson order updated.", "success");
        } catch (err) {
            console.error('Reorder error:', err.response || err);
            // Revert on error
            setLessons(lessons);
            handleApiError(err, "Failed to reorder lessons.");
        }
    };

    const handleDragEnd = () => {
        setDraggedLessonIndex(null);
        setDragOverIndex(null);
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
                // Validate up to 3 concise selling points
                if (Array.isArray(editData.sellingPoints)) {
                    const cleaned = editData.sellingPoints.map(p => (p || "").trim()).filter(Boolean);
                    if (cleaned.length > 3) return "Please limit to 3 selling points.";
                    if (cleaned.some(p => p.length > 120)) return "Each selling point should be under 120 characters.";
                }
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

        // 3.2 Handle publish/unpublish transitions
        try {
            if (course && course.is_draft && !editData.isDraft) {
                // Will publish via serializer flag below
            } else if (course && !course.is_draft && editData.isDraft) {
                await apiClient.post(`/courses/${permalink}/unpublish/`);
            }
        } catch (err) {
            return handleApiError(err, "Failed to change course publish status.");
        }
        
        const formData = new FormData();
        formData.append('title', editData.title);
        formData.append('subject', editData.subject);
        formData.append('description', editData.description);
        // send selling points as JSON list
        if (Array.isArray(editData.sellingPoints)) {
            const cleaned = editData.sellingPoints.map(p => (p || '').trim()).filter(Boolean).slice(0,3);
            formData.append('selling_points', JSON.stringify(cleaned));
        }
        if (editData.coverImageFile) {
            formData.append('cover_image', editData.coverImageFile);
        }
        
        formData.append('is_draft', editData.isDraft);
        if (!editData.isDraft) {
            // Use serializer's publish flag to flip from draft -> published
            formData.append('publish', 'true');
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

    // Create Stripe Promotion Code for this course (owner only)
    const generateRandomCode = () => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let s = '';
        for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
        setDiscountForm(prev => ({ ...prev, code: s }));
    };

    const handleCreatePromoCode = async () => {
        if (!course?.id) return;
        try {
            const payload = { course_id: course.id, ...discountForm };
            // Convert empty strings to undefined to avoid API type issues
            if (!payload.code) delete payload.code;
            if (!payload.max_redemptions) delete payload.max_redemptions;
            if (!payload.expires_at) delete payload.expires_at;
            const res = await apiClient.post('/payments/create-promo-code/', payload);
            const data = res.data || {};
            setLastCreatedCode(data);
            showMessage(`Discount code created: ${data.code}`, 'success');
        } catch (err) {
            handleApiError(err, 'Failed to create discount code.');
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
                                <label>Key Points (up to 3)</label>
                                {Array.from({ length: 3 }).map((_, idx) => (
                                  <input
                                    key={idx}
                                    type="text"
                                    value={(editData.sellingPoints?.[idx]) || ''}
                                    onChange={(e) => {
                                        const next = [...(editData.sellingPoints||[])];
                                        next[idx] = e.target.value;
                                        setEditData(prev => ({ ...prev, sellingPoints: next }));
                                    }}
                                    className={styles.inputField}
                                    placeholder={idx === 0 ? 'e.g., Learn by building real projects' : idx === 1 ? 'e.g., Step-by-step videos and code' : 'e.g., Lifetime access and updates'}
                                    maxLength={120}
                                    style={{ marginTop: idx ? 8 : 0 }}
                                  />
                                ))}
                                <small className={styles.fieldNote}>Short, benefit-driven bullets appear on the course page.</small>
                            </div>
                            <div className={styles.formGroup}>
                                <label htmlFor="editCoverImage">Cover Image</label>
                                                                {coverImagePreview && (
                                                                    <Image
                                                                        src={coverImagePreview}
                                                                        alt="Cover preview"
                                                                        className={styles.coverPreview}
                                                                        width={1200}
                                                                        height={400}
                                                                    />
                                                                )}
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
                                    {lessons.length > 1 && (
                                        <p className={styles.dragInstruction}>
                                            <FaArrowLeft style={{transform: 'rotate(90deg)', marginRight: '6px'}} />
                                            Drag lessons to reorder them
                                        </p>
                                    )}
                                    <div className={styles.scrollableBox}>
                                                                            {lessons.length ? (
                                                                                lessons.map((l, index) => (
                                                                                    <div 
                                                                                        key={l.id} 
                                                                                        className={`${styles.attachedRow} ${draggedLessonIndex === index ? styles.dragging : ''} ${dragOverIndex === index ? styles.dragOver : ''}`}
                                                                                        draggable={true}
                                                                                        onDragStart={(e) => handleDragStart(e, index)}
                                                                                        onDragOver={(e) => handleDragOver(e, index)}
                                                                                        onDragLeave={handleDragLeave}
                                                                                        onDrop={(e) => handleDrop(e, index)}
                                                                                        onDragEnd={handleDragEnd}
                                                                                    >
                                                                                        <span className={styles.dragHandle} title="Drag to reorder">⋮⋮</span>
                                                                                        <span className={styles.lessonNumber}>#{index + 1}</span>
                                                                                        <span className={styles.attachedTitle}>{l.title}</span>
                                                                                        <span className={`${styles.statusPill} ${l.status === 'published' ? styles.statusPublished : styles.statusDraft}`} style={{ marginLeft: 8 }}>
                                                                                            {l.status === 'published' ? 'Published' : 'Draft'}
                                                                                        </span>
                                                                                        {l.status === 'draft' && (
                                                                                            course.is_draft ? (
                                                                                                <button type="button" className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`} style={{ marginLeft: 8 }} disabled title="Publish the course first">Publish</button>
                                                                                            ) : (
                                                                                                <button type="button" className={`${styles.zportaBtn} ${styles.btnSuccess}`} style={{ marginLeft: 8 }} onClick={() => handlePublishSingleLesson(l)}>Publish</button>
                                                                                            )
                                                                                        )}
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
                            <div className={styles.formSection}>
                                <h3>Discount Codes</h3>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Percent Off</label>
                                        <input type="number" min={1} max={100} value={discountForm.percent_off}
                                            onChange={(e)=> setDiscountForm(p=> ({...p, percent_off: Math.max(1, Math.min(100, parseInt(e.target.value||'0',10)))}))}
                                            className={styles.inputField} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Custom Code (optional)</label>
                                        <div style={{ display:'flex', gap:8 }}>
                                            <input type="text" value={discountForm.code}
                                                onChange={(e)=> setDiscountForm(p=> ({...p, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'')}))}
                                                className={styles.inputField} />
                                            <button type="button" onClick={generateRandomCode} className={`${styles.zportaBtn} ${styles.zportaBtnSecondary}`}>Random</button>
                                        </div>
                                        <small className={styles.fieldNote}>Use letters and numbers only. Leave blank to auto-generate.</small>
                                    </div>
                                </div>
                                <div className={styles.formGrid}>
                                    <div className={styles.formGroup}>
                                        <label>Expires At (optional)</label>
                                        <input type="datetime-local" value={discountForm.expires_at}
                                            onChange={(e)=> setDiscountForm(p=> ({...p, expires_at: e.target.value}))}
                                            className={styles.inputField} />
                                    </div>
                                    <div className={styles.formGroup}>
                                        <label>Max Redemptions (optional)</label>
                                        <input type="number" min={1} value={discountForm.max_redemptions}
                                            onChange={(e)=> setDiscountForm(p=> ({...p, max_redemptions: e.target.value}))}
                                            className={styles.inputField} />
                                    </div>
                                </div>
                                <div className={styles.formGroup}>
                                    <label><input type="checkbox" checked={discountForm.first_time_only}
                                        onChange={(e)=> setDiscountForm(p=> ({...p, first_time_only: e.target.checked}))} /> First purchase only</label>
                                </div>
                                <button type="button" onClick={handleCreatePromoCode} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`}><FaSave/> Create Discount Code</button>
                                {lastCreatedCode?.code && (
                                    <div className={styles.fieldNote} style={{marginTop:8}}>Created code: <strong>{lastCreatedCode.code}</strong>{lastCreatedCode.expires_at ? ` • Expires: ${new Date(lastCreatedCode.expires_at*1000).toLocaleString()}` : ''}</div>
                                )}
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

            <MessageDisplay message={message} />

            <header className={styles.header}>
                                 <Image
                                     src={course.cover_image || 'https://placehold.co/1200x400/34495e/ffffff?text=Zporta+Academy'}
                                     alt={course.title}
                                     className={styles.coverImage}
                                     width={1200}
                                     height={400}
                                 />
                 <div className={styles.headerOverlay}>
                     <div className={styles.headerContent}>
                         <span className={styles.subjectPill}>{course.subject_name}</span>
                         <h1 className={styles.courseTitle}>{course.title}</h1>
                     </div>
                 </div>
             </header>

            <div className={styles.mainContentLayout}>
                <div className={styles.leftColumn}>
                    {/* Mobile-only: What you'll get (selling points) */}
                    {Array.isArray(course.selling_points) && course.selling_points.map(p => (p || '').trim()).filter(Boolean).length > 0 && (
                        <div className={`${styles.sellingPointsCard} ${styles.mobileOnly}`}>
                            <div className={styles.sellingPointsHeader}>What you&apos;ll get</div>
                            <ul className={styles.sellingPointsList}>
                                {course.selling_points
                                    .map(p => (p || '').trim())
                                    .filter(Boolean)
                                    .slice(0,3)
                                    .map((p, i) => (
                                        <li key={`mobile-sp-${i}`} className={styles.sellingPointItem}>
                                            <FaStar style={{ color: 'var(--zporta-primary-color, #3b82f6)' }} />
                                            <span>{p}</span>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    )}
                    {/* Modern Accordion Section */}
                    <div className={styles.accordionContainer}>
                        
                        {/* About This Course Accordion */}
                        <div className={`${styles.accordionItem} ${openAccordion === 'description' ? styles.accordionOpen : ''}`}>
                            <button 
                                className={styles.accordionHeader}
                                onClick={() => toggleAccordion('description')}
                                aria-expanded={openAccordion === 'description'}
                            >
                                <div className={styles.accordionHeaderContent}>
                                    <FaBook className={styles.accordionIcon} />
                                    <h2 className={styles.accordionTitle}>About this Course</h2>
                                </div>
                                <span className={styles.accordionToggle}>
                                    {openAccordion === 'description' ? '−' : '+'}
                                </span>
                            </button>
                            <div className={styles.accordionContent}>
                                <div className={styles.accordionInner}>
                                    <div ref={descriptionViewerRef} className={styles.descriptionViewer}>
                                        {/* Content is rendered here by useEffect */}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Lessons Accordion */}
                        {lessons.length > 0 && (
                            <div className={`${styles.accordionItem} ${openAccordion === 'lessons' ? styles.accordionOpen : ''}`}>
                                <button 
                                    className={styles.accordionHeader}
                                    onClick={() => toggleAccordion('lessons')}
                                    aria-expanded={openAccordion === 'lessons'}
                                >
                                    <div className={styles.accordionHeaderContent}>
                                        <FaBook className={styles.accordionIcon} />
                                        <h2 className={styles.accordionTitle}>Course Lessons</h2>
                                        <span className={styles.accordionCount}>{lessons.length}</span>
                                    </div>
                                    <span className={styles.accordionToggle}>
                                        {openAccordion === 'lessons' ? '−' : '+'}
                                    </span>
                                </button>
                                <div className={styles.accordionContent}>
                                    <div className={styles.accordionInner}>
                                        <div className={styles.lessonsGrid}>
                                            {lessons.map((lesson, index) => (
                                                <Link
                                                    key={lesson.id}
                                                    href={`/lessons/${lesson.permalink}`}
                                                    className={styles.lessonCard}
                                                    prefetch
                                                >
                                                    <div className={styles.lessonNumber}>{index + 1}</div>
                                                    <div className={styles.lessonInfo}>
                                                        <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                                                        <div className={styles.lessonBadges}>
                                                            {lesson.is_premium ? (
                                                                <span className={`${styles.lessonBadge} ${styles.badgePremium}`}>
                                                                    <FaCrown className={styles.badgeIcon} /> Premium
                                                                </span>
                                                            ) : (
                                                                course.course_type === 'premium' ? (
                                                                    <span className={`${styles.lessonBadge} ${styles.badgeFree}`}>
                                                                        <FaUnlock className={styles.badgeIcon} /> Free Preview
                                                                    </span>
                                                                ) : (
                                                                    <span className={`${styles.lessonBadge} ${styles.badgeStandard}`}>
                                                                        <FaRegStar className={styles.badgeIcon} /> Standard
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                        {lesson.description && (
                                                            <p className={styles.lessonDescription}>
                                                                {lesson.description.substring(0, 100)}...
                                                            </p>
                                                        )}
                                                    </div>
                                                    <FaArrowLeft className={styles.lessonArrow} style={{ transform: 'rotate(180deg)' }} />
                                                </Link>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Quizzes Accordion */}
                        {quizzes.length > 0 && (
                            <div className={`${styles.accordionItem} ${openAccordion === 'quizzes' ? styles.accordionOpen : ''}`}>
                                <button 
                                    className={styles.accordionHeader}
                                    onClick={() => toggleAccordion('quizzes')}
                                    aria-expanded={openAccordion === 'quizzes'}
                                >
                                    <div className={styles.accordionHeaderContent}>
                                        <FaQuestion className={styles.accordionIcon} />
                                        <h2 className={styles.accordionTitle}>Course Quizzes</h2>
                                        <span className={styles.accordionCount}>{quizzes.length}</span>
                                    </div>
                                    <span className={styles.accordionToggle}>
                                        {openAccordion === 'quizzes' ? '−' : '+'}
                                    </span>
                                </button>
                                <div className={styles.accordionContent}>
                                    <div className={styles.accordionInner}>
                                        <div className={styles.quizzesGrid}>
                                            {quizzes.map((quiz, index) => (
                                                <div key={quiz.id} className={styles.quizCard}>
                                                    <div className={styles.quizNumber}>{index + 1}</div>
                                                    <div className={styles.quizInfo}>
                                                        <h3 className={styles.quizTitle}>{quiz.title}</h3>
                                                        {quiz.description && (
                                                            <p className={styles.quizDescription}>
                                                                {quiz.description.substring(0, 80)}...
                                                            </p>
                                                        )}
                                                    </div>
                                                    <FaCheckCircle className={styles.quizIcon} />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile-only: Price/Enroll card under content */}
                    <div className={`${styles.sidebarCard} ${styles.mobileOnly}`}>
                        <h3>{course.course_type === 'premium' ? `$${course.price}` : 'Free'}</h3>
                        {enrolled ? (
                             <button 
                                onClick={() => enrollmentId && router.push(`/courses/enrolled/${enrollmentId}`)}
                                className={`${styles.zportaBtn} ${styles.btnSuccess}`}
                                disabled={!enrollmentId}
                            >
                                <FaCheckCircle /> Already Enrolled - Go to Course
                            </button>
                        ) : (
                             <button onClick={handleEnroll} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={course.is_draft}>
                                {course.is_draft ? "Enrollment Closed" : "Enroll Now"}
                            </button>
                        )}
                        <div className={styles.courseMeta}>
                            <span>Created by: <strong>{course.created_by}</strong></span>
                            <span>Subject: <strong>{course.subject_name}</strong></span>
                            <span>Last updated: <strong>{(course?.updated_at || course?.created_at) ? new Date(course.updated_at || course.created_at).toLocaleDateString() : '—'}</strong></span>
                        </div>
                    </div>
                </div>
                <aside className={styles.rightColumn}>
                    <div className={styles.sidebarCard}>
                        <h3>{course.course_type === 'premium' ? `$${course.price}` : 'Free'}</h3>
                        {enrolled ? (
                             <button 
                                onClick={() => enrollmentId && router.push(`/courses/enrolled/${enrollmentId}`)}
                                className={`${styles.zportaBtn} ${styles.btnSuccess}`}
                                disabled={!enrollmentId}
                            >
                                <FaCheckCircle /> Already Enrolled - Go to Course
                            </button>
                        ) : (
                             <button onClick={handleEnroll} className={`${styles.zportaBtn} ${styles.zportaBtnPrimary}`} disabled={course.is_draft}>
                                {course.is_draft ? "Enrollment Closed" : "Enroll Now"}
                            </button>
                        )}
                        <div className={styles.courseMeta}>
                            <span>Created by: <strong>{course.created_by}</strong></span>
                            <span>Subject: <strong>{course.subject_name}</strong></span>
                            <span>Last updated: <strong>{(course?.updated_at || course?.created_at) ? new Date(course.updated_at || course.created_at).toLocaleDateString() : '—'}</strong></span>
                        </div>
                    </div>
                    {Array.isArray(course.selling_points) && course.selling_points.map(p => (p || '').trim()).filter(Boolean).length > 0 && (
                        <div className={styles.sellingPointsCard}>
                            <div className={styles.sellingPointsHeader}>What you&apos;ll get</div>
                            <ul className={styles.sellingPointsList}>
                                {course.selling_points
                                    .map(p => (p || '').trim())
                                    .filter(Boolean)
                                    .slice(0,3)
                                    .map((p, i) => (
                                        <li key={i} className={styles.sellingPointItem}>
                                            <FaStar style={{ color: 'var(--zporta-primary-color, #3b82f6)' }} />
                                            <span>{p}</span>
                                        </li>
                                    ))}
                            </ul>
                        </div>
                    )}
                </aside>
            </div>
        </div>
    );
    // #endregion
};

export default CourseDetail;

