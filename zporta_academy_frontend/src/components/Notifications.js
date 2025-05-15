import React, { useEffect, useState, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api';
import './Notifications.css';

const Notifications = () => {
  const { token, logout } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1) initial HTTP fetch
  useEffect(() => {
    const fetchNotifications = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get('/notifications/');
        setNotifications(response.data);
      } catch (err) {
        setError('Failed to load notifications.');
        if (err.response?.status === 401) logout();
      } finally {
        setLoading(false);
      }
    };
    if (token) fetchNotifications();
    else setLoading(false);
  }, [token, logout]);

  // 2) WebSocket for real‐time updates
  useEffect(() => {
    if (!token) return;  // only connect if logged in

    // choose ws or wss depending on page protocol
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const socket = new WebSocket(
      `${protocol}://${window.location.host}/ws/notifications/`
    );

    socket.onopen = () => console.log('Notifications socket connected');
    socket.onmessage = (e) => {
      const newNotif = JSON.parse(e.data);
      // prepend to list
      setNotifications((prev) => [newNotif, ...prev]);
    };
    socket.onclose = () => console.log('Notifications socket closed');
    socket.onerror = (e) => console.error('Socket error', e);

    return () => socket.close();
  }, [token]);

  if (loading) return <p>Loading notifications...</p>;
  if (error)   return <p className="error">{error}</p>;
  if (!notifications.length) return <p>No notifications.</p>;

  return (
    <div className="notifications-container">
      <h2>Notifications</h2>
      <ul>
        {notifications.map(n => (
          <li key={n.id} className={n.is_read ? 'read' : 'unread'}>
            {n.message}
              {n.link && (
                <a
                  href="/diary"
                  className="view-link"
                  onClick={async (e) => {
                    e.preventDefault(); // stop the default navigation
                    try {
                      // mark it read on the server
                      await apiClient.patch(`/notifications/${n.id}/`, { is_read: true });
                    } catch (err) {
                      console.error('Failed to mark read', err);
                    }
                    // then go to the diary overview
                    window.location.href = '/diary';
                  }}
                >
                  View
                </a>
              )}
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
