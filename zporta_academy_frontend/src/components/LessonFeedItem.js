import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LessonFeedItem.module.css'; // Use the correct CSS module name
import './Editor/ViewerAccordion.css'; // Import global accordion styles

// --- Helper Functions ---

// Accordion Initialization Function (Mostly Unchanged from your snippet)
// IMPORTANT: This now operates *inside* the potentially height-restricted container
function initializeAccordions(containerElement) {
    if (!containerElement) return;
    // Find accordions within the specific content container
    const accordions = containerElement.querySelectorAll(".accordion-item"); // Find any descendant

    accordions.forEach((accordion) => {
        const header = accordion.querySelector(":scope > .accordion-header");
        const contents = accordion.querySelectorAll(":scope > .accordion-content");
        const defaultState = accordion.getAttribute("data-default-state") || "closed";

        if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") {
            return; // Already initialized or invalid structure
        }
        accordion.dataset.accordionInitialized = "true"; // Mark as initialized

        // Set initial state based on data-attribute
        if (defaultState === "open") {
            accordion.classList.add("is-open");
        } else {
            accordion.classList.remove("is-open");
        }

        // Click handler for toggling individual accordions
        const clickHandler = (e) => {
            e.stopPropagation(); // Prevent card navigation when clicking header
            accordion.classList.toggle("is-open");
            // Note: We are NOT toggling the main card's isExpanded class here
            // That's handled by the "See More" button only
        };

        // Clean up previous listener if re-initializing
        if (header.__accordionClickHandler__) {
            header.removeEventListener("click", header.__accordionClickHandler__);
        }
        header.addEventListener("click", clickHandler);
        header.__accordionClickHandler__ = clickHandler; // Store handler for cleanup

        // Initialize nested accordions recursively (if any)
        contents.forEach((content) => {
            requestAnimationFrame(() => {
                initializeAccordions(content); // Pass the content element
            });
        });
    });
}

// HTML Sanitization Function (Keep as before)
const sanitizeContentViewerHTML = (htmlString) => {
    if (!htmlString) return "";
    try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlString, "text/html");
        const editableElements = doc.querySelectorAll('[contenteditable="true"]');
        editableElements.forEach((el) => { el.removeAttribute("contenteditable"); });
        const scripts = doc.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        const allElements = doc.body.querySelectorAll('*');
        allElements.forEach(el => {
            for (const attr of el.attributes) {
                if (attr.name.startsWith('on')) {
                    el.removeAttribute(attr.name);
                }
            }
        });
        return doc.body.innerHTML;
    } catch (error) {
        console.error("Error sanitizing HTML:", error);
        return htmlString;
    }
};


