import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api'; // Adjust path as needed
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed
import QuizCard from './QuizCard'; // Assuming this component exists
import styles from './Explorer.module.css'; // Import NEW CSS Module styles

// --- Helper Functions (from your original code) ---
const stripHTML = (html) => {
  if (!html) return '';
  if (typeof window !== 'undefined' && typeof window.DOMParser === 'function') {
    try {
      const doc = new window.DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    } catch (e) {
      console.error("Error parsing HTML string:", e);
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || "";
    }
  } else if (typeof document !== 'undefined' && document.createElement) {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      return tempDiv.textContent || tempDiv.innerText || "";
  }
  return String(html).replace(/<[^>]+>/g, '');
};

// --- Skeleton Loader Component (from your original code) ---
const SkeletonCard = () => (
  <div className={styles.gridItem}>
    <div className={`${styles.gridItemCard} ${styles.skeleton}`}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.skeletonInfo}>
        <div className={styles.skeletonText} style={{ width: '80%', height: '1rem', marginBottom: '0.5rem' }}></div>
        <div className={styles.skeletonText} style={{ width: '60%', height: '0.8rem', marginBottom: '0.5rem' }}></div>
        <div className={styles.skeletonCreator}>
            <div className={styles.skeletonAvatar}></div>
            <div className={styles.skeletonText} style={{ width: '40%', height: '0.7rem' }}></div>
        </div>
      </div>
    </div>
  </div>
);

