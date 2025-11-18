"use client";
import React, { useState, useEffect, useContext } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BookOpen, Clock, Award, TrendingUp, ChevronRight } from 'lucide-react';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/EnrolledCourses.module.css';

const EnrolledCourses = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [suggestedCourses, setSuggestedCourses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  
  
  const router = useRouter();
  const itemsPerPage = 5;
  const { token, logout } = useContext(AuthContext); 

// Fetch enrolled courses using apiClient
  useEffect(() => {
    // Check for token from context
    if (!token) {
      setError('You must be logged in to view your enrollments.');
      setEnrollments([]); // Clear data
      setLoadingEnrollments(false); // Stop loading
      return;
    }

    const fetchEnrollments = async () => {
      setLoadingEnrollments(true); // Start loading
      setError(''); // Clear previous errors

      try {
        // Use apiClient.get - Auth handled automatically
        const response = await apiClient.get('/enrollments/user/');

        // Axios data is in response.data
        if (response.data && Array.isArray(response.data)) {
          setEnrollments(response.data);
        } else {
          console.warn("Received unexpected format for enrollments:", response.data);
          setEnrollments([]); // Set empty on unexpected format
          setError("Failed to load enrollments: Unexpected data format.");
        }
      } catch (err) {
        // Handle errors from apiClient
        console.error("Error fetching enrollments:", err.response ? err.response.data : err.message);
        setEnrollments([]); // Clear data on error

        if (err.response?.status === 401 || err.response?.status === 403) {
          setError('Session expired or unauthorized. Please log in again.');
          logout(); // Call logout from context
          router.push('/login');  // Redirect
        } else {
          const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
          setError(`Failed to fetch enrollments: ${apiErrorMessage || "Please try again."}`);
        }
      } finally {
        setLoadingEnrollments(false); // Stop loading indicator
      }
    };

    fetchEnrollments(); // Execute the fetch function

    // Dependency array: Fetch when token changes (login/logout)
  }, [token, router, logout]);  // <-- Updated Dependency Array

  // Derive subject for suggestions from the first enrolled course (if available)
  const subjectForSuggestion =
    enrollments.length > 0 &&
    enrollments[0].course &&
    enrollments[0].course.subject &&
    enrollments[0].course.subject.id
      ? enrollments[0].course.subject.id
      : null;

// Fetch suggested courses using apiClient
useEffect(() => {
  // Run only if we have a subject ID to suggest based on AND user is logged in
  if (subjectForSuggestion && token) {
    const fetchSuggestedCourses = async () => {
      // Optional: setLoadingSuggestions(true);
      try {
        // Use apiClient.get - Auth handled automatically
        const response = await apiClient.get(`/courses/suggestions/?subject=${subjectForSuggestion}`);

        // Axios data is in response.data
        if (response.data && Array.isArray(response.data)) {
          setSuggestedCourses(response.data);
        } else {
          console.warn("Received unexpected format for suggested courses:", response.data);
          setSuggestedCourses([]); // Set empty on unexpected format
        }
      } catch (err) {
        // Handle errors from apiClient
        // Don't necessarily set the main 'error' state, just log or use a separate suggestionError state
        console.error("Error fetching suggested courses:", err.response ? err.response.data : err.message);
        setSuggestedCourses([]); // Clear suggestions on error

        // Logout only if auth specifically fails for suggestions
        if (err.response?.status === 401 || err.response?.status === 403) {
           console.error("Auth error fetching suggestions, logging out.");
           // Decide if failing suggestions should log out the user. Maybe not.
           // logout();
           // navigate('/login');
        }
      } finally {
        // Optional: setLoadingSuggestions(false);
      }
    };
    fetchSuggestedCourses();
  } else {
    // If no subject or no token, clear suggestions
    setSuggestedCourses([]);
  }
  // Dependency array: Fetch when subjectForSuggestion changes or user logs in/out
}, [subjectForSuggestion, token, logout, router]); // <-- Updated Dependency Array

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(enrollments.length / itemsPerPage);
  const paginatedEnrollments = enrollments.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (loadingEnrollments) { // <-- Use loadingEnrollments state
    return <p>Loading your enrolled courses...</p>;
  }
  if (error) {
      return <p className="error-message">{error}</p>;
  }
  // Keep the check for empty enrollments
  if (enrollments.length === 0) {
    return <p className="no-enrollments-message">You haven&apos;t enrolled in any courses yet.</p>;
  }

  return (
    <div className={styles.enrolledCoursesContainer}>
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>My Learning Journey</h1>
          <p className={styles.pageSubtitle}>Continue where you left off and explore new courses</p>
        </div>
        <div className={styles.statsBar}>
          <div className={styles.statItem}>
            <BookOpen size={20} />
            <div>
              <div className={styles.statValue}>{enrollments.length}</div>
              <div className={styles.statLabel}>Enrolled</div>
            </div>
          </div>
          <div className={styles.statItem}>
            <Award size={20} />
            <div>
              <div className={styles.statValue}>
                {enrollments.filter(e => e.progress === 100).length}
              </div>
              <div className={styles.statLabel}>Completed</div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.coursesGrid}>
        {paginatedEnrollments.filter(enrollment => enrollment.course).map(enrollment => (
          <Link 
            href={`/courses/enrolled/${enrollment.id}`} 
            key={enrollment.id} 
            className={styles.courseCard}
          >
            <div className={styles.courseImageWrapper}>
              {enrollment.course?.cover_image ? (
                <Image
                  src={enrollment.course?.cover_image}
                  alt={`${enrollment.course?.title || 'Course'} cover`}
                  className={styles.courseImage}
                  width={400}
                  height={225}
                />
              ) : (
                <div className={styles.coursePlaceholder}>
                  <BookOpen size={48} />
                </div>
              )}
              {enrollment.progress !== null && enrollment.progress > 0 && (
                <div className={styles.progressBadge}>
                  <TrendingUp size={14} />
                  {Math.round(enrollment.progress)}%
                </div>
              )}
            </div>
            
            <div className={styles.courseContent}>
              <h3 className={styles.courseTitle}>{enrollment.course?.title || 'Untitled Course'}</h3>
              
              <div className={styles.courseMeta}>
                <div className={styles.metaItem}>
                  <Clock size={14} />
                  <span>Enrolled {new Date(enrollment.enrollment_date).toLocaleDateString()}</span>
                </div>
              </div>

              {enrollment.progress !== null && (
                <div className={styles.progressSection}>
                  <div className={styles.progressBar}>
                    <div 
                      className={styles.progressFill} 
                      style={{ width: `${enrollment.progress}%` }}
                    />
                  </div>
                  <div className={styles.progressText}>
                    {enrollment.progress === 100 ? (
                      <span className={styles.completedText}>
                        <Award size={14} /> Completed
                      </span>
                    ) : (
                      <span>{Math.round(enrollment.progress)}% Complete</span>
                    )}
                  </div>
                </div>
              )}

              <div className={styles.continueButton}>
                <span>Continue Learning</span>
                <ChevronRight size={16} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          {[...Array(totalPages)].map((_, index) => (
            <button
              key={index}
              className={`page-btn ${currentPage === index + 1 ? 'active' : ''}`}
              onClick={() => handlePageChange(index + 1)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}

      {suggestedCourses.length > 0 && (
        <section className={styles.suggestedSection}>
          <h2 className={styles.sectionTitle}>Recommended for You</h2>
          <div className={styles.suggestedGrid}>
            {suggestedCourses.map(course => (
              <div
                key={course.id}
                className={styles.suggestedCard}
                onClick={() => router.push(`/courses/${course.permalink}`)}
              >
                {course.cover_image ? (
                  <Image 
                    src={course.cover_image} 
                    alt={course.title} 
                    className={styles.suggestedImage}
                    width={300}
                    height={180}
                  />
                ) : (
                  <div className={styles.suggestedPlaceholder}>
                    <BookOpen size={32} />
                  </div>
                )}
                <div className={styles.suggestedInfo}>
                  <h3>{course.title}</h3>
                  <p className={styles.suggestedType}>
                    {course.course_type === 'premium' ? 'Premium Course' : 'Free Course'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )} 
    </div>
  );
};

export default EnrolledCourses;
