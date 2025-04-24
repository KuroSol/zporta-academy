import React, { useState, useEffect, useContext } from 'react'; 
import { Link, useNavigate } from 'react-router-dom';
import apiClient from '../api'; 
import { AuthContext } from '../context/AuthContext'; 
import './EnrolledCourses.css'; 

const EnrolledCourses = () => {
  const [enrollments, setEnrollments] = useState([]);
  const [suggestedCourses, setSuggestedCourses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const [loadingEnrollments, setLoadingEnrollments] = useState(true);
  
  
  const navigate = useNavigate();
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
          navigate('/login'); // Redirect
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
  }, [token, navigate, logout]); // <-- Updated Dependency Array

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
}, [subjectForSuggestion, token, logout, navigate]); // <-- Updated Dependency Array

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
    return <p className="no-enrollments-message">You haven't enrolled in any courses yet.</p>;
  }

  return (
    <div className="enrolled-courses-container">
      <h2 className="heading">My Enrolled Courses</h2>
      <div className="grid-container">
        {paginatedEnrollments.map(enrollment => (
          <Link to={`/courses/enrolled/${enrollment.id}`} key={enrollment.id} className="grid-item-link">

            <div className="grid-item-card">
              {enrollment.course.cover_image ? (
                <img
                  src={enrollment.course.cover_image}
                  alt={`${enrollment.course.title} cover`}
                  className="grid-item-image"
                />
              ) : (
                <div className="grid-item-placeholder">
                  <p>No Image</p>
                </div>
              )}
              <div className="grid-item-info">
                <h3>{enrollment.course.title}</h3>
                <p className="grid-item-meta">
                  Enrolled on {new Date(enrollment.enrollment_date).toLocaleDateString()}
                </p>
                {enrollment.progress !== null && (
                  <div>
                    <div className="progress-container">
                      <div className="progress-bar" style={{ width: `${enrollment.progress}%` }}></div>
                    </div>
                    <div className="progress-number">{enrollment.progress}%</div>
                  </div>
                )}
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

      {/* Suggested Courses Section */}
      {<section className="suggested-section">
          <h2>Suggested Courses</h2>
          <div className="suggested-grid">
            {suggestedCourses.map(course => (
              <div
                key={course.id}
                className="suggested-card"
                onClick={() => navigate(`/courses/${course.permalink}`)}
              >
                {course.cover_image ? (
                  <img src={course.cover_image} alt={course.title} className="suggested-image" />
                ) : (
                  <div className="suggested-placeholder">No Image</div>
                )}
                <div className="suggested-info">
                  <h3>{course.title}</h3>
                  <p>{course.course_type === 'premium' ? 'Premium Course' : 'Free Course'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
/*      )*/} 
    </div>
  );
};

export default EnrolledCourses;
