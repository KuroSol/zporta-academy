import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // Adjust path if needed
import apiClient from '../api'; // Adjust path if needed
import { Helmet } from 'react-helmet';
import {
  CheckCircle, ChevronDown, ChevronUp, Search, Sun, Moon, List, ArrowLeft, Loader2, AlertTriangle, Video, FileText, Download, X, HelpCircle, ArrowUp, ArrowDown, Users, Share2, Pencil, UserPlus, BookOpen
} from 'lucide-react';
import QuizCard from './QuizCard';
import styles from './EnrolledCourseDetail.module.css';
import CollaborationInviteModal from './CollaborationInviteModal';

// --- Collaboration, Firebase, and other imports ---
import { useCollaboration } from '../hooks/useCollaboration';
import DrawingOverlay from './DrawingOverlay';
import CollaborationZoneSection from './CollaborationZoneSection';
import { ref, onValue, get, remove } from 'firebase/database';
import { subscribeTo, writeTo, db } from '../firebase';
import StudyNoteSection from './StudyNoteSection';
import rangy from 'rangy';
import 'rangy/lib/rangy-classapplier';
import 'rangy/lib/rangy-serializer';

// --- Helper Functions ---
const sanitizeHtml = (htmlString) => {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    doc.querySelectorAll('script, [onload], [onerror], [onclick], [onmouseover], [onfocus], [onblur]').forEach(el => el.remove());
    doc.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute('contenteditable'));
    return doc.body.innerHTML;
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return htmlString;
  }
};

const getYoutubeEmbedUrl = (url) => {
  if (!url) return null;
  let videoId = null;
  try {
    if (url.includes('/embed/')) {
      const parts = url.split('/embed/');
      videoId = parts[1]?.split('?')[0]?.split('&')[0];
    } else {
      const parsedUrl = new URL(url);
      if ((parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') && parsedUrl.searchParams.has('v')) {
        videoId = parsedUrl.searchParams.get('v');
      } else if (parsedUrl.hostname === 'youtu.be') {
        videoId = parsedUrl.pathname.slice(1);
      } else if (parsedUrl.hostname === 'www.youtube.com' && parsedUrl.pathname.startsWith('/shorts/')) {
        videoId = parsedUrl.pathname.substring('/shorts/'.length);
      }
    }
    if (videoId && (videoId.includes('&') || videoId.includes('?'))) {
      videoId = videoId.split(/[&?]/)[0];
    }
  } catch (e) {
    console.error("Error parsing video URL:", e, "URL:", url);
    return null;
  }
  return videoId && /^[a-zA-Z0-9_-]{10,12}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : null;
};


// --- Child Components ---

const QuizSection = React.memo(({ quiz, searchTerm, onOpenQuiz }) => {
  const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return text.replace(regex, `<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>`);
  }, [searchTerm]);

  const sanitizedDescription = useMemo(() => sanitizeHtml(quiz.description), [quiz.description]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(quiz.title || 'Untitled Quiz'), [quiz.title, searchTerm, highlightSearchTerm]);
  const highlightedDescription = useMemo(() => highlightSearchTerm(sanitizedDescription), [sanitizedDescription, searchTerm, highlightSearchTerm]);

  return (
    <section
      id={`quiz-${quiz.id}`}
      className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600"
      aria-labelledby={`quiz-title-${quiz.id}`}
    >
      <h4 id={`quiz-title-${quiz.id}`} className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center">
        <HelpCircle className="w-5 h-5 mr-2 text-purple-500" />
        <span dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
      </h4>
      {quiz.description && (
        <div
          className="max-w-none text-gray-600 dark:text-gray-400 mb-3"
          dangerouslySetInnerHTML={{ __html: highlightedDescription }}
        />
      )}
      <button
        type="button"
        onClick={() => onOpenQuiz(quiz)}
        className="inline-flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-medium rounded-md transition duration-150 ease-in-out"
      >
        Start Quiz
      </button>
    </section>
  );
});

