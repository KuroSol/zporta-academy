import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './LessonFeedItem.module.css';
import './Editor/ViewerAccordion.css'; // Import global accordion styles

// --- Helper Functions ---

// Accordion Initialization Function (MODIFIED FOR CARD EXPANSION)
function initializeAccordions(containerElement) {
  if (!containerElement) return;
  // Find accordions *directly within* this container first
  // This helps scope the logic if accordions could be nested deeply outside our control
  const accordions = containerElement.querySelectorAll(":scope > .accordion-item, .accordion-item"); // Find top-level or any descendant

  accordions.forEach((accordion) => {
    const header   = accordion.querySelector(":scope > .accordion-header"); // Use :scope for direct child
    const contents = accordion.querySelectorAll(":scope > .accordion-content"); // Use :scope for direct child(ren)
    const defaultState = accordion.getAttribute("data-default-state") || "closed";

    if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") {
      return;
    }
    accordion.dataset.accordionInitialized = "true";

    // Find the parent card element for this accordion
    // Assumes the main article tag has the 'lessonCard' class from the CSS module
    const parentCard = accordion.closest(`.${styles.lessonCard}`); // Use the CSS module class name

    if (defaultState === "open") {
      accordion.classList.add("is-open");
      // If default is open, ensure parent card is also marked as expanded initially
      if (parentCard) {
        parentCard.classList.add(styles.isExpanded); // Use module class name
      }
    } else {
      accordion.classList.remove("is-open");
      // Check if *other* accordions in the same card might be open
      if (parentCard && !parentCard.querySelector('.accordion-item.is-open')) {
         parentCard.classList.remove(styles.isExpanded); // Use module class name
      }
    }

    const clickHandler = () => {
      // Toggle the current accordion
      const isOpening = !accordion.classList.contains("is-open");
      accordion.classList.toggle("is-open");

      // Update the parent card's expanded state
      if (parentCard) {
        // Check if *any* accordion within this specific card is now open
        const anyAccordionOpen = parentCard.querySelector('.accordion-item.is-open');
        if (anyAccordionOpen) {
          parentCard.classList.add(styles.isExpanded); // Add module class
        } else {
          parentCard.classList.remove(styles.isExpanded); // Remove module class
        }
      }
    };

    if (header.__accordionClickHandler__) {
      header.removeEventListener("click", header.__accordionClickHandler__);
    }
    header.addEventListener("click", clickHandler);
    header.__accordionClickHandler__ = clickHandler;

    // Initialize nested accordions within the content
    contents.forEach((content) => {
      requestAnimationFrame(() => {
        // Pass the content element itself for nested initialization
        initializeAccordions(content);
      });
    });
  });

  // After initializing direct children, check if the parent card needs initial expansion state set
  // This handles cases where an accordion might be deeply nested but open by default
  if (containerElement.classList.contains(styles.lessonExcerpt)) { // Check if we are the excerpt container
      const parentCard = containerElement.closest(`.${styles.lessonCard}`);
      if (parentCard && parentCard.querySelector('.accordion-item.is-open') && !parentCard.classList.contains(styles.isExpanded)) {
          parentCard.classList.add(styles.isExpanded);
      }
  }

}

// HTML Sanitization Function (Unchanged)
const sanitizeContentViewerHTML = (htmlString) => {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const editableElements = doc.querySelectorAll('[contenteditable="true"]');
    editableElements.forEach((el) => { el.removeAttribute("contenteditable"); });
    return doc.body.innerHTML;
  } catch (error) { console.error("Error sanitizing HTML:", error); return htmlString; }
};


// --- Lesson Feed Item Component ---
const LessonFeedItem = ({ lesson, isNext = false }) => {
  const navigate = useNavigate();
  const excerptContainerRef = useRef(null);

  const { lesson_title, lesson_permalink, subject, excerpt, course_title } = lesson;

  // --- Accordion Initialization Effect ---
  useEffect(() => {
    let timeoutId = null;
    let animationFrameId = null;

    if (excerpt && excerptContainerRef.current) {
      const container = excerptContainerRef.current;

      // --- Cleanup Phase ---
      const initializedAccordions = container.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
      initializedAccordions.forEach((accordion) => { /* ... cleanup logic ... */
         const header = accordion.querySelector(".accordion-header");
         if (header && header.__accordionClickHandler__) { header.removeEventListener("click", header.__accordionClickHandler__); delete header.__accordionClickHandler__; }
         if (accordion.dataset.accordionInitialized) { delete accordion.dataset.accordionInitialized; }
         // Also remove expanded class from parent on cleanup if necessary
         const parentCard = accordion.closest(`.${styles.lessonCard}`);
         if(parentCard) parentCard.classList.remove(styles.isExpanded);
      });

      // --- Initialization Phase (with delay) ---
      animationFrameId = requestAnimationFrame(() => {
        timeoutId = setTimeout(() => {
          if (excerptContainerRef.current) {
            initializeAccordions(excerptContainerRef.current);
          }
        }, 50);
      });
    }

    // --- Effect Cleanup ---
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      if (timeoutId) clearTimeout(timeoutId);
      if (excerpt && excerptContainerRef.current) {
         const container = excerptContainerRef.current;
         if (container) {
            const accordionsToClean = container.querySelectorAll(".accordion-item[data-accordion-initialized='true']");
            accordionsToClean.forEach((accordion) => { /* ... cleanup logic ... */
                const header = accordion.querySelector(".accordion-header");
                if (header && header.__accordionClickHandler__) { header.removeEventListener("click", header.__accordionClickHandler__); delete header.__accordionClickHandler__; }
                if (accordion.dataset.accordionInitialized) { delete accordion.dataset.accordionInitialized; }
                const parentCard = accordion.closest(`.${styles.lessonCard}`);
                if(parentCard) parentCard.classList.remove(styles.isExpanded);
            });
         }
      }
    };
  }, [excerpt, lesson_title]); // Dependencies


  const handleNavigate = (e) => {
    e.stopPropagation();
    navigate(`/lessons/${lesson_permalink}`);
  };

  return (
    // Ensure the main article element has the lessonCard class from the module
    <article className={`${styles.lessonCard} feedItem lessonCard`}>
      <div className={styles.lessonHeader}>
        <h3 className={styles.lessonTitle}>{lesson_title}</h3>
        {subject && <span className={styles.subjectTag}>{subject.name}</span>}
      </div>
      {course_title && <div className={styles.courseTitle}>From: {course_title}</div>}

      {excerpt && (
        <div
          ref={excerptContainerRef}
          // Make sure 'displayed-content' class is present if ViewerAccordion.css needs it
          className={`${styles.lessonExcerpt} displayed-content`}
          dangerouslySetInnerHTML={{ __html: sanitizeContentViewerHTML(excerpt) }}
        />
      )}

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
