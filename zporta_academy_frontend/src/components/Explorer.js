import React, { useState, useEffect, useContext } from 'react'; // Added useContext
import { Link } from 'react-router-dom';
import apiClient from '../api'; // <-- Added apiClient (Adjust path)
import { AuthContext } from '../context/AuthContext'; // <-- Added AuthContext (Adjust path)
import QuizCard from './QuizCard'; 
import './Explorer.css'; // Assuming CSS path is correct

const Explorer = () => {
    const [activeTab, setActiveTab] = useState('courses');
    const [items, setItems] = useState([]);
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(true); // Added loading state
    const { logout } = useContext(AuthContext); // Use context

    // Helper function remains the same
    const stripHTML = (html) => {
        if (!html) return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || "";
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true); // Start loading
            setMessage(''); // Clear message
            let relativePath = '';
            switch (activeTab) {
                /*case 'posts': relativePath = '/posts/'; break;*/
                case 'courses': relativePath = '/courses/'; break;
                case 'lessons': relativePath = '/lessons/'; break;
                case 'quizzes': relativePath = '/quizzes/'; break;
                case 'guides': relativePath = '/users/guides/'; break;
                default: relativePath = '/courses/';
            }

            try {
                const response = await apiClient.get(relativePath);
                if (Array.isArray(response.data)) {
                    setItems(response.data);
                } else {
                    console.warn(`Received non-array data for ${activeTab}:`, response.data);
                    setItems([]);
                    setMessage(`Received invalid data for ${activeTab}.`);
                }
            } catch (error) {
                console.error(`Error fetching ${activeTab}:`, error.response ? error.response.data : error.message);
                let errorMsg = `Failed to load ${activeTab}.`;
                if (error.response?.data?.detail) {
                    errorMsg = error.response.data.detail;
                }
                setMessage(errorMsg);
                setItems([]); // Clear items on error
                if (error.response?.status === 401) logout(); // Logout on auth error
            } finally {
                setLoading(false); // Stop loading
            }
        };

        fetchData();
        // Re-fetch when activeTab changes, include logout in dependencies
    }, [activeTab, logout]);

    // Render Grid Item logic remains the same...
// Inside the Explorer component...

    // UPDATED renderGridItem function
    const renderGridItem = (item) => {
        // Basic check for item validity
        if (!item || !item.id) {
            console.warn("Skipping render for invalid item:", item);
            return null;
        }

        let linkUrl = '#'; // Default link
        // Determine image URL (prefer specific fields, fallback to null)
        let imageUrl = item.og_image_url || item.cover_image || item.profile_image_url || null;
        let title = item.title || item.username || 'Untitled Item'; // Default title
        // Use description field if available, otherwise fallback to content/bio snippet
        let description = item.description || (item.content ? stripHTML(item.content).substring(0, 100) + '...' : (item.bio ? stripHTML(item.bio).substring(0, 100) + '...' : ''));
        // Prefer username fields for creator display
        let createdBy = item.created_by_username || item.creator_username || (item.user ? item.user.username : null) || 'Unknown';
        let createdAt = item.created_at ? new Date(item.created_at).toLocaleDateString() : '';
        let typeLabel = ''; // For course type, etc.

        // Determine the correct link URL based on the active tab and available data
        if (activeTab === 'posts' && item.permalink) {
            linkUrl = `/posts/${item.permalink}`;
        } else if (activeTab === 'courses' && item.permalink) {
            linkUrl = `/courses/${item.permalink}`;
        } else if (activeTab === 'lessons' && item.permalink) {
            linkUrl = `/lessons/${item.permalink}`; // Assuming lessons have permalinks and a route
        } else if (activeTab === 'quizzes' && item.id) {
            // Quizzes might not have permalinks, link to a quiz detail/attempt page?
            return <QuizCard key={item.id} quiz={item} />; // Example link using ID
        } else if (activeTab === 'guides' && item.username) {
            linkUrl = `/guide/${item.username}`; // Link to guide profile
        }

        // Add specific labels for certain types
        if (activeTab === 'courses' && item.course_type) {
            typeLabel = item.course_type.charAt(0).toUpperCase() + item.course_type.slice(1) + ' Course';
        }

        // --- Consistent Placeholder Rendering ---
        const renderImageOrPlaceholder = () => {
            // If we have a valid image URL
            if (imageUrl && imageUrl !== 'https://via.placeholder.com/150') { // Also check against default placeholder URL if used previously
                return <img src={imageUrl} alt={title} className="grid-item-image" loading="lazy" />;
            }
            // Specific placeholder for lessons/quizzes (usually no image)
            if (activeTab === 'lessons' || activeTab === 'quizzes') {
                 return (
                     <div className="grid-item-placeholder lesson-quiz-placeholder">
                         {/* You could add specific icons here later if desired */}
                         <h3>{title}</h3> {/* Display title prominently */}
                     </div>
                 );
            }
            // Generic placeholder for Posts, Courses, Guides if no image
            return (
                <div className="grid-item-placeholder">
                    {/* Optional: Add a generic icon here */}
                    <p>No Image Available</p>
                </div>
            );
        };

        // Final Card structure using Link component
        return (
            <Link to={linkUrl} key={item.id} className="grid-item-link" aria-label={`View ${title}`}>
                <div className="grid-item-card">
                    {renderImageOrPlaceholder()} {/* Render image or correct placeholder */}
                    <div className="grid-item-info">
                        <h3>{title}</h3>
                        {/* Conditionally render description/type */}
                        {description && (activeTab === 'posts' || activeTab === 'guides') &&
                            <p className="grid-item-description">{description}</p>
                        }
                        {typeLabel &&
                            <p className="grid-item-type">{typeLabel}</p>
                        }
                        {/* Meta info */}
                        <p className="grid-item-meta">
                           {/* Show creator except for guides (where title IS the creator) */}
                           {activeTab !== 'guides' && createdBy && `By: ${createdBy} | `}
                           {createdAt}
                        </p>
                    </div>
                </div>
            </Link>
        );
    }; // End renderGridItem function

    // ... rest of the Explorer component (useEffect, state, main return structure) ...


    // Main JSX structure
    return (
        <div className="explorer-container">
            <div className="tab-bar">
                {[/*'posts'*/, 'courses', 'lessons', 'quizzes', 'guides'].map((tab) => (
                    <button
                        key={tab}
                        className={`tab-btn ${activeTab === tab ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab)}
                    >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                ))}
            </div>

            {/* Display loading or error or content */}
            {loading ? (
                <p className="loading" style={{ textAlign: 'center', padding: '20px' }}>Loading {activeTab}...</p>
            ) : message ? ( // Changed from error to message to show API errors
                <p className="error-message" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{message}</p>
            ) : (
                <div className="grid-container">
                    {items.length > 0 ? items.map(renderGridItem) : <p style={{ textAlign: 'center' }}>No {activeTab} available.</p>}
                </div>
            )}
        </div>
    );
};

export default Explorer;