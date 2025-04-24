import React, { useState } from "react";
import apiClient from './api';

const PasswordReset = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        try {
            setMessage(""); // Clear previous message
            // Use apiClient.post, relative URL, data object. Headers handled automatically.
            await apiClient.post('/users/password-reset/', { email });
        
            // If await finishes without error, it was successful
            setMessage("Password reset link has been sent to your email.");
            setEmail(""); // Optionally clear email field on success
        
          } catch (error) {
            // Handle Axios errors
            console.error("Password Reset Error:", error); // Log the full error
            if (error.response && error.response.data) {
              // Use backend error message if available (check for common DRF fields)
               const backendError = error.response.data.email || // Specific field error
                                    error.response.data.detail || // General DRF detail
                                    error.response.data.error ||  // Custom error field
                                    JSON.stringify(error.response.data); // Fallback complex error
               setMessage(backendError || "Something went wrong submitting your request.");
            } else if (error.request) {
              // Network error
              setMessage('Network error. Could not connect to the server.');
            } else {
              // Other unexpected errors
              setMessage('An unexpected error occurred.');
            }
            // No logout needed here as it's an unauthenticated action
          }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>Reset Password</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <button type="submit">Send Reset Link</button>
            </form>
            {message && <p>{message}</p>}
        </div>
    );
};

export default PasswordReset;
