// C:\Users\AlexSol\Documents\zporta_academy_frontend\src\DiaryPage.js
import React, { useState } from 'react';
import DiaryEditor from './DiaryEditor';
import DiaryList from './DiaryList';

const DiaryPage = () => {
    // We'll use this state to force a re-render of the DiaryList when a new note is created.
    const [refreshKey, setRefreshKey] = useState(0);

    const handleNoteCreated = () => {
        // Change the key value to force the DiaryList component to refresh
        setRefreshKey(prev => prev + 1);
    };

    return (
        <div>
            <DiaryEditor onNoteCreated={handleNoteCreated} />
            {/* Pass the refreshKey as a key prop to force re-render on change */}
            <DiaryList key={refreshKey} />
        </div>
    );
};

export default DiaryPage;
