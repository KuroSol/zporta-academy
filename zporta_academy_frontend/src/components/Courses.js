// src/components/Courses.js
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FaEye } from "react-icons/fa";
import apiClient from '../api'; 
import { AuthContext } from '../context/AuthContext'; 


const Courses = () => { 
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false); 
  const [currentCoursePage, setCurrentCoursePage] = useState(1);
  const [error, setError] = useState(''); 
  const itemsPerCoursePage = 5;
  const navigate = useNavigate();
  const { token, logout } = useContext(AuthContext);

// useEffect to fetch user's courses using apiClient and AuthContext
useEffect(() => {
  // Check for token from context
  if (!token) {
    setError("Please log in to view your courses.");
    setCourses([]); // Clear courses if not logged in
    setCoursesLoading(false); // Ensure loading stops
    return;
  }

  const fetchCourses = async () => {
    setCoursesLoading(true); // Start loading
    setError(''); // Clear previous errors

    try {
      // Use apiClient.get - Auth handled automatically
      const response = await apiClient.get('/courses/my/');

      // Axios data is in response.data
      if (response.data && Array.isArray(response.data)) {
        setCourses(response.data);
      } else {
        console.warn("Received unexpected format for user courses:", response.data);
        setCourses([]); // Set empty on unexpected format
        setError("Failed to load courses: Unexpected data format.");
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching user courses:", err.response ? err.response.data : err.message);
      setCourses([]); // Clear courses on error

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        navigate('/login'); // Redirect
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch courses: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setCoursesLoading(false); // Stop loading indicator
    }
  };

  fetchCourses(); // Execute the fetch function

  // Dependency array: Fetch when token changes (login/logout) or navigate/logout functions change
}, [token, navigate, logout]); 


  const totalCoursePages = Math.ceil(courses.length / itemsPerCoursePage);
  const paginatedCourses = courses.slice(
    (currentCoursePage - 1) * itemsPerCoursePage,
    currentCoursePage * itemsPerCoursePage
  );

  if (coursesLoading) return <p>Loading courses...</p>;
  if (error) return <p className="error-message">{error}</p>; 
  if (!courses.length) return <p>No courses found.</p>;

  return (
    <div className="my-courses-container">
      <h2>Your Courses</h2>
      <ul className="courses-list">
        {paginatedCourses.map((course) => (
          <li key={course.id} className="course-item">
            <h3 className="course-title">{course.title}</h3>
            <p className="course-description">{course.description}</p>
            <button
              className="view-details-btn"
              onClick={() => navigate(`/courses/${course.permalink}`)}
            >
              <FaEye className="eye-icon" /> View Details
            </button>
          </li>
        ))}
      </ul>
      {totalCoursePages > 1 && (
        <div className="pagination">
          {[...Array(totalCoursePages)].map((_, index) => (
            <button
              key={index}
              className={`page-btn ${currentCoursePage === index + 1 ? "active" : ""}`}
              onClick={() => setCurrentCoursePage(index + 1)}
            >
              {index + 1}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Courses;
