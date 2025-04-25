import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api'; // Adjust path as needed
import { AuthContext } from '../context/AuthContext'; // Adjust path as needed
import QuizCard from './QuizCard'; // Assuming this component exists
import styles from './Explorer.module.css'; // Import NEW CSS Module styles

// --- Helper Functions (Keep as is) ---
const stripHTML = (html) => {
  if (!html) return '';
  if (typeof DOMParser === 'function') {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || "";
  }
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  return tempDiv.textContent || tempDiv.innerText || "";
};

// --- Skeleton Loader Component ---
// Uses new CSS classes for styling
const SkeletonCard = () => (
  <div className={styles.gridItem}> {/* Use gridItem directly */}
    <div className={`${styles.gridItemCard} ${styles.skeleton}`}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.skeletonInfo}>
        <div className={styles.skeletonText} style={{ width: '70%', height: '1rem', marginBottom: '0.5rem' }}></div>
        <div className={styles.skeletonText} style={{ width: '50%', height: '0.8rem' }}></div>
      </div>
    </div>
  </div>
);

// --- Item Card Component ---
// Uses new CSS classes for styling
const ItemCard = ({ item, activeTab }) => {
  if (!item || !item.id) {
    console.warn("Skipping render for invalid item:", item);
    return null;
  }

  // --- Determine Item Properties (Keep logic, update based on new design if needed) ---
  let linkUrl = '#';
  let imageUrl = item.og_image_url || item.cover_image || item.profile_image_url || null;
  let title = item.title || item.username || 'Untitled Item';
  // Simplified description/meta display for a more visual grid
  let metaInfo = '';
  if (activeTab === 'courses' && item.course_type) {
      metaInfo = item.course_type.charAt(0).toUpperCase() + item.course_type.slice(1);
  } else if (activeTab !== 'guides' && item.created_by) {
      metaInfo = `By ${item.created_by}`;
  } else if (item.created_at) {
      metaInfo = new Date(item.created_at).toLocaleDateString();
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

  // --- Render Image or Placeholder ---
  const renderImageOrPlaceholder = () => {
    // Prioritize showing an image for visual grids
    if (imageUrl && imageUrl !== 'https://via.placeholder.com/150') {
      return (
        <img
          src={imageUrl}
          alt={title}
          className={styles.gridItemImage}
          loading="lazy"
          onError={(e) => {
            e.target.onerror = null;
            // Hide broken image, maybe show a minimal placeholder?
            e.target.style.display = 'none';
            const placeholder = e.target.nextElementSibling;
            if (placeholder && placeholder.classList.contains(styles.gridItemPlaceholder)) {
                placeholder.style.display = 'flex';
            }
          }}
        />
      );
    }
    // Minimal placeholder if no image
    return (
      <div className={styles.gridItemPlaceholder}>
        {/* Simple Icon Placeholder */}
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
      </div>
    );
  };

  return (
    // Link now wraps the inner card content for better structure if needed
    <div className={styles.gridItem}>
        <Link to={linkUrl} className={styles.gridItemLink} aria-label={`View ${title}`}>
            <div className={styles.gridItemCard}>
                <div className={styles.gridItemImageContainer}>
                    {renderImageOrPlaceholder()}
                    {/* Fallback placeholder div in case image fails AND onError handler needs it */}
                    { !imageUrl && (
                        <div className={styles.gridItemPlaceholder} style={{display: 'none'}}> {/* Initially hidden */}
                             <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                        </div>
                    )}
                </div>
                <div className={styles.gridItemInfo}>
                    <h3 className={styles.gridItemTitle}>{title}</h3>
                    {metaInfo && <p className={styles.gridItemMeta}>{metaInfo}</p>}
                </div>
            </div>
        </Link>
    </div>
  );
};


// --- Main Explorer Component ---
const Explorer = () => {
  const [activeTab, setActiveTab] = useState('courses');
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const { logout } = useContext(AuthContext);
  const tabBarRef = useRef(null); // Ref for tab bar scrolling

  // Define tab configuration
  const tabs = [
    // { key: 'posts', label: 'Posts', path: '/posts/' },
    { key: 'courses', label: 'Courses', path: '/courses/' },
    { key: 'lessons', label: 'Lessons', path: '/lessons/' },
    { key: 'quizzes', label: 'Quizzes', path: '/quizzes/' },
    { key: 'guides', label: 'Guides', path: '/users/guides/' },
  ];

  // --- Data Fetching (Keep as is, uses useCallback) ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    setMessage('');
    setItems([]);

    const currentTabConfig = tabs.find(tab => tab.key === activeTab);
    if (!currentTabConfig) {
        setMessage(`Invalid tab selected.`);
        setLoading(false);
        return;
    }
    const relativePath = currentTabConfig.path;

    try {
      const response = await apiClient.get(relativePath);
      if (Array.isArray(response.data)) {
        setItems(response.data);
      } else {
        console.warn(`Received non-array data for ${activeTab}:`, response.data);
        setMessage(`No ${activeTab} found or data format is incorrect.`);
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
  }, [activeTab, logout]); // Dependency array is correct

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll active tab into view on mobile
  useEffect(() => {
    const activeTabElement = tabBarRef.current?.querySelector(`.${styles.active}`);
    if (activeTabElement) {
      activeTabElement.scrollIntoView({
        behavior: 'smooth',
        inline: 'center',
        block: 'nearest',
      });
    }
  }, [activeTab]);


  // --- Render Content ---
  const renderContent = () => {
    if (loading) {
      return (
        <div className={styles.gridContainer}>
          {Array.from({ length: 8 }).map((_, index) => ( // Render more skeletons
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

    if (items.length === 0) {
      return (
        <div className={`${styles.messageContainer} ${styles.infoMessage}`} role="status" aria-live="polite">
          No {activeTab} available yet. Explore other categories!
        </div>
      );
    }

    // Render Items using the new grid structure
    return (
      <div className={styles.gridContainer}>
        {items.map((item) => {
          if (activeTab === 'quizzes' && item?.id) {
            // Quizzes might need their own styling or use a variation of ItemCard
            // For now, wrap QuizCard in gridItem for layout consistency
             return (
                <div className={styles.gridItem} key={`quiz-container-${item.id}`}>
                     <QuizCard quiz={item} />
                </div>
            );
          }
          return <ItemCard key={`${activeTab}-${item.id}`} item={item} activeTab={activeTab} />;
        })}
      </div>
    );
  };

  return (
    <div className={styles.explorerContainer}>
      {/* Redesigned Tab Bar */}
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
              onClick={() => setActiveTab(tab.key)}
              disabled={loading}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div
        id={`tabpanel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        tabIndex={-1} // Make panel focusable programmatically if needed, -1 removes from tab order
        className={styles.contentArea} // Added class for potential spacing
      >
         {renderContent()}
      </div>
    </div>
  );
};

export default Explorer;