// --- Item Card Component (from your original code, with IntersectionObserver integrated) ---
const ItemCard = ({ item, activeTab, onItemVisible, onItemHidden }) => {
  const cardRef = useRef(null);

  useEffect(() => {
    // Ensure IntersectionObserver is available (it should be in modern browsers)
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported in this browser.');
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (onItemVisible) onItemVisible(item.id, activeTab); // Pass activeTab as itemType
        } else {
          if (onItemHidden) onItemHidden(item.id, activeTab); // Pass activeTab as itemType
        }
      },
      { threshold: 0.5 } // Trigger when 50% of the item is visible
    );

    const currentCardRef = cardRef.current;
    if (currentCardRef) {
      observer.observe(currentCardRef);
    }

    return () => {
      if (currentCardRef) {
        observer.unobserve(currentCardRef);
      }
    };
  }, [item, activeTab, onItemVisible, onItemHidden]); // item.id and activeTab ensure re-observation if item changes

  if (!item || !item.id) {
    console.warn("Skipping render for invalid item:", item);
    return null;
  }

  let linkUrl = '#';
  const defaultPlaceholder = 'https://placehold.co/600x400/f5f5f7/c7c7cc?text=No+Image';
  let imageUrl = item.og_image_url || item.cover_image || item.profile_image_url || defaultPlaceholder;
  let title = item.title || item.username || 'Untitled Item';
  let creatorName = item.created_by || null;
  let metaInfo = '';

  if (activeTab === 'courses' && item.course_type) {
    metaInfo = item.course_type.charAt(0).toUpperCase() + item.course_type.slice(1);
  } else if (item.created_at && !creatorName) {
    metaInfo = new Date(item.created_at).toLocaleDateString();
  }
  if (activeTab === 'guides' && item.username === creatorName) {
    creatorName = null;
  }

  if (activeTab === 'posts' && item.permalink) {
    linkUrl = `/posts/${item.permalink}`;
  } else if (activeTab === 'courses' && item.permalink) {
    linkUrl = `/courses/${item.permalink}`;
  } else if (activeTab === 'lessons' && item.permalink) {
    linkUrl = `/lessons/${item.permalink}`;
  } else if (activeTab === 'guides' && item.username) {
    linkUrl = `/guide/${item.username}`;
  }
  // Note: Quizzes are handled by QuizCard directly in renderContent

  const renderImage = () => (
    <img
      src={imageUrl}
      alt={title}
      className={styles.gridItemImage}
      loading="lazy"
      onError={(e) => {
        if (e.target.src !== defaultPlaceholder) {
          e.target.onerror = null;
          e.target.src = defaultPlaceholder;
          e.target.classList.add(styles.placeholderImage);
        } else {
          e.target.style.display = 'none';
        }
      }}
    />
  );

  return (
    <div ref={cardRef} className={styles.gridItem} data-item-id={item.id} data-item-type={activeTab}>
      <Link to={linkUrl} className={styles.gridItemLink} aria-label={`View ${title}`}>
        <div className={styles.gridItemCard}>
          <div className={styles.gridItemImageContainer}>
            {renderImage()}
          </div>
          <div className={styles.gridItemInfo}>
            {metaInfo && <p className={styles.gridItemMeta}>{metaInfo}</p>}
            <h3 className={styles.gridItemTitle}>{title}</h3>
            {creatorName && (
              <div className={styles.gridItemCreator}>
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
const Explorer = () => {
  const [activeTab, setActiveTab] = useState('courses'); // Your original default
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { token, logout } = useContext(AuthContext) || {}; // Added || {} for safety
  const tabBarRef = useRef(null);
  const visibleItemTimers = useRef({}); // Stores { [`${itemType}-${itemId}`]: startTime }

  const tabs = [
    { key: 'courses', label: 'Courses', path: '/courses/' },
    { key: 'lessons', label: 'Lessons', path: '/lessons/' },
    { key: 'quizzes', label: 'Quizzes', path: '/quizzes/' },
    { key: 'guides', label: 'Guides', path: '/users/guides/' },
    // { key: 'posts', label: 'Posts', path: '/posts/' }, // Your original had posts commented out
  ];

  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setItems([]);
    // Clear timers for items that were visible from the previous tab
    Object.keys(visibleItemTimers.current).forEach(key => {
        const [type, idStr] = key.split('-');
        // Call handleItemHidden to log time for items that were visible before tab switch
        // Ensure handleItemHidden is defined or pass null if it's not critical here
        if (handleItemHidden) handleItemHidden(parseInt(idStr), type);
    });
    visibleItemTimers.current = {}; // Reset timers for the new tab

    const currentTabConfig = tabs.find(tab => tab.key === activeTab);
    if (!currentTabConfig) {
      setMessage(`Invalid tab selected.`);
      setLoading(false);
      return;
    }
    const relativePath = currentTabConfig.path.startsWith('/') ? currentTabConfig.path.substring(1) : currentTabConfig.path;


    try {
      const response = await apiClient.get(relativePath, { // Removed leading slash from relativePath if apiClient.baseURL has it
         headers: token ? { Authorization: `Bearer ${token}` } : {} // Conditionally add auth header
      });
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []); // Handle paginated results
      setItems(data);
      if (data.length === 0) {
        setMessage(`No ${activeTab} found.`);
      }
    } catch (error) {
      console.error(`Error fetching ${activeTab}:`, error.response ? error.response.data : error.message);
      let errorMsg = `Failed to load ${activeTab}. Please try again later.`;
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      }
      setMessage(errorMsg);
      if (error.response?.status === 401 && logout) {
        setMessage('Authentication failed. Logging out...');
        setTimeout(logout, 1500);
      }
    } finally {
      setLoading(false);
    }
  }, [activeTab, token, logout]); // Removed handleItemHidden from deps as it's defined below

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const activeTabElement = tabBarRef.current?.querySelector(`.${styles.active}`);
    if (activeTabElement && typeof activeTabElement.scrollIntoView === 'function') {
      activeTabElement.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeTab]);

  // --- Visibility Tracking Callbacks ---
  const handleItemVisible = useCallback((itemId, itemType) => {
    const key = `${itemType}-${itemId}`;
    if (!visibleItemTimers.current[key]) {
      visibleItemTimers.current[key] = Date.now();
      // console.log(`Item visible: ${key} (Type: ${itemType}, ID: ${itemId}), timer started.`);
    }
  }, []);

  const handleItemHidden = useCallback(async (itemId, itemType) => {
    const key = `${itemType}-${itemId}`;
    const startTime = visibleItemTimers.current[key];

    if (startTime) {
      const durationMs = Date.now() - startTime;
      delete visibleItemTimers.current[key];

      if (durationMs > 1000 && token) { // Only log if visible for >1s and user is logged in
        // console.log(`Item hidden: ${key}, duration: ${durationMs}ms. Logging...`);
        try {
          await apiClient.post('/analytics/log-interaction-time/', { // Ensure this path is correct
            item_type: itemType,
            item_id: itemId,
            duration_ms: durationMs,
            context: 'ExplorerView',
            // url: window.location.pathname, // Optional: current page URL
          }, {
            headers: { Authorization: `Bearer ${token}` },
          });
          // console.log(`Logged interaction for ${key}`);
        } catch (error) {
          console.error(`Failed to log interaction time for ${key}:`, error);
          // Handle specific errors like 401 if needed
          if (error.response?.status === 401 && logout) {
             console.warn("Logging interaction failed due to auth error, logging out.");
             logout();
          }
        }
      } else {
        // console.log(`Item hidden: ${key}, duration too short (${durationMs}ms) or no token, not logging.`);
      }
    }
  }, [token, logout]);


  const renderContent = () => {
    const isQuizLayout = activeTab === 'quizzes';
    if (loading) {
      return (
        <div className={`${styles.gridContainer} ${isQuizLayout ? styles.quizLayout : ''}`}>
          {Array.from({ length: 12 }).map((_, index) => (
            <SkeletonCard key={`skeleton-${index}`} />
          ))}
        </div>
      );
    }
    if (message) {
      const isError = message.toLowerCase().includes('failed') || message.toLowerCase().includes('error') || message.toLowerCase().includes('invalid');
      return (
        <div className={`${styles.messageContainer} ${isError ? styles.errorMessage : styles.infoMessage}`} role="alert" aria-live="polite">
          {message}
        </div>
      );
    }
    if (!loading && items.length === 0 && !message) {
      return (
        <div className={`${styles.messageContainer} ${styles.infoMessage}`} role="status" aria-live="polite">
          No {activeTab} available yet. Explore other categories!
        </div>
      );
    }

    return (
      <div className={`${styles.gridContainer} ${isQuizLayout ? styles.quizLayout : ''}`}>
        {items.map((item) => {
          if (!item || !item.id) {
            console.warn("Skipping render for item without ID:", item);
            return null;
          }
          if (activeTab === 'quizzes') {
            // For QuizCard, we need to wrap it or ensure QuizCard itself implements IntersectionObserver
            // For simplicity, we'll wrap it with a div that has the ref and data attributes
            // QuizCard itself will receive the quiz prop
            return (
              <div
                key={`quiz-wrapper-${item.id}`}
                ref={el => {
                  // This is a bit tricky with dynamic refs in a map.
                  // A more robust way is to have QuizCard accept onItemVisible/onItemHidden
                  // or use a dedicated wrapper component for QuizCard that handles observation.
                  // For now, this div won't directly trigger the observer unless ItemCard logic is moved here.
                  // The BEST approach is to pass onItemVisible/Hidden to QuizCard if it's a separate component.
                }}
                // data-item-id={item.id} // These should be on the observed element
                // data-item-type={activeTab}
              >
                {/*
                  If QuizCard is a simple display component, it won't trigger visibility events.
                  You'd need to wrap it with something like ItemCard, or make QuizCard itself
                  use IntersectionObserver and call onItemVisible/onItemHidden.

                  Let's assume QuizCard needs to be adapted or you use ItemCard structure for it too.
                  For now, to keep your structure, we render QuizCard.
                  To enable tracking for QuizCard, it should ideally accept onItemVisible/onItemHidden
                  and use IntersectionObserver internally, or be wrapped by a component like ItemCard.
                */}
                 <QuizCard quiz={item} onItemVisible={handleItemVisible} onItemHidden={handleItemHidden} itemType={activeTab} />
              </div>
            );
          }
          // Render standard items using ItemCard which has IntersectionObserver
          return (
            <ItemCard
              key={`${activeTab}-${item.id}`}
              item={item}
              activeTab={activeTab}
              onItemVisible={handleItemVisible}
              onItemHidden={handleItemHidden}
            />
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.explorerContainer}>
      <div className={styles.tabBarContainer}>
        <div className={styles.tabBar} ref={tabBarRef} role="tablist" aria-label="Content categories">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              role="tab"
              aria-selected={activeTab === tab.key}
              aria-controls={`tabpanel-${tab.key}`}
              id={`tab-${tab.key}`}
              className={`${styles.tabBtn} ${activeTab === tab.key ? styles.active : ''}`}
              onClick={() => {
                // Before changing tab, log durations for any items currently visible
                Object.keys(visibleItemTimers.current).forEach(key => {
                    const [type, idStr] = key.split('-');
                    if (handleItemHidden) handleItemHidden(parseInt(idStr), type);
                });
                setActiveTab(tab.key);
              }}
              disabled={loading}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={-1}
        className={styles.contentArea}
      >
        {renderContent()}
      </div>
    </div>
  );
};

export default Explorer;
