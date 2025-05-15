// SidebarMenu.js
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaHome,
  FaCompass,
  FaBell,
  FaPen,
  FaBook,
  FaChevronLeft, // Icon for "Open" (pull from right)
  FaChevronRight, // Icon for "Close" (push to right)
} from "react-icons/fa";
import { AuthContext } from "./context/AuthContext"; // Adjust path if needed
import apiClient from "./api"; // Adjust path if needed
import "./SidebarMenu.css"; // Ensure this path is correct

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
        const response = await apiClient.get("/notifications/");
        const data = response.data;
        const unread = data.filter((n) => !n.is_read);
        setUnreadCount(unread.length);
      } catch (error) {
        console.error(
          "Error fetching notifications:",
          error.response ? error.response.data : error.message
        );
        if (error.response?.status === 401) {
          logout();
        }
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
      {/* Main Sidebar Container */}
      <div className={`sidebar-menu ${isExpanded ? "expanded" : "collapsed"}`}>
        <div className="sidebar-header">
          {isExpanded ? (
            <h1 className="sidebar-title">
              Zporta
              <br />
              Academy
            </h1>
          ) : (
            <h1 className="sidebar-title">ZPA</h1>
          )}
        </div>

        <div className="profile-section">
          <Link to="/profile">
            <div className="profile-hexagon">
              <img src={profileImageUrl} alt="Profile" />
            </div>
          </Link>
          {isExpanded && (
            <div className="profile-info">
              <h3>{user?.username || "User"}</h3>
            </div>
          )}
        </div>

        <nav>
          <ul>
            <li>
              <Link to="/home">
                <FaHome className="icon" />
                {isExpanded && <span>Home</span>}
              </Link>
            </li>
            <li>
              <Link to="/learn">
                <FaCompass className="icon" />
                {isExpanded && <span>Explore</span>}
              </Link>
            </li>
            <li>
              <Link to="/notifications" className="notification-link">
                <FaBell className="icon" />
                {isExpanded && <span>Alerts</span>}
                {unreadCount > 0 && (
                  <span className="notification-badge">{unreadCount}</span>
                )}
              </Link>
            </li>
            <li>
              <Link to="/diary">
                <FaPen className="icon" />
                {isExpanded && <span>Diary</span>}
              </Link>
            </li>
            <li>
              <Link to="/enrolled-courses">
                <FaBook className="icon" />
                {isExpanded && <span>Learn</span>}
              </Link>
            </li>
          </ul>
        </nav>
        {/* Desktop toggle button at the bottom is removed */}
      </div>

      {/* Unified Sidebar Toggle Handle - Positioned by CSS based on screen size and state */}
      <button
        className={`sidebar-unified-handle ${isExpanded ? "is-open" : "is-closed"}`}
        onClick={() => setIsExpanded(!isExpanded)}
        aria-label={isExpanded ? "Close Menu" : "Open Menu"}
      >
        {isExpanded ? (
          <FaChevronRight className="handle-icon" />
        ) : (
          <FaChevronLeft className="handle-icon" />
        )}
      </button>
    </>
  );
};

export default SidebarMenu;
