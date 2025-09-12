import React, { useState } from 'react';
import DiaryEditor from '@/components/diary/DiaryEditor';
import DiaryList from '@/components/diary/DiaryList';
import DiaryMentions from '@/components/diary/DiaryMentions';
import styles from '@/styles/DiaryManagement.module.css';
import DiaryRecommendations from '@/components/diary/DiaryRecommendations';

const DiaryManagement = () => {
    const [activeTab, setActiveTab] = useState('editor');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNoteCreated = () => {
        setRefreshKey(prev => prev + 1);
        setActiveTab('list');
    };

    // Helper function to get button class based on active state
    const btnClass = (tab) =>
    `${styles['diary-tab-btn']} ${activeTab === tab ? styles.active : ''}`;
    return (
        // Add a main container class for overall styling & scoping
        <div className={styles['diary-management-container']}>
        <header className={styles['diary-header']}>
            <h1 className={styles['diary-title']}>Diary Management</h1>
            <div className={styles['diary-tabs']}>
                    <button
                        type="button" // Good practice for non-submit buttons
                        className={btnClass('editor')}
                        onClick={() => setActiveTab('editor')}
                    >
                        New Entry
                    </button>
                    <button
                        type="button"
                        className={btnClass('list')}
                        onClick={() => setActiveTab('list')}
                    >
                        My Entries
                    </button>
                    <button
                        type="button"
                        className={btnClass('mentions')}
                        onClick={() => setActiveTab('mentions')}
                    >
                        Mentions
                    </button>
                </div>
            </header>
            {/* Main content area where components are rendered */}
            <main className={styles['diary-content']}>
                  {activeTab === 'editor' && (
                    <>
                    <DiaryEditor onNoteCreated={handleNoteCreated} />
                    <DiaryRecommendations title="Recommended right now" limit={12} />
                    </>
                )}
                {activeTab === 'list' && <DiaryList key={refreshKey} />}
                {activeTab === 'mentions' && <DiaryMentions />}
            </main>
            {/* Footer styling handled by CSS */}
            <footer className={styles['diary-footer']}>
                {/* Use JS for dynamic year */}
                <p>&copy; {new Date().getFullYear()} Zporta Academy</p>
            </footer>
        </div>
    );
};

export default DiaryManagement;