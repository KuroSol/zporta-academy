import React, { useContext } from 'react';
import { Link } from 'react-router-dom';
import styles from './AppHeader.module.css'; // Assuming the CSS module is in the same folder
import { AuthContext } from '../../context/AuthContext'; // Adjust path as needed to your AuthContext
import { FaUserCircle } from 'react-icons/fa'; // Example icon

// If you have an SVG or a very optimized small PNG logo, you can import it:
// import logoImageSrc from '../assets/zporta-logo-icon.svg'; // Example path

const AppHeader = () => {
  const { user } = useContext(AuthContext); // Get user info from AuthContext

  const handleHeaderClick = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getDisplayName = () => {
    if (user) {
      return user.first_name || user.username || 'User';
    }
    return 'User';
  };

  return (
    <header className={styles.appHeader}>
      <Link to="/" className={styles.brandLink} onClick={handleHeaderClick} title="Zporta Academy - Homepage">
        {/* <img src={logoImageSrc} alt="Zporta Academy" className={styles.logoImage} /> */}
        <span className={styles.logoText}>Zporta Academy</span>
      </Link>
      
      {user && (
        <nav className={styles.headerNav}>
          <Link to="/profile" className={styles.welcomeLink} title="Go to your profile">
            <span className={styles.welcomeText}>Welcome back, </span>
            <span className={styles.usernameText}>{getDisplayName()}</span>
            {/* Optional: User icon */}
            {/* <FaUserCircle className={styles.userIcon} /> */}
          </Link>
          {/* Future navigation items can go here */}
        </nav>
      )}
    </header>
  );
};

export default AppHeader;
