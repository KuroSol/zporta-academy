// SidebarMenu.js
import React, { useContext, useEffect, useState } from "react";
import Link from 'next/link';
import {
  FaHome,
  FaCompass,
  FaBell,
  FaPen,
  FaBook,
  FaChevronLeft, // Icon for "Open" (pull from right)
  FaChevronRight, // Icon for "Close" (push to right)
} from "react-icons/fa";
import { AuthContext } from "../context/AuthContext";
import apiClient from "../api";


const SidebarMenu = ({ isExpanded, setIsExpanded }) => { // Removed permissions, not used
  const { user, token, logout } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  // Swipe gesture state and handlers are removed.

 useEffect(() => {
  const fetchNotifications = async () => {
    if (!token) {
      setUnreadCount(0);
      return;
    }
    try {
      const response = await apiClient.get("/notifications/user-notifications/");
      const list     = response.data.results ?? response.data;
      const unread   = list.filter((n) => !n.is_read);
      setUnreadCount(unread.length);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      if (error.response?.status === 401) logout();
      setUnreadCount(0);
    }
  };
  fetchNotifications();
  const intervalId = setInterval(fetchNotifications, 60000);
  return () => clearInterval(intervalId);
}, [token, logout]);


  let profileImageUrl = "https://zportaacademy.com/media/managed_images/zpacademy.png";
  if (user?.profile_image_url) {
    let imgUrl = user.profile_image_url.trim();
    if (imgUrl) {
      profileImageUrl = imgUrl;
    }
  }

  return (
    <>
      {/* Sidebar Menu Container */}
      <div className={`sidebar-menu ${isExpanded ? 'expanded' : 'collapsed'}`}>
        <div className="sidebar-header">
          {isExpanded ? (
            <h1 className="sidebar-title">
              Zporta<br />Academy
            </h1>
          ) : (
            <h1 className="sidebar-title">ZPA</h1>
          )}
        </div>

        {/* Profile Section */}
        <div className="profile-section">
          <Link href="/profile" className="profile-hexagon">
            <img src={profileImageUrl} alt="Profile" />
          </Link>
          {isExpanded && (
            <div className="profile-info">
              <h3>{user?.username || 'User'}</h3>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav>
          <ul>
            <li>
              <Link href="/home" className="nav-link">
                <FaHome className="icon" />
                {isExpanded && <span>Home</span>}
              </Link>
            </li>
            <li>
              <Link href="/learn" className="nav-link">
                <FaCompass className="icon" />
                {isExpanded && <span>Explore</span>}
              </Link>
            </li>
            <li>
              <Link href="/notifications" className="nav-link notification-link">
                <FaBell className="icon" />
                {isExpanded && <span>Alerts</span>}
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </Link>
            </li>
            <li>
              <Link href="/diary" className="nav-link">
                <FaPen className="icon" />
                {isExpanded && <span>Diary</span>}
              </Link>
            </li>
            <li>
              <Link href="/enrolled-courses" className="nav-link">
                <FaBook className="icon" />
                {isExpanded && <span>Learn</span>}
              </Link>
            </li>
          </ul>
        </nav>
        {/* (The toggle button is handled below) */}
      </div>

      {/* Unified Sidebar Toggle Handle */}
      <button
        className={
          `sidebar-unified-handle ${isExpanded ? 'is-open' : 'is-closed'}` +
          `${!isExpanded && unreadCount > 0 ? ' has-unread' : ''}`
        }
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? 'Close Menu' : 'Open Menu'}
      >
        {isExpanded ? <FaChevronRight className="handle-icon" /> : <FaChevronLeft className="handle-icon" />}
      </button>
    </>
    );
  };

export default SidebarMenu;
