import React, { useEffect, useState, useContext, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { FaPlus, FaTimes, FaArrowUp, FaCheck, FaArrowLeft, FaRegClock, FaUser } from 'react-icons/fa'; // Removed FaEdit, FaTrash as Pencil/Trash2 are used
import { Pencil, Trash2 } from 'lucide-react';
import CustomEditor from "./Editor/CustomEditor";
import apiClient from "../api";
import { AuthContext } from "../context/AuthContext";
import QuizCard from './QuizCard';
// import Modal from './Modal/Modal'; // Modal import commented out as it wasn't used in the provided snippet
import styles from "./LessonDetail.module.css";
import "./Editor/ViewerAccordion.css"; // Keep this for global accordion styles used by dangerouslySetInnerHTML

console.log('LessonDetail Styles:', styles);

// Accordion Initialization Function (Copied from CourseDetail.js)
// This function handles finding, initializing, and managing click events for accordions.
function initializeAccordions(containerElement) {
  if (!containerElement) return; // Exit if no container element is provided

  // Find all elements with the class 'accordion-item' within the container
  const accordions = containerElement.querySelectorAll(".accordion-item");

  accordions.forEach((accordion) => {
    // Find the header and content elements within each accordion item
    const header   = accordion.querySelector(".accordion-header");
    // NOTE: This logic expects '.accordion-content' directly inside '.accordion-item'
    // Ensure your CustomEditor output matches this structure for accordions.
    const contents = accordion.querySelectorAll(".accordion-content");
    // Read the desired default state ('open' or 'closed') from the data attribute
    const defaultState = accordion.getAttribute("data-default-state") || "closed";

    // --- Pre-initialization Checks ---
    // 1. Check if header exists
    // 2. Check if at least one content element exists
    // 3. Check if this specific accordion has already been initialized (using a data attribute)
    if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") {
      // If any check fails, skip initialization for this accordion item
      return;
    }
    // Mark this accordion as initialized to prevent re-binding listeners
    accordion.dataset.accordionInitialized = "true";

    // --- Set Initial Visual State ---
    // Add or remove the 'is-open' class based on the 'data-default-state' attribute
    // The actual visual change (showing/hiding content, rotating icon) is handled by CSS rules
    // targeting the '.is-open' class (defined in ViewerAccordion.css).
    if (defaultState === "open") {
      accordion.classList.add("is-open");
    } else {
      accordion.classList.remove("is-open");
    }

    // --- Click Handler Definition ---
    // Define the function that will run when the accordion header is clicked
    const clickHandler = () => {
      // Toggle the 'is-open' class on the main accordion item element
      accordion.classList.toggle("is-open");
      // CSS transitions in ViewerAccordion.css handle the smooth opening/closing animation.
    };

    // --- Event Listener Management ---
    // IMPORTANT: Clean up any previously attached listener *before* adding a new one.
    // This prevents duplicate listeners if the initialization logic runs multiple times
    // (e.g., due to React re-renders or effect dependencies changing).
    // We store a reference to the handler on the header element itself.
    if (header.__accordionClickHandler__) {
      header.removeEventListener("click", header.__accordionClickHandler__);
    }
    // Add the new click listener to the header
    header.addEventListener("click", clickHandler);
    // Store a reference to the *current* clickHandler on the header element.
    // This allows us to specifically remove *this* listener during cleanup.
    header.__accordionClickHandler__ = clickHandler;

    // --- Nested Accordion Initialization ---
    // Recursively initialize any accordions found *inside* the content of the current accordion.
    // This ensures that nested accordions also become interactive.
    contents.forEach((content) => {
      // Use requestAnimationFrame to defer the nested initialization slightly.
      // This can help ensure the browser has processed any DOM updates within the content
      // before attempting to initialize nested items, especially if content is loaded dynamically.
      requestAnimationFrame(() => {
        initializeAccordions(content);
      });
    });
  });
}


