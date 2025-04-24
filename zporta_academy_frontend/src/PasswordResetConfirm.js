import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import apiClient from './api'; // <-- Added apiClient import (Adjust path if needed)

const PasswordResetConfirm = () => {
    const { uid, token } = useParams(); // Extract uid and token from the URL
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage(""); // Clear previous message

        if (newPassword !== confirmPassword) {
            setMessage("Passwords do not match.");
            return;
        }

        try {
            // Data object to send
            const resetData = {
              uid,
              token,
              new_password: newPassword,
              // confirm_new_password: confirmPassword // Often only new_password needed by backend here
            };

            // Use apiClient.post, relative URL, data object. Headers handled automatically.
            await apiClient.post('/users/password-reset/confirm/', resetData);

            // If await finishes without error, it was successful (2xx status)
            setMessage("Password reset successful! Redirecting to login...");
            // Clear fields on success
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => navigate("/login"), 2000); // Keep redirect

        } catch (error) {
            // Handle Axios errors
            console.error("Password Reset Confirm Error:", error); // Log the full error
            if (error.response && error.response.data) {
                // Use backend error message if available
                // Check common DRF fields or specific ones your backend might return
                const backendError = error.response.data.error ||
                                     error.response.data.detail ||
                                     (error.response.data.token ? `Token: ${error.response.data.token.join(' ')}` : null) ||
                                     (error.response.data.uid ? `UID: ${error.response.data.uid.join(' ')}` : null) ||
                                     (error.response.data.new_password ? `Password: ${error.response.data.new_password.join(' ')}` : null) ||
                                     (error.response.data.non_field_errors ? error.response.data.non_field_errors.join(' ') : null) ||
                                     "Password reset failed."; // Fallback message
                setMessage(backendError);
            } else if (error.request) {
                // Network error
                setMessage('Network error. Could not connect to the server.');
            } else {
                // Other unexpected errors
                setMessage('An unexpected error occurred.');
            }
        }
    };

    // JSX remains the same
    return (
        <div style={{ padding: "20px" }}> {/* Consider CSS Modules or styled-components */}
            <h1>Set New Password</h1>
            {/* Display message - consider styling success/error differently */}
            {message && <p className={message.includes("success") ? "success-message" : "error-message"}>{message}</p>}
            <form onSubmit={handleSubmit}>
                <div>
                    <label>New Password:</label>
                    <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                        autoComplete="new-password" // Added autocomplete
                    />
                </div>
                <div>
                    <label>Confirm Password:</label>
                    <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        autoComplete="new-password" // Added autocomplete
                    />
                </div>
                <button type="submit">Reset Password</button>
            </form>
        </div>
    );
};

export default PasswordResetConfirm;