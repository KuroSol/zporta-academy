import React, { useEffect, useState, useContext, useRef, useMemo, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom'; // Assuming Link might be needed for quizzes later
import { AuthContext } from '../context/AuthContext'; // Adjust path if needed
import apiClient from '../api'; // Adjust path if needed
import { Helmet } from 'react-helmet';
import {
  CheckCircle, ChevronDown, ChevronUp, Search, Sun, Moon, List, ArrowLeft, Loader2, AlertTriangle, Video, FileText, Download, X, HelpCircle, ArrowUp, ArrowDown
} from 'lucide-react'; // Added HelpCircle, ArrowUp, ArrowDown
import QuizCard from './QuizCard';
import styles from './EnrolledCourseDetail.module.css';
// --- Helper Functions ---

// Basic HTML Sanitization
const sanitizeHtml = (htmlString) => {
  if (!htmlString) return "";
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, "text/html");
    doc.querySelectorAll('script, [onload], [onerror], [onclick], [onmouseover], [onfocus], [onblur]').forEach(el => el.remove());
    doc.querySelectorAll('[contenteditable="true"]').forEach(el => el.removeAttribute('contenteditable'));
    // Add more sanitization rules if needed
    return doc.body.innerHTML;
  } catch (error) {
    console.error("Error sanitizing HTML:", error);
    return htmlString; // Fallback
  }
};

// Extracts plain text from HTML
const extractTextFromHtml = (htmlString) => {
  if (!htmlString) return '';
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.textContent || "";
  } catch (error) {
    console.error("Error extracting text from HTML:", error);
    return '';
  }
};

// Converts YouTube URLs to embed URLs (Keep your existing logic)
const getYoutubeEmbedUrl = (url) => {
    if (!url) return null;
    let videoId = null;
    try {
        // Basic check if it's already an embed URL
        if (url.includes('/embed/')) {
            const parts = url.split('/embed/');
            videoId = parts[1]?.split('?')[0]?.split('&')[0];
        } else {
            const parsedUrl = new URL(url);
            // Handle standard youtube.com links
            if ((parsedUrl.hostname === 'www.youtube.com' || parsedUrl.hostname === 'youtube.com') && parsedUrl.searchParams.has('v')) {
                videoId = parsedUrl.searchParams.get('v');
            }
            // Handle youtu.be links
            else if (parsedUrl.hostname === 'youtu.be') {
                videoId = parsedUrl.pathname.slice(1);
            }
            // Handle youtube.com/shorts/ links
            else if (parsedUrl.hostname === 'www.youtube.com' && parsedUrl.pathname.startsWith('/shorts/')) {
                 videoId = parsedUrl.pathname.substring('/shorts/'.length);
            }
             // Handle googleusercontent proxy links (adjust domains if necessary)
            else if ((parsedUrl.hostname.endsWith('googleusercontent.com')) && parsedUrl.searchParams.has('v')) {
                 videoId = parsedUrl.searchParams.get('v');
            } else if ((parsedUrl.hostname.endsWith('googleusercontent.com')) && parsedUrl.pathname.startsWith('/embed/')) {
                 videoId = parsedUrl.pathname.substring('/embed/'.length);
            } else if (parsedUrl.hostname.endsWith('googleusercontent.com') && parsedUrl.pathname.length > 1) {
                 // Assuming path is like /VIDEO_ID for some proxy cases
                 videoId = parsedUrl.pathname.slice(1);
            }
        }

        // Clean up potential extra parameters in videoId
        if (videoId && videoId.includes('&')) videoId = videoId.split('&')[0];
        if (videoId && videoId.includes('?')) videoId = videoId.split('?')[0];

    } catch (e) {
        console.error("Error parsing video URL:", e, "URL:", url);
        return null;
    }
    // Ensure videoId looks like a valid YouTube ID (basic check)
    // Allow IDs that might be slightly longer or shorter too, as YouTube might change formats
    return videoId && /^[a-zA-Z0-9_-]{10,12}$/.test(videoId) ? `https://www.youtube.com/embed/${videoId}` : null;
};