// --- Lesson Feed Item Component ---
const LessonFeedItem = ({ lesson, isNext = false }) => {
    const navigate = useNavigate();
    const excerptContainerRef = useRef(null); // Ref for the outer container div (controls height)
    const excerptContentRef = useRef(null);   // Ref for the inner content div (holds HTML, used for measurement and accordion init)

    // State for overall container expansion ("See More")
    const [isExpanded, setIsExpanded] = useState(false);
    // State to track if the "See More" button is needed
    const [needsTruncation, setNeedsTruncation] = useState(false);

    const { lesson_title, lesson_permalink, subject, excerpt, course_title } = lesson;

    // --- Effect 1: Check if container needs truncation ---
    useEffect(() => {
        setNeedsTruncation(false); // Reset on content change
        setIsExpanded(false);      // Collapse on content change

        const checkHeight = () => {
            if (excerptContentRef.current && excerptContainerRef.current) {
                // Use a fixed pixel height matching the CSS --lesson-excerpt-collapsed-height
                // Convert '6.5em' to pixels (approximate, depends on root font size)
                // It's often more reliable to use a pixel value directly in JS check
                // Or getComputedStyle if you need dynamic em conversion.
                const MAX_COLLAPSED_HEIGHT_PX = 104; // Adjust this based on your CSS value in pixels

                if (excerptContentRef.current.scrollHeight > MAX_COLLAPSED_HEIGHT_PX) {
                    setNeedsTruncation(true);
                } else {
                    setNeedsTruncation(false);
                }
            }
        };

        // Run check after render
        const timeoutId = setTimeout(checkHeight, 50);
        window.addEventListener('resize', checkHeight); // Recalculate on resize

        return () => {
            clearTimeout(timeoutId);
            window.removeEventListener('resize', checkHeight);
        };
    }, [excerpt]); // Dependency: only the excerpt content

    // --- Effect 2: Initialize Accordions within the content ---
    useEffect(() => {
        let timeoutId = null;
        let animationFrameId = null;

        // Only run if we have content and the ref is attached
        if (excerpt && excerptContentRef.current) {
            const contentElement = excerptContentRef.current;

            // --- Cleanup previous initializations ---
            const initializedAccordions = contentElement.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
            initializedAccordions.forEach((accordion) => {
                const header = accordion.querySelector(".accordion-header");
                if (header && header.__accordionClickHandler__) {
                    header.removeEventListener("click", header.__accordionClickHandler__);
                    delete header.__accordionClickHandler__;
                }
                delete accordion.dataset.accordionInitialized; // Remove marker
                accordion.classList.remove('is-open'); // Ensure closed on cleanup/re-render
            });

            // --- Initialize after a short delay ---
            // Use rAF and setTimeout to ensure DOM is ready
            animationFrameId = requestAnimationFrame(() => {
                timeoutId = setTimeout(() => {
                    if (excerptContentRef.current) { // Check ref again inside timeout
                        initializeAccordions(excerptContentRef.current); // Initialize on the CONTENT div
                    }
                }, 50); // Adjust delay if needed
            });
        }

        // --- Effect Cleanup for Accordions ---
        return () => {
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
            if (timeoutId) clearTimeout(timeoutId);
            // Cleanup listeners on unmount or before re-running
            if (excerptContentRef.current) {
                const accordionsToClean = excerptContentRef.current.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
                accordionsToClean.forEach((accordion) => {
                    const header = accordion.querySelector(".accordion-header");
                    if (header && header.__accordionClickHandler__) {
                        header.removeEventListener("click", header.__accordionClickHandler__);
                        delete header.__accordionClickHandler__;
                    }
                    delete accordion.dataset.accordionInitialized;
                    accordion.classList.remove('is-open');
                });
            }
        };
    }, [excerpt]); // Dependency: Re-initialize accordions if excerpt changes


    // --- Handlers ---
    const handleNavigate = (e) => {
        e.stopPropagation();
        navigate(`/lessons/${lesson_permalink}`);
    };

    // Toggles the *container's* expansion state
    const toggleContainerExpansion = (e) => {
        e.stopPropagation();
        setIsExpanded(prev => !prev);
    };

    // Sanitize excerpt only once using useMemo
    const sanitizedExcerpt = useMemo(() => sanitizeContentViewerHTML(excerpt), [excerpt]);

    return (
        <article className={styles.lessonCard}>
            {/* Header */}
            <div className={styles.lessonHeader}>
                <h3 className={styles.lessonTitle}>{lesson_title}</h3>
                {subject && <span className={styles.subjectTag}>{subject.name}</span>}
            </div>
            {course_title && <div className={styles.courseTitle}>From: {course_title}</div>}

            {/* Excerpt Container - Manages overall height and expansion class */}
            {sanitizedExcerpt && (
                <div
                    ref={excerptContainerRef}
                    className={`${styles.lessonExcerptContainer} ${isExpanded ? styles.isExpanded : ''}`}
                >
                    {/* Actual Content Div - Holds HTML, used for scrollHeight and accordion init */}
                    <div
                        ref={excerptContentRef}
                        className={`${styles.lessonExcerptContent} displayed-content`} // Ensure 'displayed-content' class if needed by ViewerAccordion.css
                        dangerouslySetInnerHTML={{ __html: sanitizedExcerpt }}
                    />
                </div>
            )}

            {/* See More/Less Button - For the CONTAINER */}
            {needsTruncation && (
                <button onClick={toggleContainerExpansion} className={styles.seeMoreButton}>
                    {isExpanded ? 'See Less' : 'See More'}
                </button>
            )}

            {/* Footer */}
            <div className={styles.cardFooter}>
                <span className={styles.lessonType}>
                    {isNext ? 'Next Lesson' : 'Suggested Lesson'}
                </span>
                <span
                    className={styles.cardAction}
                    onClick={handleNavigate}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === 'Enter' && handleNavigate(e)}
                >
                    View Lesson
                </span>
            </div>
        </article>
    );
};

export default LessonFeedItem;
