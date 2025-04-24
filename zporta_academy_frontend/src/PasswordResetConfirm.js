import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom"; // Import Link
import apiClient from './api';
import styles from './PasswordReset.module.css'; // Import the SAME CSS module

const PasswordResetConfirm = () => {
    const { uid, token } = useParams(); // Extract uid and token from the URL
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState(''); // 'error' or 'success'
    const navigate = useNavigate();

    const showMessage = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        showMessage(""); // Clear previous message

        if (newPassword !== confirmPassword) {
            showMessage("Passwords do not match.", 'error');
            return;
        }
        if (newPassword.length < 8) { // Example: Basic password length check
             showMessage("Password must be at least 8 characters long.", 'error');
             return;
        }

        try {
            const resetData = {
                uid,
                token,
                new_password: newPassword,
            };

            await apiClient.post('/users/password-reset/confirm/', resetData);

            showMessage("Password reset successful! Redirecting to login...", 'success');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => navigate("/login"), 3000); // Redirect after a short delay

        } catch (error) {
            console.error("Password Reset Confirm Error:", error);
            let errorMsg = "Password reset failed. The link may be invalid or expired."; // Default error
            if (error.response && error.response.data) {
                 // Try to extract a more specific error from backend response
                 const backendError = error.response.data.error ||
                                      error.response.data.detail ||
                                      (error.response.data.token ? `Token Error: ${error.response.data.token.join(' ')}` : null) ||
                                      (error.response.data.uid ? `UID Error: ${error.response.data.uid.join(' ')}` : null) ||
                                      (error.response.data.new_password ? `Password Error: ${error.response.data.new_password.join(' ')}` : null) ||
                                      (error.response.data.non_field_errors ? error.response.data.non_field_errors.join(' ') : null);
                 if (backendError) {
                    errorMsg = backendError;
                 }
            } else if (error.request) {
                 errorMsg = 'Network error. Could not connect to the server.';
            }
            showMessage(errorMsg, 'error');
        }
    };

    return (
        <div className={styles.resetPageContainer}>
            <div className={styles.resetBox}>
                <h1 className={styles.title}>Set New Password</h1>
                <p className={styles.instructions}>
                    Please enter your new password below. Make sure it's secure!
                </p>

                 {/* Display Message - Placed above form for visibility */}
                 {message && (
                    <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`} style={{ marginBottom: '20px' }}> {/* Add bottom margin when message shown */}
                        {message}
                    </p>
                 )}

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label htmlFor="new-password" className={styles.label}>New Password</label>
                        <input
                            id="new-password"
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className={styles.input}
                            autoComplete="new-password"
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="confirm-password" className={styles.label}>Confirm New Password</label>
                        <input
                            id="confirm-password"
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className={styles.input}
                            autoComplete="new-password"
                        />
                    </div>
                    <button type="submit" className={styles.submitButton}>Reset Password</button>
                </form>

                 {/* Link back to Login - Conditionally show or always show */}
                 <div className={styles.backLink}>
                    <Link to="/login">Back to Login</Link>
                 </div>

            </div>
        </div>
    );
};

export default PasswordResetConfirm;
