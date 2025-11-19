import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { FaUser, FaRegClock } from 'react-icons/fa';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import {
  CheckCircle, ChevronDown, ChevronUp, Search, Sun, Moon, ArrowLeft, Loader2, AlertTriangle, Video, FileText, Download, HelpCircle, ArrowUp, ArrowDown, Users, Share2, Menu, X, BookOpen, Eraser, Undo, Redo, Radio, Home, Square, Circle as CircleIcon, MessageSquare,
} from 'lucide-react';
import QuizCard from '@/components/QuizCard';
import ShadowRootContainer from '@/components/common/ShadowRootContainer';
import styles from '@/styles/EnrolledCourseDetail.module.css';
import lessonStyles from '@/styles/LessonDetail.module.css';
import '@/styles/Editor/ViewerAccordion.module.css';
// Collaboration features commented out - not in use
// import CollaborationInviteModal from '@/components/collab/CollaborationInviteModal';
// import { useCollaboration } from '@/hooks/useCollaboration';
// import CollaborationZoneSection from '@/components/collab/CollaborationZoneSection';
// Firebase features disabled for performance:
// import { ref, onValue, get, set } from 'firebase/database';
// import { db } from '@/firebase/firebase';
// import StudyNoteSection from '@/components/study/StudyNoteSection';
// Rangy library - needed for text selection/annotations (not Firebase-dependent):
import rangy from 'rangy';
import 'rangy/lib/rangy-textrange';
import 'rangy/lib/rangy-classapplier';
import 'rangy/lib/rangy-serializer';

// A flag to ensure the toolbar animation only runs once on initial mount
let _isToolbarMounted = false;

// ==================================================================
// --- Helper Functions (same as LessonDetail) ---
// ==================================================================
function initializeAccordions(containerElement) {
  if (!containerElement) return;
  const accordions = containerElement.querySelectorAll(".accordion-item");
  accordions.forEach((accordion) => {
    const header = accordion.querySelector(".accordion-header");
    const contents = accordion.querySelectorAll(".accordion-content");
    const defaultState = accordion.getAttribute("data-default-state") || "closed";
    if (!header || contents.length === 0 || accordion.dataset.accordionInitialized === "true") return;
    accordion.dataset.accordionInitialized = "true";
    if (defaultState === "open") accordion.classList.add("is-open");
    else accordion.classList.remove("is-open");
    const clickHandler = () => accordion.classList.toggle("is-open");
    if (header.__accordionClickHandler__) header.removeEventListener("click", header.__accordionClickHandler__);
    header.addEventListener("click", clickHandler);
    header.__accordionClickHandler__ = clickHandler;
    contents.forEach((content) => requestAnimationFrame(() => initializeAccordions(content)));
  });
}

const sanitizeContentViewerHTML = (htmlString) => {
  if (!htmlString) return "";
  if (typeof window === "undefined") return htmlString;
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    doc.querySelectorAll('[contenteditable="true"]').forEach((el) => el.removeAttribute("contenteditable"));
    return doc.body.innerHTML;
  } catch {
    return htmlString;
  }
};

const sanitizeLessonCss = (css) => {
  if (!css) return "";
  let out = css;
  out = out.replace(/:root\b/g, ":host");
  out = out.replace(/\b(html|body)\b(?![^]*?<\/style>)/g, ".lesson-content");
  return out;
};

