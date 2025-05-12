import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api'; // Adjust path as needed
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed
import QuizCard from './QuizCard'; // Assuming this component exists
import styles from './Explorer.module.css'; // Import NEW CSS Module styles

// --- Helper Functions (Keep as is) ---
const stripHTML = (html) => {
  if (!html) return '';
  // Basic check if running in a browser environment
  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    try {
      const doc = new window.DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    } catch (e) {
      console.error("Error parsing HTML string:", e);
      // Fallback for environments without DOMParser or if parsing fails
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || "";
    }
  } else if (typeof document !== 'undefined' && document.createElement) {
      // Fallback for environments like Node.js testing setup with basic DOM
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || "";
  }
  // Final fallback if no DOM is available
  return String(html).replace(/<[^>]+>/g, ''); // Basic tag stripping
};


// --- Skeleton Loader Component ---
// Uses updated CSS classes for styling
const SkeletonCard = () => (
  // Apply quiz-specific class here too if needed for skeleton layout
  <div className={styles.gridItem}> {/* Use gridItem directly */}
    <div className={`${styles.gridItemCard} ${styles.skeleton}`}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.skeletonInfo}>
        <div className={styles.skeletonText} style={{ width: '80%', height: '1rem', marginBottom: '0.5rem' }}></div>
        <div className={styles.skeletonText} style={{ width: '60%', height: '0.8rem', marginBottom: '0.5rem' }}></div>
         {/* Skeleton for creator */}
        <div className={styles.skeletonCreator}>
            <div className={styles.skeletonAvatar}></div>
            <div className={styles.skeletonText} style={{ width: '40%', height: '0.7rem' }}></div>
        </div>
      </div>
    </div>
  </div>
);