const LessonSection = React.memo(({ lesson, associatedQuiz, isCompleted, completedAt, onMarkComplete, onOpenQuiz, searchTerm }) => {
  const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    return text.replace(regex, `<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>`);
  }, [searchTerm]);

  const sanitizedContent = useMemo(() => sanitizeHtml(lesson.content), [lesson.content]);
  const highlightedContent = useMemo(() => highlightSearchTerm(sanitizedContent), [sanitizedContent, searchTerm, highlightSearchTerm]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(lesson.title || 'Untitled Lesson'), [lesson.title, searchTerm, highlightSearchTerm]);
  const embedUrl = useMemo(() => getYoutubeEmbedUrl(lesson.video_url), [lesson.video_url]);

  return (
    <section
      id={`lesson-${lesson.id}`}
      className="mb-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700"
      aria-labelledby={`lesson-title-${lesson.id}`}
    >
      <div className="flex justify-between items-center mb-4">
        <h3
          id={`lesson-title-${lesson.id}`}
          className="lesson-title flex items-center mr-2 text-xl font-semibold text-gray-800 dark:text-gray-100"
        >
          {lesson.content_type === 'video' && <Video className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />}
          {lesson.content_type === 'text' && <FileText className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" />}
          <span className="flex-grow" dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
        </h3>
        <div className="flex items-center space-x-3 flex-shrink-0">
          {isCompleted && (
            <div className="flex flex-col items-end">
              <span className="text-green-600 dark:text-green-400 text-sm font-medium flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" /> Completed
              </span>
              {completedAt && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(completedAt).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {associatedQuiz && (
            <HelpCircle className="w-4 h-4 text-purple-500 dark:text-purple-400" title="Quiz available for this lesson" />
          )}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        {lesson.content_type === 'video' && embedUrl && (
          <div className="aspect-w-16 aspect-h-9 mb-4 rounded-lg overflow-hidden bg-black shadow-inner">
            <iframe
              src={embedUrl}
              title={`${lesson.title || 'Lesson'} Video`}
              className="w-full h-full"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              loading="lazy"
            ></iframe>
          </div>
        )}
        {lesson.content_type === 'video' && !embedUrl && lesson.video_url && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">Could not embed video. <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="underline">Link</a></p>
        )}

        {lesson.content_type === 'text' && lesson.content && (
          <div
            className="content-text max-w-none prose dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
        )}
        {lesson.content_type === 'text' && !lesson.content && (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">This text lesson has no content.</p>
        )}

        {lesson.file_url && (
          <div className="mt-4 mb-4">
            <a
              href={lesson.file_url}
              target="_blank"
              rel="noopener noreferrer"
              download={lesson.file_name || true}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition duration-150 ease-in-out shadow-sm hover:shadow-md"
            >
              <Download className="w-4 h-4 mr-2" />
              Download File {lesson.file_name ? `(${lesson.file_name})` : ''}
            </a>
          </div>
        )}

        {associatedQuiz && (
          <QuizSection
            quiz={associatedQuiz}
            searchTerm={searchTerm}
            onOpenQuiz={onOpenQuiz}
          />
        )}

        {!isCompleted && (
          <div className="mt-6 text-right">
            <button
              onClick={() => onMarkComplete(lesson.id)}
              className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition duration-150 ease-in-out shadow-sm hover:shadow-md"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Mark as Complete
            </button>
          </div>
        )}
      </div>
    </section>
  );
});

const LessonIndexModal = ({ isOpen, onClose, lessons, quizzes, onNavigate, completedLessons, completionTimestamps, activeLessonId }) => {
    if (!isOpen) return null;

    const handleNavClick = (id, type) => {
        onNavigate(`${type}-${id}`);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[200] flex justify-center items-center" onClick={onClose}>
            <div 
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">Course Index</h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto p-4">
                    {lessons.length > 0 && (
                        <>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 mb-2">Lessons</p>
                            <ul className="space-y-1">
                                {lessons.map(lesson => {
                                    const isCompleted = completedLessons.has(lesson.id);
                                    const isActive = lesson.id === activeLessonId;
                                    return (
                                        <li key={`nav-lesson-${lesson.id}`}>
                                            <button
                                                onClick={() => handleNavClick(lesson.id, 'lesson')}
                                                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center transition-colors ${isActive ? 'bg-blue-100 dark:bg-blue-900/50' : 'hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                                            >
                                                <div className="flex-shrink-0 mr-3">
                                                    {isCompleted ? <CheckCircle className="w-5 h-5 text-green-500" /> : <div className={`w-5 h-5 border-2 ${isActive ? 'border-blue-500' : 'border-gray-300 dark:border-gray-600'} rounded-full`}></div>}
                                                </div>
                                                <span className={`flex-grow truncate ${isActive ? 'font-semibold text-blue-600 dark:text-blue-300' : 'text-gray-700 dark:text-gray-200'}`}>
                                                    {lesson.title || 'Untitled Lesson'}
                                                </span>
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        </>
                    )}
                     {quizzes.length > 0 && (
                        <>
                            <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 mt-4 mb-2 pt-4 border-t border-gray-200 dark:border-gray-700">Quizzes</p>
                            <ul className="space-y-1">
                                {quizzes.map(quiz => (
                                    <li key={`nav-quiz-${quiz.id}`}>
                                        <button
                                            onClick={() => handleNavClick(quiz.id, 'quiz')}
                                            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg flex items-center"
                                        >
                                            <HelpCircle className="w-5 h-5 mr-3 text-purple-500 flex-shrink-0" />
                                            <span className="truncate">{quiz.title || 'Untitled Quiz'}</span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const FloatingIndexButton = ({ onClick, lessonCount, completedCount }) => {
    const progressPercentage = lessonCount > 0 ? (completedCount / lessonCount) * 100 : 0;
    
    return (
        <button 
            onClick={onClick}
            id="course-index-button"
            // MODIFIED: Using CSS module for positioning, combined with Tailwind for looks.
            className={`${styles.floatingIndexButton} flex items-center justify-center w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl hover:bg-blue-700 transition-all duration-300 ease-in-out transform hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800`}
            aria-label="Open course index"
        >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle
                    className="text-blue-300/50"
                    stroke="currentColor"
                    strokeWidth="8"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                />
                <circle
                    className="text-white"
                    stroke="currentColor"
                    strokeWidth="8"
                    cx="50"
                    cy="50"
                    r="42"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={2 * Math.PI * 42 * (1 - progressPercentage / 100)}
                    transform="rotate(-90 50 50)"
                    style={{ transition: 'stroke-dashoffset 0.5s ease' }}
                />
            </svg>
            <List size={24} className="relative"/>
        </button>
    );
};


const SearchBar = ({ searchTerm, onSearchChange, resultCount, currentResultIndex, onNextResult, onPrevResult }) => {
  const hasResults = resultCount > 0;
  const currentDisplayIndex = hasResults ? currentResultIndex + 1 : 0;

  return (
    <div className="mb-6">
      <div className="relative">
        <input
          type="search"
          placeholder="Search course content..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
          aria-label="Search course content"
        />
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 dark:text-gray-500 pointer-events-none" />
      </div>
      {searchTerm && (
        <div className="mt-2 flex items-center justify-end text-sm text-gray-600 dark:text-gray-400">
          {hasResults ? (
            <>
              <span className="mr-3">
                Result {currentDisplayIndex} of {resultCount}
              </span>
              <button
                onClick={onPrevResult}
                disabled={currentResultIndex <= 0}
                className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Previous search result"
              >
                <ArrowUp size={16} />
              </button>
              <button
                onClick={onNextResult}
                disabled={currentResultIndex >= resultCount - 1}
                className="ml-1 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-label="Next search result"
              >
                <ArrowDown size={16} />
              </button>
            </>
          ) : (
            <span>No results found for "{searchTerm}"</span>
          )}
        </div>
      )}
    </div>
  );
};

const ScrollProgress = () => {
  const [scrollPercentage, setScrollPercentage] = useState(0);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    setScrollPercentage(Math.min(100, Math.max(0, scrolled)));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    const handleResize = () => handleScroll();
    window.addEventListener('resize', handleResize, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    }
  }, [handleScroll]);

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[101] bg-gray-200 dark:bg-gray-700">
      <div
        className="h-1 bg-blue-600 dark:bg-blue-400 transition-width duration-100 ease-linear"
        style={{ width: `${scrollPercentage}%` }}
      />
    </div>
  );
};

const ThemeToggle = ({ theme, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900"
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};


// --- Main Component: EnrolledCourseStudyPage ---
const EnrolledCourseStudyPage = () => {
  const { user, token, logout } = useContext(AuthContext);
  const [modalQuiz, setModalQuiz] = useState(null);
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [completionTimestamps, setCompletionTimestamps] = useState({});
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [isIndexModalOpen, setIsIndexModalOpen] = useState(false);

  const [highlights, setHighlights] = useState([]);
  const highlightApplier = useRef(null);

  const openQuizModal = useCallback((quiz) => {
    setModalQuiz(quiz);
    setIsQuizModalOpen(true);
  }, []);

  const closeQuizModal = useCallback(() => {
    setIsQuizModalOpen(false);
    setModalQuiz(null);
  }, []);

  const [roomId, setRoomId] = useState(null);
  const [myId, setMyId] = useState(null);
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [shareInvites, setShareInvites] = useState([]);
  
  const mainContentRef = useRef(null);

  useEffect(() => {
    if (!enrollmentId) return;
    apiClient.get('/enrollments/share-invites/', { params: { enrollment: enrollmentId } })
      .then(res => setShareInvites(res.data.results || res.data))
      .catch(err => console.error('Failed to load share invites:', err));
  }, [enrollmentId]);

  const [allStrokes, setAllStrokes] = useState([]);
  useEffect(() => {
    if (!roomId) return;
    const drawingsRef = ref(db, `sessions/${roomId}/drawings`);
    const unsubscribe = onValue(drawingsRef, snap => {
      const val = snap.val() || {};
      const arr = Object.entries(val).map(([id, s]) => ({ id, ...s }));
      setAllStrokes(arr);
    });
    return () => unsubscribe();
  }, [roomId]);

  const COLORS = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4'];
  const userColors = useMemo(() => {
    const ids = Array.from(new Set([myId, ...allStrokes.map(s => s.userId)]));
    return ids.reduce((map, id, i) => {
      map[id] = COLORS[i % COLORS.length];
      return map;
    }, {});
  }, [myId, allStrokes]);

  const [courseData, setCourseData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [otherId, setOtherId] = useState(null);
  const [otherUserId, setOtherUserId] = useState(null); 
  const [isCollabActive, setIsCollabActive] = useState(false);
  const [isDrawingMode, setIsDrawingMode] = useState(false); 
  const isTeacher = false;
  
  const [zoom, setZoom] = useState(1.0);
  const [drawingTool, setDrawingTool] = useState('pen');
  const [drawingColor, setDrawingColor] = useState('#FFC107');
  const [drawingLineWidth, setDrawingLineWidth] = useState(4);

  const { addDrawingStroke, addTextHighlight, setDrawingCanvas, peerCursors, updateCursor, updateScroll, isSessionCreator, claimControl } = useCollaboration(roomId, myId, user?.username);
  const [controlOwner, setControlOwner] = useState(null);

  useEffect(() => {
    const contentEl = mainContentRef.current;
    if (!contentEl || controlOwner !== myId) return;

    const mouseHandler = (e) => {
      const rect = contentEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      
      if (contentEl.clientWidth > 0 && contentEl.clientHeight > 0) {
        const normX = x / (contentEl.clientWidth / zoom);
        const normY = y / (contentEl.clientHeight / zoom);
        updateCursor(normX, normY);
      }
    };

    const scrollHandler = () => {
      updateScroll(window.scrollX, window.scrollY);
    };

    window.addEventListener('mousemove', mouseHandler);
    window.addEventListener('scroll', scrollHandler, { passive: true });

    return () => {
      window.removeEventListener('mousemove', mouseHandler);
      window.removeEventListener('scroll', scrollHandler);
    };
  }, [controlOwner, myId, updateCursor, updateScroll, zoom]);

  useEffect(() => {
    if (!roomId) return;
    const ctrlRef = ref(db, `sessions/${roomId}/controlOwner`);
    const unsub = onValue(ctrlRef, snap => {
      const newOwner = snap.val();
      setControlOwner(newOwner);
      if (!newOwner && isSessionCreator) {
        claimControl(myId);
      }
    });
    return () => unsub();
  }, [roomId, isSessionCreator, myId, claimControl]);

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState([]);
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

  const onDeleteLast = async () => {
    if (!roomId) return;
    const snapshot = await get(ref(db, `sessions/${roomId}/drawings`));
    const all = snapshot.val() || {};
    const keys = Object.keys(all).filter(k => all[k].userId === myId);
    const lastKey = keys[keys.length - 1];
    if (lastKey) {
      await remove(ref(db, `sessions/${roomId}/drawings/${lastKey}`));
    }
  };

  useEffect(() => {
    rangy.init();
    highlightApplier.current = rangy.createClassApplier("highlight", { elementTagName: "span", normalize: true });
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const highlightsRef = ref(db, `sessions/${roomId}/highlights`);
    const unsubscribe = onValue(highlightsRef, (snapshot) => {
      const highlightsData = snapshot.val() || {};
      const highlightsArray = Object.values(highlightsData);
      setHighlights(highlightsArray);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    if (!mainContentRef.current || !highlightApplier.current) return;
    const allRanges = rangy.createRange(mainContentRef.current);
    highlightApplier.current.undoToRange(allRanges);
    highlights.forEach(h => {
      try {
        rangy.deserializeRange(h.serialized, mainContentRef.current);
      } catch (e) {
        console.error("Failed to apply highlight:", h, e);
      }
    });
  }, [highlights, lessons]);

  const handleHighlightText = useCallback(() => {
    const selection = rangy.getSelection();
    if (selection.isCollapsed) {
      alert("Please select some text to highlight.");
      return;
    }
    try {
      const serializedRange = rangy.serializeRange(selection.getRangeAt(0), true, mainContentRef.current);
      addTextHighlight({ serialized: serializedRange });
    } catch (e) {
      console.error("Could not serialize highlight:", e);
      alert("Sorry, this text cannot be highlighted.");
    }
    selection.removeAllRanges();
  }, [addTextHighlight]);

  const onClearAll = useCallback(async () => {
    if (window.confirm('Are you sure you want to clear ALL drawings for everyone?')) {
      if (!roomId) return;
      const drawingsRef = ref(db, `sessions/${roomId}/drawings`);
      await remove(drawingsRef);
    }
  }, [roomId]);

  const handleInviteUser = async (invitedUser) => {
    if (!user || !invitedUser || !courseData) return;
    try {
      const res = await apiClient.post(`/enrollments/share-invites/`, {
        enrollment: enrollmentId,
        invited_user: invitedUser.id,
      });
      const invite = res.data;
      const newRoomId = invite.token;
      const tokenLink = `${location.pathname}?shared_token=${newRoomId}`;
      navigate(tokenLink, { replace: true });
      await apiClient.post('/notifications/user-notifications/create-collab-invite/', {
        target_user_id: invitedUser.id,
        invite_url: tokenLink,
        course_title: courseData.title,
      });
      setRoomId(newRoomId);
      setOtherUserId(invitedUser.id);
      setIsCollabActive(true);
      setIsInviteModalOpen(false);
    } catch (err) {
      console.error("Could not create ShareInvite:", err);
      alert("Failed to invite user. Please try again.");
    }
  };

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light'), []);

  useEffect(() => {
    const identity = user?.id ?? user?.username;
    if (identity && !myId) setMyId(identity);
    if (otherUserId && !otherId) setOtherId(otherUserId);
  }, [user, otherUserId, myId, otherId]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    if (!enrollmentId || !token) {
      setError(!enrollmentId ? "Enrollment ID missing." : "Authentication required.");
      setLoading(false);
      if (!token) navigate('/login');
      return;
    }

    const sharedToken = new URLSearchParams(location.search).get("shared_token");
    if (sharedToken && !roomId) {
      setRoomId(sharedToken);
      setIsCollabActive(true);
    }

    const fetchCourseData = async () => {
      try {
        const tokenQuery = sharedToken ? `?shared_token=${sharedToken}` : "";
        const enrollmentRes = await apiClient.get(`/enrollments/${enrollmentId}${tokenQuery}`);
        if (!isMounted) return;

        const enrollment = enrollmentRes.data;
        const course = enrollment.course_snapshot || enrollment.course;
        if (!course) throw new Error("Course data not found.");
        setCourseData(course);

        const lessonsData = await Promise.all(
          (course.lessons || []).map(lsn =>
            apiClient.get(`/lessons/${lsn.permalink || lsn.id}/`)
              .then(res => ({ ...res.data.lesson, id: res.data.lesson.id || lsn.id }))
              .catch(() => ({ ...lsn, title: `${lsn.title} (Error)`, content: null, id: lsn.id }))
          )
        );

        lessonsData.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || String(a.id).localeCompare(String(b.id)));
        setLessons(lessonsData);

        const quizzesData = lessonsData.flatMap(lesson => lesson.quizzes || []);
        quizzesData.sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || String(a.id).localeCompare(String(b.id)));
        setQuizzes(quizzesData);

        const { data: completions } = await apiClient.get(`/enrollments/${enrollmentId}/completions/${tokenQuery}`);
        if (!isMounted) return;

        const tsMap = {};
        completions.forEach(c => tsMap[c.lesson.id] = c.completed_at);
        setCompletionTimestamps(tsMap);
        setCompletedLessons(new Set(Object.keys(tsMap).map(id => parseInt(id, 10))));
        
        if (lessonsData.length > 0 && !activeLessonId) {
            setActiveLessonId(lessonsData[0].id);
        }

        if (sharedToken && enrollment.share_invite) {
          const invite = enrollment.share_invite;
          const inviterId = invite.invited_by?.id || invite.invited_by;
          if (inviterId) setOtherUserId(inviterId);
        }
      } catch (err) {
        console.error("Error fetching course data:", err);
        if (!isMounted) return;
        if (err.response?.status === 404) setError("Enrollment or course not found.");
        else if ([401, 403].includes(err.response?.status)) {
          setError("Unauthorized. Please log in again.");
          logout();
        } else setError(`Failed to load course: ${err.message}`);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchCourseData();
    return () => { isMounted = false; };
  }, [enrollmentId, token, navigate, logout, location.search, roomId, activeLessonId]);

  useEffect(() => {
    if (lessons.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const intersectingEntry = entries.find(entry => entry.isIntersecting);
        if (intersectingEntry) {
          const lessonId = parseInt(intersectingEntry.target.id.split('-')[1], 10);
          setActiveLessonId(lessonId);
        }
      },
      {
        rootMargin: '-50% 0px -50% 0px',
        threshold: 0
      }
    );

    const lessonElements = document.querySelectorAll('section[id^="lesson-"]');
    lessonElements.forEach((el) => observer.observe(el));

    return () => lessonElements.forEach((el) => observer.unobserve(el));
  }, [lessons]);


  useEffect(() => {
    if (!searchTerm) {
      if (searchMatches.length > 0) {
        searchMatches.forEach(el => el.classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'));
        setSearchMatches([]);
        setCurrentMatchIndex(-1);
      }
      return;
    }
    const handler = setTimeout(() => {
      const contentArea = mainContentRef.current;
      if (contentArea) {
        document.querySelectorAll('.active-search-match').forEach(el => el.classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'));
        const matches = Array.from(contentArea.querySelectorAll('.search-match-highlight'));
        setSearchMatches(matches);
        const newIndex = matches.length > 0 ? 0 : -1;
        setCurrentMatchIndex(newIndex);
        if (newIndex !== -1) {
          matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
          matches[0].classList.add('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900');
        }
      }
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm, lessons, quizzes]);

  const handleMarkComplete = useCallback(async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    const lessonIdentifier = lesson?.permalink || lesson?.id;
    if (!lessonIdentifier || completedLessons.has(lessonId)) return;
    setCompletedLessons(prev => new Set(prev).add(lessonId));
    try {
      const res = await apiClient.post(`/lessons/${lessonIdentifier}/complete/`, {});
      if (res.status === 201 && res.data.completed_at) {
        setCompletionTimestamps(prev => ({ ...prev, [lessonId]: res.data.completed_at }));
      }
    } catch (err) {
      console.error("Error marking lesson complete:", err);
      setCompletedLessons(prev => {
        const newSet = new Set(prev);
        newSet.delete(lessonId);
        return newSet;
      });
      alert(`Failed to mark lesson complete: ${err.response?.data?.detail || err.message}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        setError("Session expired. Please log in again.");
        logout();
      }
    }
  }, [lessons, completedLessons, logout]);

  const handleNavigate = useCallback((targetId) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const navigateSearchResults = useCallback((direction) => {
    if (searchMatches.length === 0) return;
    let nextIndex = currentMatchIndex + direction;
    if (nextIndex >= searchMatches.length) nextIndex = 0;
    else if (nextIndex < 0) nextIndex = searchMatches.length - 1;

    if (currentMatchIndex >= 0 && searchMatches[currentMatchIndex]) {
      searchMatches[currentMatchIndex].classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900');
    }
    const nextMatchElement = searchMatches[nextIndex];
    if (nextMatchElement) {
      nextMatchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      nextMatchElement.classList.add('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900');
      setCurrentMatchIndex(nextIndex);
    }
  }, [searchMatches, currentMatchIndex]);

  const handleNextResult = useCallback(() => navigateSearchResults(1), [navigateSearchResults]);
  const handlePrevResult = useCallback(() => navigateSearchResults(-1), [navigateSearchResults]);

  const lessonsWithQuizzes = useMemo(() => {
    return lessons.map(lesson => ({
      ...lesson,
      associatedQuiz: quizzes.find(quiz => quiz.lesson === lesson.id),
    }));
  }, [lessons, quizzes]);

  // WebRTC useEffect remains unchanged...

  const allCustomCss = lessons.map(l => l.custom_css || '').filter(s => !!s).join('\n');
  const defaultAccent = lessons[0]?.accent_color || '#3498db';

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        Loading course content...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-gray-100 dark:bg-gray-900 p-4">
        <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
        <p className="text-red-600 dark:text-red-400 text-center mb-4">{error}</p>
        <button onClick={() => navigate(-1)} className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md">
          <ArrowLeft className="w-4 h-4 mr-2" /> Go Back
        </button>
      </div>
    );
  }

  if (!courseData) {
    return <div className="text-center p-8 text-gray-500 dark:text-gray-400">Course data could not be loaded.</div>;
  }

  return (
    <>
      <Helmet>
        <title>Study: {courseData.title || 'Course'} | Zporta Academy</title>
        <meta name="description" content={`Study materials for the course: ${courseData.title || 'Untitled Course'}`} />
        {allCustomCss && <style type="text/css">{allCustomCss}</style>}
        <style type="text/css">{`:root { --accent-color: ${defaultAccent}; }`}</style>
      </Helmet>

      <ScrollProgress />

      <CollaborationInviteModal isOpen={isInviteModalOpen} onClose={() => setIsInviteModalOpen(false)} onInviteUser={handleInviteUser} courseTitle={courseData?.title} enrollmentId={enrollmentId} />
      
      {/* The StudyNoteSection is moved here, outside of the transformed div, so it positions relative to the viewport. */}
      <StudyNoteSection enrollmentId={enrollmentId} />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 font-sans transition-colors duration-300">
        <div
          style={{ transform: `scale(${zoom})`, transformOrigin: 'top center', transition: 'transform 0.2s ease-out' }}
        >
          <div ref={mainContentRef} className={`${styles.lessonTemplate} relative mx-auto px-4 pt-8 pb-32`}>
            {isCollabActive && roomId && myId && (
              <>
                <DrawingOverlay
                  contentRef={mainContentRef} 
                  isDrawingMode={isDrawingMode}
                  onStroke={addDrawingStroke}
                  setCanvasRef={setDrawingCanvas}
                  strokes={allStrokes}
                  userColors={userColors}
                  onDeleteLast={onDeleteLast}
                  onClearAll={onClearAll}
                  onHighlightText={handleHighlightText}
                  tool={drawingTool}
                  setTool={setDrawingTool}
                  color={drawingColor}
                  setColor={setDrawingColor}
                  lineWidth={drawingLineWidth}
                  setLineWidth={setDrawingLineWidth}
                  onStopDrawing={() => setIsDrawingMode(false)}
                  zoom={zoom}
                  setZoom={setZoom}
                />
                <div className={styles.cursorOverlay}>
                  {peerCursors && Object.entries(peerCursors).map(([id, { x, y, name }]) => {
                    const contentEl = mainContentRef.current;
                    if (!contentEl) return null;
                    const absoluteX = x * contentEl.clientWidth;
                    const absoluteY = y * contentEl.clientHeight;
                    return (
                      <div key={id} className={styles.remoteCursor} style={{ left: `${absoluteX}px`, top: `${absoluteY}px` }}>
                        <Users size={20} style={{ color: userColors[id] || '#FFFFFF' }} />
                        <span className={styles.cursorName}>{name || '...'}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <header className="mb-8 flex flex-row justify-between items-start">
              <div className="flex-1">
                <button onClick={() => navigate('/my-learning')} className="mb-2 inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to My Learning
                </button>
                <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
                  {courseData.title}
                </h1>
                {courseData.description && (
                  <div className="mt-2 text-gray-600 dark:text-gray-400" dangerouslySetInnerHTML={{ __html: sanitizeHtml(courseData.description) }} />
                )}
              </div>
              <div className="flex-shrink-0 self-start mt-4 sm:mt-0 sm:ml-6">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
              </div>
            </header>

            <CollaborationZoneSection isCollabActive={isCollabActive} isTeacher={isTeacher} isDrawingMode={isDrawingMode} setIsDrawingMode={setIsDrawingMode} setIsInviteModalOpen={setIsInviteModalOpen} shareInvites={shareInvites} />
            <div className="my-8">
              <SearchBar searchTerm={searchTerm} onSearchChange={setSearchTerm} resultCount={searchMatches.length} currentResultIndex={currentMatchIndex} onNextResult={handleNextResult} onPrevResult={handlePrevResult} />
            </div>

            <main>
              {lessonsWithQuizzes.length === 0 && !searchTerm && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-6">
                  This course currently has no lessons or quizzes.
                </p>
              )}
              {lessonsWithQuizzes.map(lesson => (
                <LessonSection
                  key={lesson.id}
                  lesson={lesson}
                  associatedQuiz={lesson.associatedQuiz}
                  isCompleted={completedLessons.has(lesson.id)}
                  completedAt={completionTimestamps[lesson.id]}
                  onMarkComplete={handleMarkComplete}
                  onOpenQuiz={openQuizModal}
                  searchTerm={searchTerm}
                />
              ))}
            </main>
          </div>
        </div>
      </div>

        <FloatingIndexButton 
            onClick={() => setIsIndexModalOpen(true)}
            lessonCount={lessons.length}
            completedCount={completedLessons.size}
        />

        <LessonIndexModal 
            isOpen={isIndexModalOpen}
            onClose={() => setIsIndexModalOpen(false)}
            lessons={lessons} 
            quizzes={quizzes} 
            onNavigate={handleNavigate} 
            completedLessons={completedLessons} 
            completionTimestamps={completionTimestamps}
            activeLessonId={activeLessonId}
        />

      {isQuizModalOpen && modalQuiz && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[210]" onClick={closeQuizModal}>
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-xl w-full relative" onClick={e => e.stopPropagation()}>
            <button onClick={closeQuizModal} className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" aria-label="Close quiz">✕</button>
            <QuizCard quiz={modalQuiz} />
          </div>
        </div>
      )}

      <style>{`
        .highlight { background-color: rgba(255, 229, 0, 0.5); border-radius: 2px; }
        .search-match-highlight { transition: background-color 0.3s ease-in-out; border-radius: 3px; padding: 0.1em 0; margin: -0.1em 0; }
        .active-search-match { transition: background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out; box-shadow: 0 0 0 2px theme('colors.blue.500'); }
        .prose .active-search-match { position: relative; z-index: 1; }
        .prose :where(mark):not(:where([class~="not-prose"] *)) { background-color: transparent; color: inherit; padding: 0; border-radius: 0; }
        .aspect-w-16.aspect-h-9 iframe { border-radius: 0.375rem; }
      `}</style>
    </>
  );
}

export default EnrolledCourseStudyPage;