// ==================================================================
// --- TextStyler Component (Annotation & Highlighting Tool) ---
// ==================================================================
const TextStyler = ({ htmlContent, enrollmentId, activeTool, onToolClick, highlightColor, onClearHighlightsReady, onClearNotesReady, onResetReady, accentColor, customCSS }) => {
    const editorRef = useRef(null);
    const overlayRef = useRef(null);
    const saveTimeoutRef = useRef(null);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const redoStack = useRef([]);
    const [confirmation, setConfirmation] = useState(null); // { message, onConfirm, onCancel }

    const saveState = useCallback(() => {
        if (!editorRef.current || !enrollmentId) return;
        const currentState = editorRef.current.innerHTML;
        setHistory(prev => (prev.length === 0 || prev[prev.length - 1] !== currentState ? [...prev.slice(-29), currentState] : prev));
        redoStack.current = [];
        
        // Save annotations via API (Firebase collaboration disabled)
        try {
          // Immediate local persistence for resilience
          const lsKey = `annotations:v1:enrollment:${enrollmentId}`;
          localStorage.setItem(lsKey, currentState);
        } catch {}

        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = setTimeout(() => {
          apiClient.post(`/enrollments/${enrollmentId}/notes/`, {
            highlight_data: currentState 
          }).catch(err => {
            console.error("Failed to save annotations via API:", err);
            // Fallback is localStorage already written above
          });
        }, 600);
    }, [enrollmentId]);

    const clearAllHighlights = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        
        setConfirmation({
            message: "Remove all highlights? This cannot be undone.",
            onConfirm: () => {
                Array.from(editor.querySelectorAll(`span.${styles.stylerHighlight}`)).forEach(el => {
                    const parent = el.parentNode;
                    while (el.firstChild) parent.insertBefore(el.firstChild, el);
                    parent.removeChild(el);
                });
                editor.normalize();
                // Clear localStorage cache
                if (enrollmentId) {
                    localStorage.removeItem(`annotations:v1:enrollment:${enrollmentId}`);
                }
                saveState();
                setConfirmation(null);
            },
            onCancel: () => setConfirmation(null)
        });
    }, [saveState, enrollmentId]);
    
    const clearAllNotes = useCallback(() => {
        const editor = editorRef.current;
        if (!editor) return;
        
        setConfirmation({
            message: "Remove all notes? This cannot be undone.",
            onConfirm: () => {
                Array.from(editor.querySelectorAll(`span.${styles.stylerNoteAnchor}`)).forEach(el => {
                    const parent = el.parentNode;
                    Array.from(el.childNodes).forEach(child => {
                        if (child.nodeType === Node.TEXT_NODE || 
                            (child.nodeType === Node.ELEMENT_NODE && !child.className?.includes('stylerNote'))) {
                            parent.insertBefore(child.cloneNode(true), el);
                        }
                    });
                    parent.removeChild(el);
                });
                editor.normalize();
                // Clear localStorage cache
                if (enrollmentId) {
                    localStorage.removeItem(`annotations:v1:enrollment:${enrollmentId}`);
                }
                saveState();
                setConfirmation(null);
            },
            onCancel: () => setConfirmation(null)
        });
    }, [saveState, enrollmentId]);
    
    const resetToOriginal = useCallback(() => {
        if (!htmlContent || !enrollmentId) return;
        
        setConfirmation({
            message: "Reset lesson to original content? This will remove ALL annotations and cannot be undone.",
            onConfirm: async () => {
                const editor = editorRef.current;
                if (editor) {
                    // Reset editor to original clean HTML
                    editor.innerHTML = htmlContent;
                    editor.normalize();
                    
                    // Clear localStorage
                    localStorage.removeItem(`annotations:v1:enrollment:${enrollmentId}`);
                    
                    // Clear database by sending empty highlight_data
                    try {
                        await apiClient.post(`/enrollments/${enrollmentId}/notes/`, {
                            highlight_data: htmlContent
                        });
                    } catch (error) {
                        console.error('Failed to reset annotations in database:', error);
                    }
                    
                    setConfirmation(null);
                }
            },
            onCancel: () => setConfirmation(null)
        });
    }, [htmlContent, enrollmentId, saveState]);

    useEffect(() => {
        rangy.init();
        if (onClearHighlightsReady) onClearHighlightsReady(clearAllHighlights);
        if (onClearNotesReady) onClearNotesReady(clearAllNotes);
        if (onResetReady) onResetReady(resetToOriginal);
    }, [onClearHighlightsReady, onClearNotesReady, onResetReady, clearAllHighlights, clearAllNotes, resetToOriginal]);

    const undo = useCallback(() => {
        if (history.length > 1) {
            const lastState = history[history.length - 1];
            redoStack.current.push(lastState);
            const newHistory = history.slice(0, -1);
            const prevState = newHistory[newHistory.length - 1];
            setHistory(newHistory);
            if (editorRef.current) {
                editorRef.current.innerHTML = prevState;
                saveState();
            }
        }
        onToolClick(null);
    }, [history, saveState, onToolClick]);

    const redo = useCallback(() => {
      if (redoStack.current.length) {
        const nextState = redoStack.current.pop();
        setHistory(h => [...h, nextState]);
        if(editorRef.current) {
            editorRef.current.innerHTML = nextState;
            saveState();
        }
      }
      onToolClick(null);
    }, [saveState, onToolClick]);

    useEffect(() => {
        if (!htmlContent || !enrollmentId) return;

        const loadAnnotations = async () => {
            let initialHtml = htmlContent;
            try {
              // Load annotations from API (Firebase collaboration disabled)
              try {
                const response = await apiClient.get(`/enrollments/${enrollmentId}/notes/`);
                if (response.data && response.data.highlight_data) {
                  initialHtml = response.data.highlight_data;
                } else {
                  const lsKey = `annotations:v1:enrollment:${enrollmentId}`;
                  const cached = typeof window !== 'undefined' ? localStorage.getItem(lsKey) : null;
                  if (cached) initialHtml = cached;
                }
              } catch (e) {
                const lsKey = `annotations:v1:enrollment:${enrollmentId}`;
                const cached = typeof window !== 'undefined' ? localStorage.getItem(lsKey) : null;
                if (cached) initialHtml = cached;
              }
            } catch (error) {
                console.error("Failed to load annotations:", error);
            } finally {
                if (editorRef.current) {
                    editorRef.current.innerHTML = initialHtml;
                    setHistory([initialHtml]);
                    // Lazy audio: defer loading until user plays
                    try {
                      const processAudio = (audio) => {
                        if (audio.dataset.lazyProcessed === '1') return;
                        audio.dataset.lazyProcessed = '1';
                        // Keep src so native controls remain functional; just set preload to 'none'.
                        try { audio.preload = 'none'; } catch {}
                      };
                      editorRef.current.querySelectorAll('audio').forEach(processAudio);
                    } catch {}
                }
            }
        };

        loadAnnotations();
        // Firebase real-time listener removed - annotations now API-only
    }, [htmlContent, enrollmentId]);

    // Re-run lazy audio setup if highlight operations introduce new audio elements
    useEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;
      const audios = editor.querySelectorAll('audio:not([data-lazy-processed])');
      audios.forEach(a => {
        a.dataset.lazyProcessed = '1';
        try { a.preload = 'none'; } catch {}
      });
    }, [history]);

    const openNote = useCallback((popup) => {
        if (overlayRef.current) overlayRef.current.style.display = 'block';
        popup.style.display = 'block';
        setIsNoteOpen(true);
        popup.focus();
    }, []);

    const closeOpenNote = useCallback(() => {
        const openPopup = editorRef.current?.querySelector(`.${styles.stylerNotePopup}[style*="display: block"]`);
        if (openPopup) openPopup.style.display = 'none';
        if (overlayRef.current) overlayRef.current.style.display = 'none';
        setIsNoteOpen(false);
    }, []);

    const openNoteEditor = useCallback((noteAnchor) => {
        closeOpenNote();
        
        const existingNote = noteAnchor.getAttribute('data-note-text') || '';
        const popup = document.createElement('div');
        popup.className = styles.stylerNoteEditor;
        
        const header = document.createElement('div');
        header.className = styles.stylerNoteHeader;
        
        const title = document.createElement('span');
        title.textContent = 'Edit Note';
        title.className = styles.stylerNoteTitle;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = styles.stylerNoteCloseBtn;
        closeBtn.innerHTML = '&times;';
        closeBtn.setAttribute('type', 'button');
        closeBtn.setAttribute('aria-label', 'Close');
        closeBtn.onmousedown = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        closeBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            document.body.removeChild(popup);
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            setIsNoteOpen(false);
        };
        
        header.appendChild(title);
        header.appendChild(closeBtn);
        popup.appendChild(header);
        
        const textarea = document.createElement('textarea');
        textarea.className = styles.stylerNoteTextarea;
        textarea.placeholder = 'Type your note here...';
        textarea.value = existingNote;
        popup.appendChild(textarea);
        
        const actions = document.createElement('div');
        actions.className = styles.stylerNoteActions;
        
        const saveBtn = document.createElement('button');
        saveBtn.className = styles.stylerNoteSaveBtn;
        saveBtn.textContent = 'Save';
        saveBtn.onclick = (e) => {
            e.stopPropagation();
            const noteText = textarea.value.trim();
            if (noteText) {
                noteAnchor.setAttribute('data-note-text', noteText);
                noteAnchor.setAttribute('title', noteText);
            }
            document.body.removeChild(popup);
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            setIsNoteOpen(false);
            saveState();
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = styles.stylerNoteDeleteBtn;
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            const parent = noteAnchor.parentNode;
            Array.from(noteAnchor.childNodes).forEach(child => {
                if (child.nodeType === Node.TEXT_NODE || 
                    (child.nodeType === Node.ELEMENT_NODE && !child.className.includes('stylerNote'))) {
                    parent.insertBefore(child.cloneNode(true), noteAnchor);
                }
            });
            parent.removeChild(noteAnchor);
            parent.normalize();
            document.body.removeChild(popup);
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            setIsNoteOpen(false);
            saveState();
        };
        
        const cancelBtn = document.createElement('button');
        cancelBtn.className = styles.stylerNoteCancelBtn;
        cancelBtn.textContent = 'Cancel';
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            document.body.removeChild(popup);
            if (overlayRef.current) overlayRef.current.style.display = 'none';
            setIsNoteOpen(false);
        };
        
        actions.appendChild(saveBtn);
        actions.appendChild(deleteBtn);
        actions.appendChild(cancelBtn);
        popup.appendChild(actions);
        
        document.body.appendChild(popup);
        
        // Position popup near the note anchor
        const rect = noteAnchor.getBoundingClientRect();
        popup.style.left = `${Math.max(10, Math.min(rect.left, window.innerWidth - 310))}px`;
        popup.style.top = `${rect.bottom + 10}px`;
        
        if (overlayRef.current) overlayRef.current.style.display = 'block';
        setIsNoteOpen(true);
        setTimeout(() => textarea.focus(), 50);
    }, [saveState, closeOpenNote]);

    const applyNote = useCallback((range) => {
        const selectedText = range.cloneContents();
        const textContent = selectedText.textContent.trim();
        
        if (!textContent) return; // Don't create empty notes
        
        const noteAnchor = document.createElement('span');
        noteAnchor.className = styles.stylerNoteAnchor;
        noteAnchor.setAttribute('data-note-text', '');
        noteAnchor.appendChild(range.extractContents());
        
        const badge = document.createElement('sup');
        badge.className = styles.stylerNoteBadge;
        badge.textContent = '📝';
        noteAnchor.appendChild(badge);
        
        range.insertNode(noteAnchor);
        
        // Auto-open edit popup after creation
        setTimeout(() => {
            openNoteEditor(noteAnchor);
        }, 50);
    }, [openNoteEditor]);

    const applyStyle = useCallback((style, range) => {
        if (style === 'note') {
            applyNote(range);
            return;
        }
        if (style === 'highlight') {
            const span = document.createElement('span');
            span.className = styles.stylerHighlight;
            span.style.backgroundColor = highlightColor || '#fef08a';
            span.appendChild(range.extractContents());
            range.insertNode(span);
        }
    }, [applyNote, highlightColor]);

    const eraseStyle = useCallback((range) => {
        const editor = editorRef.current;
        if (!editor) return;
        
        // Remove highlights within selection
        Array.from(editor.querySelectorAll(`span.${styles.stylerHighlight}`)).forEach(el => {
            if (range.intersectsNode(el)) {
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            }
        });

        // Remove notes within selection
        Array.from(editor.querySelectorAll(`span.${styles.stylerNoteAnchor}`)).forEach(el => {
            if (range.intersectsNode(el)) {
                const parent = el.parentNode;
                while (el.firstChild) parent.insertBefore(el.firstChild, el);
                parent.removeChild(el);
            }
        });
        
        window.getSelection().removeAllRanges();
        editor.normalize();
    }, []);

    useEffect(() => {
        const editor = editorRef.current;
        const overlay = overlayRef.current;
        if (!editor) return;

        const handleMouseUp = () => {
            if (isNoteOpen || !activeTool) return;
            const selection = rangy.getSelection();
            if (selection && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                if (activeTool === 'eraser') eraseStyle(range);
                else applyStyle(activeTool, range);
                saveState();
                window.getSelection().removeAllRanges();
            }
        };

        // Mobile touch support for annotations
        const handleTouchEnd = () => {
            if (isNoteOpen || !activeTool) return;
            // Small delay to allow selection to register on mobile
            setTimeout(() => {
                const selection = rangy.getSelection();
                if (selection && !selection.isCollapsed) {
                    const range = selection.getRangeAt(0);
                    if (activeTool === 'eraser') eraseStyle(range);
                    else applyStyle(activeTool, range);
                    saveState();
                    // Don't clear selection immediately on mobile - let user see what was highlighted
                    setTimeout(() => window.getSelection().removeAllRanges(), 500);
                }
            }, 100);
        };

        const handleClick = (event) => {
            const noteAnchor = event.target.closest(`.${styles.stylerNoteAnchor}`);
            if (noteAnchor && event.target.classList.contains(styles.stylerNoteBadge)) {
                event.preventDefault();
                event.stopPropagation();
                openNoteEditor(noteAnchor);
            }
        };
        
        editor.addEventListener('input', saveState);
        editor.addEventListener('mouseup', handleMouseUp);
        editor.addEventListener('touchend', handleTouchEnd); // Mobile support
        editor.addEventListener('click', handleClick);
        if (overlay) overlay.addEventListener('click', closeOpenNote);

        return () => {
            editor.removeEventListener('input', saveState);
            editor.removeEventListener('mouseup', handleMouseUp);
            editor.removeEventListener('touchend', handleTouchEnd);
            editor.removeEventListener('click', handleClick);
            if (overlay) overlay.removeEventListener('click', closeOpenNote);
        };
    }, [activeTool, isNoteOpen, saveState, applyStyle, eraseStyle, openNoteEditor, closeOpenNote]);
    
    const accent = accentColor || '#222E3B';
    
    return (
        <div className={styles.stylerWrapper}>
            <div ref={overlayRef} className={styles.stylerOverlay}></div>
            
            {confirmation && createPortal(
              <div className={styles.confirmationModalOverlay}>
                <div className={styles.confirmationModal}>
                  <p className={styles.confirmationModalMessage}>{confirmation.message}</p>
                  <div className={styles.confirmationModalActions}>
                    <button onClick={confirmation.onConfirm}>Delete</button>
                    <button onClick={confirmation.onCancel}>Cancel</button>
                  </div>
                </div>
              </div>, document.body
            )}

            <ShadowRootContainer as="div" className={styles.lessonShadowRoot} data-lesson-root="true" style={{ "--accent-color": accent }}>
              <style>{`:host { --accent-color: ${accent}; }
${sanitizeLessonCss(customCSS || "")}

/* grid/columns */
.lesson-content .zporta-columns{display:grid;gap:1.5rem;grid-template-columns:var(--cols-base, 1fr);align-items:start;margin-block:1rem;}
.lesson-content .zporta-column{min-width:0;}
.lesson-content .zporta-column > *{word-break:break-word;max-width:100%;margin-bottom:1rem;}
.lesson-content .zporta-column > *:last-child{margin-bottom:0;}
.lesson-content .zporta-column img,.lesson-content .zporta-column video,.lesson-content .zporta-column iframe{max-width:100%;height:auto;display:block;border-radius:0.5rem;}
/* general media fallback */
.lesson-content img,.lesson-content video,.lesson-content iframe{max-width:100%;height:auto;display:block;border-radius:0.5rem}
@media (min-width:640px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-sm, var(--cols-base, 1fr));}}
@media (min-width:768px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-md, var(--cols-sm, var(--cols-base, 1fr)));}}
@media (min-width:1024px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-lg, var(--cols-md, var(--cols-sm, var(--cols-base, 1fr))));}}

/* buttons */
.lesson-content .zporta-button{display:inline-flex;align-items:center;justify-content:center;font-weight:600;text-decoration:none;border:1px solid transparent;padding:.6rem 1.1rem;border-radius:var(--r-md);transition:filter .15s}
.lesson-content .zporta-button:hover{filter:brightness(.95)}
.lesson-content .zporta-btn--block{display:flex;width:100%;text-align:center}
.lesson-content .zporta-btnSize--sm{padding:.4rem .85rem;font-size:.9rem}
.lesson-content .zporta-btnSize--md{padding:.6rem 1.1rem;font-size:1rem}
.lesson-content .zporta-btnSize--lg{padding:.8rem 1.3rem;font-size:1.1rem}
.lesson-content .zporta-btn--primary{background:var(--zporta-dark-blue,#0A2342);color:#fff;border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--secondary{background:#fff;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--ghost{background:transparent;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-border-color,#e2e8f0)}
.lesson-content .zporta-btn--link{background:transparent;color:var(--zporta-dark-blue,#0A2342);border:0;padding:0;text-decoration:underline}

/* accordion */
.lesson-content .zporta-accordion{width:100%}
.lesson-content .zporta-acc-item{border:1px solid var(--zporta-border-color,#e2e8f0);border-radius:var(--acc-radius,8px);margin:0 0 12px 0;overflow:hidden;background:var(--zporta-background-light,#fff)}
.lesson-content .zporta-acc-title{cursor:pointer;display:block;padding:.75rem 1rem;background:var(--zporta-background-medium,#f8fafc);font-weight:600;position:relative;padding-right:3rem;list-style:none}
.lesson-content .zporta-acc-title::-webkit-details-marker{display:none}
.lesson-content .zporta-acc-title[data-align="center"]{text-align:center}
.lesson-content .zporta-acc-title[data-align="right"]{text-align:right}
.lesson-content .zporta-acc-title[data-size="sm"]{font-size:.9rem}
.lesson-content .zporta-acc-title[data-size="md"]{font-size:1rem}
.lesson-content .zporta-acc-title[data-size="lg"]{font-size:1.1rem}
.lesson-content .zporta-acc-title::after{content:'';position:absolute;right:1rem;top:50%;width:.6em;height:.6em;transform:translateY(-50%) rotate(45deg);border-right:2px solid currentColor;border-bottom:2px solid currentColor;transition:transform .2s ease}
.lesson-content details[open]>.zporta-acc-title::after{transform:translateY(-50%) rotate(225deg)}
.lesson-content .zporta-acc-title[data-icon="plus"]::after{content:'+';border:0;font-weight:700;font-size:1.5em;transform:translateY(-50%);transition:transform .2s ease}
.lesson-content details[open]>.zporta-acc-title[data-icon="plus"]::after{transform:translateY(-50%) rotate(45deg)}
.lesson-content .zporta-acc-title[data-icon="none"]::after{display:none}
.lesson-content .zporta-acc--outline .zporta-acc-item{border-style:dashed}
.lesson-content .zporta-acc--dark .zporta-acc-item{background:#0f172a;border-color:#1f2a44}
.lesson-content .zporta-acc--dark .zporta-acc-title{background:#0b1220;color:#e2e8f0}
.lesson-content .zporta-acc--dark .zporta-acc-panel{background:#0f172a;color:#cbd5e1}
.lesson-content .zporta-acc-panel{padding:1rem;border-top:1px solid var(--zporta-border-color,#e2e8f0)}

/* gated content placeholder (modern card) */
.lesson-content .gated-content{position:relative;border-radius:12px;background:linear-gradient(180deg,#f8fafc,#f1f5f9);border:1px solid var(--zporta-border-color,#e2e8f0);padding:14px;overflow:hidden}
.lesson-content .gated-content::before{content:"";position:absolute;inset:0;background-image:radial-gradient(120px 50px at top left,rgba(10,35,66,.08),transparent),radial-gradient(150px 80px at bottom right,rgba(10,35,66,.06),transparent);pointer-events:none}
.lesson-content .gated-content .gc-card{display:flex;gap:14px;align-items:center}
.lesson-content .gated-content .gc-icon{flex:0 0 40px;width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:#0A2342;color:#fff;box-shadow:0 6px 14px rgba(10,35,66,.2);filter:saturate(1.1)}
.lesson-content .gated-content .gc-body{display:flex;flex-direction:column;gap:6px;color:#0f172a}
.lesson-content .gated-content .gc-title{font-weight:800;letter-spacing:0.2px}
.lesson-content .gated-content .gc-text{color:#334155}
.lesson-content .gated-content .gc-btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:.5rem .9rem;border-radius:10px;border:1px solid #0A2342;background:#0A2342;color:#fff;text-decoration:none;font-weight:700;box-shadow:0 6px 14px rgba(10,35,66,.2);transition:transform .12s ease,box-shadow .12s ease}
.lesson-content .gated-content .gc-btn:hover{transform:translateY(-1px);box-shadow:0 10px 20px rgba(10,35,66,.25)}

/* compact variant: blurred line + small link */
.lesson-content .gated-content.gc-compact{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;background:linear-gradient(180deg,#f8fafc,#f1f5f9);border:1px solid var(--zporta-border-color,#e2e8f0);margin:.5rem 0}
.lesson-content .gated-content.gc-compact::before{display:none}
.lesson-content .gated-content.gc-compact .gc-blur-line{flex:1 1 auto;height:.9em;max-width:220px;border-radius:6px;background:linear-gradient(90deg,#e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%);background-size:200px 100%;filter:blur(1.2px);opacity:.7;animation:gc-shimmer 1.6s linear infinite}
@keyframes gc-shimmer{0%{background-position:-200px 0}100%{background-position:200px 0}}
.lesson-content .gated-content.gc-compact .gc-link{flex:0 0 auto;font-weight:700;font-size:.85rem;color:#0A2342;text-decoration:none;padding:4px 10px;border:1px solid #0A2342;border-radius:9999px;background:#fff}
.lesson-content .gated-content.gc-compact .gc-link:hover{background:#0A2342;color:#fff}
`}</style>

              <div
                  ref={editorRef}
                  className={`lesson-content ${styles.stylerEditor} prose dark:prose-invert max-w-none ${activeTool === 'laser' ? styles.laserActive : ''}`}
                  contentEditable={false} 
              />
            </ShadowRootContainer>
        </div>
    );
};
// ==================================================================
// --- End of TextStyler Component ---
// ==================================================================

