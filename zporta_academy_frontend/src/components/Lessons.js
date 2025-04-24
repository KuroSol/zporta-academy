// src/components/Lessons.js
import React, { useState, useEffect, useContext } from "react"; // <-- ADD useContext
import { FaUser, FaRegClock } from "react-icons/fa";
import { Link } from "react-router-dom";
import apiClient from '../api'; 
import { AuthContext } from '../context/AuthContext'; 


const Lessons = ({ token }) => {
  const [lessons, setLessons] = useState([]);
  const [lessonsLoading, setLessonsLoading] = useState(false); // Keep loading state
  const [error, setError] = useState(''); // <-- ADD error state
  const { token, logout } = useContext(AuthContext); // <-- ADD context usage

// useEffect to fetch user's lessons using apiClient and AuthContext
useEffect(() => {
  // Check for token from context
  if (!token) {
    setError("Please log in to view your lessons.");
    setLessons([]); // Clear data
    setLessonsLoading(false); // Stop loading
    return;
  }

  const fetchMyLessons = async () => {
    setLessonsLoading(true); // Start loading
    setError(''); // Clear previous errors

    try {
      // Use apiClient.get - Auth handled automatically
      const response = await apiClient.get('/lessons/my/');

      // Axios data is in response.data
      if (response.data && Array.isArray(response.data)) {
        setLessons(response.data);
      } else {
        console.warn("Received unexpected format for user lessons:", response.data);
        setLessons([]); // Set empty on unexpected format
        setError("Failed to load lessons: Unexpected data format.");
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching user lessons:", err.response ? err.response.data : err.message);
      setLessons([]); // Clear data on error

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        // Optional: navigate('/login'); // Add if useNavigate is imported/used
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch lessons: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setLessonsLoading(false); // Stop loading indicator
    }
  };

  fetchMyLessons(); // Execute the fetch function

  // Dependency array: Fetch when token changes (login/logout)
}, [token, logout]); // <-- Updated Dependency Array (add navigate if used)

return (
  <div className="lessons-container">
    <h2>Your Lessons</h2>
    {error && <p className="error-message">{error}</p>} {/* <-- ADD THIS LINE */}
    {lessonsLoading ? (
        <p>Loading lessons...</p>
      ) : lessons.length > 0 ? (
        <div className="lesson-list">
          {lessons.map((lesson) => (
            <Link to={`/lessons/${lesson.permalink}`} key={lesson.id} className="lesson-card">
              <h3>{lesson.title}</h3>
              <p>
                <FaUser /> {lesson.created_by} &nbsp; | &nbsp;
                <FaRegClock /> {new Date(lesson.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p>You don't have any lessons.</p>
      )}
    </div>
  );
};

export default Lessons;
