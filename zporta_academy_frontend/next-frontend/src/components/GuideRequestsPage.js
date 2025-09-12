"use client";
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import styles from '@/styles/GuideRequestsPage.module.css';


const GuideRequestsPage = () => {
  const { token, user, logout } = useContext(AuthContext); 
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true); 
  const [error, setError] = useState(''); 

// useEffect to fetch guide requests using apiClient
useEffect(() => {
  // Check for token from context
  if (!token) {
    setError("Please log in to view guide requests.");
    setLoading(false); // Stop loading
    setRequests([]); // Clear data
    return;
  }

  const loadRequests = async () => { // Renamed inner function
    setLoading(true); // Start loading
    setError('');     // Clear previous errors

    try {
      // Use apiClient.get - Auth handled automatically
      const response = await apiClient.get('/social/guide-requests/');

      // Axios data is in response.data
      if (response.data && Array.isArray(response.data)) {
        setRequests(response.data);
      } else {
        console.warn("Received unexpected format for guide requests:", response.data);
        setRequests([]); // Set empty on unexpected format
        setError("Failed to load requests: Unexpected data format.");
      }
    } catch (err) {
      // Handle errors from apiClient
      console.error("Error fetching guide requests:", err.response ? err.response.data : err.message);
      setRequests([]); // Clear data on error

      if (err.response?.status === 401 || err.response?.status === 403) {
        setError('Session expired or unauthorized. Please log in again.');
        logout(); // Call logout from context
        // Optional: navigate('/login'); - If useNavigate is imported/used
      } else {
        const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
        setError(`Failed to fetch requests: ${apiErrorMessage || "Please try again."}`);
      }
    } finally {
      setLoading(false); // Stop loading indicator
    }
  };

  loadRequests(); // Execute the fetch function

  // Dependency array: Fetch when token changes (login/logout)
}, [token, logout]); // <-- Updated Dependency Array (add navigate if used in error handling)

  // Handler for accepting a request
// handleAccept using apiClient
const handleAccept = async (requestId) => {
  if (!token) {
      alert("Authentication error. Please log in again.");
      logout(); // Ensure logout if token is missing unexpectedly
      return;
  }
  try {
    // Use apiClient.post - Auth handled automatically, no body needed assumed
    await apiClient.post(`/social/guide-requests/${requestId}/accept/`);

    // --- Handle Success ---
    // Update local state to reflect acceptance immediately
    setRequests(prevRequests =>
        prevRequests.map(r =>
            r.id === requestId ? { ...r, status: 'accepted' } : r
        )
    );
    alert("Request accepted successfully!"); // Optional success feedback

  } catch (err) {
    // --- Handle Errors ---
    console.error("Error accepting guide request:", err.response ? err.response.data : err.message);
    // Extract specific error message from API response if available
    const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
    // Use alert for error message as in original code
    alert(`Failed to accept request: ${apiErrorMessage || "Please try again."}`);

    // Check for authorization errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout(); // Call logout from AuthContext
    }
  }
};

// handleDeny using apiClient
const handleDeny = async (requestId) => {
  if (!token) {
      alert("Authentication error. Please log in again.");
      logout();
      return;
  }
  try {
    // Use apiClient.post - Auth handled automatically, no body needed assumed
    await apiClient.post(`/social/guide-requests/${requestId}/deny/`);

    // --- Handle Success ---
    // Update local state to reflect decline immediately
    setRequests(prevRequests =>
        prevRequests.map(r =>
            r.id === requestId ? { ...r, status: 'declined' } : r
        )
    );
    alert("Request declined successfully!"); // Optional success feedback

  } catch (err) {
    // --- Handle Errors ---
    console.error("Error declining guide request:", err.response ? err.response.data : err.message);
    // Extract specific error message from API response if available
    const apiErrorMessage = err.response?.data?.detail || err.response?.data?.error || err.message;
    // Use alert for error message as in original code
    alert(`Failed to decline request: ${apiErrorMessage || "Please try again."}`);

    // Check for authorization errors
    if (err.response?.status === 401 || err.response?.status === 403) {
      logout(); // Call logout from AuthContext
    }
  }
};

  // If user data isn't loaded yet, show a loading indicator.
  if (loading) return <p>Loading guide requests...</p>;
  if (error) return <p className={styles.error}>{error}</p>;
  if (!requests.length) return <p className={styles.noRequests}>No guide requests available.</p>;
  if (!user) return <p>Loading user data...</p>;

  return (
    <div className={styles.guideRequestsContainer}>
      <h2>Guide Requests</h2>
      <ul className={styles.requestsList}>
        {requests.map(req => (
          <li key={req.id} className={styles.requestItem}>
            <div>
              <strong>Explorer:</strong> {req.explorer_username ? req.explorer_username : req.explorer}
            </div>
            <div>
              <strong>Status:</strong> {req.status}
            </div>
            <div>
              <strong>Requested At:</strong> {new Date(req.created_at).toLocaleString()}
            </div>
            {/* Only show Accept/Deny buttons if the logged-in user is the guide 
                and the request is pending */}
            { user && String(req.guide) === String(user.user_id) && req.status === "pending" && (
              <div className={styles.actionButtons}>
                <button onClick={() => handleAccept(req.id)} className={styles.acceptButton}>
                  Accept
                </button>
                <button onClick={() => handleDeny(req.id)} className={styles.denyButton}>
                  Deny
                </button>
              </div>
            )}
            { console.log("req.guide:", req.guide, typeof req.guide, "user.user_id:", user.user_id, typeof user.user_id) }
          </li>
        ))}
      </ul>
    </div>
  );
};

export default GuideRequestsPage;
