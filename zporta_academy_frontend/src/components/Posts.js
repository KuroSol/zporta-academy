import React, { useEffect, useState, useContext } from "react"; // <-- ADD useContext
import { FaUser, FaRegClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import apiClient from '../api'; // <-- ADD apiClient (Adjust path if needed)
import { AuthContext } from '../context/AuthContext'; // <-- ADD AuthContext


const Posts = ({ profile }) => {  // Accept profile as a prop
  const [posts, setPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false); // Keep loading state
  const [error, setError] = useState(''); // <-- ADD error state
  const { token, logout } = useContext(AuthContext)

// useEffect to fetch specific user's posts using apiClient and optimized endpoint
useEffect(() => {
  // Ensure we have a username from the profile prop to fetch for
  const usernameToFetch = profile?.username;

  if (!usernameToFetch) {
    // If no profile/username provided, don't fetch, clear state
    setPosts([]);
    setPostsLoading(false);
    setError(""); // No error, just no user specified
    return;
  }

  // Check for token from context (assuming endpoint requires auth)
  if (!token) {
    setError("Authentication required to view posts.");
    setPosts([]);
    setPostsLoading(false);
    return;
  }

  const fetchUserPosts = async () => {
    setPostsLoading(true); // Start loading
    setError(''); // Clear previous errors

    try {
      // Use apiClient.get with query parameter - Auth handled automatically
      // *** Assumes backend supports filtering like this ***
      const response = await apiClient.get(`/posts/?created_by=${usernameToFetch}`);

      // Axios data is in response.data
      if (response.data && Array.isArray(response.data)) {
        setPosts(response.data); // Set state directly with filtered data from API
      } else {
        console.warn(`Received unexpected format for posts by ${usernameToFetch}:`, response.data);
        setPosts([]); // Set empty on unexpected format
        setError("Failed to load posts: Unexpected data format.");
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error(`Error fetching posts for ${usernameToFetch}:`, err.response ? err.response.data : err.message);
      setPosts([]); // Clear data on error

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch posts: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setPostsLoading(false); // Stop loading indicator
    }
  };

  fetchUserPosts(); // Execute the fetch function

  // Dependency array: Fetch when profile changes or token changes
}, [profile, token, logout]); // <-- Updated Dependency Array

return (
  <div className="posts-container">
    {/* Use profile username if available, otherwise default */}
    <h2>{profile?.username ? `${profile.username}'s` : 'User'} Posts</h2>
    {error && <p className="error-message">{error}</p>} {/* <-- ADD THIS LINE */}
    {postsLoading ? (
      <p>Loading posts...</p>
    ) : posts.length > 0 ? (
        <div className="post-list">
          {posts.map((post) => (
            <Link to={`/posts/${post.permalink}`} key={post.id} className="post-card">
              <h3>{post.title}</h3>
              <p>
                <FaUser /> {post.created_by} &nbsp; | &nbsp;
                <FaRegClock /> {new Date(post.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p>You don't have any posts.</p>
      )}
    </div>
  );
};

export default Posts;