// --- Child Components ---

// Represents a single quiz section (simplified for this view)
const QuizSection = React.memo(({ quiz, searchTerm, onOpenQuiz }) => {
  // Highlight search term function specific to this component
  const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    // Escape special characters in search term for regex
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    // Use the search-match-highlight class for consistency with lesson search
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>');
  }, [searchTerm]);

  const sanitizedDescription = useMemo(() => sanitizeHtml(quiz.description), [quiz.description]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(quiz.title || 'Untitled Quiz'), [quiz.title, searchTerm, highlightSearchTerm]);
  const highlightedDescription = useMemo(() => highlightSearchTerm(sanitizedDescription), [sanitizedDescription, searchTerm, highlightSearchTerm]);

  // Determine the link target for the quiz
  // Prioritize permalink, fall back to ID. Adjust the path as needed.
  const quizLink = quiz.permalink ? `/quizzes/take/${quiz.permalink}` : (quiz.id ? `/quizzes/take/${quiz.id}` : null);

  return (
    <section
      id={`quiz-${quiz.id}`} // ID for navigation/linking
      className="mt-4 pt-4 border-t border-dashed border-gray-300 dark:border-gray-600" // Added top border
      aria-labelledby={`quiz-title-${quiz.id}`}
    >
      <h4 id={`quiz-title-${quiz.id}`} className="text-lg font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center">
        <HelpCircle className="w-5 h-5 mr-2 text-purple-500" /> {/* Quiz Icon */}
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


// Represents a single lesson section, potentially including a quiz
const LessonSection = React.memo(({ lesson, associatedQuiz, isCompleted, completedAt, onMarkComplete, onOpenQuiz, searchTerm }) => {
  const [isExpanded, setIsExpanded] = useState(!isCompleted); // Start expanded unless already complete
  const contentRef = useRef(null);

  // Toggle expansion state
  const toggleExpand = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  // Effect to collapse when marked complete externally
  useEffect(() => {
    // This effect might cause unexpected behavior if the user manually expands/collapses
    // Consider if automatic collapse/expand on completion change is truly desired.
    // If so, the simpler `setIsExpanded(!isCompleted)` might be sufficient,
    // but be aware it overrides manual interaction.
    // Current logic prevents automatic collapse if user manually expanded a completed lesson.
    if (isCompleted && isExpanded && !lesson.userManuallyExpanded) {
        // setIsExpanded(false); // Optional: Collapse if marked complete externally
    }
    // Reset manual flag if needed
    // if (!isExpanded) lesson.userManuallyExpanded = false;
  }, [isCompleted, isExpanded, lesson.userManuallyExpanded]); // Add dependencies if using flags

  // Highlight search term (add specific class for search navigation)
   const highlightSearchTerm = useCallback((text) => {
    if (!searchTerm || !text) return text;
    // Escape special characters in search term for regex
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedSearchTerm})`, 'gi');
    // Add the class 'search-match-highlight' to the mark tag
    return text.replace(regex, '<mark class="bg-yellow-200 dark:bg-yellow-600 search-match-highlight">$1</mark>');
  }, [searchTerm]);


  const sanitizedContent = useMemo(() => sanitizeHtml(lesson.content), [lesson.content]);
  const highlightedContent = useMemo(() => highlightSearchTerm(sanitizedContent), [sanitizedContent, searchTerm, highlightSearchTerm]);
  const highlightedTitle = useMemo(() => highlightSearchTerm(lesson.title || 'Untitled Lesson'), [lesson.title, searchTerm, highlightSearchTerm]);
  const embedUrl = useMemo(() => getYoutubeEmbedUrl(lesson.video_url), [lesson.video_url]);

  return (
    <section
      id={`lesson-${lesson.id}`} // ID for navigation
      className="mb-6 p-4 md:p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 transition-all duration-300 ease-in-out"
      aria-labelledby={`lesson-title-${lesson.id}`}
    >
      {/* Lesson Header */}
      <div className="flex justify-between items-center mb-4 cursor-pointer" onClick={toggleExpand}>
        <h3
          id={`lesson-title-${lesson.id}`}
          className="
            lesson-title flex items-center mr-2

            /* 1) clamp font size: min 0.875rem, scales up to 1.5rem at large screens */
            text-[clamp(0.875rem,6vw,1.5rem)]

            /* 2) never break inside a CJK “word” */
            word-break-[keep-all]
            overflow-wrap-normal

            /* 3) only wrap at real whitespace if absolutely needed */
            whitespace-nowrap

            font-semibold text-gray-800 dark:text-gray-100
          "
        > {/* Added margin right */}
          {lesson.content_type === 'video' && <Video className="w-5 h-5 mr-2 text-blue-500 flex-shrink-0" />}
          {lesson.content_type === 'text' && <FileText className="w-5 h-5 mr-2 text-green-500 flex-shrink-0" />}
          {/* Render highlighted title */}
              <span className="flex-grow" dangerouslySetInnerHTML={{ __html: highlightedTitle }} /> {/* Allow title to grow */}
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

      {/* Collapsible Content Area */}
      <div
        ref={contentRef}
        className={`overflow-hidden transition-all duration-500 ease-in-out ${isExpanded ? 'opacity-100' : 'max-h-0 opacity-0'}`}
        style={{ maxHeight: isExpanded ? `${(contentRef.current?.scrollHeight ?? 0) + 250}px` : '0px' }} // Increased buffer slightly
      >
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          {/* Video Content */}
          {lesson.content_type === 'video' && embedUrl && (
            <div className="aspect-w-16 aspect-h-9 mb-4 rounded overflow-hidden bg-black shadow-inner"> {/* Added shadow */}
              <iframe
                src={embedUrl}
                title={`${lesson.title || 'Lesson'} Video`}
                className="w-full h-full"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" // Added web-share
                allowFullScreen
                loading="lazy" // Add lazy loading
              ></iframe>
            </div>
          )}
           {lesson.content_type === 'video' && !embedUrl && lesson.video_url && (
             <p className="text-sm text-red-600 dark:text-red-400 mb-4">Could not embed video. Link: <a href={lesson.video_url} target="_blank" rel="noopener noreferrer" className="underline">{lesson.video_url}</a></p>
           )}

          {/* Text Content */}
          {lesson.content_type === 'text' && lesson.content && (
          <div
              className="content-text prose dark:prose-invert max-w-none break-words whitespace-normal mb-4"
              dangerouslySetInnerHTML={{ __html: highlightedContent }}
          />
          )}
          {lesson.content_type === 'text' && !lesson.content && (
             <p className="text-sm text-gray-500 dark:text-gray-400 italic mb-4">This text lesson has no content.</p>
          )}

          {/* Downloadable File */}
          {lesson.file_url && (
            <div className="mt-4 mb-4"> {/* Added margin bottom */}
              <a
                href={lesson.file_url}
                target="_blank"
                rel="noopener noreferrer"
                download={lesson.file_name || true}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition duration-150 ease-in-out shadow-sm hover:shadow-md" // Added shadow
              >
                <Download className="w-4 h-4 mr-2" />
                Download File {lesson.file_name ? `(${lesson.file_name})` : ''}
              </a>
            </div>
          )}

          {/* Associated Quiz Section */}
          {associatedQuiz && (
             <QuizSection
              quiz={associatedQuiz}
              searchTerm={searchTerm}
              onOpenQuiz={onOpenQuiz}
            />

          )}

          {/* Mark Complete Button */}
          {!isCompleted && (
            <div className="mt-6 text-right">
              <button
                onClick={() => onMarkComplete(lesson.id)}
                className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-md transition duration-150 ease-in-out shadow-sm hover:shadow-md" // Added shadow
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

// Floating Navigation Menu
const FloatingNav = ({ lessons, quizzes, onNavigate }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavClick = (id, type) => {
    onNavigate(`${type}-${id}`);
    setIsOpen(false); // Close menu after navigation
  };

  return (
    // Adjusted positioning: Mobile: bottom-20 right-5; MD+: bottom-16 right-16
    <div className="fixed bottom-16 right-2 md:bottom-16 md:right-16 z-[100]">
      
      {/* Menu Toggle Button - Opaque red background for both states */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-3 rounded-full shadow-lg transition-all duration-300 ease-in-out text-white ${
          isOpen
            ? 'bg-red-600 hover:bg-red-700 rotate-45'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
        style={{ opacity: 0.80 }}   // <-- plain numeric opacity
        aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
        aria-expanded={isOpen}
        aria-controls="floating-nav-menu"
      >
        {isOpen ? <X size={24} /> : <List size={24} />}
      </button>


      {/* Navigation List - Menu content background changed */}
      {isOpen && (
        <div
            id="floating-nav-menu"
            role="menu"
            // Changed bg-white to bg-gray-100 for light mode, kept dark mode the same.
            // Removed backdrop-blur as it's less effective with more opaque backgrounds.
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
                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md truncate" // Adjusted hover for new bg
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
                  className="block w-full text-left px-3 py-1.5 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md truncate" // Adjusted hover for new bg
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

// Search Bar Component with Navigation Controls
const SearchBar = ({ searchTerm, onSearchChange, resultCount, currentResultIndex, onNextResult, onPrevResult }) => {
  const hasResults = resultCount > 0;
  const currentDisplayIndex = hasResults ? currentResultIndex + 1 : 0; // 1-based index for display

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
        {/* Search Results Navigation */}
        {searchTerm && ( // Only show nav when there's a search term
            <div className="mt-2 flex items-center justify-end text-sm text-gray-600 dark:text-gray-400">
                {hasResults ? (
                    <>
                        <span className="mr-3"> {/* Added margin */}
                            Result {currentDisplayIndex} of {resultCount}
                        </span>
                        <button
                            onClick={onPrevResult}
                            disabled={currentResultIndex <= 0}
                            className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500" // Added focus style
                            aria-label="Previous search result"
                        >
                            <ArrowUp size={16} />
                        </button>
                        <button
                            onClick={onNextResult}
                            disabled={currentResultIndex >= resultCount - 1}
                            className="ml-1 p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-1 focus:ring-blue-500" // Added focus style
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

// Scroll Progress Bar (no changes needed)
const ScrollProgress = () => {
  const [scrollPercentage, setScrollPercentage] = useState(0);

  const handleScroll = useCallback(() => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
    const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    // Clamp value between 0 and 100
    setScrollPercentage(Math.min(100, Math.max(0, scrolled)));
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true }); // Use passive listener
    // Recalculate on mount and resize
    const handleResize = () => handleScroll();
    window.addEventListener('resize', handleResize, { passive: true });
    handleScroll(); // Initial calculation

    return () => {
        window.removeEventListener('scroll', handleScroll);
        window.removeEventListener('resize', handleResize);
    }
  }, [handleScroll]);

  return (
    <div className="fixed top-0 left-0 w-full h-1 z-[101] bg-gray-200 dark:bg-gray-700"> {/* Ensure higher z-index */}
      <div
        className="h-1 bg-blue-600 dark:bg-blue-400 transition-width duration-100 ease-linear" // Changed transition property
        style={{ width: `${scrollPercentage}%` }}
      />
    </div>
  );
};

// Theme Toggle Button (no changes needed)
const ThemeToggle = ({ theme, onToggle }) => {
  return (
    <button
      onClick={onToggle}
      className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-900" // Added focus style
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
    </button>
  );
};

// --- Main Component: EnrolledCourseStudyPage ---

const EnrolledCourseStudyPage = () => {
  const [modalQuiz, setModalQuiz] = useState(null);

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
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const { token, logout } = useContext(AuthContext);

  
  // --- State ---
  const [courseData, setCourseData] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [quizzes, setQuizzes] = useState([]); // Store all quizzes
  const [completedLessons, setCompletedLessons] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Search State
  const [searchTerm, setSearchTerm] = useState("");
  const [searchMatches, setSearchMatches] = useState([]); // Stores DOM elements of matches
  const [currentMatchIndex, setCurrentMatchIndex] = useState(-1); // -1 means no active match

  const mainContentRef = useRef(null); // Ref for the main content area to search within

  // --- Theme Management ---
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => { // Wrap in useCallback
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  }, []);

  // --- Data Fetching ---
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

    const fetchCourseData = async () => {
      try {
        // Fetch Enrollment Details (includes course snapshot with basic lesson/quiz lists)
        const enrollmentRes = await apiClient.get(`/enrollments/${enrollmentId}/`);
        if (!isMounted) return;

        const enrollment = enrollmentRes.data;
        const course = enrollment?.course_snapshot || enrollment?.course;

        if (!course) throw new Error("Course data not found in enrollment.");
        setCourseData(course);

        const lessonList = course.lessons || [];

        // Fetch Detailed Lesson Content (assuming API provides full content)
        // Adjust endpoint/logic if only IDs are provided initially
        const lessonDetailPromises = lessonList.map(lesson =>
          apiClient.get(`/lessons/${lesson.permalink || lesson.id}/`) // Use permalink or ID
            .then(res => ({...res.data.lesson, id: res.data.lesson.id || lesson.id})) // Ensure ID is present
            .catch(err => {
              console.warn(`Failed to fetch lesson ${lesson.permalink || lesson.id}:`, err);
              return { ...lesson, title: `${lesson.title || 'Lesson'} (Error Loading)`, content: null, id: lesson.id || lesson.permalink };
            })
        );

        // Fetch Detailed Quiz Content (assuming API provides full content)
        // Adjust endpoint/logic if necessary
        const detailedLessons = await Promise.all(lessonDetailPromises);
        const detailedQuizzes = detailedLessons.flatMap(lesson => lesson.quizzes || []);


        if (!isMounted) return;

        // Sort lessons/quizzes if needed (e.g., by an 'order' field from API)
        // FIX: Ensure localeCompare is only called on strings
        const sortContent = (a, b) => {
            const orderDiff = (a.order ?? Infinity) - (b.order ?? Infinity);
            if (orderDiff !== 0) return orderDiff;
            // Convert IDs to strings before comparing
            const idA = String(a.id ?? '');
            const idB = String(b.id ?? '');
            return idA.localeCompare(idB);
        };

        detailedLessons.sort(sortContent);
        detailedQuizzes.sort(sortContent);


        setLessons(detailedLessons);
        setQuizzes(detailedQuizzes); // Store all detailed quizzes

        // Fetch or determine Completion Status
        // Example: Assuming completion status comes with lesson details
        const initialCompleted = new Set(
        );
        // Or fetch separately if needed:
        // const completionRes = await apiClient.get(`/enrollments/${enrollmentId}/completion/`);
        // const initialCompleted = new Set(completionRes.data.completed_lesson_ids);
        setCompletedLessons(initialCompleted);


        const { data: completions } = await apiClient.get(
          `/lessons/enrollments/${enrollmentId}/completions/`
        );
        const tsMap = {};
        
        completions.forEach(c => {
          // c.lesson.id comes from SimpleLessonCompletionSerializer
          tsMap[c.lesson.id] = c.completed_at;
        });
        setCompletionTimestamps(tsMap);

        // build your completedLessons set from the same data:
        setCompletedLessons(new Set(Object.keys(tsMap).map(idStr => parseInt(idStr, 10))));
      } catch (err) {
        console.error("Error fetching course study data:", err);
        if (isMounted) {
          if (err.response?.status === 404) {
            setError("Enrollment or course not found.");
          } else if (err.response?.status === 401 || err.response?.status === 403) {
            setError("Unauthorized. Please log in again.");
            logout(); // Call logout
            // navigate('/login'); // Redirect may be too abrupt
          } else {
             // Check if the error message indicates the localeCompare issue specifically
             if (err instanceof TypeError && err.message.includes('localeCompare is not a function')) {
                 setError(`Failed to sort course content. Please check if lesson/quiz IDs are valid strings or numbers.`);
             } else {
                 setError(`Failed to load course content: ${err.message || "An unexpected error occurred."}`);
             }
          }
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCourseData();

    return () => { isMounted = false; };
  }, [enrollmentId, token, navigate, logout]); // Dependencies for fetching

  // --- Search Logic ---
  useEffect(() => {
    // Clear previous highlights and state when search term is empty
    if (!searchTerm) {
      if (searchMatches.length > 0) { // Only clear if there were previous matches
          searchMatches.forEach(el => el.classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'));
          setSearchMatches([]);
          setCurrentMatchIndex(-1);
      }
      return;
    }

    // Debounce search execution
    const handler = setTimeout(() => {
        if (mainContentRef.current) {
            // Remove previous active styles before finding new matches
            document.querySelectorAll('.active-search-match').forEach(el => el.classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'));

            // Find all elements marked by highlightSearchTerm
            const matches = Array.from(mainContentRef.current.querySelectorAll('.search-match-highlight'));
            setSearchMatches(matches);
            const newIndex = matches.length > 0 ? 0 : -1;
            setCurrentMatchIndex(newIndex);

            if (newIndex !== -1) {
                // Scroll to and highlight the first match
                matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
                matches[0].classList.add('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'); // Add active style
            }
        }
    }, 300); // 300ms delay after typing stops

    return () => clearTimeout(handler); // Cleanup timeout

  }, [searchTerm, lessons, quizzes]); // Re-run search if content or term changes


  // --- Event Handlers ---

  // Mark Lesson as Complete (wrapped in useCallback)
  const handleMarkComplete = useCallback(async (lessonId) => {
    const lesson = lessons.find(l => l.id === lessonId);
    const lessonIdentifier = lesson?.permalink || lesson?.id;
    if (!lessonIdentifier || completedLessons.has(lessonId)) return;

    setCompletedLessons(prev => new Set(prev).add(lessonId)); // Optimistic update

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
      // Success - state already updated
    } catch (err) {
      console.error("Error marking lesson complete:", err);
      setCompletedLessons(prev => { // Revert on error
        const newSet = new Set(prev);
        newSet.delete(lessonId);
        return newSet;
      });
      alert(`Failed to mark lesson complete: ${err.response?.data?.detail || err.message}`); // Consider better notification
      if (err.response?.status === 401 || err.response?.status === 403) {
          setError("Session expired. Please log in again.");
          logout();
      }
    }
  }, [lessons, completedLessons, logout]); // Dependencies

  // Handle navigation from FloatingNav (wrapped in useCallback)
  const handleNavigate = useCallback((targetId) => {
    const element = document.getElementById(targetId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // Optional: Highlight effect
      element.classList.add('transition-all', 'duration-1000', 'ring-2', 'ring-offset-2', 'ring-indigo-500', 'dark:ring-offset-gray-900');
      setTimeout(() => {
        element.classList.remove('ring-2', 'ring-offset-2', 'ring-indigo-500', 'dark:ring-offset-gray-900');
      }, 1500);

        // If the target is a lesson, attempt to expand it if collapsed
        if (targetId.startsWith('lesson-')) {
            const lessonComp = element; // element is the section
            // Check if the content div has max-height: 0px (indicates collapsed)
            const contentDiv = lessonComp.querySelector(':scope > div[style*="max-height: 0px"]');
             if (contentDiv) {
                 // Simulate a click on the header to toggle expansion
                 const header = lessonComp.querySelector(':scope > div:first-child');
                 header?.click();
             }
        }
         // If the target is a quiz, ensure its parent lesson is expanded
        else if (targetId.startsWith('quiz-')) {
            const quizComp = element;
            const lessonComp = quizComp.closest('section[id^="lesson-"]'); // Find parent lesson section
            if (lessonComp) {
                 const contentDiv = lessonComp.querySelector(':scope > div[style*="max-height: 0px"]');
                 if (contentDiv) {
                    const header = lessonComp.querySelector(':scope > div:first-child');
                    header?.click();
                 }
            }
        }
    }
  }, []); // No dependencies needed if it only interacts with DOM

  // Search Result Navigation (wrapped in useCallback)
  const navigateSearchResults = useCallback((direction) => {
      if (searchMatches.length === 0) return;

      let nextIndex = currentMatchIndex + direction;

      // Handle boundary conditions (no wrap around for now)
      // if (nextIndex >= searchMatches.length) nextIndex = searchMatches.length - 1;
      // if (nextIndex < 0) nextIndex = 0;
       // Wrap around logic:
       if (nextIndex >= searchMatches.length) {
           nextIndex = 0;
       } else if (nextIndex < 0) {
           nextIndex = searchMatches.length - 1;
       }


      // Remove highlight from current match if valid index
      if (currentMatchIndex >= 0 && searchMatches[currentMatchIndex]) {
          searchMatches[currentMatchIndex].classList.remove('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900');
      }

      // Scroll to and highlight the next match
      const nextMatchElement = searchMatches[nextIndex];
      if (nextMatchElement) {
          nextMatchElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          nextMatchElement.classList.add('active-search-match', 'ring-2', 'ring-offset-2', 'ring-blue-500', 'dark:ring-offset-gray-900'); // Add active style
          setCurrentMatchIndex(nextIndex);
      }
  }, [searchMatches, currentMatchIndex]); // Dependencies

  const handleNextResult = useCallback(() => navigateSearchResults(1), [navigateSearchResults]);
  const handlePrevResult = useCallback(() => navigateSearchResults(-1), [navigateSearchResults]);


  // --- Filtering and Data Preparation ---
   // Filter lessons based on search term (only needed if you want to hide non-matching lessons entirely)
   // Current implementation relies on highlighting within visible lessons.
   // If filtering is desired:
   /*
   const filteredLessons = useMemo(() => {
     if (!searchTerm) return lessons;
     const lowerSearchTerm = searchTerm.toLowerCase();
     return lessons.filter(lesson => {
         const titleMatch = lesson.title?.toLowerCase().includes(lowerSearchTerm);
         const contentMatch = extractTextFromHtml(lesson.content)?.toLowerCase().includes(lowerSearchTerm);
         const assocQuiz = quizzes.find(q => q.lesson_id === lesson.id);
         const quizTitleMatch = assocQuiz?.title?.toLowerCase().includes(lowerSearchTerm);
         const quizDescMatch = extractTextFromHtml(assocQuiz?.description)?.toLowerCase().includes(lowerSearchTerm);
         return titleMatch || contentMatch || quizTitleMatch || quizDescMatch;
     });
   }, [lessons, quizzes, searchTerm]);
   */
   // If not filtering, just use the original 'lessons' array for mapping
   const lessonsToDisplay = lessons; // Or use filteredLessons if implementing filtering


   // Find associated quiz for each lesson (assuming quiz object has lesson_id)
   const lessonsWithQuizzes = useMemo(() => {
        // Use lessonsToDisplay (which is either all lessons or filtered lessons)
        return lessonsToDisplay.map(lesson => {
            // Adjust 'lesson_id' if your quiz data uses a different field name
            const associatedQuiz = quizzes.find(quiz => quiz.lesson === lesson.id);
            return {
                ...lesson,
                associatedQuiz: associatedQuiz // Add the found quiz (or undefined)
            };
        });
    // Depend on the array being mapped and the quizzes array
    }, [lessonsToDisplay, quizzes]);

console.log('fetched quizzes:', quizzes)
  // --- Render ---
// 1) aggregate all custom CSS strings from each lesson
const allCustomCss = lessons
  .map(l => l.custom_css || '')
  .filter(s => !!s)
  .join('\n');

// 2) pick a default accent color (falls back if none set)
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
            onClick={() => navigate(-1)} // Go back
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
      {/* this is the only bit you need to swap out: */}
      <style type="text/css">{`
        :root { --accent-color: ${defaultAccent}; }
      `}</style>
    </Helmet>
      <ScrollProgress />
    <div className={styles.lessonTemplate}>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-300">
        {/* Increased padding-bottom to avoid overlap with floating button */}
        <div className="w-full mx-auto px-4 pt-8 pb-32 max-w-full md:max-w-4xl">{/* Adjusted pb for mobile */}

          {/* Header */}
          <header className="mb-8 flex flex-col sm:flex-row justify-between items-start"> {/* Stack on small screens */}
             <div className="mb-4 sm:mb-0"> {/* Add bottom margin on small screens */}
               <button
                   onClick={() => navigate('/my-learning')} // Navigate to a specific known route
                   className="mb-2 inline-flex items-center text-sm text-blue-600 dark:text-blue-400 hover:underline"
               >
                   <ArrowLeft className="w-4 h-4 mr-1" /> Back to My Learning
               </button>
               <h1 className="text-3xl md:text-4xl font-bold text-gray-800 dark:text-gray-100">{courseData.title}</h1>
               {courseData.description && (
                 <div className="mt-2 text-gray-600 dark:text-gray-400 prose dark:prose-invert max-w-none break-words whitespace-normal" dangerouslySetInnerHTML={{ __html: sanitizeHtml(courseData.description)}}></div>
               )}
             </div>
             <div className="flex-shrink-0 self-start sm:self-center"> {/* Align self start on small */}
                <ThemeToggle theme={theme} onToggle={toggleTheme} />
             </div>
          </header>

          {/* Search Bar and Controls */}
          <SearchBar
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            resultCount={searchMatches.length}
            currentResultIndex={currentMatchIndex}
            onNextResult={handleNextResult}
            onPrevResult={handlePrevResult}
          />

          {/* Main Content Area - Add ref here */}
          <main ref={mainContentRef}>
            {lessonsWithQuizzes.length === 0 && !searchTerm && (
               <p className="text-center text-gray-500 dark:text-gray-400 py-6">This course currently has no lessons or quizzes.</p>
            )}
             {/* Message when search yields no results is handled by SearchBar now */}


            {/* Render Lessons (which now include their quizzes) */}
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

            {/* Note: Standalone QuizSection rendering is removed as quizzes are now shown within lessons */}

          </main>
        </div>

        {/* Floating Navigation */}
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
       {/* Add some basic styles for the active search highlight */}
       <style>{`
        .search-match-highlight {
          transition: background-color 0.3s ease-in-out;
          border-radius: 3px; /* Slightly more rounding */
          padding: 0.1em 0; /* Add slight vertical padding */
          margin: -0.1em 0; /* Counteract padding */
        }
        .active-search-match {
          /* Ring styles are applied via JS */
          /* Add a subtle background color transition */
           transition: background-color 0.3s ease-in-out, box-shadow 0.3s ease-in-out;
           box-shadow: 0 0 0 2px theme('colors.blue.500'); /* Use Tailwind theme color */
        }
        /* Ensure ring is visible over prose elements */
        .prose .active-search-match {
            position: relative;
            z-index: 1;
        }
        /* Tailwind Prose adjustments for mark tags */
        .prose :where(mark):not(:where([class~="not-prose"] *)) {
            background-color: transparent; /* Let the inner mark handle color */
            color: inherit;
            padding: 0;
            border-radius: 0;
        }
        /* Style for embedded iframe */
        .aspect-w-16.aspect-h-9 iframe {
             border-radius: 0.375rem; /* md rounded corners */
        }
       `}</style>
    </>
  );
};

export default EnrolledCourseStudyPage;