// --- Floating Action Buttons Component ---
// Provides quick actions like scrolling to top, marking complete, and going back.
const FloatingActionButtons = ({ onTopClick, onCompleteClick, onBackClick }) => {
    const [isOpen, setIsOpen] = useState(false); // State to control the radial menu visibility

    // Toggles the open/closed state of the radial menu
    const toggleMenu = () => setIsOpen(!isOpen);

  return (
    // Container for the entire FAB menu
    <div className={styles.radialMenuContainer}>
      {/* The menu itself, applies 'open' class when active */}
      <div className={`${styles.radialMenu} ${isOpen ? styles.open : ''}`}>
        {/* Main button to toggle the menu */}
        <button className={`${styles.localFab} ${styles.radialMenuButton} ${styles.mainButton}`} onClick={toggleMenu}>
          {/* Shows close (X) icon when open, plus (+) icon when closed */}
          {isOpen ? <FaTimes size={24} /> : <FaPlus size={24} />}
        </button>
        {/* Button to scroll to top */}
        <button
          className={`${styles.radialMenuButton} ${styles.item} ${styles.item1}`}
          onClick={() => { onTopClick(); setIsOpen(false); }} // Executes action and closes menu
          title="Scroll to Top" // Tooltip for accessibility
        >
          <FaArrowUp size={20} />
        </button>
        {/* Button to mark lesson complete */}
        <button
          className={`${styles.radialMenuButton} ${styles.item} ${styles.item2}`}
          onClick={() => { onCompleteClick(); setIsOpen(false); }} // Executes action and closes menu
          title="Mark Complete" // Tooltip for accessibility
        >
          <FaCheck size={20} />
        </button>
        {/* Button to go back */}
        <button
          className={`${styles.radialMenuButton} ${styles.item} ${styles.item3}`}
          onClick={() => { onBackClick(); setIsOpen(false); }} // Executes action and closes menu
          title="Go Back" // Tooltip for accessibility
        >
          <FaArrowLeft size={20} />
        </button>
      </div>
    </div>
  );
};

// --- HTML Sanitization Function ---
// Removes potentially harmful attributes (like contenteditable) before rendering HTML.
const sanitizeContentViewerHTML = (htmlString) => {
    if (!htmlString) return ""; // Return empty string if input is null or empty
    try {
        // Use the browser's DOMParser to parse the HTML string
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, 'text/html');

        // Find all elements with contenteditable="true"
        const editableElements = doc.querySelectorAll('[contenteditable="true"]');
        // Remove the contenteditable attribute from each found element
        editableElements.forEach(el => {
            el.removeAttribute('contenteditable');
        });

        // Return the innerHTML of the body, which now contains the sanitized content
        return doc.body.innerHTML;
    } catch (error) {
        // Log an error if parsing or sanitization fails
        console.error("Error sanitizing HTML for viewer:", error);
        // Return the original string as a fallback to prevent breaking the page
        return htmlString;
    }
};