// --- Item Card Component ---
// Uses updated CSS classes for styling and displays creator info
const ItemCard = ({ item, activeTab }) => {
  if (!item || !item.id) {
    console.warn("Skipping render for invalid item:", item);
    return null;
  }

  // --- Determine Item Properties (Logic mostly kept, adjusted for display) ---
  let linkUrl = '#';
  // Use a default placeholder if no image is found
  const defaultPlaceholder = 'https://placehold.co/600x400/f5f5f7/c7c7cc?text=No+Image';
  let imageUrl = item.og_image_url || item.cover_image || item.profile_image_url || defaultPlaceholder;
  let title = item.title || item.username || 'Untitled Item';
  let creatorName = item.created_by || null; // Get creator name

  // Simplified meta info - maybe course type or date if no creator
  let metaInfo = '';
   if (activeTab === 'courses' && item.course_type) {
      metaInfo = item.course_type.charAt(0).toUpperCase() + item.course_type.slice(1);
   } else if (item.created_at && !creatorName) { // Show date only if no creator
      metaInfo = new Date(item.created_at).toLocaleDateString();
   }
   // Guides already show username as title, so creator might be redundant unless different
   if (activeTab === 'guides' && item.username === creatorName) {
       creatorName = null; // Avoid showing the same name twice
   }


  // --- Determine Link URL (Keep as is) ---
    if (activeTab === 'posts' && item.permalink) {
        linkUrl = `/posts/${item.permalink}`;
    } else if (activeTab === 'courses' && item.permalink) {
        linkUrl = `/courses/${item.permalink}`;
    } else if (activeTab === 'lessons' && item.permalink) {
        linkUrl = `/lessons/${item.permalink}`;
    } else if (activeTab === 'guides' && item.username) {
        linkUrl = `/guide/${item.username}`;
    }
  // Note: Quizzes are handled separately

  // --- Render Image with Error Handling ---
  const renderImage = () => (
    <img
      src={imageUrl}
      alt={title}
      className={styles.gridItemImage}
      loading="lazy"
      onError={(e) => {
        // Prevent infinite loop if the placeholder itself fails
        if (e.target.src !== defaultPlaceholder) {
            e.target.onerror = null; // stop trying to load the broken image
            e.target.src = defaultPlaceholder; // Fallback to default placeholder
            e.target.classList.add(styles.placeholderImage); // Add class to style placeholder text if needed
        } else {
            // If the placeholder itself fails, hide the image element
            e.target.style.display = 'none';
        }
      }}
    />
  );

  return (
    // Apply quiz-specific class here too if needed for item layout
    <div className={styles.gridItem}>
      {/* Link wraps the entire card content for better click/tap target */}
      <Link to={linkUrl} className={styles.gridItemLink} aria-label={`View ${title}`}>
        <div className={styles.gridItemCard}>
          <div className={styles.gridItemImageContainer}>
            {renderImage()}
          </div>
          <div className={styles.gridItemInfo}>
            {/* Display Meta Info (e.g., Course Type) if available */}
            {metaInfo && <p className={styles.gridItemMeta}>{metaInfo}</p>}
            {/* Display Title */}
            <h3 className={styles.gridItemTitle}>{title}</h3>
            {/* Display Creator Info if available */}
            {creatorName && (
              <div className={styles.gridItemCreator}>
                {/* Placeholder for potential avatar in the future */}
                {/* <img src={creatorAvatarUrl || defaultAvatar} alt="" className={styles.creatorAvatar} /> */}
                <span className={styles.creatorName}>{creatorName}</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
};


// --- Main Explorer Component ---
// (No significant logical changes, just using the updated ItemCard and styles)
const Explorer = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { logout } = useContext(AuthContext);
  const tabBarRef = useRef(null); // Ref for tab bar scrolling

  // Define tab configuration
  const tabs = [
    // { key: 'posts', label: 'Posts', path: '/posts/' }, // Uncomment if needed
    { key: 'courses', label: 'Courses', path: '/courses/' },
    { key: 'lessons', label: 'Lessons', path: '/lessons/' },
    { key: 'quizzes', label: 'Quizzes', path: '/quizzes/' },
    { key: 'guides', label: 'Guides', path: '/users/guides/' },
  ];

  // --- Data Fetching (Keep as is, uses useCallback) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setItems([]); // Clear items before fetching new tab data

    const currentTabConfig = tabs.find(tab => tab.key === activeTab);
    if (!currentTabConfig) {
        setMessage(`Invalid tab selected.`);
        setLoading(false);
        return;
    }
    const relativePath = currentTabConfig.path;

    try {
      const response = await apiClient.get(relativePath);
      // Ensure data is always an array, even if API returns null or something else
      const data = Array.isArray(response.data) ? response.data : [];
      setItems(data);
      if (data.length === 0) {
          setMessage(`No ${activeTab} found.`); // Set info message if empty
      }

    } catch (error) {
      console.error(`Error fetching ${activeTab}:`, error.response ? error.response.data : error.message);
      let errorMsg = `Failed to load ${activeTab}. Please try again later.`;
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      setMessage(errorMsg);
      if (error.response?.status === 401) {
        setMessage('Authentication failed. Logging out...');
        setTimeout(logout, 1500);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, logout]); // Dependency array includes activeTab and logout

  useEffect(() => {
    fetchData();
  }, [fetchData]); // Re-run fetch when fetchData changes (i.e., when activeTab changes)

  // Scroll active tab into view on mobile
  useEffect(() => {
    const activeTabElement = tabBarRef.current?.querySelector(`.${styles.active}`);
    if (activeTabElement && typeof activeTabElement.scrollIntoView === 'function') {
      activeTabElement.scrollIntoView({
        behavior: 'smooth',
        inline: 'center', // Centers the tab horizontally
        block: 'nearest', // Avoids vertical scrolling if possible
      });
    }
  }, [activeTab]); // Run when activeTab changes


  // --- Render Content ---
  const renderContent = () => {
    // Determine if the quiz layout should be applied
    const isQuizLayout = activeTab === 'quizzes';

    // Show loading skeletons
    if (loading) {
      return (
        // Add quizLayout class to skeleton container if quiz tab is loading
        <div className={`${styles.gridContainer} ${isQuizLayout ? styles.quizLayout : ''}`}>
          {/* Render a good number of skeletons for visual feedback */}
          {Array.from({ length: 12 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      );
    }

    // Show messages (Error or Info like "No items found")
    if (message) {
      const isError = message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') || message.toLowerCase().includes('invalid');
      return (
        <div className={`${styles.messageContainer} ${isError ? styles.errorMessage : styles.infoMessage}`} role="alert" aria-live="polite">
          {message}
        </div>
      );
    }

    // Show "No items" message specifically if items array is empty and no other message is set
     if (!loading && items.length === 0 && !message) {
         return (
             <div className={`${styles.messageContainer} ${styles.infoMessage}`} role="status" aria-live="polite">
                 No {activeTab} available yet. Explore other categories!
             </div>
         );
     }


    // Render Items using the new grid structure
    // Conditionally add the quizLayout class
    return (
      <div className={`${styles.gridContainer} ${isQuizLayout ? styles.quizLayout : ''}`}>
        {items.map((item) => {
          // Handle invalid items defensively
          if (!item || !item.id) {
            console.warn("Skipping render for item without ID:", item);
            return null;
          }

          if (activeTab === 'quizzes') {
             // Wrap QuizCard in gridItem for layout consistency
             // Ensure QuizCard itself is styled appropriately or adapt here
             // The gridItem will now be full width due to the quizLayout class on the parent
             return (
                 <div className={styles.gridItem} key={`quiz-wrapper-${item.id}`}>
                     <QuizCard quiz={item} />
                     {/* Consider adding creator info here too if QuizCard doesn't handle it */}
                     {item.created_by && (
                        <div className={`${styles.gridItemInfo} ${styles.quizCreatorInfo}`}>
                            <div className={styles.gridItemCreator}>
                                <span className={styles.creatorName}>{item.created_by}</span>
                            </div>
                        </div>
                     )}
                 </div>
             );
          }
          // Render standard items using the updated ItemCard
          return <ItemCard key={`${activeTab}-${item.id}`} item={item} activeTab={activeTab} />;
        })}
      </div>
    );
  };

  return (
    <div className={styles.explorerContainer}>
      {/* Tab Bar */}
      <div className={styles.tabBarContainer}>
        <div className={styles.tabBar} ref={tabBarRef} role="tablist" aria-label="Content categories">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`} // Links button to panel
              id={`tab-${tab.key}`} // Unique ID for label association
              className={`${styles.tabBtn} ${activeTab === tab.key ? styles.active : ''}`}
              onClick={() => setActiveTab(tab.key)}
              disabled={loading} // Disable tabs while loading
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area - Linked to active tab via aria-labelledby */}
      <div
        id={`tabpanel-${activeTab}`} // ID matches button's aria-controls
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`} // Associates panel with its controlling tab
        tabIndex={-1} // Make panel focusable programmatically if needed, -1 removes from normal tab order
        className={styles.contentArea}
      >
         {renderContent()}
      </div>
    </div>
  );
};

export default Explorer;
