import React, { useEffect, useState, useContext } from "react"; // <-- ADD useContext
import { useParams, useNavigate } from "react-router-dom";
import { FaBook } from "react-icons/fa";
import "./CourseDetail.module.css"; // Assuming CSS is shared or correct
import { loadStripe } from '@stripe/stripe-js';
import apiClient from '../api'; // <-- ADD apiClient (Adjust path if needed)
import { AuthContext } from '../context/AuthContext'; // <-- ADD AuthContext

// Initialize Stripe with your test publishable key.
// This key is safe to expose on the frontend.
const stripePromise = loadStripe("pk_test_51KuSZdAyDb4VsWsQVWaz6RYSufh5e8ns6maCvV4b0g1waYUL4TvvgrB14G73tirboPQ67w3l8n8Tt631kACShVaT003wDftkeU");

const CourseOverview = () => {
  // Extract URL parameters that form the course permalink.
  const { username, date, subject, courseTitle } = useParams();
  const navigate = useNavigate();
  const permalink = `${username}/${date}/${subject}/${courseTitle}`;

  const [course, setCourse] = useState(null);
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [enrollMessage, setEnrollMessage] = useState("");
  const { user, token, logout } = useContext(AuthContext); // <-- ADD THIS
  const loggedInUser = user ? user.username : null;      // <-- Calculate loggedInUser from context


// Fetch course details and lessons using apiClient
useEffect(() => {
  // No need to check for token here, apiClient might handle public/private automatically
  // Or if the endpoint *requires* auth even for overview, let apiClient handle it.
  if (!permalink) {
      setError("Course identifier missing.");
      setLoading(false);
      return;
  }

  setLoading(true);
  setError("");

  const fetchCourseData = async () => {
    try {
      // Use apiClient.get - Auth handled by apiClient interceptors if needed
      const response = await apiClient.get(`/courses/${permalink}/`);

      // Axios data is in response.data
      if (response.data && response.data.course) {
        setCourse(response.data.course);
        setLessons(response.data.lessons || []); // Ensure lessons is an array
      } else {
         // Handle case where API gives 2xx but no course data
         console.warn("Course data received but missing 'course' object:", response.data);
         setError("Course data not found or invalid format.");
         setCourse(null);
         setLessons([]);
      }

    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching course data:", err.response ? err.response.data : err.message);
      setCourse(null); // Clear data on error
      setLessons([]);

      if (err.response?.status === 404) {
          setError("Course not found (404).");
      } else if (err.response?.status === 401 || err.response?.status === 403) {
          // This might happen if even viewing requires login and token is bad/missing
          setError("Unauthorized to view this course. Please log in.");
          // Decide if logout is appropriate here - maybe not if it's a public page view attempt
          // logout();
          // navigate('/login');
      } else {
           const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
          setError(`Error loading course: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  fetchCourseData();

  // Dependency array: Fetch when permalink changes.
  // We don't strictly need 'token' if apiClient handles it internally for GET requests.
  // Add 'logout' and 'navigate' if used in error handling.
}, [permalink, logout, navigate]); // <-- Adjusted Dependency Array

  // Check if the logged-in user is already enrolled in this course.
// Check enrollment status using apiClient
useEffect(() => {
  // Only check enrollment if we have a course ID AND the user is logged in (has a token)
  if (course && course.id && token) {
    const fetchEnrollmentStatus = async () => {
      try {
        // Use apiClient.get - Auth handled by apiClient
        const response = await apiClient.get("/enrollments/");

        // Axios data is in response.data
        if (response.data && Array.isArray(response.data)) {
           const enrollments = response.data;
           const isEnrolled = enrollments.some(
             (enrollment) =>
               enrollment.object_id === course.id &&
               enrollment.enrollment_type === "course"
           );
           setEnrolled(isEnrolled);
        } else {
           console.warn("Enrollment data received but not in expected format:", response.data);
           setEnrolled(false);
        }
      } catch (err) {
        // Handle errors from apiClient
        console.error("Error fetching enrollment status:", err.response ? err.response.data : err.message);
        setEnrolled(false); // Assume not enrolled on error

        // Log out only if it's an auth error *during* the check
        if (err.response?.status === 401 || err.response?.status === 403) {
           console.error("Auth error checking enrollment, logging out.");
           logout(); // Call logout from AuthContext
           // Optionally navigate to login
           // navigate('/login');
        }
        // Don't necessarily set the main page 'error' state here,
        // as failing enrollment check might not be critical page error.
      }
    };
    fetchEnrollmentStatus();
  } else {
    // If no course or no token, user is not enrolled in this context
    setEnrolled(false);
  }

  // Dependency array: Check when course changes or user logs in/out (token changes)
}, [course, token, logout]); // <-- Updated Dependency Array

  // Handler to enroll in the course (free) or start payment (premium)
// handleEnroll using apiClient
const handleEnroll = async () => {
  // Ensure course exists and user is logged in (token needed for enrollment/payment)
  if (!course?.id) {
      setEnrollMessage("Cannot enroll: Course details missing.");
      return;
  }
  if (!token) {
      setEnrollMessage("Please log in to enroll or purchase.");
      navigate('/login'); // Redirect to login if trying to enroll while logged out
      return;
  }

  setEnrollMessage(""); // Clear previous messages

  // --- Premium Course Logic (using apiClient) ---
  if (course.course_type === "premium") {
    try {
      // Use apiClient.post
      const response = await apiClient.post("/payments/create-checkout-session/", {
        course_id: course.id
      });
      const data = response.data; // Axios data

      if (data && data.sessionId) {
        // Stripe redirect logic (same as before)
        const stripe = await stripePromise;
        const { error: stripeError } = await stripe.redirectToCheckout({ sessionId: data.sessionId });
        if (stripeError) {
          console.error("Stripe redirect error:", stripeError.message);
          setEnrollMessage(`Payment initiation failed: ${stripeError.message}`);
        }
      } else {
         console.error("API Error: Checkout session ID not received.", data);
         setEnrollMessage(`Payment setup failed: ${data?.error || "Missing session ID."}`);
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error("Create checkout session error:", err.response ? err.response.data : err.message);
      setEnrollMessage(`Payment setup error: ${err.response?.data?.error || err.message || "Please try again."}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout(); // Logout on auth error
      }
    }

  // --- Free Course Logic (using apiClient) ---
  } else {
    try {
      // Note: Ensure your backend /enrollments/ endpoint expects this structure
      const enrollmentData = {
        object_id: course.id,
        enrollment_type: "course",
        // content_type might not be needed if backend determines it from object_id/type
      };
      // Use apiClient.post
      await apiClient.post("/enrollments/", enrollmentData);

      // If no error, enrollment succeeded
      setEnrolled(true);
      setEnrollMessage("Enrollment successful!");

    } catch (err) {
      // Handle errors from apiClient
      console.error("Free enrollment error:", err.response ? err.response.data : err.message);
      const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
      setEnrollMessage(`Enrollment failed: ${apiErrorMessage || "Please try again."}`);
      setEnrolled(false); // Ensure not marked as enrolled
      if (err.response?.status === 401 || err.response?.status === 403) {
        logout(); // Logout on auth error
      }
    }
  }
};
  if (loading) return <p>Loading...</p>;
  if (error) return <p>{error}</p>;

  // Determine if the logged-in user is the course creator.
  if (!course) return <p>Course data not available.</p>;

  return (
    <div className="course-detail-container">
      <h1 className="course-title">{course.title}</h1>
      {course.cover_image && (
        <img src={course.cover_image} alt="Course Cover" className="course-image" />
      )}
      <div className="course-description" dangerouslySetInnerHTML={{ __html: course.description }}></div>
      
      {/* Display price if the course is premium */}
      {course.course_type === "premium" && course.price > 0 && (
        <p className="course-price">Price: ${course.price}</p>
      )}

      <h2 className="section-title">
        <FaBook /> Lessons
      </h2>
      <ul className="lessons-list">
        {lessons.map((lesson) => (
          <li key={lesson.id} className="lesson-item">
            <strong>{lesson.title}</strong>
            <button className="study-btn" onClick={() => navigate(`/lessons/${lesson.permalink}`)}>
              Study
            </button>
          </li>
        ))}
      </ul>

      {/* Show the enrollment/payment option if the user is not the course creator 
      {!isCreator && (
        <div className="enroll-section">
          {enrolled ? (
            <button className="btn enrolled" disabled>
              Enrolled
            </button>
          ) : (
            <button className="btn enroll-button" onClick={handleEnroll}>
              {course.course_type === "premium" ? "Buy This Course" : "Enroll Now"}
            </button>
          )}
          {enrollMessage && <p className="message">{enrollMessage}</p>}
        </div>
      )}*/}
    </div>
  );
};

export default CourseOverview;