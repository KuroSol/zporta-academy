import React, { useState, useEffect, useCallback, useContext } from "react";
import { useNavigate, Link } from "react-router-dom"; // <-- Import Link
import apiClient from './api';
import { AuthContext } from './context/AuthContext';
import styles from './Register.module.css'; // <-- Import the CSS module

// --- Placeholder for AI Image --- (Use the same or a different one)
// const aiImageUrl = '/images/register-visual.png'; // If image is in public/images
const aiImageUrl = 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZWR1Y2F0aW9uJTIwY29sbGFib3JhdGlvbnxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60'; // Example image (Replace with your actual AI-generated image URL)

const Register = () => {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        role: "explorer", // Default role
        bio: "",
    });
    const [message, setMessage] = useState("");
    const [messageType, setMessageType] = useState(''); // 'error' or 'success'
    const navigate = useNavigate();
    const { login } = useContext(AuthContext); // Only need login here likely

    const showMessage = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    }

    // --- Google Sign-In Logic ---
    const handleGoogleResponse = useCallback(async (response) => {
        const token = response.credential;
        try {
            showMessage('');
            const apiResponse = await apiClient.post('/users/google-login/', { token });
            const data = apiResponse.data;
            if (data.token && data.user) {
                console.log("Google signup/login success:", data);
                login(data.user, data.token); // Login directly after Google signup
                 showMessage("Google registration successful!", 'success'); // Use success type
            } else {
                // This case might mean backend registered but didn't return login info
                console.log("Google action success (no auto-login):", data);
                showMessage("Google account linked! Redirecting to login...", 'success');
                setTimeout(() => navigate("/login"), 2000); // Navigate to login if not auto-logged in
            }
        } catch (error) {
            console.error("Google signup error:", error.response ? error.response.data : error.message);
            const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Google signup failed.";
            showMessage(errorMsg);
        }
    }, [login, navigate]); // Add dependencies

    // --- Google Script Loading ---
    useEffect(() => {
        // Script loading and initialization (Similar to Login, targets 'google-signup')
        if (document.getElementById('google-jssdk')) {
             // If script exists, maybe just ensure button is rendered if needed
             // This logic can be complex if navigating between login/register
             // For simplicity, we assume script loads once per page load
             // return; // Potentially skip if script already loaded
        }


        const script = document.createElement("script");
        script.id = 'google-jssdk'; // Use same ID to potentially avoid duplicate loads
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
        script.onload = () => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                try {
                    window.google.accounts.id.initialize({
                        client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com", // Your Client ID
                        callback: handleGoogleResponse,
                        ux_mode: "popup",
                    });
                    // *** Target the correct ID for the signup button ***
                    const buttonContainer = document.getElementById("google-signup");
                    if (buttonContainer) {
                        window.google.accounts.id.renderButton(buttonContainer, {
                            theme: "outline",
                            size: "large",
                            type: "standard",
                            text: "signup_with", // Use "signup_with" text
                            shape: "rectangular",
                             width: "300" // Optional width
                        });
                    } else {
                        console.error("Google Sign-Up button container ('google-signup') not found.");
                    }
                 } catch (error) {
                     console.error("Error initializing Google Sign-In:", error);
                     showMessage("Failed to initialize Google Sign-In.");
                 }
            } else {
                 console.error("Google Sign-In library failed to load.");
                 showMessage("Failed to load Google Sign-In.");
            }
        };
        script.onerror = () => {
             showMessage("Failed to load Google API script.");
        };
        document.body.appendChild(script);

        // Basic cleanup
        return () => {
            // Consider more robust cleanup if needed
        };
    }, [handleGoogleResponse]); // Dependency

    // --- Form Input Change Handler ---
    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // --- Standard Registration Submit Handler ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        showMessage(''); // Clear message

        try {
            // Use apiClient.post for standard registration
            await apiClient.post('/users/register/', formData);
            showMessage("Registration successful! Redirecting to login...", 'success');
            setTimeout(() => navigate("/login"), 2000); // Redirect after success

        } catch (error) {
            console.error("Registration error:", error.response ? error.response.data : error.message);
            let errorMsg = "Registration failed. Please check the fields.";
             if (error.response && error.response.data) {
                 if (typeof error.response.data === 'object') {
                    // Format specific field errors nicely
                    errorMsg = Object.entries(error.response.data)
                        .map(([field, messages]) => `${field.charAt(0).toUpperCase() + field.slice(1)}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                        .join(' | ');
                 } else {
                     errorMsg = error.response.data.error || error.response.data.detail || errorMsg;
                 }
             } else if (error.request) {
                 errorMsg = 'Network error. Could not connect to the server.';
             }
            showMessage(errorMsg); // Show formatted error message
        }
    };

    // --- JSX Structure ---
    return (
        <div className={styles.registerPageContainer}>
            <div className={styles.registerBox}>

                {/* Image Panel (Left Side) */}
                <div className={styles.imagePanel}>
                    <img src={aiImageUrl} alt="ZPorta Academy Registration Visual" />
                    <h2>Join ZPorta Academy</h2>
                    <p>Unlock a world of knowledge. Sign up to start exploring and guiding.</p>
                </div>

                {/* Form Panel (Right Side) */}
                <div className={styles.formPanel}>
                    <h2>Create Your Account</h2>

                    {/* Display Message */}
                    {message && (
                        <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                            {message}
                        </p>
                     )}

                    {/* Standard Registration Form */}
                    <form onSubmit={handleSubmit}>
                        <div className={styles.formGroup}>
                            <label htmlFor="reg-username" className={styles.label}>Username</label>
                            <input
                                id="reg-username"
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                required
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="reg-email" className={styles.label}>Email</label>
                            <input
                                id="reg-email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="reg-password" className={styles.label}>Password</label>
                            <input
                                id="reg-password"
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                required
                                className={styles.input}
                                autoComplete="new-password" /* Help password managers */
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="reg-role" className={styles.label}>Register as</label>
                            <select
                                id="reg-role"
                                name="role"
                                value={formData.role}
                                onChange={handleChange}
                                className={styles.select} /* Use select style */
                            >
                                <option value="explorer">Explorer (I want to learn)</option>
                                <option value="guide">Guide (I want to teach/share)</option>
                                <option value="both">Both Explorer & Guide</option>
                            </select>
                        </div>
                        <div className={styles.formGroup}>
                             <label htmlFor="reg-bio" className={styles.label}>Short Bio (Optional)</label>
                            <textarea
                                id="reg-bio"
                                name="bio"
                                value={formData.bio}
                                onChange={handleChange}
                                className={styles.textarea} /* Use textarea style */
                                placeholder="Tell us a little about yourself or your interests..."
                            ></textarea>
                        </div>

                        <button type="submit" className={styles.submitButton}>Register</button>
                    </form>

                    {/* Separator */}
                    <div className={styles.separator}>Or</div>

                    {/* Google Sign-Up Button Container */}
                     {/* Ensure this ID matches the one targeted in useEffect */}
                    <div id="google-signup" className={styles.googleButtonContainer}>
                        {/* Google button rendered here */}
                    </div>

                    {/* Link to Login Page */}
                    <p className={styles.authLink}>
                        Already have an account? <Link to="/login">Login here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Register;