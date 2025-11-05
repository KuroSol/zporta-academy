import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import {
  CheckCircle, ChevronDown, ChevronUp, Search, Sun, Moon, ArrowLeft, Loader2, AlertTriangle, Video, FileText, Download, HelpCircle, ArrowUp, ArrowDown, Users, Share2, Menu, X, BookOpen, Eraser, Undo, Redo, Radio, Home, Square, Circle as CircleIcon, MessageSquare,
} from 'lucide-react';
import QuizCard from '@/components/QuizCard';
import styles from '@/styles/EnrolledCourseDetail.module.css';
import CollaborationInviteModal from '@/components/collab/CollaborationInviteModal';
import { useCollaboration } from '@/hooks/useCollaboration';
import CollaborationZoneSection from '@/components/collab/CollaborationZoneSection';
import { ref, onValue, get, set } from 'firebase/database';
import { db } from '@/firebase/firebase';
import StudyNoteSection from '@/components/study/StudyNoteSection';

import rangy from 'rangy';
import 'rangy/lib/rangy-textrange';
import 'rangy/lib/rangy-classapplier';
import 'rangy/lib/rangy-serializer';

// A flag to ensure the toolbar animation only runs once on initial mount
let _isToolbarMounted = false;

// ==================================================================
// --- TextStyler Component (Annotation & Highlighting Tool) ---
// ==================================================================
const TextStyler = ({ htmlContent, isCollaborative, roomId, enrollmentId, activeTool, onToolClick }) => {
    const [showToolbar, setShowToolbar] = useState(() => !_isToolbarMounted);
    const editorRef = useRef(null);
    const overlayRef = useRef(null);
    const isUpdatingFromFirebase = useRef(false);
    const [isToolbarOpen, setIsToolbarOpen] = useState(false);
    const [isNoteOpen, setIsNoteOpen] = useState(false);
    const [history, setHistory] = useState([]);
    const redoStack = useRef([]);
    const [confirmation, setConfirmation] = useState(null); // { message, onConfirm, onCancel }

    useEffect(() => {
        rangy.init();
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsToolbarOpen(window.innerWidth >= 768);
        }
    }, []);
    
    useEffect(() => {
       if (showToolbar) _isToolbarMounted = true;
       return () => {
         if (showToolbar) _isToolbarMounted = false;
       };
     }, [showToolbar]);

    const saveState = useCallback(() => {
        if (!editorRef.current) return;
        const currentState = editorRef.current.innerHTML;
        setHistory(prev => (prev.length === 0 || prev[prev.length - 1] !== currentState ? [...prev.slice(-29), currentState] : prev));
        redoStack.current = [];
        
        if (isCollaborative && roomId) {
            if (isUpdatingFromFirebase.current) return;
            set(ref(db, `sessions/${roomId}/content`), currentState);
        } else if (!isCollaborative && enrollmentId) {
            apiClient.post(`/enrollments/${enrollmentId}/notes/`, {
                highlight_data: currentState 
            }).catch(err => console.error("Failed to save annotations via API:", err));
        }
    }, [isCollaborative, roomId, enrollmentId]);

    useEffect(() => {
        if (!htmlContent) return;

        const loadAnnotations = async () => {
            let initialHtml = htmlContent;
            try {
                if (isCollaborative && roomId) {
                    const contentRef = ref(db, `sessions/${roomId}/content`);
                    const snapshot = await get(contentRef);
                    if (snapshot.exists()) initialHtml = snapshot.val();
                } else if (!isCollaborative && enrollmentId) {
                    const response = await apiClient.get(`/enrollments/${enrollmentId}/notes/`);
                    if (response.data && response.data.highlight_data) initialHtml = response.data.highlight_data;
                }
            } catch (error) {
                console.error("Failed to load annotations:", error);
            } finally {
                if (editorRef.current) {
                    editorRef.current.innerHTML = initialHtml;
                    setHistory([initialHtml]);
                }
            }
        };

        loadAnnotations();
        
        if (isCollaborative && roomId) {
            const contentRef = ref(db, `sessions/${roomId}/content`);
            const unsubscribe = onValue(contentRef, (snapshot) => {
                const remoteHtml = snapshot.val();
                if (editorRef.current && remoteHtml && editorRef.current.innerHTML !== remoteHtml) {
                    isUpdatingFromFirebase.current = true;
                    editorRef.current.innerHTML = remoteHtml;
                    setHistory(prev => [...prev.slice(-29), remoteHtml]);
                    setTimeout(() => { isUpdatingFromFirebase.current = false; }, 100);
                }
            });
            return () => unsubscribe();
        }
    }, [htmlContent, isCollaborative, roomId, enrollmentId]);

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

    const handleToolClick = useCallback((tool) => {
        if (tool === 'undo') undo();
        else if (tool === 'redo') redo();
        else onToolClick(tool);
    }, [undo, redo, onToolClick]);
    
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

    const applyNote = useCallback((range) => {
        const noteAnchor = document.createElement('span');
        noteAnchor.className = styles.stylerNoteAnchor;
        noteAnchor.appendChild(range.extractContents());
        
        const icon = document.createElement('span');
        icon.className = styles.stylerNoteIcon;
        icon.textContent = 'i';
        noteAnchor.appendChild(icon);
        
        const notePopup = document.createElement('div');
        notePopup.className = styles.stylerNotePopup;
        notePopup.setAttribute('contenteditable', 'true');
        notePopup.innerText = 'Type your note...';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = styles.stylerNoteDeleteBtn;
        deleteBtn.innerHTML = '&times;';
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          setConfirmation({
            message: "Are you sure you want to delete this note?",
            onConfirm: () => {
              const parent = noteAnchor.parentNode;
              while (noteAnchor.firstChild) {
                  if(noteAnchor.firstChild.nodeName !== "SPAN" && noteAnchor.firstChild.nodeName !== "DIV") {
                    parent.insertBefore(noteAnchor.firstChild, noteAnchor);
                  } else {
                      break;
                  }
              }
              parent.removeChild(noteAnchor);
              parent.normalize();
              saveState();
              setConfirmation(null);
            },
            onCancel: () => setConfirmation(null)
          });
        };
        notePopup.appendChild(deleteBtn);
        noteAnchor.appendChild(notePopup);
        range.insertNode(noteAnchor);
    }, [saveState]);

    const applyStyle = useCallback((style, range) => {
        if (style === 'note') {
            applyNote(range);
            return;
        }
        const classMap = { highlight: styles.stylerHighlight, box: styles.stylerBox, circle: styles.stylerCircle };
        if (classMap[style]) {
            const classApplier = rangy.createClassApplier(classMap[style], { elementTagName: 'span', normalize: true });
            classApplier.applyToRange(range);
        }
    }, [applyNote]);

    const eraseStyle = useCallback((range) => {
        const editor = editorRef.current;
        if (!editor) return;
        const workingRange = range.cloneRange();
        
        const spansToProcess = [];
        [styles.stylerHighlight, styles.stylerBox, styles.stylerCircle].forEach(cls => {
            Array.from(editor.querySelectorAll(`span.${cls}`)).forEach(el => {
                if (workingRange.intersectsNode(el)) spansToProcess.push({ el, cls });
            });
        });

        spansToProcess.forEach(({ el, cls }) => {
            const spanRange = rangy.createRange();
            spanRange.selectNodeContents(el);

            const intersection = spanRange.intersection(workingRange);
            if (intersection) {
                const before = spanRange.cloneRange();
                before.setEnd(intersection.startContainer, intersection.startOffset);
                const after = spanRange.cloneRange();
                after.setStart(intersection.endContainer, intersection.endOffset);
                
                const frag = document.createDocumentFragment();
                if (!before.collapsed) {
                    const b = document.createElement('span');
                    b.className = cls;
                    b.appendChild(before.cloneContents());
                    frag.appendChild(b);
                }
                frag.appendChild(intersection.cloneContents());
                if (!after.collapsed) {
                    const a = document.createElement('span');
                    a.className = cls;
                    a.appendChild(after.cloneContents());
                    frag.appendChild(a);
                }
                el.parentNode.replaceChild(frag, el);
            }
        });

        Array.from(editor.querySelectorAll(`span.${styles.stylerNoteAnchor}`)).forEach(el => {
            if (workingRange.intersectsNode(el)) {
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
            if (isNoteOpen || !activeTool || activeTool === 'laser') return;
            const selection = rangy.getSelection();
            if (selection && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                if (activeTool === 'eraser') eraseStyle(range);
                else applyStyle(activeTool, range);
                saveState();
                window.getSelection().removeAllRanges();
            }
        };

        const handleClick = (event) => {
            const icon = event.target.closest(`.${styles.stylerNoteIcon}`);
            if (icon) {
                const popup = icon.parentElement.querySelector(`.${styles.stylerNotePopup}`);
                if (popup) popup.style.display === 'block' ? closeOpenNote() : openNote(popup);
            }
        };
        
        editor.addEventListener('input', saveState);
        editor.addEventListener('mouseup', handleMouseUp);
        editor.addEventListener('click', handleClick);
        if (overlay) overlay.addEventListener('click', closeOpenNote);

        return () => {
            editor.removeEventListener('input', saveState);
            editor.removeEventListener('mouseup', handleMouseUp);
            editor.removeEventListener('click', handleClick);
            if (overlay) overlay.removeEventListener('click', closeOpenNote);
        };
    }, [activeTool, isNoteOpen, saveState, applyStyle, eraseStyle, openNote, closeOpenNote]);
    
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

            {showToolbar && typeof document !== 'undefined' && createPortal(
                <div className={`${styles.floatingToolbarContainer} ${!isToolbarOpen ? styles.collapsed : ''}`}>
                    <div className={styles.toolbarContent}>
                        <button onClick={() => handleToolClick('laser')} className={`${styles.stylerToolBtn} ${activeTool === 'laser' ? styles.active : ''}`} title="Laser Pointer"><Radio size={18} /></button>
                        <div className={styles.separator}></div>
                        <button onClick={() => handleToolClick('highlight')} className={`${styles.stylerToolBtn} ${activeTool === 'highlight' ? styles.active : ''}`} title="Highlight"><Home size={18} /></button>
                        <button onClick={() => handleToolClick('box')} className={`${styles.stylerToolBtn} ${activeTool === 'box' ? styles.active : ''}`} title="Box"><Square size={18} /></button>
                        <button onClick={() => handleToolClick('circle')} className={`${styles.stylerToolBtn} ${activeTool === 'circle' ? styles.active : ''}`} title="Circle"><CircleIcon size={18} /></button>
                        <button onClick={() => handleToolClick('note')} className={`${styles.stylerToolBtn} ${activeTool === 'note' ? styles.active : ''}`} title="Add Note"><MessageSquare size={18} /></button>
                        <div className={styles.separator}></div>
                        <button onClick={() => handleToolClick('eraser')} className={`${styles.stylerToolBtn} ${activeTool === 'eraser' ? styles.active : ''}`} title="Eraser"><Eraser size={18} /></button>
                        <button onClick={() => handleToolClick('undo')} className={styles.stylerToolBtn} title="Undo"><Undo size={18} /></button>
                        <button onClick={() => handleToolClick('redo')} className={styles.stylerToolBtn} title="Redo"><Redo size={18} /></button>
                    </div>
                    <button onClick={() => setIsToolbarOpen(!isToolbarOpen)} className={styles.toolbarToggle}>
                        {isToolbarOpen ? <ChevronDown size={20} /> : <BookOpen size={18} />}
                    </button>
                </div>,
                document.body
            )}

            <div
                ref={editorRef}
                className={`${styles.stylerEditor} prose dark:prose-invert max-w-none ${activeTool === 'laser' ? styles.laserActive : ''}`}
                contentEditable={false} 
            />
        </div>
    );
};
// ==================================================================
// --- End of TextStyler Component ---
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

