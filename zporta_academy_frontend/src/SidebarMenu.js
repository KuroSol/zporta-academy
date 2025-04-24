// SidebarMenu.js
import React, { useContext, useEffect, useState } from "react";
import { Link } from "react-router-dom";
//import { FaHome, FaCompass, FaBell, FaPen, FaBook, FaGripVertical } from "react-icons/fa";
import {FaHome, FaCompass, FaBell, FaPen, FaBook,FaGripVertical, FaChevronRight, FaBars,FaTimes } from "react-icons/fa";  
import { AuthContext } from "./context/AuthContext"; // Adjust path if needed
import apiClient from "./api"; // Adjust path if needed
import "./SidebarMenu.css"; // Ensure this path is correct

const SidebarMenu = ({ isExpanded, setIsExpanded, permissions }) => {
  const { user, token, logout } = useContext(AuthContext);
  const [unreadCount, setUnreadCount] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);

  // Fetch notifications count from backend
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
    // Uncomment below lines for polling every 60 seconds if desired:
    const intervalId = setInterval(fetchNotifications, 60000);
    return () => clearInterval(intervalId);
  }, [token, logout]);

  // Determine profile image URL, use placeholder if needed
  let profileImageUrl = "https://robohash.org/mail@ashallendesign.co.uk";
  if (user?.profile_image_url) {
    let imgUrl = user.profile_image_url.trim();
    if (imgUrl) {
      profileImageUrl = imgUrl;
    }
  }

  // Determine toggle arrow depending on expansion state
  const desktopToggleArrow  = isExpanded ? ">>" : "<<";
  
 // Touch gesture handling for mobile view
 const handleTouchStart = (e) => {
  setTouchStartX(e.touches[0].clientX);
};

const handleTouchEnd = (e) => {
  if (touchStartX !== null) {
    const touchEndX = e.changedTouches[0].clientX;
    const diffX = touchEndX - touchStartX;

    // Only handle SWIPE RIGHT TO CLOSE (diffX > 50)
    // The button/handle now manages opening.
    if (diffX > 50 && isExpanded) { // Only close if already expanded
      setIsExpanded(false);
    }
    setTouchStartX(null); // Reset touch start position
  }
};



  return (
    <div 
      className={`sidebar-menu ${isExpanded ? "expanded" : "collapsed"}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Sidebar Header */}
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

      {/* Profile Section */}
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

      {/* Navigation */}
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

      {/* Toggle Button */}
      <button
        className="toggle-sidebar-desktop" // Renamed class
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {desktopToggleArrow} {/* Use renamed variable */}
      </button>
            {/* Mobile Handle: This vertical bar will be visible only in mobile */}
            {/* --- NEW MOBILE Toggle Button (The "Bump") --- */}
            {/* This button is only visible/styled on mobile via CSS */}
            <button
              className="toggle-sidebar-mobile"
              onClick={() => setIsExpanded(!isExpanded)}
              aria-label={isExpanded ? "Close Menu" : "Open Menu"} // For accessibility
            >
              {/* Change icon based on state */}
              {isExpanded ? <FaChevronRight className="mobile-toggle-icon" /> : <FaGripVertical className="mobile-toggle-icon" />}
            </button>
    </div>
  );
};

export default SidebarMenu;
