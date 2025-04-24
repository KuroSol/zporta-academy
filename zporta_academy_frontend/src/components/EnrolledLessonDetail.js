import React, { useEffect, useState, useContext } from 'react'; // Keep useContext
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet';
import { AuthContext } from '../context/AuthContext';
import apiClient from '../api'; 
import './EnrolledLessonDetail.css'; 


const EnrolledLessonDetail = () => {
  const { snapshotId } = useParams();
  const navigate = useNavigate();
  const [lessonData, setLessonData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const { token, logout } = useContext(AuthContext);

// useEffect to fetch specific lesson snapshot using apiClient
useEffect(() => {
  // Ensure we have the necessary info
  if (!snapshotId) {
      setError("Lesson snapshot ID is missing from URL.");
      setLoading(false);
      return;
  }
  if (!token) {
      setError("Please log in to view lesson details.");
      setLoading(false);
      // Optional: navigate('/login');
      return;
  }

  setLoading(true); // Start loading
  setError('');     // Clear previous errors

  const fetchSnapshot = async () => {
    try {
      // Use apiClient.get - Auth handled automatically
      const response = await apiClient.get(`/lessons/enrolled/${snapshotId}/`);

      // Axios data is in response.data
      // Check if we received an object
      if (response.data && typeof response.data === 'object' && !Array.isArray(response.data)) {
        setLessonData(response.data);
      } else {
        console.warn("Received unexpected format for lesson snapshot:", response.data);
        setLessonData(null); // Set null if format is wrong
        setError("Failed to load lesson: Unexpected data format.");
      }

    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching lesson snapshot:", err.response ? err.response.data : err.message);
      setLessonData(null); // Clear data on error

      if (err.response?.status === 404) {
        setError("Lesson snapshot not found (404).");
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        navigate('/login'); // Redirect
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch lesson: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  fetchSnapshot(); // Execute the fetch function

  // Dependency array: Fetch when snapshotId or token changes. Include navigate/logout.
}, [snapshotId, token, navigate, logout]); 


if (loading) return <p>Loading lesson...</p>; // Use loading state
if (error) return <p className="error-message">{error}</p>; // Keep error check
if (!lessonData) return <p>Lesson data not available.</p>; // Check if lessonData is null *after* loading

// handleCompleteLesson using apiClient
const handleCompleteLesson = async () => {
  if (!snapshotId || !token) {
      alert("Cannot complete lesson: Missing ID or not logged in.");
      return;
  }

  try {
    // Use apiClient.post - Auth handled automatically.
    // Send an empty object {} as payload if backend requires a body, otherwise omit it.
    // Adjust based on your API requirement. Let's assume no body needed:
    const response = await apiClient.post(`/lessons/enrolled/${snapshotId}/complete/`);

    // --- Handle Success ---
    // Axios data is in response.data
    // Display success message from API response if available
    alert(response.data?.message || "Lesson marked as complete!");
    // Optional: Update UI state if needed (e.g., show a "Completed" badge)
    // setLessonData(prev => ({ ...prev, completed: true })); // Example state update

  } catch (err) {
    // --- Handle Errors ---
    console.error("Error marking lesson complete:", err.response ? err.response.data : err.message);
    // Extract specific error message from API response if available
    const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.response?.data?.message || err.message;
    // Use alert for error message as in original code
    alert(`Failed to mark lesson complete: ${apiErrorMessage || "Please try again."}`);

    // Check for authorization errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout(); // Call logout from AuthContext
      // navigate('/login'); // Optional redirect
    }
  }
};

  return (
    <div className="enrolled-lesson-detail-container">
      <Helmet>
        <title>{lessonData.title}</title>
        <meta name="description" content={lessonData.seo_description} />
        <link rel="canonical" href={lessonData.canonical_url} />
        <meta property="og:title" content={lessonData.og_title} />
        <meta property="og:description" content={lessonData.og_description} />
        <meta property="og:image" content={lessonData.og_image} />
      </Helmet>
      <h1 className="lesson-title">{lessonData.title}</h1>
      <div className="lesson-content" dangerouslySetInnerHTML={{ __html: lessonData.content }}></div>
      {lessonData.video_url && (
        <div className="lesson-video">
          <a href={lessonData.video_url} target="_blank" rel="noopener noreferrer">
            Watch Video
          </a>
        </div>
      )}

      <button className="complete-lesson-btn" onClick={handleCompleteLesson}>
        Mark as Complete
      </button>

      <button onClick={() => navigate(-1)} className="back-btn">Back to Course</button>
    </div>
  );
};

export default EnrolledLessonDetail;
