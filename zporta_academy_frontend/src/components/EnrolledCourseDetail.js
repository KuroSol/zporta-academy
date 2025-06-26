import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext'; // Adjust path if needed
import apiClient from '../api'; // Adjust path if needed
import { Helmet } from 'react-helmet';
import {
 CheckCircle, ChevronDown, ChevronUp, Search, Sun, Moon, List, ArrowLeft, Loader2, AlertTriangle, Video, FileText, Download, X, HelpCircle, ArrowUp, ArrowDown,Users, Share2, Pencil, UserPlus
} from 'lucide-react';
import QuizCard from './QuizCard';
import styles from './EnrolledCourseDetail.module.css';
import CollaborationInviteModal from './CollaborationInviteModal';

// ── Collaboration imports ───────────────────────────────
import { useCollabCursor } from '../hooks/useCollabCursor';
import { useCollaboration } from '../hooks/useCollaboration';
import DrawingOverlay from './DrawingOverlay';
import CollaborationZoneSection from './CollaborationZoneSection';
import { ref, onValue, get, remove } from 'firebase/database';
// ────────────────────────────────────────────────────────

// --- Firebase and WebRTC Integration ───────────────────────
import { subscribeTo, writeTo, db } from '../firebase';

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
   return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>');
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
         className="prose prose-sm dark:prose-invert max-w-none text-gray-600 dark:text-gray-400 mb-3"
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
 const [isExpanded, setIsExpanded] = useState(!isCompleted);
 const contentRef = useRef(null);

 const toggleExpand = useCallback(() => {
   setIsExpanded(prev => !prev);
 }, []);

 useEffect(() => {
   if (isCompleted && isExpanded && !lesson.userManuallyExpanded) {
   }
 }, [isCompleted, isExpanded, lesson.userManuallyExpanded]);

   const highlightSearchTerm = useCallback((text) => {
   if (!searchTerm || !text) return text;
   const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
   return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>');
 }, [searchTerm]);

 const sanitizedContent = useMemo(() => sanitizeHtml(lesson.content), [lesson.content]);
 const highlightedContent = useMemo(() => highlightSearchTerm(sanitizedContent), [sanitizedContent, searchTerm, highlightSearchTerm]);
 const highlightedTitle = useMemo(() => highlightSearchTerm(lesson.title || 'Untitled Lesson'), [lesson.title, searchTerm, highlightSearchTerm]);
 const embedUrl = useMemo(() => getYoutubeEmbedUrl(lesson.video_url), [lesson.video_url]);

 return (
   <section
     id={`lesson-${lesson.id}`}
     className="mb-6 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out"
     aria-labelledby={`lesson-title-${lesson.id}`}
   >
     <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={toggleExpand}>
       <h3
         id={`lesson-title-${lesson.id}`}
         className="lesson-title flex items-center mr-2 text-[clamp(0.875rem,6vw,1.5rem)] word-break-[keep-all] overflow-wrap-normal whitespace-nowrap font-semibold text-gray-800 dark:text-gray-100"
       >
         {lesson.content_type === 'video' && <Video className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />}
         {lesson.content_type === 'text' && <FileText className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" />}
           <span className="flex-grow" dangerouslySetInnerHTML={{ __html: highlightedTitle }} />
       </h3>
       <div className="flex items-center space-x-3 flex-shrink-0">
         {isCompleted && (
           <div className="flex flex-col items-start space-y-1">
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
         <button
           aria-label={isExpanded ? "Collapse lesson" : "Expand lesson"}
           className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
         >
           {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
         </button>
       </div>
     </div>

     <div
       ref={contentRef}
       className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-100' : 'max-h-0 opacity-0'}`}
       style={{ maxHeight: isExpanded ? `${(contentRef.current?.scrollHeight ?? 0) + 250}px` : '0px' }}
     >
       <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
         {lesson.content_type === 'video' && embedUrl && (
           <div className="aspect-w-16 aspect-h-9 mb-4 rounded overflow-hidden bg-black shadow-inner">
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
             <p className="text-sm text-red-600 dark:text-red-400 mb-4">Could not embed video. Link: <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="underline">{lesson.video_url}</a></p>
           )}

         {lesson.content_type === 'text' && lesson.content && (
         <div
             className="content-text prose dark:prose-invert max-w-none break-words whitespace-normal mb-4"
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
     </div>
   </section>
 );
});

const FloatingNav = ({ lessons, quizzes, onNavigate }) => {
 const [isOpen, setIsOpen] = useState(false);

 const handleNavClick = (id, type) => {
   onNavigate(`${type}-${id}`);
   setIsOpen(false);
 };

 return (
   <div className="fixed bottom-16 right-2 md:bottom-16 md:right-16 z-[100]">
     
     <button
       onClick={() => setIsOpen(!isOpen)}
       className={`p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out text-white ${
         isOpen
           ? 'bg-red-600 hover:bg-red-700 rotate-45'
           : 'bg-blue-600 hover:bg-blue-700'
       }`}
       style={{ opacity: 0.80 }}
       aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
       aria-expanded={isOpen}
       aria-controls="floating-nav-menu"
     >
       {isOpen ? <X size={24} /> : <List size={24} />}
     </button>


     {isOpen && (
       <div
           id="floating-nav-menu"
           role="menu"
           className="absolute bottom-16 right-0 w-64 max-h-80 overflow-y-auto 
                     bg-gray-100 dark:bg-gray-800 
                     rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-3 space-y-1"
       >
         <h4 className="text-sm font-semibold text-gray-500 dark:text-gray-400 px-2 pb-1 border-b border-gray-200 dark:border-gray-700">Navigation</h4>
         {lessons.length > 0 && (
           <>
             <p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 pt-1">Lessons</p>
             {lessons.map(lesson => (
               <button
                 key={`nav-lesson-${lesson.id}`}
                 onClick={() => handleNavClick(lesson.id, 'lesson')}
                 role="menuitem"
                 className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md truncate"
               >
                 {lesson.content_type === 'video' && <Video className="w-4 h-4 mr-1.5 inline-block text-blue-500 flex-shrink-0" />}
                 {lesson.content_type === 'text' && <FileText className="w-4 h-4 mr-1.5 inline-block text-green-500 flex-shrink-0" />}
                 {lesson.title || 'Untitled Lesson'}
               </button>
             ))}
           </>
         )}

         {quizzes.length > 0 && (
           <>
             <p className="text-xs font-medium text-gray-400 dark:text-gray-500 px-2 pt-2">Quizzes</p>
             {quizzes.map(quiz => (
               <button
                 key={`nav-quiz-${quiz.id}`}
                 onClick={() => handleNavClick(quiz.id, 'quiz')}
                 role="menuitem"
                 className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md truncate"
               >
                 <HelpCircle className="w-4 h-4 mr-1.5 inline-block text-purple-500 flex-shrink-0" />
                 {quiz.title || 'Untitled Quiz'}
               </button>
             ))}
           </>
         )}
           {(lessons.length === 0 && quizzes.length === 0) && (
             <p className="text-xs text-gray-400 px-2 italic py-2">No content to navigate.</p>
           )}
       </div>
     )}
   </div>
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

useEffect(() => {
  if (!enrollmentId) return;

  apiClient
    .get('/enrollments/share-invites/', { params: { enrollment: enrollmentId } })
    .then(res => {
      // DRF may paginate under `results`
      setShareInvites(res.data.results || res.data);
    })
    .catch(err => {
      console.error('Failed to load share invites:', err);
    });
}, [enrollmentId]);



// ─── track all strokes from Firebase ─────────────────────────────────
 const [allStrokes, setAllStrokes] = useState([]);
 useEffect(() => {
   const drawingsRef = ref(db, `sessions/${roomId}/drawings`);
   const unsubscribe = onValue(drawingsRef, snap => {
     const val = snap.val() || {};
     // turn { key: {…} } into [ { id:key, …stroke } ]
     const arr = Object.entries(val).map(([id, s]) => ({ id, ...s }));
     setAllStrokes(arr);
   });
   return () => unsubscribe();
 }, [roomId]);

 // ─── assign each user a stable color ────────────────────────────────
 const COLORS = ['#e6194b','#3cb44b','#ffe119','#4363d8','#f58231','#911eb4'];
 const userColors = useMemo(() => {
   const ids = Array.from(new Set([myId, ...allStrokes.map(s => s.userId)]));
   return ids.reduce((map, id, i) => {
     map[id] = COLORS[i % COLORS.length];
     return map;
   }, {});
 }, [myId, allStrokes]);

 
 // --- State ---
 const [courseData, setCourseData] = useState(null);
 const [lessons, setLessons] = useState([]);
 const [quizzes, setQuizzes] = useState([]);
 const [completedLessons, setCompletedLessons] = useState(new Set());
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState("");

 // --- REVISED COLLABORATION STATE ---

 const [otherId, setOtherId] = useState(null);
 const [otherUserId, setOtherUserId] = useState(null); // Raw user ID of the other person
 const [isCollabActive, setIsCollabActive] = useState(false);
 const [isDrawingMode, setIsDrawingMode] = useState(false); // This line is already here
 const [allowTeacherScroll, setAllowTeacherScroll] = useState(true); // Simplified for peer-to-peer
 const isTeacher = false; // Simplified for peer-to-peer

// === ADD THESE LINES HERE ===
 const [drawingTool, setDrawingTool] = useState('pen');
 const [drawingColor, setDrawingColor] = useState('#FFC107');
 const [drawingLineWidth, setDrawingLineWidth] = useState(4);
// =============================

 // --- FIXED: Call hooks at the top level ---
 const {
   addDrawingStroke,
   setDrawingCanvas,
   peerCursors,
   updateCursor,    // ← grab this too!
 } = useCollaboration(roomId, myId, user?.username);
 useCollabCursor(roomId, myId, otherId, allowTeacherScroll);


 const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

 // Search State
 const [searchTerm, setSearchTerm] = useState("");
 const [searchMatches, setSearchMatches] = useState([]);
 const [currentMatchIndex, setCurrentMatchIndex] = useState(-1);

 const mainContentRef = useRef(null);

 const onDeleteLast = async () => {
  // 1) read children at `sessions/${roomId}/drawings`
  const snapshot = await get(ref(db, `sessions/${roomId}/drawings`));
  const all = snapshot.val() || {};
  // 2) filter by your userId
  const keys = Object.keys(all).filter(k => all[k].userId === myId);
  const lastKey = keys[keys.length - 1];
  if (lastKey) {
    await remove(ref(db, `sessions/${roomId}/drawings/${lastKey}`));
  }
};

 const handleHighlightText = useCallback(() => {
    // Set a special tool mode to disable canvas drawing.
    setDrawingTool('text');
    const selection = window.getSelection();

    // Check if the user has selected any text.
    if (selection && !selection.isCollapsed) {
        // Create a span to wrap the selection.
        const span = document.createElement('span');
        // Apply the NEW CSS class from your module file.
        span.className = styles.markerHighlight; 
        try {
            // Get the selected text range and wrap it with our new span
            const range = selection.getRangeAt(0);
            range.surroundContents(span);
        } catch (e) {
            console.error("Highlight failed: ", e);
            // This can happen if the selection crosses complex HTML boundaries.
            alert("This text can't be highlighted automatically. Try highlighting smaller sections.");
        }
        // Clear the browser's text selection so the user can see the result.
        selection.removeAllRanges();
    } else {
        alert("To highlight text, first select it with your mouse, then click the 'T' button again.");
    }
 }, []);

// === ADD THIS ENTIRE FUNCTION HERE ===
const onClearAll = useCallback(async () => {
  if (window.confirm('Are you sure you want to clear ALL drawings for everyone?')) {
      if (!roomId) return;
      const drawingsRef = ref(db, `sessions/${roomId}/drawings`);
      await remove(drawingsRef);
  }
}, [roomId]);
// =====================================

const handleInviteUser = async (invitedUser) => {
 if (!user || !invitedUser || !courseData) return;

 try {
   const res = await apiClient.post(`/enrollments/share-invites/`, {
     enrollment: enrollmentId,
     invited_user: invitedUser.id,
   });

   const invite = res.data;
   const newRoomId = invite.token;

   // Immediately update the URL for the inviter, so reloads work.

const tokenLink = `${location.pathname}?shared_token=${newRoomId}`;
navigate(tokenLink, { replace: true });

   await apiClient.post('/notifications/user-notifications/create-collab-invite/', {
     target_user_id: invitedUser.id,
     invite_url: tokenLink,
     course_title: courseData.title,
   });
   
   console.log(`[COLLAB] Invite sent. Activating session for inviter. Room: ${newRoomId}, Other User: ${invitedUser.id}`);
   setRoomId(newRoomId);
   setOtherUserId(invitedUser.id);
   setIsCollabActive(true);
   
   setIsInviteModalOpen(false);
 } catch (err) {
   console.error("Could not create ShareInvite:", err);
   alert("Failed to invite user. Please try again.");
 }
};

  // --- Theme Management ---
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  }, []);

// Setup myId and otherId
useEffect(() => {
  // Dump the full user so you can see what fields you have
  console.log('[COLLAB_ID] user object is:', user);

  // Try user.id first; if that's null, use user.username
  const identity = user?.id ?? user?.username;
  console.log('[COLLAB_ID] resolved identity →', identity);

  if (identity && !myId) {
    console.log(`[COLLAB_ID] Setting myId: ${identity}`);
    setMyId(identity);
  }
  if (otherUserId && !otherId) {
    console.log(`[COLLAB_ID] Setting otherId from otherUserId: ${otherUserId}`);
    setOtherId(otherUserId);
  }
}, [user, otherUserId, myId, otherId]);

// Main data fetching and session activation logic
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

  // If a shared token is in the URL, this user is the invitee.
  if (sharedToken && !roomId) {
      console.log(`[COLLAB] Shared token found. Setting up session for invitee. Room: ${sharedToken}`);
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

      const sortFn = (a, b) => (a.order ?? Infinity) - (b.order ?? Infinity) || String(a.id).localeCompare(String(b.id));
      lessonsData.sort(sortFn);
      setLessons(lessonsData);

      const quizzesData = lessonsData.flatMap(lesson => lesson.quizzes || []);
      quizzesData.sort(sortFn);
      setQuizzes(quizzesData);

      const { data: completions } = await apiClient.get(`/enrollments/${enrollmentId}/completions/${tokenQuery}`);
      if (!isMounted) return;

      const tsMap = {};
      completions.forEach(c => tsMap[c.lesson.id] = c.completed_at);
      setCompletionTimestamps(tsMap);
      setCompletedLessons(new Set(Object.keys(tsMap).map(id => parseInt(id, 10))));

      // If this user is an invitee, find out who invited them.
      if (sharedToken && enrollment.share_invite) {
        const invite = enrollment.share_invite;
        const inviterId = invite.invited_by?.id || invite.invited_by;
        if (inviterId) {
            console.log(`[COLLAB] Inviter identified: ${inviterId}. Setting as otherUserId.`);
            setOtherUserId(inviterId);
        } else {
            console.warn('[COLLAB] Could not identify inviter from API response.', invite);
        }
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
}, [enrollmentId, token, navigate, logout, location.search]); // location.search is critical

  // --- Search Logic ---
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
        if (mainContentRef.current) {
          document.querySelectorAll('.active-search-match').forEach(el => el.classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'));
          const matches = Array.from(mainContentRef.current.querySelectorAll('.search-match-highlight'));
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


  // --- Event Handlers ---

  const handleMarkComplete = useCallback(async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    const lessonIdentifier = lesson?.permalink || lesson?.id;
    if (!lessonIdentifier || completedLessons.has(lessonId)) return;

    setCompletedLessons(prev => new Set(prev).add(lessonId));

    try {
      const res = await apiClient.post(
        `/lessons/${lessonIdentifier}/complete/`, 
        {}
      );
      if (res.status === 201 && res.data.completed_at) {
        setCompletionTimestamps(prev => ({
          ...prev,
          [lessonId]: res.data.completed_at
        }));
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
      element.classList.add('transition-all', 'duration-1000', 'ring-2', 'ring-offset-2', 'ring-indigo-500', 'dark:ring-offset-gray-900');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-500', 'dark:ring-offset-gray-900');
      }, 1500);

        if (targetId.startsWith('lesson-')) {
            const lessonComp = element;
            const contentDiv = lessonComp.querySelector(':scope > div[style*="max-height: 0px"]');
             if (contentDiv) {
                const header = lessonComp.querySelector(':scope > div:first-child');
                header?.click();
             }
        }
       else if (targetId.startsWith('quiz-')) {
           const quizComp = element;
           const lessonComp = quizComp.closest('section[id^="lesson-"]');
           if (lessonComp) {
               const contentDiv = lessonComp.querySelector(':scope > div[style*="max-height: 0px"]');
               if (contentDiv) {
                  const header = lessonComp.querySelector(':scope > div:first-child');
                  header?.click();
               }
           }
       }
    }
  }, []);

  const navigateSearchResults = useCallback((direction) => {
      if (searchMatches.length === 0) return;
      let nextIndex = currentMatchIndex + direction;
       if (nextIndex >= searchMatches.length) {
           nextIndex = 0;
       } else if (nextIndex < 0) {
           nextIndex = searchMatches.length - 1;
       }

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

    const lessonsToDisplay = lessons;

    const lessonsWithQuizzes = useMemo(() => {
        return lessonsToDisplay.map(lesson => {
            const associatedQuiz = quizzes.find(quiz => quiz.lesson === lesson.id);
            return {
                ...lesson,
                associatedQuiz: associatedQuiz
            };
        });
    }, [lessonsToDisplay, quizzes]);


  // --- WebRTC Screen-Sharing (Original Logic Preserved) ---
  useEffect(() => {
    const setupWebRTC = async () => {
      try {
        if (!roomId) {
            console.log("WebRTC setup skipped: No room ID.");
            return;
        }

        const localStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
        const peerConnection = new RTCPeerConnection();

        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

        peerConnection.onicecandidate = event => {
            if (event.candidate) {
                console.log('New ICE candidate:', event.candidate);
                writeTo(`sessions/${roomId}/iceCandidates`, event.candidate.toJSON());
            }
        };
        
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        console.log('SDP Offer created:', offer);
        writeTo(`sessions/${roomId}/offer`, { sdp: offer.sdp, type: offer.type });

        subscribeTo(`sessions/${roomId}/answer`, answer => {
            if (answer && !peerConnection.currentRemoteDescription) {
                console.log('Received SDP answer:', answer);
                const remoteDesc = new RTCSessionDescription(answer);
                peerConnection.setRemoteDescription(remoteDesc).catch(e => console.error("Error setting remote description:", e));
            }
        });
        
        subscribeTo(`sessions/${roomId}/remoteIceCandidates`, candidate => {
            if (candidate) {
                console.log('Received remote ICE candidate:', candidate);
                peerConnection.addIceCandidate(new RTCIceCandidate(candidate)).catch(e => console.error("Error adding received ice candidate", e));
            }
        });

      } catch (err) {
        console.error("Error setting up WebRTC screen-sharing:", err);
      }
    };

    if (roomId) {
        console.log("WebRTC logic is available and can be triggered.");
    }

  }, [roomId]);


  // --- Render ---
const allCustomCss = lessons
 .map(l => l.custom_css || '')
 .filter(s => !!s)
 .join('\n');

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
        <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md"
        >
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
      <meta
        name="description"
        content={`Study materials for the course: ${courseData.title || 'Untitled Course'}`}
      />
      {allCustomCss && (
        <style type="text/css">{allCustomCss}</style>
      )}
      <style type="text/css">{`
        :root { --accent-color: ${defaultAccent}; }
      `}</style>
</Helmet>

<ScrollProgress />

<CollaborationInviteModal
  isOpen={isInviteModalOpen}
  onClose={() => setIsInviteModalOpen(false)}
  onInviteUser={handleInviteUser}
  courseTitle={courseData?.title}
  enrollmentId={enrollmentId}
/>

{isCollabActive && roomId && myId && (
  <div
    className={styles.collabContainer}
    onMouseMove={e => updateCursor(e.clientX, e.clientY)}
  >
    <DrawingOverlay
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
    />

    {peerCursors && Object.keys(peerCursors).length > 0 && (
      <div className={styles.cursorOverlay}>
        {Object.entries(peerCursors).map(([id, { x, y, name }]) => (
          <div
            key={id}
            className={styles.remoteCursor}
            style={{ left: `${x}px`, top: `${y}px` }}
          >
            <Users size={20} style={{ color: userColors[id] }} />
            <span className={styles.cursorName}>{name || id}</span>
          </div>
        ))}
      </div>
    )}
  </div>
)}

<div className={styles.lessonTemplate}>

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
        <div className="w-full mx-auto px-4 pt-8 pb-32 max-w-full md:max-w-4xl">

          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start">
              <div className="mb-4 sm:mb-0">
                <button
                    onClick={() => navigate('/my-learning')}
                    className="mb-2 inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <ArrowLeft className="w-4 h-4 mr-1" /> Back to My Learning
                </button>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100">{courseData.title}</h1>
                {courseData.description && (
                  <div className="mt-2 text-gray-600 dark:text-gray-400 prose dark:prose-invert max-w-none break-words whitespace-normal" dangerouslySetInnerHTML={{ __html: sanitizeHtml(courseData.description)}}></div>
                )}
              </div>
              <div className="flex-shrink-0 self-start sm:self-center">
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
              </div>
          </header>

  <CollaborationZoneSection
  isCollabActive={isCollabActive}
  isTeacher={isTeacher}
  isDrawingMode={isDrawingMode}
  setIsDrawingMode={setIsDrawingMode}
  setIsInviteModalOpen={setIsInviteModalOpen}
  shareInvites={shareInvites}  
/>

          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            resultCount={searchMatches.length}
            currentResultIndex={currentMatchIndex}
            onNextResult={handleNextResult}
            onPrevResult={handlePrevResult}
          />

          <main ref={mainContentRef}>
            {lessonsWithQuizzes.length === 0 && !searchTerm && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-6">This course currently has no lessons or quizzes.</p>
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

        <FloatingNav lessons={lessons} quizzes={quizzes} onNavigate={handleNavigate} />
      </div>
      </div>
        {isQuizModalOpen && modalQuiz && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50"
            onClick={closeQuizModal}
          >
            <div
              className="bg-white dark:bg-gray-800 p-6 rounded-lg max-w-xl w-full relative"
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={closeQuizModal}
                className="absolute top-2 right-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                aria-label="Close quiz"
              >
                ✕
              </button>
              <QuizCard quiz={modalQuiz} />
            </div>
          </div>
        )}
      <style>{`
        .search-match-highlight {
          transition: background-color 0.3s ease-in-out;
          border-radius: 3px;
          padding: 0.1em 0;
          margin: -0.1em 0;
        }
        .active-search-match {
          transition: background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
          box-shadow: 0 0 0 2px theme('colors.blue.500');
        }
        .prose .active-search-match {
            position: relative;
            z-index: 1;
        }
        .prose :where(mark):not(:where([class~="not-prose"] *)) {
            background-color: transparent;
            color: inherit;
            padding: 0;
            border-radius: 0;
        }
        .aspect-w-16.aspect-h-9 iframe {
            border-radius: 0.375rem;
        }
       `}</style>
    </>
  );
};

export default EnrolledCourseStudyPage;
