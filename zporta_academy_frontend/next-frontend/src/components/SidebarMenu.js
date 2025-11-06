// src/components/SidebarMenu.js
import React, { useContext, useEffect, useState } from "react";
import {
  FaHome, FaCompass, FaBell, FaPen, FaBook,
  FaChevronLeft, FaChevronRight,
} from "react-icons/fa";
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from "@/styles/SidebarMenu.module.css";
import { lockBodyScroll, unlockBodyScroll } from "@/utils/scrollLock";
const MAIN_ORIGIN = process.env.NEXT_PUBLIC_MAIN_ORIGIN || "/";

export default function SidebarMenu({ isExpanded, setIsExpanded }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      const els = document.querySelectorAll('#zporta-sidebar');
      if (els.length > 1) console.warn('[SidebarMenu] Duplicate instances:', els.length, els);
    }
  }, []);
 
  const { user, token, logout } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  // warn if two sidebars accidentally mount (common cause of “duplicate” look)
  useEffect(() => {
    const els = document.querySelectorAll("#zporta-sidebar");
    if (els.length > 1) console.warn("[SidebarMenu] Duplicate instances mounted:", els.length);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) { setUnreadCount(0); return; }
      try {
        // Use a shorter timeout so slow boots don't hang the UI
        const res = await apiClient.get("/notifications/user-notifications/", { timeout: 8000 });
        const list = res.data.results ?? res.data;
        setUnreadCount(list.filter(n => !n.is_read).length);
      } catch (err) {
        // Be quiet in production to avoid noisy console on slow boots
        if (process.env.NODE_ENV !== 'production') {
          console.warn("Notifications fetch failed:", err?.message || err);
        }
        if (err.response?.status === 401) logout();
        setUnreadCount(0);
      }
    };
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [token, logout]);

  // lock background scroll while menu is expanded (esp. on mobile)
  useEffect(() => {
    if (isExpanded) lockBodyScroll();
    else unlockBodyScroll();
    return () => unlockBodyScroll();
  }, [isExpanded]);

  let profileImageUrl = "https://zportaacademy.com/media/managed_images/zpacademy.png";
  if (user?.profile_image_url?.trim()) profileImageUrl = user.profile_image_url.trim();

  const links = [
    { href: `${MAIN_ORIGIN}home`,              label: "Home",   Icon: FaHome },
    { href: `${MAIN_ORIGIN}learn`,             label: "Explore",Icon: FaCompass },
    { href: `${MAIN_ORIGIN}notifications`,     label: "Alerts", Icon: FaBell, badge: unreadCount },
    { href: `${MAIN_ORIGIN}diary`,             label: "Diary",  Icon: FaPen },
    { href: `${MAIN_ORIGIN}enrolled-courses`,  label: "Learn",  Icon: FaBook },
  ];

  return (
    <>
      <div
        id="zporta-sidebar"
        className={`sidebarMenu ${styles.sidebarMenu} ${isExpanded ? `expanded ${styles.expanded}` : `collapsed ${styles.collapsed}`}`}
      >
        <div className={styles.sidebarHeader}>
          {isExpanded
            ? <h1 className={styles.sidebarTitle}>Zporta<br/>Academy</h1>
            : <h1 className={styles.sidebarTitle}>ZPA</h1>}
        </div>

        {/* Profile */}
        <div className={styles.profileSection}>
          <a href={`${MAIN_ORIGIN}profile`} className={styles.profileHexagon}>
            <img src={profileImageUrl} alt="Profile" />
          </a>
          {isExpanded && (
            <div className={styles.profileInfo}>
              <h3>{user?.username || "User"}</h3>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className={styles.navRoot}>
          <ul className={styles.navList}>
            {links.map(({ href, label, Icon, badge }) => (
              <li key={href}>
                <a
                  href={href}
                  className={`${styles.navLink} ${badge ? styles.notificationLink : ""}`}
                >
                  <Icon className={styles.icon} />
                  {isExpanded && <span>{label}</span>}
                  {!!badge && <span className={styles.notificationBadge}>{badge}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Mobile backdrop (click to close) */}
      <button
        type="button"
        aria-hidden={!isExpanded}
        aria-label="Close sidebar"
        onClick={() => setIsExpanded(false)}
        className={`${styles.backdrop} ${isExpanded ? styles.backdropVisible : ""}`}
      />

      {/* Toggle */}
      <button
        className={`${styles.sidebarUnifiedHandle} ${isExpanded ? styles.isOpen : styles.isClosed} ${!isExpanded && unreadCount > 0 ? styles.hasUnread : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? "Close Menu" : "Open Menu"}
      >
        {isExpanded
          ? <FaChevronRight className={styles.handleIcon} />
          : <FaChevronLeft  className={styles.handleIcon} />}
      </button>
    </>
  );
}