const CourseHeader = React.memo(({ course, onBack, theme, onToggleTheme }) => (
    <header className={styles.courseHeader}>
        <div>
            <button onClick={onBack} className={styles.backButton}>
                <ArrowLeft size={16} /> Back to My Learning
            </button>
            <h1 className={styles.courseTitle}>{course.title}</h1>
            {course.description && (
                <div className="mt-2 text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(course.description) }} />
            )}
        </div>
        <div className="flex-shrink-0 self-start">
            <button onClick={onToggleTheme} className={styles.themeToggle} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
                {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
        </div>
    </header>
));
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
    <div className="mb-6">
      <div className="relative">
        <Search className={styles.searchInputIcon} />
        <input
          type="search"
          placeholder="Search course content..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className={styles.searchInput}
          aria-label="Search course content"
        />
      </div>
      {searchTerm && (
        <div className={styles.searchResultNavigator}>
          {hasResults ? (
            <>
              <span>{currentResultIndex + 1} of {resultCount}</span>
              <div className="flex items-center">
                <button onClick={onPrevResult} disabled={currentResultIndex <= 0} aria-label="Previous result"><ArrowUp size={16} /></button>
                <button onClick={onNextResult} disabled={currentResultIndex >= resultCount - 1} aria-label="Next result"><ArrowDown size={16} /></button>
              </div>
            </>
          ) : (
            <span>No results found for &quot;{searchTerm}&quot;</span>
          )}
        </div>
      )}
    </div>
  );
});
SearchBar.displayName = 'SearchBar';

