import React from 'react';
import Link from 'next/link';
import { FaLock, FaCrown } from 'react-icons/fa';
import styles from '@/styles/PremiumLockOverlay.module.css';

/**
 * @component PremiumLockOverlay
 * @description A reusable overlay component that blocks access to premium content
 * while maintaining SEO visibility. Shows a prominent call-to-action for enrollment.
 * 
 * @param {Object} props
 * @param {boolean} props.isVisible - Whether to show the overlay
 * @param {Object} props.course - Course data (optional)
 * @param {string} props.course.title - Course title
 * @param {string} props.course.permalink - Course permalink
 * @param {string} props.message - Custom message to display
 * @param {boolean} props.isAuthenticated - Whether user is logged in
 * @param {string} props.redirectPath - Path to redirect to after login
 */
const PremiumLockOverlay = ({
  isVisible = false,
  course = null,
  message = "This is premium content. Enroll to access.",
  isAuthenticated = false,
  redirectPath = ""
}) => {
  if (!isVisible) return null;

  return (
    <div className={styles.overlayContainer}>
      <div className={styles.overlayBackdrop} />
      <div className={styles.overlayContent}>
        <div className={styles.lockIcon}>
          <FaLock size={48} />
        </div>
        
        <h2 className={styles.overlayTitle}>
          <FaCrown className={styles.crownIcon} /> Premium Content
        </h2>
        
        <p className={styles.overlayMessage}>
          {message}
        </p>
        
        {course && (
          <div className={styles.courseInfo}>
            <p className={styles.courseText}>
              Part of: <strong>{course.title}</strong>
            </p>
          </div>
        )}
        
        <div className={styles.overlayActions}>
          {course?.permalink && (
            <Link 
              href={`/courses/${course.permalink}`} 
              className={`${styles.btn} ${styles.btnPrimary}`}
            >
              View Course Details
            </Link>
          )}
          
          {!isAuthenticated && (
            <Link 
              href={`/login${redirectPath ? `?redirect=${encodeURIComponent(redirectPath)}` : ''}`}
              className={`${styles.btn} ${styles.btnSecondary}`}
            >
              Log In to Enroll
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default PremiumLockOverlay;
