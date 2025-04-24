import React, { useEffect, useState, useContext } from "react"; // <-- ADD useContext
import { useLocation, useNavigate } from "react-router-dom";
import apiClient from '../api'; // <-- ADD apiClient (Adjust path if needed)
import { AuthContext } from '../context/AuthContext'; // <-- ADD AuthContext

const PaymentSuccess = () => {
  const [loading, setLoading] = useState(true);
  const [enrollmentRecord, setEnrollmentRecord] = useState(null);
  const [fallbackTried, setFallbackTried] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { token, logout } = useContext(AuthContext);
  const sessionId = new URLSearchParams(location.search).get("session_id");
  const storedCourseId = localStorage.getItem("courseId");

// Fetch enrollments and try to find the one using apiClient
useEffect(() => {
  // Ensure we have the necessary info to proceed
  if (!token) {
      console.error("PaymentSuccess: User not logged in.");
      // Optionally set an error state for the user
      // setError("You must be logged in.");
      navigate('/login'); // Redirect if no token
      return;
  }
  if (!storedCourseId) {
      console.error("PaymentSuccess: Cannot verify enrollment without stored course ID.");
      // Optionally set an error state
      // setError("Could not verify enrollment: Course ID missing.");
      navigate('/my-courses'); // Navigate away if course ID is missing
      return;
  }

  setLoading(true); // Start loading

  const fetchEnrollment = async () => {
    try {
      // Use apiClient.get - Auth handled by apiClient
      const response = await apiClient.get("/enrollments/");

      // Axios data is in response.data
      if (response.data && Array.isArray(response.data)) {
        const enrollments = response.data;
        console.log("Enrollment GET data:", enrollments); // Debug log

        // Find the enrollment record matching the stored course ID
        const foundEnrollment = enrollments.find(
          (enrollment) =>
            enrollment.enrollment_type === "course" &&
            enrollment.object_id?.toString() === storedCourseId // Use optional chaining and already string
        );

        if (foundEnrollment) {
          console.log("Found enrollment record:", foundEnrollment);
          setEnrollmentRecord(foundEnrollment);
        } else {
           // This is expected if webhook is delayed, fallback will trigger
           console.log("Enrollment record not yet found for course ID:", storedCourseId);
        }
      } else {
         console.warn("Enrollment data received but not in expected format:", response.data);
         // Treat as not found, rely on fallback
      }

    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching enrollment status:", err.response ? err.response.data : err.message);
      // Don't necessarily set a page error, rely on fallback or redirect logic
      if (err.response?.status === 401 || err.response?.status === 403) {
         console.error("Auth error fetching enrollment, logging out.");
         logout();
         navigate('/login');
      }
    } finally {
      // Stop loading *after* attempt, even if not found, so fallback can trigger
      setLoading(false);
    }
  };

  fetchEnrollment();

  // Dependency array: Fetch when component mounts with valid token/courseId.
  // sessionId might trigger refetch if user somehow gets back here with different session? Unlikely.
  // storedCourseId is stable after mount. Token/logout/navigate are context/router hooks.
}, [storedCourseId, token, logout, navigate, sessionId]); // Include sessionId if it's relevant trigger

  // If no enrollment record was found and we haven't tried the fallback yet, trigger the fallback enrollment
// Fallback Enrollment Trigger using apiClient
useEffect(() => {
  // Condition to run: Not loading, no record found yet, haven't tried fallback, have course ID & token
  if (!loading && !enrollmentRecord && !fallbackTried && storedCourseId && token) {
    const triggerEnrollmentFallback = async () => {
      console.log("Attempting enrollment fallback for course ID:", storedCourseId); // Log attempt

      // Mark that we are trying the fallback *before* the API call
      setFallbackTried(true); // Prevent multiple attempts even if API fails quickly

      try {
        // Prepare data
        const enrollmentData = {
          object_id: parseInt(storedCourseId, 10), // Ensure courseId is an integer if backend expects it
          enrollment_type: "course"
        };

        // Use apiClient.post - Auth handled by apiClient
        const response = await apiClient.post("/enrollments/", enrollmentData);

        // Axios data is in response.data
        // Check if we got a valid enrollment object back
        if (response.data && response.data.id) { // Assuming successful enrollment returns the record with an ID
           console.log("Fallback enrollment successful:", response.data);
           setEnrollmentRecord(response.data); // Set the record state
        } else {
           // Handle case where API gives 2xx but no valid data
           console.error("Fallback enrollment API success but response missing data:", response.data);
           // Don't set enrollmentRecord, let the redirect logic handle failure later
        }

      } catch (err) {
        // Handle errors from apiClient
        console.error("Fallback enrollment failed:", err.response ? err.response.data : err.message);
        // Check for specific conflict error (maybe already enrolled via webhook just now?)
        if (err.response?.status === 400 && err.response?.data?.non_field_errors?.includes("already enrolled")) {
            console.warn("Fallback enrollment failed: Already enrolled (likely webhook succeeded).");
            // Consider trying to fetch the enrollment again here? Or just let redirect handle it.
        } else if (err.response?.status === 401 || err.response?.status === 403) {
           console.error("Auth error during fallback enrollment, logging out.");
           logout();
           navigate('/login');
        }
        // No need to set page error, just log it. Redirect logic will handle lack of enrollmentRecord.
      }
      // No finally block needed here as fallbackTried is set at the start of the attempt
    };

    triggerEnrollmentFallback();
  }
  // Dependency array: Trigger when loading finishes, or related states change. Include token/logout/navigate.
}, [loading, enrollmentRecord, fallbackTried, storedCourseId, token, logout, navigate]); // <-- Updated Dependency Array
  // Redirect automatically once the enrollment record is available
  useEffect(() => {
    if (!loading && enrollmentRecord && storedCourseId) {
      // The enrollment serializer returns a "course" field with a "permalink"
      const coursePermalink = enrollmentRecord.course && enrollmentRecord.course.permalink;
      if (coursePermalink) {
        // Construct the dynamic URL; note the trailing slash if needed by your route
        const courseUrl = `/courses/${coursePermalink}/`;
        console.log("Redirecting to course URL:", courseUrl);
        navigate(courseUrl);
      } else {
        // Fallback: redirect to the "My Courses" page if permalink isn't available
        navigate("/my-courses");
      }
    }
  }, [loading, enrollmentRecord, storedCourseId, navigate]);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h2>Payment Successful!</h2>
      {enrollmentRecord ? (
        <p>You are now enrolled in the course. Redirecting to your course...</p>
      ) : (
        <p>Your payment was successful, but enrollment is still processing.</p>
      )}
      {/* Fallback navigation link in case automatic redirection fails */}
      <button onClick={() => navigate("/my-courses")}>Go to My Courses</button>
    </div>
  );
};

export default PaymentSuccess;
