// Next version
import React, { useEffect, useState, useContext, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/Notifications.module.css';

export default function Notifications() {
  const { token, logout } = useContext(AuthContext);
  const router = useRouter();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Auth guard + initial load
  useEffect(() => {
    if (!token) {
      router.push('/login');
      return;
    }
    (async () => {
      setLoading(true);
      try {
        const { data } = await apiClient.get('/notifications/user-notifications/');
        const list = Array.isArray(data) ? data : (data?.results ?? []);
        setNotifications(list);
      } catch (err) {
        console.error('Failed to load notifications:', err);
        if (err?.response?.status === 401) logout();
        setError('Failed to load notifications.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, router, logout]);

  const isExternal = (link) => /^https?:\/\//i.test(link);

  const markAsRead = useCallback(async (n) => {
    if (n.is_read) return;
    try {
      await apiClient.patch(`/notifications/user-notifications/${n.id}/`, { is_read: true });
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  }, []);

  const handleClick = async (n) => {
    if (!n.link) return;
    await markAsRead(n);

    // Internal → Next router. External → hard open.
    if (!isExternal(n.link)) {
      // Normalize known Next dynamic routes that require trailing slash
      let path = n.link;
      if (path.startsWith('/quizzes/') && !path.endsWith('/review/') && !path.endsWith('/')) {
        path += '/';
      }
      router.push(path);
      return;
    }
    if (typeof window !== 'undefined') window.open(n.link, '_blank', 'noopener,noreferrer');
  };

  if (loading) return <p className={styles.status}>Loading notifications...</p>;
  if (error)   return <p className={`${styles.status} ${styles.error}`}>{error}</p>;
  if (!notifications?.length) return <p className={styles.status}>No new notifications.</p>;

  return (
    <div className={styles.container}>
      <h2 className={styles.heading}>Notifications</h2>
      <ul className={styles.list}>
        {notifications.map((n) => {
          const liClass = [
            styles.item,
            n.is_read ? styles.read : styles.unread,
            n.link ? styles.clickable : ''
          ].join(' ');
          return (
            <li
              key={n.id}
              className={liClass}
              onClick={() => handleClick(n)}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter') handleClick(n); }}
            >
              <div className={styles.content}>
                <p className={styles.title}>{n.title}</p>
                <p className={styles.message}>{n.message}</p>
              </div>
              <span className={styles.timestamp}>
                {new Date(n.created_at).toLocaleString()}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