// ==================================================================
// --- Shared Annotation Toolbar Component ---
// ==================================================================
const AnnotationToolbar = ({ activeTool, onToolClick, highlightColor, onColorChange, onClearHighlights, onClearNotes, onReset }) => {
    const [isToolbarOpen, setIsToolbarOpen] = useState(true);
    const [showColorPicker, setShowColorPicker] = useState(false);
    const [showClearMenu, setShowClearMenu] = useState(false);
    
    const highlightColors = [
        { name: 'Yellow', value: '#fef08a' },
        { name: 'Green', value: '#bbf7d0' },
        { name: 'Blue', value: '#bfdbfe' },
        { name: 'Pink', value: '#fbcfe8' },
        { name: 'Orange', value: '#fed7aa' },
    ];

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsToolbarOpen(window.innerWidth >= 768);
        }
    }, []);

    return createPortal(
        <div className={`${styles.annotationToolbar} ${!isToolbarOpen ? styles.collapsed : ''}`}>
            <div className={styles.toolbarContent}>
                <div className={styles.highlightGroup}>
                    <button 
                        onClick={() => onToolClick('highlight')} 
                        className={`${styles.toolBtn} ${activeTool === 'highlight' ? styles.active : ''}`} 
                        title="Highlight"
                        style={activeTool === 'highlight' ? { background: highlightColor } : {}}
                    >
                        <Home size={20} />
                    </button>
                    <button 
                        onClick={() => setShowColorPicker(!showColorPicker)} 
                        className={styles.colorPickerBtn}
                        title="Change highlight color"
                    >
                        <ChevronDown size={14} />
                    </button>
                    {showColorPicker && (
                        <div className={styles.colorPicker}>
                            {highlightColors.map(c => (
                                <button
                                    key={c.value}
                                    className={`${styles.colorSwatch} ${highlightColor === c.value ? styles.activeColor : ''}`}
                                    style={{ background: c.value }}
                                    onClick={() => { onColorChange(c.value); setShowColorPicker(false); }}
                                    title={c.name}
                                />
                            ))}
                        </div>
                    )}
                </div>
                <button onClick={() => onToolClick('note')} className={`${styles.toolBtn} ${activeTool === 'note' ? styles.active : ''}`} title="Add Note"><MessageSquare size={20} /></button>
                <div className={styles.separator}></div>
                <button onClick={() => onToolClick('eraser')} className={`${styles.toolBtn} ${activeTool === 'eraser' ? styles.active : ''}`} title="Eraser"><Eraser size={20} /></button>
                <button onClick={() => onToolClick('undo')} className={styles.toolBtn} title="Undo"><Undo size={20} /></button>
                <button onClick={() => onToolClick('redo')} className={styles.toolBtn} title="Redo"><Redo size={20} /></button>
                <div className={styles.separator}></div>
                <div className={styles.clearGroup}>
                    <button 
                        onClick={() => setShowClearMenu(!showClearMenu)} 
                        className={styles.toolBtn}
                        title="Clear annotations"
                    >
                        <X size={20} />
                    </button>
                    {showClearMenu && (
                        <div className={styles.clearMenu}>
                            <button onClick={() => { onClearHighlights(); setShowClearMenu(false); }} className={styles.clearMenuItem}>
                                Clear All Highlights
                            </button>
                            <button onClick={() => { onClearNotes(); setShowClearMenu(false); }} className={styles.clearMenuItem}>
                                Clear All Notes
                            </button>
                            <button onClick={() => { onReset(); setShowClearMenu(false); }} className={`${styles.clearMenuItem} ${styles.resetItem}`}>
                                Reset to Original
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <button onClick={() => setIsToolbarOpen(!isToolbarOpen)} className={styles.toolbarToggle} title={isToolbarOpen ? "Hide toolbar" : "Show toolbar"}>
                {isToolbarOpen ? <ChevronDown size={20} /> : <BookOpen size={20} />}
            </button>
        </div>,
        document.body
    );
};
// ==================================================================
// --- End of Annotation Toolbar ---
// ==================================================================


// --- Helper & Utility Functions ---
const sanitizeHtml = (htmlString) => {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    const forbiddenTags = ['script', 'style', 'iframe', 'object', 'embed'];
    const forbiddenAttrs = ['onload', 'onerror', 'onclick', 'onmouseover', 'onfocus', 'onblur', 'style'];
    doc.querySelectorAll('*').forEach(el => {
        if(forbiddenTags.includes(el.tagName.toLowerCase())) {
            el.remove();
            return;
        }
        for (const attr of forbiddenAttrs) {
            el.removeAttribute(attr);
        }
    });
    return doc.body.innerHTML;
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return "Content failed to load securely.";
  }
};

const getYoutubeEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = null;
  try {
    if (url.includes('youtu.be/')) videoId = new URL(url).pathname.slice(1);
    else if (url.includes('youtube.com/')) {
        const params = new URL(url).searchParams;
        videoId = params.get('v') || new URL(url).pathname.split('/').pop();
    }
    if (videoId) videoId = videoId.split('?')[0].split('&')[0];
  } catch (e) {
    console.error("Error parsing YouTube URL:", e);
    return null;
  }
  return videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : null;
};


// ==================================================================
// --- Sub-Components for the Main Page ---
// ==================================================================

const CourseHeader = React.memo(({ course, onBack, theme, onToggleTheme }) => {
    const [isDescriptionOpen, setIsDescriptionOpen] = useState(false);
    
    return (
        <header className={styles.courseHeader}>
            <div>
                <button onClick={onBack} className={styles.backButton}>
                    <ArrowLeft size={16} /> Back to My Learning
                </button>
                <h1 className={styles.courseTitle}>{course.title}</h1>
                {course.description && (
                    <div className={styles.courseDescription}>
                        <button 
                            onClick={() => setIsDescriptionOpen(!isDescriptionOpen)} 
                            className={styles.descriptionToggle}
                            aria-expanded={isDescriptionOpen}
                        >
                            {isDescriptionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                            {isDescriptionOpen ? 'Hide' : 'Show'} Course Description
                        </button>
                        {isDescriptionOpen && (
                            <div 
                                className={styles.descriptionContent} 
                                dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }} 
                            />
                        )}
                    </div>
                )}
            </div>
            <div className="flex-shrink-0 self-start">
                <button onClick={onToggleTheme} className={styles.themeToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                </button>
            </div>
        </header>
    );
});
CourseHeader.displayName = 'CourseHeader';

