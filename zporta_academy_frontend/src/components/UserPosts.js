import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaRegClock, FaUser, FaEye } from 'react-icons/fa';
import apiClient from '../api'; // <-- Added import (Adjust path if needed)
import './UserPosts.css'; // Assuming CSS path is correct

const UserPosts = () => {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null); // <-- Added error state

    // Helper function remains the same
    const stripHTML = (html) => {
        if (!html) return ''; // Handle null/undefined html
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || "";
    };

    useEffect(() => {
        const fetchPosts = async () => {
            setLoading(true); // Ensure loading is set at the start
            setError(null); // Clear previous errors on new fetch
            try {
                // Use apiClient.get with relative URL '/posts/'
                const response = await apiClient.get('/posts/');
                const data = response.data; // Use response.data

                // Keep your sorting logic
                // Ensure data is an array before sorting
                if (Array.isArray(data)) {
                    setPosts(data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)));
                } else {
                    console.error('API response for posts is not an array:', data);
                    setPosts([]); // Set to empty array if response format is wrong
                    setError('Received invalid data format for posts.');
                }

            } catch (error) {
                // Handle Axios errors
                console.error('Error fetching posts:', error.response ? error.response.data : error.message);
                setError('Failed to load posts. Please try again.');

                // If this endpoint could potentially require auth:
                // if (error.response?.status === 401) { /* import and call logout(); */ }
            } finally {
                setLoading(false); // Ensure loading state is always updated
            }
        };

        fetchPosts();
        // Empty dependency array means fetch only runs once on mount
    }, []);

    // Conditional rendering based on state
    if (loading) return <p className="loading" style={{ textAlign: 'center', padding: '20px' }}>Loading posts...</p>;
    if (error) return <p className="error" style={{ color: 'red', textAlign: 'center', padding: '20px' }}>{error}</p>;

    // Main JSX structure remains the same
    return (
        <div className="user-posts-container">
            <h2>📢 Explore User Posts</h2>
            <div className="post-grid">
                {posts.length > 0 ? (
                    posts.map(post => (
                        <Link
                            // Ensure permalink exists before creating link
                            to={post.permalink ? `/posts/${post.permalink}` : '#'}
                            key={post.id}
                            className="post-card"
                        >
                            <div className="post-thumbnail">
                                {post.og_image_url ? (
                                    <img src={post.og_image_url} alt={post.title || 'Post image'} />
                                ) : (
                                    // Make sure post.content exists before stripping/substringing
                                    <p className="post-excerpt">
                                        {post.content ? stripHTML(post.content).substring(0, 100) + '...' : 'No content preview'}
                                    </p>
                                )}
                            </div>
                            <div className="post-content">
                                <h3 className="post-title">{post.title || 'Untitled Post'}</h3>
                                <p className="post-meta">
                                    <FaUser className="icon" /> {post.created_by || 'Unknown User'} &nbsp; | &nbsp;
                                    <FaRegClock className="icon" /> {post.created_at ? new Date(post.created_at).toLocaleDateString() : 'Unknown Date'}
                                </p>
                                <div className="hover-overlay">
                                    <button className="view-button">
                                        <FaEye className="eye-icon" /> View Post
                                    </button>
                                </div>
                            </div>
                        </Link>
                    ))
                ) : (
                    <p style={{ textAlign: 'center' }}>No posts available yet.</p>
                )}
            </div>
        </div>
    );
};

export default UserPosts;