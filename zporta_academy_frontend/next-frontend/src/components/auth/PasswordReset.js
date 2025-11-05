import { useState } from "react";
import Link from "next/link";
import apiClient from "@/api";
import styles from "@/styles/PasswordReset.module.css";

const PasswordReset = () => {
    const [email, setEmail] = useState("");
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState(''); // 'error' or 'success'

    const showMessage = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    }

    const handleSubmit = async (e) => {
        e.preventDefault();
        showMessage(""); // Clear message on new submission

        try {
            // Use apiClient.post
            await apiClient.post('/users/password-reset/', { email });

            showMessage("Password reset link has been sent to your email if an account exists with that address.", 'success');
            setEmail(""); // Clear email field on success

        } catch (error) {
            console.error("Password Reset Error:", error);
            // Provide a generic message for security reasons (don't confirm/deny email existence)
            // unless the backend specifically returns a clear, safe error message.
            if (error.response && error.response.status === 400) {
                 showMessage("There was an issue with the email provided. Please check and try again.", 'error');
            } else if (error.request) {
                 showMessage('Network error. Could not connect to the server.', 'error');
            }
            else {
                 // Generic message for other errors or if backend doesn't give useful info
                 showMessage("If an account exists for this email, a reset link has been sent.", 'success'); // Still show success-like message
            }
        }
    };

    return (
        <div className={styles.resetPageContainer}>
            <div className={styles.resetBox}>
                <h1 className={styles.title}>Reset Password</h1>
                <p className={styles.instructions}>
                    Enter the email address associated with your account, and we&apos;ll send you a link to reset your password.
                </p>

                <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                        <label htmlFor="reset-email" className={styles.label}>Email Address</label>
                        <input
                            id="reset-email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className={styles.input}
                            placeholder="you@example.com"
                        />
                    </div>
                    <button type="submit" className={styles.submitButton}>Send Reset Link</button>
                </form>

                {/* Display Message */}
                {message && (
                    <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                        {message}
                    </p>
                )}

                 {/* Link back to Login */}
                <div className={styles.backLink}>
                    <Link href="/login">Back to Login</Link>
                </div>
            </div>
        </div>
    );
};

export default PasswordReset;
