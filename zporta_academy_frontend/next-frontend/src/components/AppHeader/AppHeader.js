import React, { useContext } from 'react';
import Link from 'next/link';
import styles from '../../styles/AppHeader.module.css'; // Assuming the CSS module is in the same folder
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
      {/* Logo / Brand - links to home */}
        <a href={process.env.NEXT_PUBLIC_MAIN_ORIGIN || '/'} className={styles.brandLink}>
          <span className={styles.logoText}>Zporta Academy</span>
        </a>


      {/* User welcome (shown only if logged in) */}
      {user && (
        <nav className={styles.headerNav}>
          <Link href="/profile" className={styles.welcomeLink} title="Go to your profile">
            <span className={styles.welcomeText}>Welcome back, </span>
            <span className={styles.usernameText}>{getDisplayName()}</span>
            {/* Optional: an icon next to the username */}
            {/* <FaUserCircle className={styles.userIcon} /> */}
          </Link>
          {/* Future nav items could go here */}
        </nav>
      )}
    </header>
  );
};

export default AppHeader;
