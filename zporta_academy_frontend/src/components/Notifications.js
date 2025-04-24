import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext'; // Assuming context path is correct
import apiClient from '../api'; // <--- Import apiClient (Adjust path if needed)
import './Notifications.css'; // Assuming CSS path is correct


const Notifications = () => {
  const { token, logout } = useContext(AuthContext); // Added logout for potential use on auth error
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // Added error state

  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true); // Ensure loading is true at the start
      setError(null); // Clear previous errors
      try {
        // Use apiClient.get with relative path; Auth header added by interceptor
        const response = await apiClient.get('/notifications/');
        setNotifications(response.data); // Data is in response.data
      } catch (error) {
        console.error("Error fetching notifications:", error.response ? error.response.data : error.message);
        setError("Failed to load notifications."); // Set error message for UI
        if (error.response?.status === 401) { // Example: Logout if unauthorized
          logout();
        }
      } finally {
        setLoading(false);
      }
    };

    if (token) { // Only fetch if token exists
      fetchNotifications();
    } else {
      setLoading(false); // No token, not loading
      // Optionally navigate away or show message if token is required
    }
  }, [token, logout]); // Added logout to dependencies

  if (loading) return <p>Loading notifications...</p>;
  if (error) return <p className="error">{error}</p>; // Display error message
  if (!notifications.length) return <p>No notifications.</p>;

  return (
    <div className="notifications-container">
      <h2>Notifications</h2>
      <ul>
        {notifications.map(n => (
          <li key={n.id} className={n.is_read ? 'read' : 'unread'}>
            {/* Consider making link handling more robust */}
            {n.message} {n.link && <a href={n.link} target="_blank" rel="noopener noreferrer">View</a>}
            {/* Add timestamp? Mark as read functionality? */}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Notifications;