// --- Main Lesson Detail Component ---
const LessonDetail = () => {
    // Extract parameters from the URL
    const { username: paramUsername, subject, date, lessonSlug } = useParams();
    // Construct the permalink used for API calls
    const permalink = (paramUsername && subject && date && lessonSlug)
                      ? `${paramUsername}/${subject}/${date}/${lessonSlug}`
                      : null;
    const navigate = useNavigate(); // Hook for programmatic navigation
    const { user, token, logout } = useContext(AuthContext); // Get user auth info

    // --- State Variables ---
    const [lessonData, setLessonData] = useState(null); // Holds lesson details, SEO info, etc.
    const [isEnrolled, setIsEnrolled] = useState(false); // User's enrollment status for the course/lesson
    const [isCompleted, setIsCompleted] = useState(false); // User's completion status for this lesson
    const [loading, setLoading] = useState(true); // Loading indicator state
    const [error, setError] = useState(""); // Error message state
    const [editMode, setEditMode] = useState(false); // Controls whether the edit form is shown
    const [editLesson, setEditLesson] = useState({}); // Holds the lesson data being edited
    const [subjects, setSubjects] = useState([]); // List of available subjects for the edit form dropdown
    const [courseLessons, setCourseLessons] = useState([]); // List of all lessons in the same course (if applicable)
    const [prevLesson, setPrevLesson] = useState(null); // Link to the previous lesson in the course sequence
    const [nextLesson, setNextLesson] = useState(null); // Link to the next lesson in the course sequence

    // Quiz state
    const [quizzes, setQuizzes] = useState([]);                           // attached to this lesson
    const [availableQuizzes, setAvailableQuizzes] = useState([]);         // user’s quizzes not yet attached
    const [selectedQuiz, setSelectedQuiz] = useState("");                 // for dropdown
    const [quizActionError, setQuizActionError] = useState("");           // error messaging



    // --- Refs ---
    const editorRef = useRef(null); // Ref to access the CustomEditor component instance (for getting content)
    const lessonContentDisplayRef = useRef(null); // Ref for the div rendering dangerouslySetInnerHTML (for accordion init)
    // const lessonsAccordionRef = useRef(null); // Ref for the separate course lessons accordion (if needed) - Currently unused by the primary accordion logic

    // Utility function to strip HTML tags for creating meta descriptions
    const stripHTML = (html) => {
        if (!html) return '';
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || "";
    };

    // --- Effect for Fetching Initial Data ---
    // Fetches lesson details, enrollment status, subjects, and related course lessons.
    useEffect(() => {
        let isMounted = true; // Flag to prevent state updates on unmounted component

        const initialize = async () => {
            // 1. Guard Clauses: Check for token and valid permalink
            if (!token || !permalink) {
                if (isMounted) {
                    setLoading(false);
                    setError(!permalink ? "Invalid URL." : "Login required.");
                }
                if (!token) navigate("/login"); // Redirect to login if no token
                return;
            }

            // 2. Set Loading State
            if (isMounted) {
                setLoading(true);
                setError("");
            }

            try {
                // 3. Fetch Core Data in Parallel
                const [lessonRes, statusRes, subjectsRes] = await Promise.all([
                    apiClient.get(`/lessons/${permalink}/`), // Get lesson content, metadata, quizzes
                    apiClient.get(`/lessons/${permalink}/enrollment-status/`), // Get enrollment/completion status
                    apiClient.get("/subjects/"), // Get list of all subjects
                ]);

                if (!isMounted) return; // Exit if component unmounted during fetch

                // 4a. Set attached quizzes
                setQuizzes(lessonRes.data.lesson.quizzes || []);

                // 4b. Fetch user’s quizzes for dropdown
                const userQuizzesRes = await apiClient.get('/quizzes/my/');
                if (!isMounted) return;
                const notAttached = Array.isArray(userQuizzesRes.data)
                ? userQuizzesRes.data.filter(q => !q.lesson)      // only quizzes not bound to any lesson
                : [];
                setAvailableQuizzes(notAttached);

                // 4. Store Core Data in State
                setLessonData(lessonRes.data);
                setIsEnrolled(statusRes.data.is_enrolled);
                setIsCompleted(statusRes.data.is_completed);
                setSubjects(subjectsRes.data || []);

                // 5. Fetch Related Course Lessons (if applicable)
                const coursePermalink = lessonRes.data.lesson.course_data?.permalink;
                if (coursePermalink) {
                    // Fetch details of the course this lesson belongs to
                    const courseRes = await apiClient.get(`/courses/${coursePermalink}/`);
                    if (!isMounted) return;

                    const allLessons = courseRes.data.lessons || [];
                    setCourseLessons(allLessons); // Store the list of lessons in the course

                    // 6. Determine Previous/Next Lesson Links
                    const currentIndex = allLessons.findIndex(
                        (l) => l.permalink === lessonRes.data.lesson.permalink
                    );
                    setPrevLesson(currentIndex > 0 ? allLessons[currentIndex - 1] : null);
                    setNextLesson(
                        currentIndex >= 0 && currentIndex < allLessons.length - 1
                            ? allLessons[currentIndex + 1]
                            : null
                    );
                } else {
                    // If the lesson is not part of a course, clear related state
                    setCourseLessons([]);
                    setPrevLesson(null);
                    setNextLesson(null);
                }

            } catch (err) {
                console.error("Error fetching initial data:", err.response ? err.response.data : err.message);
                if (isMounted) {
                    // Set appropriate error messages based on status code
                    if (err.response?.status === 404) {
                        setError("Lesson or related data not found.");
                    } else {
                        setError("An error occurred while loading lesson data.");
                    }
                    // Logout user if unauthorized
                    if (err.response?.status === 401 || err.response?.status === 403) {
                         setError("Unauthorized. Please log in again.");
                         logout();
                         navigate('/login');
                    }
                }
            } finally {
                // Always turn off loading indicator when done
                if (isMounted) setLoading(false);
            }
        };

        if (permalink) {
            initialize(); // Run the initialization function if permalink is valid
        } else {
            // Handle invalid URL case directly
            setError("Invalid Lesson URL.");
            setLoading(false);
        }

        // Cleanup function: Set isMounted to false when the component unmounts
        return () => {
            isMounted = false;
        };
    }, [permalink, token, logout, navigate]); // Dependencies for the effect


    // --- Accordion Initialization Effect (Course-Aware Timing Fix) ---
    // This effect initializes/cleans up accordions in dynamically rendered content.
    // It now also depends on courseLessons to re-run after course context is loaded.
    useEffect(() => {
        // Conditions to run: Not in edit mode, lesson content exists, container ref available.
        let timeoutId = null;
        let animationFrameId = null;

        if (!editMode && lessonData?.lesson?.content && lessonContentDisplayRef.current) {
            const container = lessonContentDisplayRef.current;

            // --- Cleanup Phase ---
            // Clean up any previously initialized accordions within this container.
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
            // Use rAF + setTimeout for robust timing, allowing React to settle.
            animationFrameId = requestAnimationFrame(() => {
                timeoutId = setTimeout(() => {
                    if (lessonContentDisplayRef.current) {
                        console.log("Initializing accordions (Course-Aware Fix)"); // Debug log
                        initializeAccordions(lessonContentDisplayRef.current);
                    }
                }, 50); // Small delay
            });

        } // End of if condition

        // --- Effect Cleanup Function ---
        return () => {
            // Cancel pending timers/frames
            if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            }
            if (timeoutId) {
            clearTimeout(timeoutId);
            }

            // Perform cleanup only if the effect actually ran its setup logic.
            if (!editMode && lessonData?.lesson?.content && lessonContentDisplayRef.current) {
            const container = lessonContentDisplayRef.current;
            if (container) { // Check container exists during cleanup
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
            }
        };
    // Dependencies: Re-run if edit mode changes, lesson content changes, OR courseLessons changes.
    }, [editMode, lessonData?.lesson?.content, courseLessons]); // <--- Added courseLessons here!




    // --- Action Handlers ---

    // Marks the current lesson as complete for the user
    const handleCompleteLesson = async () => {
        if (!lessonData?.lesson?.id || !permalink || isCompleted) return; // Guard clauses
        setError(''); // Clear previous errors
        try {
            const response = await apiClient.post(`/lessons/${permalink}/complete/`, {});
            alert(response.data.message || "Lesson marked complete!");
            setIsCompleted(true); // Update local state
        } catch (err) {
            console.error("Error completing lesson:", err.response ? err.response.data : err.message);
            const errorMsg = err.response?.data?.detail || "Failed to mark lesson complete.";
            setError(errorMsg);
            alert("Error: " + errorMsg);
            if (err.response?.status === 401 || err.response?.status === 403) logout(); // Handle auth errors
        }
    };

    // Deletes the current lesson (owner only)
    const handleDeleteLesson = async () => {
        if (!permalink || lessonData?.lesson?.is_locked) {
             alert("Lesson is locked or cannot be identified.");
             return;
        }
        if (!window.confirm("Are you sure you want to delete this lesson? This action cannot be undone.")) return; // Confirmation dialog
        setError(''); // Clear previous errors
        try {
            await apiClient.delete(`/lessons/${permalink}/delete/`);
            alert("Lesson deleted successfully.");
            navigate("/admin/lessons"); // Navigate away after deletion
        } catch (err) {
            console.error("Error deleting lesson:", err.response ? err.response.data : err.message);
            const errorMsg = err.response?.data?.detail || "Failed to delete lesson.";
            setError(errorMsg);
            alert("Error deleting lesson: " + errorMsg);
            if (err.response?.status === 401 || err.response?.status === 403) logout(); // Handle auth errors
        }
    };

    // Enters edit mode and populates the edit form state
    const handleEditClick = () => {
        if (!lessonData?.lesson || lessonData.lesson.is_locked) {
            alert("Lesson is locked or data is unavailable for editing.");
            return;
        }
        // Populate the editLesson state with current lesson data
        setEditLesson({
            title: lessonData.lesson.title || '',
            content: lessonData.lesson.content || '',
            video_url: lessonData.lesson.video_url || '',
            // Join tags array into a comma-separated string for the input field
            tags: Array.isArray(lessonData.lesson.tags_output) ? lessonData.lesson.tags_output.join(', ') : '',
            subject_id: lessonData.lesson.subject || null // Use subject ID
        });
        setEditMode(true); // Switch to edit mode
        setError(''); // Clear any previous errors
    };

    // Exits edit mode without saving
    const handleCancelEdit = () => {
        setEditMode(false);
        setError(null); // Clear errors
        setEditLesson({}); // Clear edit form state
    };

    // Saves the edited lesson data
    const handleSaveEdit = async (e) => {
        e.preventDefault(); // Prevent default form submission
        if (!editorRef.current || !lessonData?.lesson || lessonData.lesson.is_locked) {
            alert("Cannot save: Editor not ready, lesson data missing, or lesson is locked.");
            return;
        }
        // Get the latest content from the CustomEditor instance
        const updatedContent = editorRef.current.getContent();

        // Basic validation
        if (!editLesson.title?.trim() || !updatedContent?.trim() || !editLesson.subject_id) {
            setError("Title, Content, and Subject are required fields.");
            alert("Title, Content, and Subject are required fields.");
            return;
        }
        setError(null); // Clear previous errors

        try {
            // Prepare the payload for the API request
            // Convert comma-separated tags string back into an array
            const tagsArray = editLesson.tags
                ? editLesson.tags.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
                : [];
            const payload = {
                title: editLesson.title,
                content: updatedContent,
                video_url: editLesson.video_url,
                tags: tagsArray,
                subject: editLesson.subject_id // Send subject ID
            };

            // Make the PUT request to update the lesson
            const response = await apiClient.put(`/lessons/${permalink}/update/`, payload);

            // Update the local lessonData state with the response from the server
            // This ensures the displayed data reflects the saved changes
            setLessonData(prevData => ({ ...prevData, lesson: response.data }));
            setEditMode(false); // Exit edit mode
            alert("Lesson updated successfully.");

        } catch (err) {
            console.error("Error updating lesson:", err.response ? err.response.data : err.message);
            // Try to display a specific error message from the API response
            const errorMsg = err.response?.data?.detail || JSON.stringify(err.response?.data) || "Failed to update lesson.";
            setError(errorMsg);
            alert("Error updating lesson: " + errorMsg);
            if (err.response?.status === 401 || err.response?.status === 403) logout(); // Handle auth errors
        }
    };

    // Utility function to convert YouTube URLs (various formats) to a standard embed URL
    const getYoutubeEmbedUrl = (url) => {
        if (!url) return null;

        let videoId = null;
        try {
            const parsedUrl = new URL(url); // Use standard URL parser

            // Handle standard youtube.com URLs (watch?v=...)
            if ((parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') &&
                parsedUrl.pathname === '/watch' && parsedUrl.searchParams.has('v')) {
                videoId = parsedUrl.searchParams.get('v');
            }
            // Handle embed URLs (youtube.com/embed/...)
            else if ((parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') &&
                     parsedUrl.pathname.startsWith('/embed/')) {
                videoId = parsedUrl.pathname.substring('/embed/'.length);
            }
            // Handle shortened youtu.be URLs (youtu.be/...)
            else if (parsedUrl.hostname === 'youtu.be') {
                videoId = parsedUrl.pathname.slice(1); // Remove leading '/'
            }

            // Remove any extra query parameters (like list=..., t=...) from the video ID
            if (videoId && videoId.includes('&')) {
                videoId = videoId.split('&')[0];
            }
            if (videoId && videoId.includes('?')) {
                 videoId = videoId.split('?')[0];
            }

        } catch (e) {
            console.error("Error parsing video URL:", e);
            return null; // Return null if URL parsing fails
        }

        // Return the standard embed URL if a valid video ID was extracted
        return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
    };


    // Attach a quiz
    const handleAddQuiz = async e => {
        e.preventDefault();
        if (!selectedQuiz || !permalink) return;
        setQuizActionError("");
        try {
        const res = await apiClient.post(
            `/lessons/${permalink}/add-quiz/`,
            { quiz_id: selectedQuiz }
        );
        const added = res.data.quiz || res.data;
        setQuizzes(prev => [...prev, added]);
        setAvailableQuizzes(prev => prev.filter(q => q.id !== added.id));
        setSelectedQuiz("");
        } catch (err) {
        console.error("Add quiz error:", err);
        setQuizActionError(
            err.response?.data?.detail || "Failed to attach quiz."
        );
        }
    };
    
    // Detach a quiz
    const handleDetachQuiz = async quizId => {
        if (!quizId) return;
        if (!window.confirm("Detach this quiz from the lesson?")) return;
        try {
        await apiClient.post(
            `/lessons/${permalink}/detach-quiz/`,
            { quiz_id: quizId }
        );
        setQuizzes(prev => prev.filter(q => q.id !== quizId));
        // Put it back into available list
        const detached = quizzes.find(q => q.id === quizId);
        if (detached) setAvailableQuizzes(prev => [...prev, detached]);
        } catch (err) {
        console.error("Detach quiz error:", err);
        alert(err.response?.data?.detail || "Failed to detach quiz.");
        }
    };
  

    // --- Render Logic ---

    // 1. Loading State
    if (loading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading lesson details...</div>;

    // 2. Error State (if lessonData hasn't loaded at all)
    if (error && !lessonData) return <p className={styles.error} style={{ color: 'red', padding: '20px', textAlign: 'center' }}>{error}</p>;

    // 3. Not Found State
    if (!lessonData?.lesson) return <p style={{ padding: '20px', textAlign: 'center' }}>Lesson not found.</p>;

    // --- Prepare Data for Rendering ---
    const { lesson, seo } = lessonData; // Destructure lesson and SEO data
    // pull out our styling hooks:
    const accent = lesson.accent_color || '#222E3B';
    const extraCss = lesson.custom_css || '';
    // Determine if the logged-in user is the owner of the lesson
    const isOwner = user && lesson?.created_by?.toLowerCase() === user.username?.toLowerCase();
    const isLocked = lesson.is_locked; // Check if the lesson is locked (prevents editing/deleting)
    const isAttachedToCourse = !!lesson.course_data?.permalink; // Check if the lesson is part of a course

    // --- JSX ---
    return (
        <div className={styles.lessonDetailContainer}>

            {/* SEO Head Tags */}
            <Helmet>
                <title>{seo?.title || lesson.title || 'Lesson Details'}</title>
                <meta name="description" content={seo?.description || stripHTML(lesson.content || '').substring(0, 160)} />
                 {/* inject per‐lesson CSS and accent color */}

                <style type="text/css">{`
                    .${styles.lessonDetailContainer} {
                        --accent-color: ${accent};
                    }
                    ${extraCss}
                `}</style>

                <link rel="canonical" href={seo?.canonical_url || window.location.href} />
                {/* Add other meta tags as needed (Open Graph, Twitter Cards) */}
            </Helmet>

            {/* Conditional Rendering: Edit Form or Read-Only View */}
            {editMode ? (
                /* --- Edit Mode Form --- */
                <form className={styles.editLessonForm} onSubmit={handleSaveEdit}>
                    <h2 className={styles.modalFormTitle}>Edit Lesson</h2>

                    {/* Display form-specific errors */}
                    {error && <p className={`${styles.message} ${styles.error} ${styles.formError}`}>{error}</p>}

                    {/* Title Input */}
                    <div className={styles.formGroup}>
                        <label htmlFor="editLessonTitle">Title: <span className={styles.required}>*</span></label>
                        <input
                            id="editLessonTitle"
                            className={styles.inputField}
                            type="text"
                            value={editLesson.title || ""}
                            onChange={(e) => setEditLesson({ ...editLesson, title: e.target.value })}
                            required
                            // disabled={submittingEdit} // Add submitting state if needed
                        />
                    </div>

                    {/* Subject Select */}
                    <div className={styles.formGroup}>
                        <label htmlFor="editLessonSubject">Subject: <span className={styles.required}>*</span></label>
                        <select
                            id="editLessonSubject"
                            className={styles.selectField}
                            value={editLesson.subject_id || ''} // Bind to subject_id
                            onChange={(e) => setEditLesson({ ...editLesson, subject_id: e.target.value })}
                            required
                            // disabled={submittingEdit}
                        >
                            <option value="">Select Subject</option>
                            {/* Populate options from the fetched subjects list */}
                            {subjects.map(subj => ( <option key={subj.id} value={subj.id}>{subj.name}</option> ))}
                        </select>
                    </div>

                    {/* Video URL Input */}
                    <div className={styles.formGroup}>
                        <label htmlFor="editLessonVideoUrl">Video URL (YouTube):</label>
                        <input
                            id="editLessonVideoUrl"
                            className={styles.inputField}
                            type="url" // Use type="url" for better semantics/validation
                            placeholder="e.g., https://www.youtube.com/watch?v=..."
                            value={editLesson.video_url || ''}
                            onChange={(e) => setEditLesson({ ...editLesson, video_url: e.target.value })}
                            // disabled={submittingEdit}
                        />
                    </div>

                       {/* Tags Input */}
                    <div className={styles.formGroup}>
                        <label htmlFor="editLessonTags">Tags (comma separated):</label>
                        <input
                        id="editLessonTags"
                        className={styles.inputField}
                        type="text"
                        placeholder="e.g., react, javascript, webdev"
                        value={editLesson.tags || ''}
                        onChange={(e) => setEditLesson({ ...editLesson, tags: e.target.value })}
                        />
                    </div>

                       {/* ─── Manage Attached Quizzes ─── */}
                       <fieldset className={styles.formSection}>
                    <legend>Manage Attached Quizzes</legend>

                    {/* 4a. Currently attached */}
                    <div className={styles.attachedContentList}>
                        <h3>Attached Quizzes ({quizzes.length})</h3>
                        {quizzes.length > 0 ? (
                        <ul>
                            {quizzes.map(q => (
                            <li key={q.id}>
                                {q.title}
                                <button
                                type="button"
                                className={styles.detachBtn}
                                onClick={() => handleDetachQuiz(q.id)}
                                >
                                <FaTimes /> Remove
                                </button>
                            </li>
                            ))}
                        </ul>
                        ) : (
                        <p>No quizzes attached.</p>
                        )}
                    </div>

                    {/* 4b. Attach new quiz */}
                    <div className={styles.contentSectionHeader}>
                        <select
                        value={selectedQuiz}
                        onChange={e => {
                            setSelectedQuiz(e.target.value);
                            setQuizActionError("");
                        }}
                        >
                        <option value="">Select a quiz to attach…</option>
                        {availableQuizzes.map(q => (
                            <option key={q.id} value={q.id}>
                            {q.title}
                            </option>
                        ))}
                        </select>
                        <button
                        type="button"
                        onClick={handleAddQuiz}
                        disabled={!selectedQuiz}
                        className={styles.addBtn}
                        >
                        <FaPlus /> Attach Quiz
                        </button>
                    </div>

                    {quizActionError && (
                        <p className={styles.formError}>{quizActionError}</p>
                    )}
                    </fieldset>
                       {/* ────────────────────────────────── */}

                    {/* Tags Input */}
                    <div className={styles.formGroup}>
                        <label htmlFor="editLessonTags">Tags (comma separated):</label>
                        <input
                            id="editLessonTags"
                            className={styles.inputField}
                            type="text"
                            placeholder="e.g., react, javascript, webdev"
                            value={editLesson.tags || ''}
                            onChange={(e) => setEditLesson({ ...editLesson, tags: e.target.value })}
                            // disabled={submittingEdit}
                        />
                    </div>

                    {/* Content Editor */}
                    <div className={styles.formGroup}>
                        <label className={styles.editorLabel} htmlFor="editLessonContent">Content: <span className={styles.required}>*</span></label>
                        <div className={styles.editorContainer}>
                            <CustomEditor
                                ref={editorRef} // Assign the ref
                                initialContent={editLesson.content} // Pass initial content
                                mediaCategory="lesson" // Specify media category for uploads
                                editable={true} // Ensure editor is editable
                                // isDisabled={submittingEdit} // Pass disabled state if editor supports it
                            />
                            {/* Hidden input for label association if needed by accessibility tools */}
                            <input type="hidden" id="editLessonContent" />
                        </div>
                    </div>

                    {/* Form Actions (Save/Cancel) */}
                    <div className={styles.formActions}>
                        <button
                            type="submit"
                            className={`${styles.btn} ${styles.btnPrimary}`}
                            // disabled={submittingEdit}
                        >
                            {/* {submittingEdit ? 'Saving...' : 'Save Changes'} */}
                            Save Changes
                        </button>
                        <button
                            type="button" // Important: type="button" to prevent form submission
                            className={`${styles.btn} ${styles.btnSecondary}`}
                            onClick={handleCancelEdit}
                            // disabled={submittingEdit}
                        >
                            Cancel
                        </button>
                    </div>
                </form>

            ) : (
                /* --- Read-Only View --- */
                <>
                    {/* Lesson Title */}
                    <h1 className={styles.lessonTitle}>
                        {lesson.title}
                        {/* Show locked indicator only to owner */}
                        {isLocked && isOwner && <span className={styles.lockedIndicator}> 🔒 Locked</span>}
                    </h1>

                    {/* Course Information Banner (if part of a course) */}
                    { isAttachedToCourse ? (
                        <div className={styles.courseInfo}>
                            <p>
                                This lesson is part of the course:{" "}
                                <Link to={`/courses/${lesson.course_data.permalink}`}>
                                    {lesson.course_data.title}
                                </Link>
                            </p>
                        </div>
                    ) : (
                        <div className={styles.freeLessonInfo}>
                            <p>This is a standalone lesson.</p>
                        </div>
                    )}

                    {/* Optional: Course Lessons Accordion (if needed and styled separately) */}
                    {/* This was present in the original code but uses a different ref and potentially different JS. */}
                    {/* If you want this accordion to use the *same* logic, it needs to be inside the lessonContentDisplayRef */}
                    {/* or initialized separately using the same initializeAccordions function. */}
                    {/* Example structure (currently uses different ref/logic): */}
                    {/*
                    {isAttachedToCourse && courseLessons && courseLessons.length > 1 && (
                        <div ref={lessonsAccordionRef}
                             className={`${styles.courseLessonsAccordion} accordion-item`} // Needs global AND module classes
                             data-default-state="closed">
                            <div className={`${styles.accordionHeader} accordion-header`}>
                                Course Content ({courseLessons.length} lessons)
                                <span className={styles.accordionIcon}></span>
                            </div>
                            <div className={`${styles.accordionContentWrapper} accordion-content-wrapper`}>
                                <div className={`${styles.accordionContent} accordion-content`}>
                                    <ul className={styles.courseLessonsList}>
                                        {courseLessons.map(l => (
                                            <li key={l.permalink}>
                                                <Link
                                                    to={`/lessons/${l.permalink}`}
                                                    className={l.permalink === lesson.permalink ? styles.activeLessonLink : ""}
                                                >
                                                    {l.title}
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                    */}

                    {/* Display General Errors (e.g., completion error) */}
                    {error && <p className={`${styles.message} ${styles.error}`}>{error}</p>}

                    {/* Video Embed */}
                    {lesson.video_url && (() => {
                        const embedUrl = getYoutubeEmbedUrl(lesson.video_url);
                        if (embedUrl) {
                            // Render iframe if a valid embed URL is generated
                            return (
                                <div className={styles.lessonVideoEmbed}>
                                    <iframe
                                        src={embedUrl}
                                        title={lesson.title + " Video"}
                                        frameBorder="0"
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen>
                                    </iframe>
                                </div>
                            );
                        } else if (lesson.video_url.trim()) {
                            // Render a simple link if URL exists but couldn't be parsed into an embed URL
                            return (
                                <div className={styles.lessonVideoLink}>
                                    <p>Video Link: <a href={lesson.video_url} target="_blank" rel="noopener noreferrer">{lesson.video_url}</a> (Could not embed)</p>
                                </div>
                            );
                        }
                        return null; // Return null if no video URL
                    })()}

                    {/* Lesson Content (Rendered HTML) */}
                    {/* This div contains the main lesson content, including any accordions */}
                    <div
                        ref={lessonContentDisplayRef} // Assign ref for accordion initialization
                        className={`displayed-content ${styles.lessonContent}`} // Apply styles
                        // Use the sanitization function before setting innerHTML
                        dangerouslySetInnerHTML={{ __html: sanitizeContentViewerHTML(lesson.content || "") }}
                    />

                    {/* Quizzes Section */}
                    {lesson.quizzes?.length > 0 && (
                        <section className={styles.lessonQuizzes}>
                            <h2>Associated Quizzes</h2>
                            {lesson.quizzes.map(q => (
                                <QuizCard key={q.id} quiz={q} /> // Render each quiz using QuizCard component
                            ))}
                        </section>
                    )}

                    {/* Post Metadata (Author, Date) */}
                    <p className={styles.postMeta}>
                        <FaUser /> {lesson.created_by || 'Unknown Author'}
                        &nbsp; | &nbsp; {/* Add spacing */}
                        <FaRegClock /> {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'Unknown Date'}
                    </p>

                     {/* Tags Display */}
                     {lesson.tags_output && lesson.tags_output.length > 0 && (
                        <div className={styles.lessonTags}> {/* Use module style */}
                            <strong>Tags:</strong> {lesson.tags_output.join(', ')}
                        </div>
                    )}

                    {/* Previous / Next Lesson Navigation */}
                    <div className={styles.lessonNavButtons}>
                        {prevLesson ? (
                            <Link
                                to={`/lessons/${prevLesson.permalink}`}
                                className={`${styles.navButton} ${styles.prevButton}`}
                            >
                                ← {prevLesson.title}
                            </Link>
                        ) : <span className={styles.navPlaceholder}></span> /* Placeholder for alignment */}
                        {nextLesson ? (
                            <Link
                                to={`/lessons/${nextLesson.permalink}`}
                                className={`${styles.navButton} ${styles.nextButton}`}
                            >
                                {nextLesson.title} →
                            </Link>
                        ) : <span className={styles.navPlaceholder}></span> /* Placeholder for alignment */}
                    </div>


                    {/* Completion Button / Indicator */}
                    {/* Show button only if enrolled and not yet completed */}
                    {isEnrolled && !isCompleted && (
                        <button className={`${styles.btn} ${styles.btnPrimary} ${styles.completeBtn}`} onClick={handleCompleteLesson}>
                            Mark Lesson as Complete
                        </button>
                    )}
                    {/* Show indicator if completed */}
                    {isCompleted && <div className={styles.completedIndicator}>✅ Lesson Completed!</div>}

                    {/* Owner Actions (Edit/Delete) */}
                    {isOwner && (
                        <div className={styles.lessonActions}>
                            <button
                                className={styles.editBtn}
                                onClick={handleEditClick}
                                style={{ color: accent }}       // example: text in accent color
                                disabled={isLocked}
                                title="Edit Lesson"
                            >
                                <Pencil size={18} /> <span>Edit</span>
                            </button>
                            <button
                                className={styles.deleteBtn}
                                onClick={handleDeleteLesson}
                                style={{ backgroundColor: accent }} // example: bg in accent color
                                disabled={isLocked}
                                title="Delete Lesson"
                            >
                                <Trash2 size={18} /> <span>Delete</span>
                            </button>
                        </div>
                    )}

                    {/* Floating Action Buttons */}
                    <FloatingActionButtons
                        onTopClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} // Scroll to top smoothly
                        onCompleteClick={handleCompleteLesson} // Reuse complete handler
                        onBackClick={() => { // Navigate back to course or courses list
                            if (isAttachedToCourse) {
                                navigate(`/courses/${lesson.course_data.permalink}`);
                            } else {
                                navigate('/courses'); // Or maybe '/lessons' or '/dashboard'? Adjust as needed.
                            }
                        }}
                    />
                </>
            )}
        </div>
    );
};

export default LessonDetail;
