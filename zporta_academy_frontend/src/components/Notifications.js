import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api';
import './Notifications.css';

const Notifications = () => {
  const { token, logout } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const response = await apiClient.get('/notifications/user-notifications/');
        const list     = response.data.results ?? response.data;
        setNotifications(list);
      } catch (err) {
        console.error("Failed to load notifications:", err);
        if (err.response?.status === 401) logout();
        setError('Failed to load notifications.');
      } finally {
        setLoading(false);
      }
    };
    fetchNotifications();
  }, [token, logout]);

  
  // NOTE: Your WebSocket logic can be added back here if needed for live updates.

  const handleNotificationClick = async (notification) => {
    // Only proceed if the notification has a link
    if (!notification.link) return;

    // Mark as read on the server if it's not already
    if (!notification.is_read) {
        try {
            await apiClient.patch(`/notifications/user-notifications/${notification.id}/`, { is_read: true });
            // Optimistically update the UI to show it as read immediately
            setNotifications(prev => prev.map(n => 
                n.id === notification.id ? { ...n, is_read: true } : n
            ));
        } catch (err) {
            console.error('Failed to mark notification as read', err);
        }
    }

    // This logic correctly handles navigation for both internal and external links
    try {
        // Create a full URL to parse it, even if the link is relative
        const url = new URL(notification.link, window.location.origin);
        if (url.origin === window.location.origin) {
            // It's an internal link, use React Router to navigate
            navigate(url.pathname + url.search);
        } else {
            // It's an external link, open it in a new tab for security
            window.open(notification.link, '_blank', 'noopener,noreferrer');
        }
    } catch (_) {
        // If the link is relative and not a full URL (e.g., "/courses/1"), navigate directly
        navigate(notification.link);
    }
  };

  if (loading) return <p className="notification-status">Loading notifications...</p>;
  if (error)   return <p className="notification-status error">{error}</p>;
  if (!notifications || notifications.length === 0) return <p className="notification-status">No new notifications.</p>;

  return (
    <div className="notifications-container">
      <h2>Notifications</h2>
      <ul>
        {notifications.map(n => (
          // Make the entire list item clickable
          <li 
            key={n.id} 
            className={`${n.is_read ? 'read' : 'unread'} ${n.link ? 'clickable' : ''}`}
            onClick={() => handleNotificationClick(n)}
          >
            <div className="notification-content">
              <p className="notification-title">{n.title}</p>
              <p className="notification-message">{n.message}</p>
            </div>
            <span className="timestamp">
              {new Date(n.created_at).toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Notifications;