const CourseIndexPanel = React.memo(({ lessons, quizzes, completedLessons, activeContentId, onNavigate }) => (
  <div className={styles.indexPanel}>
    <h3 className={styles.indexTitle}>Course Content</h3>
    <div className={styles.indexList}>
      {lessons.map(l => {
        const isActive = `lesson-${l.id}` === activeContentId;
        return (
          <button key={`idx-l-${l.id}`} onClick={() => onNavigate(`lesson-${l.id}`)} className={`${styles.indexItem} ${isActive ? styles.indexItemActive : ''}`}>
            <span className="mr-3">
              {completedLessons.has(l.id) ? <CheckCircle className="w-4 h-4 text-green-500" /> : <span className={styles.indexItemIcon} />}
            </span>
            <span className="truncate">{l.title || 'Untitled Lesson'}</span>
          </button>
        )
      })}
      {quizzes.map(q => {
        const isActive = `quiz-${q.id}` === activeContentId;
        return (
          <button key={`idx-q-${q.id}`} onClick={() => onNavigate(`quiz-${q.id}`)} className={`${styles.indexItem} ${isActive ? styles.indexItemActive : ''}`}>
            <HelpCircle className="w-4 h-4 mr-3 text-purple-500" />
            <span className="truncate">{q.title || 'Untitled Quiz'}</span>
          </button>
        )
      })}
    </div>
  </div>
));
CourseIndexPanel.displayName = 'CourseIndexPanel';

const SearchBar = React.memo(({ searchTerm, onSearchChange, resultCount, currentResultIndex, onNextResult, onPrevResult }) => {
  const hasResults = resultCount > 0;
  return (
    <div className={styles.searchBar}>
      <div className={styles.searchBox}>
        <Search className={styles.searchIcon} aria-hidden="true" />
        <input
          type="search"
          placeholder="Search course content"
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
          aria-label="Search course content"
        />
      </div>
      {searchTerm && (
        <div className={styles.searchResults}>
          {hasResults ? (
            <>
              <span className={styles.searchSummary}>{currentResultIndex + 1} of {resultCount}</span>
              <div className={styles.searchNavButtons}>
                <button onClick={onPrevResult} disabled={currentResultIndex <= 0} aria-label="Previous result"><ArrowUp size={16} /></button>
                <button onClick={onNextResult} disabled={currentResultIndex >= resultCount - 1} aria-label="Next result"><ArrowDown size={16} /></button>
              </div>
            </>
          ) : (
            <span className={styles.searchSummary}>No results for “{searchTerm}”</span>
          )}
        </div>
      )}
    </div>
  );
});
SearchBar.displayName = 'SearchBar';

