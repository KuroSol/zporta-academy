import React, { useState, useEffect, useContext } from 'react'; // <-- ADD useContext
import { useNavigate } from 'react-router-dom';
import apiClient from '../api'; // <-- ADD apiClient (Adjust path if needed)
import { AuthContext } from '../context/AuthContext'; // <-- ADD AuthContext
import './MyCourses.css';

const MyCourses = () => {
  const [courses, setCourses] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const itemsPerPage = 5;
  const { token, logout } = useContext(AuthContext); // <-- ADD THIS LINE
  
// useEffect using apiClient and AuthContext
useEffect(() => {
  // Use token from AuthContext to check if logged in
  if (!token) {
    setError('You must be logged in to view your courses.');
    setCourses([]); // Ensure courses are cleared if not logged in
    return;
  }

  const fetchMyCourses = async () => {
    setError(''); // Clear previous errors
    // We don't need setLoading here unless you want a loading indicator

    try {
      // Use apiClient.get - URL and auth handled automatically
      const response = await apiClient.get('/courses/my/');

      // Axios data is in response.data, check if it's an array
      if (response.data && Array.isArray(response.data)) {
        setCourses(response.data);
      } else {
        console.warn("Received unexpected format for 'my courses':", response.data);
        setCourses([]); // Set empty if format is wrong
        setError("Failed to load courses: Unexpected data format.");
      }

    } catch (err) {
      // Handle errors from apiClient (network, 4xx, 5xx)
      console.error("Error fetching my courses:", err.response ? err.response.data : err.message);
      setCourses([]); // Clear courses on error

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        navigate('/login'); // Redirect to login
      } else {
        // Generic error message
         const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch courses: ${apiErrorMessage || "Please try again."}`);
      }
    }
  };

  fetchMyCourses();

  // Dependency array: Fetch when token changes (login/logout) or navigate/logout functions change (rarely)
}, [token, navigate, logout]); // <-- Updated Dependency Array

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const totalPages = Math.ceil(courses.length / itemsPerPage);
  const paginatedCourses = courses.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  if (courses.length === 0) {
    return <p className="no-courses-message">You haven't created any courses yet.</p>;
  }

  return (
    <div className="my-courses-container">
      <h2 className="heading">My Courses</h2>
      <ul className="courses-list">
        {paginatedCourses.map(course => (
          <li key={course.id} className="course-item">
            <h3 className="course-title">{course.title}</h3>
            <p className="course-description">{course.description.substring(0, 100)}...</p>
            
            {/* Use the correct permalink from the database */}
            <button
              className="view-details-btn"
              onClick={() => navigate(`/courses/${course.permalink}`)}
            >
              View Details
            </button>
          </li>
        ))}
      </ul>

      {/* Pagination */}
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
    </div>
  );
};

export default MyCourses;
