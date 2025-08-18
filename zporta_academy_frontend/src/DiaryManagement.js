import React, { useState } from 'react';
import DiaryEditor from './DiaryEditor'; // Assuming editor has its own styling
import DiaryList from './DiaryList'; // Assuming list has its own styling
import DiaryMentions from './DiaryMentions'; // Assuming mentions has its own styling
import './DiaryManagement.css'; // Import the CSS file for this page
import DiaryRecommendations from './DiaryRecommendations'; // Assuming recommendations has its own styling


const DiaryManagement = () => {
    const [activeTab, setActiveTab] = useState('editor');
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNoteCreated = () => {
        setRefreshKey(prev => prev + 1);
        setActiveTab('list');
    };

    // Helper function to get button class based on active state
    const getButtonClass = (tabName) => {
        return `diary-tab-btn ${activeTab === tabName ? 'active' : ''}`;
    };

    return (
        // Add a main container class for overall styling & scoping
        <div className="diary-management-container">
            <header className="diary-header">
                {/* Title styling handled by CSS */}
                <h1 className="diary-title">Diary Management</h1>
                {/* Tab container */}
                <div className="diary-tabs">
                    <button
                        type="button" // Good practice for non-submit buttons
                        className={getButtonClass('editor')}
                        onClick={() => setActiveTab('editor')}
                    >
                        New Entry
                    </button>
                    <button
                        type="button"
                        className={getButtonClass('list')}
                        onClick={() => setActiveTab('list')}
                    >
                        My Entries
                    </button>
                    <button
                        type="button"
                        className={getButtonClass('mentions')}
                        onClick={() => setActiveTab('mentions')}
                    >
                        Mentions
                    </button>
                </div>
            </header>
            {/* Main content area where components are rendered */}
            <main className="diary-content">
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
            <footer className="diary-footer">
                {/* Use JS for dynamic year */}
                <p>&copy; {new Date().getFullYear()} Zporta Academy</p>
            </footer>
        </div>
    );
};

export default DiaryManagement;