const LessonSection = ({ lesson, isCompleted, completedAt, isOpen, onToggle, onMarkComplete, onOpenQuiz, searchTerm, onClearHighlightsReady, onClearNotesReady, onResetReady, ...stylerProps }) => {
  const contentDisplayRef = useRef(null);
  
  const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, `<mark class="search-match-highlight">$1</mark>`);
  }, [searchTerm]);

  const sanitizedContent = useMemo(() => sanitizeContentViewerHTML(lesson.content), [lesson.content]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(lesson.title || 'Untitled Lesson'), [lesson.title, highlightSearchTerm]);
  const embedUrl = useMemo(() => getYoutubeEmbedUrl(lesson.video_url), [lesson.video_url]);
  const accent = lesson.accent_color || '#222E3B';
  const customCSS = sanitizeLessonCss(lesson.custom_css || '');
  const customJS = lesson.custom_js || '';
  
  const formatCompletedDate = useCallback((iso) => {
    if (!iso) return '';
    try {
      return new Intl.DateTimeFormat(undefined, { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(iso));
    } catch { return ''; }
  }, []);

  // Initialize accordions when content loads (same as LessonDetail)
  useEffect(() => {
    if (!isOpen || !sanitizedContent || typeof window === 'undefined') return;
    const timeoutId = setTimeout(() => {
      const container = contentDisplayRef.current?.shadowRoot?.querySelector('[data-lesson-root="true"]');
      if (container) {
        initializeAccordions(container);
        container.querySelectorAll('.accordion-item').forEach(item => delete item.dataset.accordionInitialized);
      }
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [sanitizedContent, isOpen]);

  // Execute custom JS when lesson opens (same as LessonDetail)
  useEffect(() => {
    if (!isOpen || !customJS.trim() || typeof window === 'undefined') return;
    const timeoutId = setTimeout(() => {
      const hostEl = contentDisplayRef.current;
      const shadowRoot = hostEl?.shadowRoot;
      if (!shadowRoot) return;
      try {
        new Function('document', 'root', customJS)(shadowRoot, hostEl);
      } catch (e) {
        console.error('Custom JS error in enrolled lesson:', e);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [customJS, isOpen]);

  // Apply lazy audio loading (preload=none) when lesson opens
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const timeoutId = setTimeout(() => {
      const shadowRoot = contentDisplayRef.current?.shadowRoot;
      if (!shadowRoot) return;
      shadowRoot.querySelectorAll('audio').forEach(audio => {
        if (!audio.hasAttribute('preload')) {
          audio.setAttribute('preload', 'none');
        }
      });
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [isOpen, sanitizedContent]);

  return (
    <section id={`lesson-${lesson.id}`} className={styles.lessonSection} aria-labelledby={`lesson-title-${lesson.id}`}>
      <header className={styles.lessonHeader} role="button" onClick={onToggle} aria-expanded={isOpen}>
        <h3 id={`lesson-title-${lesson.id}`} className={styles.lessonTitle}>
          {lesson.content_type === 'video' ? <Video size={20} /> : <FileText size={20} />}
          <span dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
        </h3>
        <div className={styles.lessonHeaderActions}>
          {isCompleted && (
            <>
              <span className={styles.completedBadge}><CheckCircle size={14} /> Completed</span>
              {completedAt && <span className={styles.completedOn}>on {formatCompletedDate(completedAt)}</span>}
            </>
          )}
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </header>
      <div className={`${styles.lessonBody} ${!isOpen ? styles.lessonBodyCollapsed : ''}`}>
        {isOpen && (
          <div className={lessonStyles.lessonDetailContainer}>
            <style>{`.${lessonStyles.lessonDetailContainer}{--accent-color:${accent};}`}</style>
            
            {/* Video embed (match LessonDetail exactly) */}
            {lesson.content_type === 'video' && embedUrl && (
              <div className={lessonStyles.lessonVideoEmbed}>
                <iframe
                  src={embedUrl}
                  title={`${lesson.title || 'Lesson'} Video`}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
            )}
            
            {/* Lesson content in shadow DOM (same structure as LessonDetail preview) */}
            {sanitizedContent && (
              <ShadowRootContainer
                ref={contentDisplayRef}
                as="div"
                className={lessonStyles.lessonShadowRoot}
                data-lesson-root="true"
                style={{ '--accent-color': accent }}
              >
                <style>{`:host { --accent-color: ${accent}; }
${customCSS}

/* grid/columns */
.lesson-content .zporta-columns{display:grid;gap:1.5rem;grid-template-columns:var(--cols-base, 1fr);align-items:start;margin-block:1rem;}
.lesson-content .zporta-column{min-width:0;}
.lesson-content .zporta-column > *{word-break:break-word;max-width:100%;margin-bottom:1rem;}
.lesson-content .zporta-column > *:last-child{margin-bottom:0;}
.lesson-content .zporta-column img,.lesson-content .zporta-column video,.lesson-content .zporta-column iframe{max-width:100%;height:auto;display:block;border-radius:0.5rem;}
@media (min-width:640px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-sm, var(--cols-base, 1fr));}}
@media (min-width:768px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-md, var(--cols-sm, var(--cols-base, 1fr)));}}
@media (min-width:1024px){.lesson-content .zporta-columns{grid-template-columns:var(--cols-lg, var(--cols-md, var(--cols-sm, var(--cols-base, 1fr))));}}

/* buttons */
.lesson-content .zporta-button{display:inline-flex;align-items:center;justify-content:center;font-weight:600;text-decoration:none;border:1px solid transparent;padding:.6rem 1.1rem;border-radius:var(--r-md);transition:filter .15s}
.lesson-content .zporta-button:hover{filter:brightness(.95)}
.lesson-content .zporta-btn--block{display:flex;width:100%;text-align:center}
.lesson-content .zporta-btnSize--sm{padding:.4rem .85rem;font-size:.9rem}
.lesson-content .zporta-btnSize--md{padding:.6rem 1.1rem;font-size:1rem}
.lesson-content .zporta-btnSize--lg{padding:.8rem 1.3rem;font-size:1.1rem}
.lesson-content .zporta-btn--primary{background:var(--zporta-dark-blue,#0A2342);color:#fff;border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--secondary{background:#fff;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-dark-blue,#0A2342)}
.lesson-content .zporta-btn--ghost{background:transparent;color:var(--zporta-dark-blue,#0A2342);border-color:var(--zporta-border-color,#e2e8f0)}
.lesson-content .zporta-btn--link{background:transparent;color:var(--zporta-dark-blue,#0A2342);border:0;padding:0;text-decoration:underline}

/* accordion */
.lesson-content .zporta-accordion{width:100%}

/* General media sizing for content */
.lesson-content img,.lesson-content video,.lesson-content iframe{max-width:100%;height:auto;display:block;border-radius:0.5rem;}
`}</style>
                <div className="lesson-content" dangerouslySetInnerHTML={{ __html: sanitizedContent }} />
              </ShadowRootContainer>
            )}
            
            {/* File download section */}
            {lesson.file_url && (
              <div className={lessonStyles.downloadSection}>
                <h3 className={lessonStyles.downloadTitle}>Download this lesson file</h3>
                <div className={lessonStyles.downloadButtons}>
                  <a
                    href={lesson.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    download
                    className={`${lessonStyles.btn} ${lessonStyles.btnSecondary} ${lessonStyles.downloadBtn}`}
                  >
                    <Download size={16} /> {lesson.file_name || 'Download File'}
                  </a>
                </div>
              </div>
            )}
            
            {/* Meta info (creator + date + tags) */}
            <div className={lessonStyles.metaContainer}>
              <p className={lessonStyles.postMeta}>
                <span className={lessonStyles.metaItem}>
                  <FaUser className={lessonStyles.metaIcon} /> {lesson.created_by || 'Unknown'}
                </span>
                <span className={lessonStyles.metaSeparator}>|</span>
                <span className={lessonStyles.metaItem}>
                  <FaRegClock className={lessonStyles.metaIcon} /> {lesson.created_at ? new Date(lesson.created_at).toLocaleDateString() : 'Unknown'}
                </span>
              </p>
              {lesson.tags_output?.length > 0 && (
                <div className={lessonStyles.lessonTags}>
                  <strong>Tags:</strong>
                  {lesson.tags_output.map((tag) => (
                    <span key={tag} className={lessonStyles.tagItem}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            {/* Completion / quiz actions */}
            <div className={styles.lessonFooter}> 
              {lesson.associatedQuiz && (
                <button onClick={() => onOpenQuiz(lesson.associatedQuiz)} className={styles.startQuizButtonSmall}>
                  <HelpCircle size={16}/> Start Quiz
                </button>
              )}
              {!isCompleted && (
                <button onClick={(e) => { e.stopPropagation(); onMarkComplete(lesson.id); }} className={styles.markCompleteButton}>
                  <CheckCircle size={16} /> Mark as Complete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

const QuizSection = React.memo(({ quiz, onOpenQuiz, searchTerm }) => {
    const highlightedTitle = useMemo(() => {
        if (!searchTerm) return quiz.title;
        const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
        return (quiz.title || 'Untitled Quiz').replace(regex, `<mark class="search-match-highlight">$1</mark>`);
    }, [searchTerm, quiz.title]);

    return (
        <section id={`quiz-${quiz.id}`} className={styles.quizSection} aria-labelledby={`quiz-title-${quiz.id}`}>
             <h3 id={`quiz-title-${quiz.id}`} className={styles.quizTitle}>
                <HelpCircle size={20} />
                <span dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
             </h3>
             <p className={styles.quizDescription}>{quiz.description}</p>
             <button onClick={() => onOpenQuiz(quiz)} className={styles.startQuizButton}>
                Take Quiz
            </button>
        </section>
    );
});
QuizSection.displayName = 'QuizSection';


const ScrollProgress = () => {
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const handleScroll = useCallback(() => {
    const el = document.documentElement;
    const scrolled = el.scrollTop / (el.scrollHeight - el.clientHeight);
    setScrollPercentage(Math.min(100, Math.max(0, scrolled * 100)));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return (
    <div className={styles.scrollProgressContainer}>
      <div className={styles.scrollProgressBar} style={{ width: `${scrollPercentage}%` }}/>
    </div>
  );
};

const BackToTopButton = () => {
  const [isVisible, setIsVisible] = useState(false);

  const handleScroll = useCallback(() => {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    setIsVisible(scrollTop > 400);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Check initial scroll position
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (!isVisible) return null;

  return (
    <button 
      onClick={scrollToTop} 
      className={styles.backToTopButton}
      aria-label="Back to top"
      title="Back to top"
    >
      <ArrowUp size={24} />
    </button>
  );
};


// ==================================================================
// --- Main Component: EnrolledCourseStudyPage ---
// ==================================================================
function EnrolledCourseStudyPage() {
  const { user, token, logout } = useContext(AuthContext);
  const router = useRouter();
  const { enrollmentId } = router.query;

  // Page State
  const [courseData, setCourseData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState('light');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [openLessonId, setOpenLessonId] = useState(null); // accordion: which lesson is open
  const [completedAtByLesson, setCompletedAtByLesson] = useState({}); // lessonId -> ISO string
  const mainContentRef = useRef(null);

  // Interaction State
  const [modalQuiz, setModalQuiz] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState(null);
  const [confirmComplete, setConfirmComplete] = useState(null); // { lessonId, lessonTitle }
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  
  // Collaboration State - disabled
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [collabRoomId, setCollabRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  // const { peerCursors, updateCursor } = useCollaboration(collabRoomId, myId, user?.username);
  const peerCursors = {}; // Empty object for disabled collaboration
  const [activeTool, setActiveTool] = useState(null);
  const [highlightColor, setHighlightColor] = useState('#fef08a');
  const clearHighlightsRef = useRef(null);
  const clearNotesRef = useRef(null);
  const resetRef = useRef(null);

  // --- Effects ---

  // Theme Management
  useEffect(() => {
    const storedTheme = localStorage.getItem('theme') || 'light';
    setTheme(storedTheme);
    document.documentElement.classList.toggle('dark', storedTheme === 'dark');
  }, []);

  // Set User ID for collaboration
  useEffect(() => {
    if (user && !myId) setMyId(user.id ?? user.username);
  }, [user, myId]);
  
  // Main Data Fetching Effect
  useEffect(() => {
    let isMounted = true;
    if (!enrollmentId || !token) {
        if (!token && isMounted) router.push('/login');
        return;
    }

    const sharedToken = router.query.shared_token;
    if (sharedToken) {
        setIsCollaborative(true);
        setCollabRoomId(sharedToken);
    }

    const fetchCourseData = async () => {
      setLoading(true);
      setError("");
      const url = `/enrollments/${enrollmentId}/${sharedToken ? `?shared_token=${sharedToken}` : ''}`;

      const attemptFetch = async () => {
        try {
          return await apiClient.get(url);
        } catch (err) {
          const status = err?.response?.status;
          // Retry only on network errors or 5xx
          if (!status || (status >= 500 && status <= 599)) {
            throw err; // signal for retry
          }
          // Non-retryable error: set message and stop
          if (isMounted) {
            if (status === 404) setError("Course or enrollment not found (404).");
            else if (status === 403) setError("Permission denied (403).");
            else if (status === 401) setError("Session expired. Please log in (401).");
            else setError("Unexpected error loading course.");
          }
          return null;
        }
      };

      let enrollmentRes = null;
      try {
        enrollmentRes = await attemptFetch();
        if (!enrollmentRes) { if (isMounted) setLoading(false); return; } // non-retryable error handled
      } catch (err) {
        // Single retry after brief delay
        await new Promise(r => setTimeout(r, 500));
        try {
          enrollmentRes = await attemptFetch();
          if (!enrollmentRes) { if (isMounted) setLoading(false); return; }
        } catch (finalErr) {
          if (isMounted) setError("Network/server issue. Please refresh.");
          if (isMounted) setLoading(false);
          return;
        }
      }

      if (!isMounted) return;
      const enrollment = enrollmentRes.data;
      const course = enrollment.course_snapshot || enrollment.course;
      if (!course) {
        if (isMounted) setError("Course data missing in enrollment payload.");
        if (isMounted) setLoading(false);
        return;
      }

      const lessonsData = Array.isArray(course.lessons)
        ? course.lessons.filter(l => l.status === 'published' || !l.status)
        : [];
      const allQuizzes = lessonsData.flatMap(l => Array.isArray(l.quizzes) ? l.quizzes : []);
      if (isMounted) {
        setCourseData(course);
        setLessons(lessonsData);
        setQuizzes(allQuizzes);
      }

      // Use embedded completions
      const completions = Array.isArray(enrollment.lesson_completions) ? enrollment.lesson_completions : [];
      const completedSet = new Set(completions.map(c => c.lesson_id));
      setCompletedLessons(completedSet);
      const byLesson = {};
      completions.forEach(c => { if (c.lesson_id && c.completed_at) byLesson[c.lesson_id] = c.completed_at; });
      setCompletedAtByLesson(byLesson);

      if (lessonsData.length > 0) {
        let lastCompletedIndex = -1;
        lessonsData.forEach((l, i) => { if (completedSet.has(l.id)) lastCompletedIndex = i; });
        const nextIndex = Math.min(lastCompletedIndex + 1, lessonsData.length - 1);
        setOpenLessonId(lessonsData[nextIndex].id);
        setActiveContentId(`lesson-${lessonsData[nextIndex].id}`);
      } else if (course.quizzes?.length > 0) {
        setActiveContentId(`quiz-${course.quizzes[0].id}`);
      }

      // Success path complete; clear loading
      if (isMounted) setLoading(false);
    };
    // Initial fetch (fire and forget; internal retry covers transient errors)
    fetchCourseData();
    return () => { isMounted = false; };
  }, [enrollmentId, token, router.query.shared_token, router]);

  // Intersection Observer for active lesson
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setActiveContentId(entry.target.id);
          }
        });
      }, { rootMargin: '-40% 0px -60% 0px', threshold: 0 }
    );
    const elements = document.querySelectorAll('section[id^="lesson-"], section[id^="quiz-"]');
    elements.forEach(el => observer.observe(el));
    return () => elements.forEach(el => observer.unobserve(el));
  }, [lessons, quizzes]);

  // Search logic
  useEffect(() => {
    document.querySelectorAll('.active-search-match').forEach(el => el.classList.remove('active-search-match'));
    if (!searchTerm) {
      setSearchMatches([]);
      setCurrentMatchIndex(-1);
      return;
    }
    const matches = Array.from(mainContentRef.current?.querySelectorAll('.search-match-highlight') || []);
    setSearchMatches(matches);
    setCurrentMatchIndex(matches.length > 0 ? 0 : -1);
    if(matches.length > 0) {
        matches[0].classList.add('active-search-match');
        matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [searchTerm]);

  // Collaboration cursor updates - disabled
  // useEffect(() => {
  //   const contentEl = mainContentRef.current;
  //   if (!contentEl || !isCollaborative || activeTool !== 'laser') {
  //       updateCursor(null, null);
  //       return;
  //   }

  //   const mouseHandler = (e) => {
  //       const rect = contentEl.getBoundingClientRect();
  //       const normX = (e.clientX - rect.left) / rect.width;
  //       const normY = (e.clientY - rect.top) / rect.height;
  //       updateCursor(normX, normY);
  //   };
    
  //   contentEl.addEventListener('mousemove', mouseHandler);
  //   contentEl.addEventListener('mouseleave', () => updateCursor(null, null));
  //   return () => {
  //       contentEl.removeEventListener('mousemove', mouseHandler);
  //       contentEl.removeEventListener('mouseleave', () => updateCursor(null, null));
  //   };
  // }, [isCollaborative, updateCursor, activeTool]);


  // --- Handlers ---
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
        const newTheme = prev === 'light' ? 'dark' : 'light';
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
        localStorage.setItem('theme', newTheme);
        return newTheme;
    });
  }, []);
  
  // **FIX**: Corrected `handleMarkComplete` to use the robust identifier
  const handleMarkComplete = useCallback(async (lessonId) => {
    if (completedLessons.has(lessonId)) return;
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) {
        console.error("Could not find lesson to mark complete:", lessonId);
        return;
    }
    
    // Show confirmation dialog
    setConfirmComplete({ lessonId, lessonTitle: lesson.title || 'this lesson' });
  }, [completedLessons, lessons]);

  const confirmMarkComplete = useCallback(async () => {
    if (!confirmComplete) return;
    const { lessonId } = confirmComplete;
    
    const lesson = lessons.find(l => l.id === lessonId);
    if (!lesson) {
        console.error("Could not find lesson to mark complete:", lessonId);
        setConfirmComplete(null);
        return;
    }
    
    const lessonIdentifier = lesson.permalink || lesson.id;
    
    setCompletedLessons(prev => new Set(prev).add(lessonId));
    setConfirmComplete(null);
    // After completing, close this lesson and open the next one (if any)
    const idx = lessons.findIndex(l => l.id === lessonId);
    const nextIdx = Math.min(idx + 1, lessons.length - 1);
    const nextLessonId = lessons[nextIdx]?.id ?? lessonId;
    setOpenLessonId(nextLessonId);
    
    try {
      const res = await apiClient.post(`/lessons/${lessonIdentifier}/complete/`, {});
      const serverLessonId = res?.data?.lesson_id ?? lessonId;
      const serverTs = res?.data?.completed_at ?? null;
      if (serverTs) setCompletedAtByLesson(prev => ({ ...prev, [serverLessonId]: serverTs }));
      else {
        try {
          const { data: completions } = await apiClient.get(`/enrollments/${enrollmentId}/completions/`);
          const byLesson = {};
          completions.forEach(c => {
            const lid = c.lesson?.id ?? c.lesson_id ?? c.lesson;
            const ts = c.completed_at || c.created_at || null;
            if (lid && ts) byLesson[lid] = ts;
          });
          setCompletedAtByLesson(byLesson);
        } catch {}
      }
    } catch (err) {
      console.error("Failed to mark complete:", err);
      alert(`Failed to mark lesson complete: ${err.response?.data?.detail || err.message}`);
      setCompletedLessons(prev => {
        const newSet = new Set(prev);
        newSet.delete(lessonId);
        return newSet;
      });
      // Revert open state if API fails
      setOpenLessonId(lessonId);
    }
  }, [confirmComplete, lessons, enrollmentId]);

  const handleNavigate = useCallback((targetId) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsSidebarOpen(false);
      if (targetId.startsWith('lesson-')) {
        const idNum = Number(targetId.replace('lesson-', ''));
        if (!Number.isNaN(idNum)) setOpenLessonId(idNum);
      }
    }
  }, []);

  const navigateSearchResults = useCallback((direction) => {
    if (searchMatches.length === 0) return;
    searchMatches[currentMatchIndex]?.classList.remove('active-search-match');
    
    let nextIndex = currentMatchIndex + direction;
    if (nextIndex >= searchMatches.length) nextIndex = 0;
    else if (nextIndex < 0) nextIndex = searchMatches.length - 1;

    searchMatches[nextIndex]?.classList.add('active-search-match');
    searchMatches[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setCurrentMatchIndex(nextIndex);
  }, [searchMatches, currentMatchIndex]);
  
  const handleInviteUser = async (invitedUser) => {
    if (!user || !invitedUser || !courseData) return;
    try {
      const res = await apiClient.post(`/enrollments/share-invites/`, {
        enrollment: enrollmentId,
        invited_user: invitedUser.id,
      });
      const invite = res.data;
      const tokenLink = `${window.location.origin}${router.asPath.split('?')[0]}?shared_token=${invite.token}`;
      
      await apiClient.post('/notifications/user-notifications/create-collab-invite/', {
        target_user_id: invitedUser.id,
        invite_url: tokenLink,
        course_title: courseData.title,
      });

      router.push(tokenLink, undefined, { shallow: true });
      setIsCollaborative(true);
      setCollabRoomId(invite.token);
      setIsInviteModalOpen(false);

    } catch (err) {
      console.error("Could not create ShareInvite:", err);
      alert("Failed to invite user. Please try again.");
    }
  };

  // --- Derived State ---
  // **FIX**: This now correctly maps quizzes to lessons
  const lessonsWithQuizzes = useMemo(() => {
    return lessons.map(lesson => ({
      ...lesson,
      associatedQuiz: quizzes.find(quiz => quiz.lesson === lesson.id),
    }));
  }, [lessons, quizzes]);
  
  const defaultAccent = lessons[0]?.accent_color || '#4f46e5';

  // --- Render Logic ---

  if (loading) return <div className={styles.loadingScreen}><Loader2 className="animate-spin" size={32}/> Loading Course...</div>;
  if (error) return <div className={styles.errorScreen}><AlertTriangle size={40} /><p>{error}</p><button onClick={() => router.back()}>Go Back</button></div>;
  if (!courseData) return <div className={styles.errorScreen}><p>Course data is unavailable.</p></div>;

  return (
    <>
      <Head>
        <title>{`Study: ${courseData.title || 'Course'} | Zporta Academy`}</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
              :root { --accent-color: ${defaultAccent}; }
              /* Tighten the global sidebar only on this page (desktop) */
              @media (min-width: 768px) {
                :root { --sidebar-width-desktop-collapsed: 0px; }
                /* Avoid a thin shadow line from the hidden sidebar */
                .sidebarMenu:not(.expanded) { box-shadow: none !important; }
              }
            `
          }}
        />
      </Head>

      {/* Local dark-mode scope wrapper so CSS Modules `.dark …` selectors apply */}
      <div className={theme === 'dark' ? styles.dark : ''}>
        <ScrollProgress />
        
        {/* Collaboration features disabled */}
        {/* <CollaborationInviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} onInviteUser={handleInviteUser} courseTitle={courseData?.title} enrollmentId={enrollmentId} /> */}
        
        {/* StudyNoteSection disabled for performance */}
        {/* <StudyNoteSection enrollmentId={enrollmentId} /> */}

        <div className={`${styles.pageWrapper} ${isSidebarOpen ? styles.sidebarOpen : ''}`}>
        
        {isSidebarOpen && <div className={styles.sidebarOverlay} onClick={() => setIsSidebarOpen(false)} />}

        <aside className={styles.sidebar} onClick={(e) => e.stopPropagation()}>
            <div className={styles.sidebarHeader}>
                <h3 className={styles.indexTitle}>Course Menu</h3>
                <button onClick={() => setIsSidebarOpen(false)} className={styles.sidebarCloseButton} aria-label="Close menu"><X/></button>
            </div>
            <CourseIndexPanel 
                lessons={lessons}
                quizzes={quizzes.filter(q => q.lesson)} // Only show quizzes linked to lessons here
                completedLessons={completedLessons}
                activeContentId={activeContentId}
                onNavigate={handleNavigate}
            />
            {/* Collaboration Zone hidden - not in use */}
            {/* <CollaborationZoneSection isCollabActive={isCollaborative} setIsInviteModalOpen={setIsInviteModalOpen} shareInvites={[]}/> */}
        </aside>
        
        <div ref={mainContentRef} className={styles.mainContent}>
            {isCollaborative && collabRoomId && (
              <div className={styles.cursorOverlay}>
                {Object.entries(peerCursors).map(([id, { x, y, name }]) => {
                  if (!x || !y) return null;
                  return (
                    <div key={id} className={styles.remoteCursor} style={{ left: `${x*100}%`, top: `${y*100}%` }}>
                      <Users size={18} />
                      <span className={styles.cursorName}>{name || '...'}</span>
                    </div>
                  );
                })}
              </div>
            )}
            <CourseHeader course={courseData} onBack={() => router.push('/my-learning')} theme={theme} onToggleTheme={toggleTheme}/>
            <main className={styles.contentArea}>
                <SearchBar 
                    searchTerm={searchTerm} 
                    onSearchChange={setSearchTerm} 
                    resultCount={searchMatches.length} 
                    currentResultIndex={currentMatchIndex} 
                    onNextResult={() => navigateSearchResults(1)} 
                    onPrevResult={() => navigateSearchResults(-1)}
                />

                {lessonsWithQuizzes.map(lesson => (
                  <LessonSection
                    key={lesson.id}
                    lesson={lesson}
                    isCompleted={completedLessons.has(lesson.id)}
                    completedAt={completedAtByLesson[lesson.id]}
                    isOpen={openLessonId === lesson.id}
                    onToggle={() => setOpenLessonId(prev => prev === lesson.id ? null : lesson.id)}
                    onMarkComplete={handleMarkComplete}
                    onOpenQuiz={setModalQuiz}
                    searchTerm={searchTerm}
                    isCollaborative={isCollaborative}
                    roomId={collabRoomId}
                    enrollmentId={enrollmentId}
                    userId={myId}
                    activeTool={activeTool}
                    onToolClick={(tool) => setActiveTool(prev => prev === tool ? null : tool)}
                    highlightColor={highlightColor}
                    accentColor={lesson.accent_color || courseData?.accent_color || '#222E3B'}
                    customCSS={lesson.custom_css || ''}
                    onClearHighlightsReady={(fn) => { clearHighlightsRef.current = fn; }}
                    onClearNotesReady={(fn) => { clearNotesRef.current = fn; }}
                    onResetReady={(fn) => { resetRef.current = fn; }}
                  />
                ))}
                
                {quizzes.filter(q => !q.lesson).map(quiz => (
                    <QuizSection
                        key={quiz.id}
                        quiz={quiz}
                        onOpenQuiz={setModalQuiz}
                        searchTerm={searchTerm}
                    />
                ))}
            </main>
        </div>
        </div>
      </div>
      
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={styles.floatingMenuToggle} aria-label={isSidebarOpen ? "Close course menu" : "Open course menu"}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
      <BackToTopButton />
      
      <AnnotationToolbar 
        activeTool={activeTool} 
        onToolClick={(tool) => setActiveTool(prev => prev === tool ? null : tool)}
        highlightColor={highlightColor}
        onColorChange={setHighlightColor}
        onClearHighlights={() => clearHighlightsRef.current?.()}
        onClearNotes={() => clearNotesRef.current?.()}
        onReset={() => resetRef.current?.()}
      />
      
      {confirmComplete && createPortal(
        <div className={styles.modalOverlay} onMouseDown={() => setConfirmComplete(null)}>
          <div className={styles.confirmModal} onMouseDown={(e) => e.stopPropagation()}>
            <h3 className={styles.confirmTitle}>Mark Lesson Complete?</h3>
            <p className={styles.confirmMessage}>
              Are you sure you want to mark <strong>{confirmComplete.lessonTitle}</strong> as complete?
            </p>
            <div className={styles.confirmActions}>
              <button onClick={confirmMarkComplete} className={styles.confirmButton}>
                <CheckCircle size={18} /> Yes, Mark Complete
              </button>
              <button onClick={() => setConfirmComplete(null)} className={styles.cancelButton}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
      
      {modalQuiz && createPortal(
          <div className={styles.modalOverlay} onMouseDown={() => setModalQuiz(null)}>
            <div className={styles.modalContent} onMouseDown={(e) => e.stopPropagation()}>
                <button onClick={() => setModalQuiz(null)} className={styles.modalCloseButton} aria-label="Close quiz"><X size={20}/></button>
                <QuizCard quiz={modalQuiz} />
            </div>
          </div>,
          document.body
      )}
    </>
  );
}

export default EnrolledCourseStudyPage;

