// src/components/SidebarMenu.js
import React, { useContext, useEffect, useState } from "react";
import {
  FaHome, FaCompass, FaBell, FaPen, FaBook,
  FaChevronLeft, FaChevronRight,
} from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api";

const MAIN_ORIGIN = process.env.NEXT_PUBLIC_MAIN_ORIGIN || "/";

export default function SidebarMenu({ isExpanded, setIsExpanded }) {
  const { user, token, logout } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchNotifications = async () => {
      if (!token) { setUnreadCount(0); return; }
      try {
        const res = await apiClient.get("/notifications/user-notifications/");
        const list = res.data.results ?? res.data;
        setUnreadCount(list.filter(n => !n.is_read).length);
      } catch (err) {
        console.error("Error fetching notifications:", err);
        if (err.response?.status === 401) logout();
        setUnreadCount(0);
      }
    };
    fetchNotifications();
    const id = setInterval(fetchNotifications, 60000);
    return () => clearInterval(id);
  }, [token, logout]);

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
      <div className={`sidebar-menu ${isExpanded ? "expanded" : "collapsed"}`}>
        <div className="sidebar-header">
          {isExpanded ? <h1 className="sidebar-title">Zporta<br/>Academy</h1> : <h1 className="sidebar-title">ZPA</h1>}
        </div>

        {/* Profile */}
        <div className="profile-section">
          <a href={`${MAIN_ORIGIN}profile`} className="profile-hexagon">
            <img src={profileImageUrl} alt="Profile" />
          </a>
          {isExpanded && (
            <div className="profile-info">
              <h3>{user?.username || "User"}</h3>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav>
          <ul>
            {links.map(({ href, label, Icon, badge }) => (
              <li key={href}>
                <a href={href} className={`nav-link ${badge ? "notification-link" : ""}`}>
                  <Icon className="icon" />
                  {isExpanded && <span>{label}</span>}
                  {!!badge && <span className="notification-badge">{badge}</span>}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      {/* Toggle */}
      <button
        className={`sidebar-unified-handle ${isExpanded ? "is-open" : "is-closed"}${!isExpanded && unreadCount > 0 ? " has-unread" : ""}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? "Close Menu" : "Open Menu"}
      >
        {isExpanded ? <FaChevronRight className="handle-icon" /> : <FaChevronLeft className="handle-icon" />}
      </button>
    </>
  );
}
