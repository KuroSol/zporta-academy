// zporta_academy_frontend/src/components/Explorer.js
// This version introduces a dynamic layout for the Quizzes tab.

import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api';
import { quizPermalinkToUrl } from '../utils/urls';
import { AuthContext } from '../context/AuthContext';
import QuizCard from './QuizCard';
import styles from './Explorer.module.css';

// --- Helper: Skeleton Loader ---
const SkeletonCard = () => (
  <div className={styles.gridItem}>
    <div className={`${styles.gridItemCard} ${styles.skeleton}`}>
      <div className={styles.skeletonImage}></div>
      <div className={styles.skeletonInfo}>
        <div className={styles.skeletonText} style={{ width: '80%', height: '1rem', marginBottom: '0.5rem' }}></div>
        <div className={styles.skeletonText} style={{ width: '60%', height: '0.8rem' }}></div>
      </div>
    </div>
  </div>
);

// --- Helper: Generic Item Card ---
const ItemCard = ({ item, type }) => {
  if (!item || !item.id) return null;

  const defaultPlaceholder = 'https://placehold.co/600x400/f5f5f7/c7c7cc?text=No+Image';
  let linkUrl;
  if (type === 'quizzes') {
    linkUrl = quizPermalinkToUrl(item.permalink);
  } else if (type === 'guides') {
    linkUrl = `/guide/${item.username}`;
  } else {
    linkUrl = `/${type}/${item.permalink || item.username || item.id}/`;
  }
  let imageUrl = item.og_image_url || item.cover_image || item.profile_image_url || defaultPlaceholder;
  let title = item.title || item.username || 'Untitled';
  let creatorName = item.created_by?.username || null; // Access nested username

  return (
    <div className={styles.gridItem}>
      <Link to={linkUrl} className={styles.gridItemLink}>
        <div className={styles.gridItemCard}>
          <div className={styles.gridItemImageContainer}>
            <img
              src={imageUrl}
              alt={title}
              className={styles.gridItemImage}
              loading="lazy"
              onError={(e) => { e.target.src = defaultPlaceholder; }}
            />
          </div>
          <div className={styles.gridItemInfo}>
            <h3 className={styles.gridItemTitle}>{title}</h3>
            {creatorName && <p className={styles.creatorName}>by {creatorName}</p>}
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
  const [loading, setLoading] = useState(true);
  const { token } = useContext(AuthContext) || {};

  // --- Search State ---
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState(null);

  const tabs = [
    { key: 'courses', label: 'Courses', path: '/courses/' },
    { key: 'lessons', label: 'Lessons', path: '/lessons/' },
    { key: 'quizzes', label: 'Quizzes', path: '/quizzes/' },
    { key: 'guides', label: 'Guides', path: '/users/guides/' },
  ];

  // --- Debounce search input ---
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setSearchResults(null);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      performSearch();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // --- Data Fetching for Tabs ---
  const fetchData = useCallback(async (tabKey) => {
    setLoading(true);
    setItems([]);
    const currentTabConfig = tabs.find(tab => tab.key === tabKey);
    if (!currentTabConfig) return;

    try {
      const response = await apiClient.get(currentTabConfig.path);
      const data = Array.isArray(response.data) ? response.data : (response.data?.results || []);
      setItems(data);
    } catch (error) {
      console.error(`Error fetching ${tabKey}:`, error);
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Initial data load ---
  useEffect(() => {
    if (!searchResults) { // Only fetch tab data if not showing search results
        fetchData(activeTab);
    }
  }, [activeTab, searchResults, fetchData]);


  // --- Global Search Function ---
  const performSearch = async () => {
      setIsSearching(true);
      try {
          const response = await apiClient.get('/explorer/search/', {
              params: { q: searchTerm }
          });
          setSearchResults(response.data);
      } catch (error) {
          console.error("Global search error:", error);
          setSearchResults({ courses: [], lessons: [], quizzes: [], guides: [] });
      } finally {
          setIsSearching(false);
      }
  };

  const handleTabClick = (tabKey) => {
    setSearchTerm('');
    setSearchResults(null);
    setActiveTab(tabKey);
  };

  // --- RENDER FUNCTIONS ---

  const renderSearchResults = () => {
    if (isSearching) {
      return (
        <div className={styles.gridContainer}>
          {Array.from({ length: 8 }).map((_, index) => <SkeletonCard key={index} />)}
        </div>
      );
    }

    if (!searchResults || Object.values(searchResults).every(arr => arr.length === 0)) {
        return <div className={`${styles.messageContainer} ${styles.infoMessage}`}>No results found for "{searchTerm}"</div>;
    }
    
    // Determine layout for each category within search results
    const getCategoryLayoutClass = (category) => {
        return category === 'quizzes' ? styles.quizLayout : '';
    };

    return (
      <div className={styles.searchResultsContainer}>
        {Object.entries(searchResults).map(([category, results]) => (
          results.length > 0 && (
            <section key={category}>
              <h2 className={styles.categoryHeader}>{category.charAt(0).toUpperCase() + category.slice(1)}</h2>
              <div className={`${styles.gridContainer} ${getCategoryLayoutClass(category)}`}>
                {results.map(item => {
                    if (category === 'quizzes') {
                        return <QuizCard key={`search-quiz-${item.id}`} quiz={item} />;
                    }
                    return <ItemCard key={`search-${category}-${item.id}`} item={item} type={category} />;
                })}
              </div>
            </section>
          )
        ))}
      </div>
    );
  };

  const renderTabContent = () => {
    // Apply the special quiz layout class if the quizzes tab is active
    const gridLayoutClass = activeTab === 'quizzes' ? styles.quizLayout : '';

    if (loading) {
      return (
        <div className={`${styles.gridContainer} ${gridLayoutClass}`}>
          {Array.from({ length: activeTab === 'quizzes' ? 3 : 12 }).map((_, index) => 
            activeTab === 'quizzes' ? <QuizCard key={`skeleton-quiz-${index}`} quiz={{}} isLoading={true} /> : <SkeletonCard key={index} />
          )}
        </div>
      );
    }
    if (items.length === 0) {
        return <div className={`${styles.messageContainer} ${styles.infoMessage}`}>No {activeTab} found.</div>;
    }

    return (
      <div className={`${styles.gridContainer} ${gridLayoutClass}`}>
        {items.map((item) => {
          if (activeTab === 'quizzes') {
            return <QuizCard key={`quiz-${item.id}`} quiz={item} />;
          }
          return <ItemCard key={`${activeTab}-${item.id}`} item={item} type={activeTab} />;
        })}
      </div>
    );
  };

  return (
    <div className={styles.explorerContainer}>
        <div className={styles.globalSearchContainer}>
             <svg className={styles.searchIcon} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <input
                type="text"
                placeholder="Search courses, lessons, and more..."
                className={styles.searchInput}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

      {!searchResults && (
        <div className={styles.tabBarContainer}>
          <div className={styles.tabBar} role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={activeTab === tab.key}
                className={`${styles.tabBtn} ${activeTab === tab.key ? styles.active : ''}`}
                onClick={() => handleTabClick(tab.key)}
                disabled={loading}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={styles.contentArea}>
        {searchTerm.trim() ? renderSearchResults() : renderTabContent()}
      </div>
    </div>
  );
};

export default Explorer;
