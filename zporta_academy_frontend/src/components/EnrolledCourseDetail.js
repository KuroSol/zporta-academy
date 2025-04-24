import React, { useEffect, useState, useContext } from 'react'; // Keep useContext
import { useParams, useNavigate } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api'; //
import './EnrolledCourseDetail.css'; 


const EnrolledCourseDetail = () => {
  const { enrollmentId } = useParams();
  const navigate = useNavigate();
  const [enrollment, setEnrollment] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true); 
  const { token, logout } = useContext(AuthContext); 

// useEffect to fetch specific enrollment using apiClient
useEffect(() => {
  // Ensure we have the necessary info
  if (!enrollmentId) {
      setError("Enrollment ID is missing from URL.");
      setLoading(false);
      return;
  }
  if (!token) {
      setError("Please log in to view enrollment details.");
      setLoading(false);
      // Optional: navigate('/login');
      return;
  }

  setLoading(true); // Start loading
  setError('');     // Clear previous errors

  const fetchEnrollment = async () => {
    try {
      // Use apiClient.get - Auth handled automatically
      const response = await apiClient.get(`/enrollments/${enrollmentId}/`);

      // Axios data is in response.data
      // Check if we received an object (expected for a single enrollment)
      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        setEnrollment(response.data);
      } else {
        console.warn("Received unexpected format for enrollment:", response.data);
        setEnrollment(null); // Set null if format is wrong
        setError("Failed to load enrollment: Unexpected data format.");
      }

    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching enrollment:", err.response ? err.response.data : err.message);
      setEnrollment(null); // Clear enrollment data on error

      if (err.response?.status === 404) {
        setError("Enrollment not found (404).");
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        navigate('/login'); // Redirect
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch enrollment: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  fetchEnrollment(); // Execute the fetch function

  // Dependency array: Fetch when enrollmentId or token changes. Include navigate/logout.
}, [enrollmentId, token, navigate, logout]); // <-- Updated Dependency Array

if (loading) return <p>Loading enrollment...</p>; // Use loading state
if (error) return <p className="error-message">{error}</p>; // Keep error check
if (!enrollment) return <p>Enrollment data not available.</p>; // Check if enrollment is null *after* loading

  // Use snapshot details if available; fallback to live course details if not.
  const courseData = enrollment.course_snapshot ? enrollment.course_snapshot : enrollment.course;

  return (
    <div className="enrolled-course-detail">
      <h1>{courseData.title}</h1>
      {courseData.cover_image ? (
        <img 
          src={courseData.cover_image} 
          alt={`${courseData.title} cover`} 
          className="course-image" 
        />
      ) : (
        <div className="placeholder">No Image</div>
      )}
      <div 
        className="course-description" 
        dangerouslySetInnerHTML={{ __html: courseData.description }}
      ></div>
      {courseData.subject && (
        <p>
          <strong>Subject:</strong> {courseData.subject.name || courseData.subject}
        </p>
      )}

      {/* Lessons Section */}
      {courseData.lessons && courseData.lessons.length > 0 && (
        <>
          <h2>Lessons</h2>
          <ul className="lessons-list">
            {courseData.lessons.map((lesson) => (
              <li key={lesson.id} className="lesson-item">
                <button 
                  className="study-btn" 
                  onClick={() => navigate(`/lessons/${lesson.permalink}`)}
                >
                  {lesson.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {/* Quizzes Section */}
      {courseData.quizzes && courseData.quizzes.length > 0 && (
        <>
          <h2>Quizzes</h2>
          <ul className="quizzes-list">
            {courseData.quizzes.map((quiz) => (
              <li key={quiz.id} className="quiz-item">
                <button 
                  className="take-quiz-btn" 
                  onClick={() => navigate(`/quizzes/enrolled/${quiz.permalink}`)}
                >
                  {quiz.title}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <button onClick={() => navigate(-1)} className="back-btn">
        Back to My Courses
      </button>
    </div>
  );
};

export default EnrolledCourseDetail;