const LessonSection = React.memo(({ lesson, isCompleted, onMarkComplete, onOpenQuiz, searchTerm, ...stylerProps }) => {
  const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    const regex = new RegExp(`(${searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, `<mark class="search-match-highlight">$1</mark>`);
  }, [searchTerm]);

  const sanitizedContent = useMemo(() => sanitizeHtml(lesson.content), [lesson.content]);
  const highlightedContent = useMemo(() => highlightSearchTerm(sanitizedContent), [sanitizedContent, highlightSearchTerm]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(lesson.title || 'Untitled Lesson'), [lesson.title, highlightSearchTerm]);
  const embedUrl = useMemo(() => getYoutubeEmbedUrl(lesson.video_url), [lesson.video_url]);

  return (
    <section id={`lesson-${lesson.id}`} className={styles.lessonSection} aria-labelledby={`lesson-title-${lesson.id}`}>
      <header className={styles.lessonHeader}>
        <h3 id={`lesson-title-${lesson.id}`} className={styles.lessonTitle}>
          {lesson.content_type === 'video' ? <Video size={20} /> : <FileText size={20} />}
          <span dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
        </h3>
        {isCompleted && <span className={styles.completedBadge}><CheckCircle size={14} /> Completed</span>}
      </header>

      <div className={styles.lessonContent}>
        {lesson.content_type === 'video' && embedUrl && (
          <div className={styles.videoContainer}>
            <iframe src={embedUrl} title={`${lesson.title || 'Lesson'} Video`} allowFullScreen loading="lazy" />
          </div>
        )}
        {lesson.content_type === 'text' && lesson.content && (
           <TextStyler htmlContent={highlightedContent} {...stylerProps} />
        )}
        {lesson.file_url && (
            <a href={lesson.file_url} target="_blank" rel="noopener noreferrer" download className={styles.downloadButton}>
                <Download size={16} /> Download File {lesson.file_name ? `(${lesson.file_name})` : ''}
            </a>
        )}
      </div>

      <footer className={styles.lessonFooter}>
        {lesson.associatedQuiz && (
            <button onClick={() => onOpenQuiz(lesson.associatedQuiz)} className={styles.startQuizButtonSmall}>
                <HelpCircle size={16}/> Start Quiz
            </button>
        )}
        {!isCompleted && (
          <button onClick={() => onMarkComplete(lesson.id)} className={styles.markCompleteButton}>
            <CheckCircle size={16} /> Mark as Complete
          </button>
        )}
      </footer>
    </section>
  );
});
LessonSection.displayName = 'LessonSection';

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
  const mainContentRef = useRef(null);

  // Interaction State
  const [modalQuiz, setModalQuiz] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [activeContentId, setActiveContentId] = useState(null);
  
  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);
  
  // Collaboration State
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [collabRoomId, setCollabRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  const { peerCursors, updateCursor } = useCollaboration(collabRoomId, myId, user?.username);
  const [activeTool, setActiveTool] = useState(null);

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
      try {
        const url = `/enrollments/${enrollmentId}/${sharedToken ? `?shared_token=${sharedToken}` : ''}`;
        const enrollmentRes = await apiClient.get(url);
        if (!isMounted) return;

        const enrollment = enrollmentRes.data;
        const course = enrollment.course_snapshot || enrollment.course;
        if (!course) throw new Error("Course data not found in enrollment.");
        
        // Use lessons from the course payload; avoid per-lesson fetch (draft lessons can 404)
        const lessonsData = Array.isArray(course.lessons)
          ? course.lessons.filter(l => l.status === 'published' || !l.status)
          : [];
        // Quizzes are already nested per lesson by the serializer
        const allQuizzes = lessonsData.flatMap(l => Array.isArray(l.quizzes) ? l.quizzes : []);

        if (isMounted) {
            setCourseData(course);
            setLessons(lessonsData);
            setQuizzes(allQuizzes);setQuizzes(allQuizzes); // Use quizzes extracted from lessons
            
            const { data: completions } = await apiClient.get(`/enrollments/${enrollmentId}/completions/`);
            if (!isMounted) return;
            setCompletedLessons(new Set(completions.map(c => c.lesson.id)));
            
            if (lessonsData.length > 0) setActiveContentId(`lesson-${lessonsData[0].id}`);
            else if (course.quizzes?.length > 0) setActiveContentId(`quiz-${course.quizzes[0].id}`);
        }
      } catch (err) {
        console.error("Error fetching course data:", err);
        if (isMounted) setError("Failed to load course data. You may not have permission or the course does not exist.");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

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

  // Collaboration cursor updates
  useEffect(() => {
    const contentEl = mainContentRef.current;
    if (!contentEl || !isCollaborative || activeTool !== 'laser') {
        updateCursor(null, null);
        return;
    }

    const mouseHandler = (e) => {
        const rect = contentEl.getBoundingClientRect();
        const normX = (e.clientX - rect.left) / rect.width;
        const normY = (e.clientY - rect.top) / rect.height;
        updateCursor(normX, normY);
    };
    
    contentEl.addEventListener('mousemove', mouseHandler);
    contentEl.addEventListener('mouseleave', () => updateCursor(null, null));
    return () => {
        contentEl.removeEventListener('mousemove', mouseHandler);
        contentEl.removeEventListener('mouseleave', () => updateCursor(null, null));
    };
  }, [isCollaborative, updateCursor, activeTool]);


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
    
    const lessonIdentifier = lesson.permalink || lesson.id;
    
    setCompletedLessons(prev => new Set(prev).add(lessonId));
    try {
      await apiClient.post(`/lessons/${lessonIdentifier}/complete/`, {});
    } catch (err) {
      console.error("Failed to mark complete:", err);
      alert(`Failed to mark lesson complete: ${err.response?.data?.detail || err.message}`);
      setCompletedLessons(prev => {
        const newSet = new Set(prev);
        newSet.delete(lessonId);
        return newSet;
      });
    }
  }, [completedLessons, lessons]);

  const handleNavigate = useCallback((targetId) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setIsSidebarOpen(false);
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
        <style dangerouslySetInnerHTML={{ __html: `:root { --accent-color: ${defaultAccent}; }` }} />
      </Head>

      <ScrollProgress />
      
      <CollaborationInviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} onInviteUser={handleInviteUser} courseTitle={courseData?.title} enrollmentId={enrollmentId} />
      
      <StudyNoteSection enrollmentId={enrollmentId} />

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
            <CollaborationZoneSection isCollabActive={isCollaborative} setIsInviteModalOpen={setIsInviteModalOpen} shareInvites={[]}/>
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
                        onMarkComplete={handleMarkComplete}
                        onOpenQuiz={setModalQuiz}
                        searchTerm={searchTerm}
                        isCollaborative={isCollaborative}
                        roomId={collabRoomId}
                        enrollmentId={enrollmentId}
                        userId={myId}
                        activeTool={activeTool}
                        onToolClick={(tool) => setActiveTool(prev => prev === tool ? null : tool)}
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
      
      <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className={styles.floatingMenuToggle} aria-label={isSidebarOpen ? "Close course menu" : "Open course menu"}>
          {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>
      
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

