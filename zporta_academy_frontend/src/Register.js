import React, { useState, useEffect, useCallback, useContext } from "react"; // Added useContext, useCallback
import { useNavigate } from "react-router-dom";
import apiClient from './api'; // <-- ADD apiClient import (Adjust path if needed)
import { AuthContext } from './context/AuthContext'; // <-- ADD AuthContext import (Adjust path)

const Register = () => {
    const [formData, setFormData] = useState({
        username: "",
        email: "",
        password: "",
        role: "explorer", // Default role
        bio: "",
    });
    const [message, setMessage] = useState("");
    const navigate = useNavigate();
    const { login, logout } = useContext(AuthContext);

    const handleGoogleResponse = useCallback(async (response) => {
        const token = response.credential;

        // Inside handleGoogleResponse function
        try {
            setMessage(''); // Clear message
            // Use apiClient.post, relative URL, data object. No headers needed.
            const response = await apiClient.post('/users/google-login/', { token }); // token is response.credential
            const data = response.data; // Use response.data

            // --- IMPORTANT ---
            // Should Google Sign-In log the user in directly?
            // If YES, call the login function from AuthContext here:
            if (data.token && data.user) { // Check if backend returns token and user data
                console.log("Google login success:", data);
                login(data.user, data.token); // Use context login function (navigates automatically)
                setMessage("Login successful!"); // Message will be brief before navigation
            } else {
                // Handle cases where backend might just confirm/create account without login token
                console.log("Google action success:", data);
                setMessage("Google account linked/verified successfully!");
                // Maybe navigate to login or profile depending on backend response
                // setTimeout(() => navigate("/login"), 2000);
            }

        } catch (error) {
            // Handle Axios errors
            console.error("Google login error:", error.response ? error.response.data : error.message);
            if (error.response && error.response.data) {
            setMessage(error.response.data.error || error.response.data.detail || "Google login failed.");
            } else if (error.request) {
            setMessage('Network error during Google login.');
            } else {
            setMessage('An unexpected error occurred during Google login.');
            }
            // No logout needed here as user wasn't necessarily logged in
        }
    }, [navigate]);

    useEffect(() => {
        // Ensure the Google script is loaded
        const script = document.createElement("script");
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;
    
        // On successful load of the script
        script.onload = () => {
            if (window.google && window.google.accounts) {
                // Initialize Google login
                window.google.accounts.id.initialize({
                    client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
                    callback: (response) => handleGoogleResponse(response), // Ensure response is passed to the callback
                    ux_mode: "popup",
                });
    
                // Render Google Sign-In button
                const buttonContainer = document.getElementById("google-signup");
                if (buttonContainer) {
                    window.google.accounts.id.renderButton(buttonContainer, {
                        theme: "outline",
                        size: "large",
                    });
                } else {
                    console.error("Google Sign-Up button container not found.");
                }
            } else {
                console.error("Google API is not available.");
            }
        };
    
        // Handle script loading errors
        script.onerror = () => {
            setMessage("Failed to load Google API script.");
        };
    
        // Append the script to the body
        document.body.appendChild(script);
    
        // Cleanup script on component unmount
        return () => {
            document.body.removeChild(script);
        };
    }, [handleGoogleResponse]);
    

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage("");

        // Inside handleSubmit function
        try {
            setMessage(""); // Clear message
            // Use apiClient.post, relative URL, data object (formData). No headers needed.
            await apiClient.post('/users/register/', formData);

            // If await finishes without error, registration was successful
            setMessage("Registration successful! Redirecting to login...");
            setTimeout(() => navigate("/login"), 2000); // Keep redirect

        } catch (error) {
            // Handle Axios errors
            console.error("Registration error:", error.response ? error.response.data : error.message);
            if (error.response && error.response.data) {
            // Extract potential specific field errors or general errors
            let errorMsg = "Registration failed.";
            if (typeof error.response.data === 'object') {
                // Example: Join errors from multiple fields
                errorMsg = Object.entries(error.response.data)
                .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
                .join(' | ');
            } else {
                errorMsg = error.response.data.error || error.response.data.detail || errorMsg;
            }
            setMessage(errorMsg);
            } else if (error.request) {
            setMessage('Network error during registration.');
            } else {
            setMessage('An unexpected error occurred during registration.');
            }
            // No logout needed here
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <h1>Register</h1>
            <form onSubmit={handleSubmit}>
                <div>
                    <label>Username:</label>
                    <input
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Email:</label>
                    <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div>
                    <label>Role:</label>
                    <select name="role" value={formData.role} onChange={handleChange}>
                        <option value="explorer">Explorer</option>
                        <option value="guide">Guide</option>
                        <option value="both">Both</option>
                    </select>
                </div>
                <div>
                    <label>Bio:</label>
                    <textarea name="bio" value={formData.bio} onChange={handleChange}></textarea>
                </div>
                <button type="submit">Register</button>
            </form>
            <div id="google-signup" style={{ marginTop: "20px" }}></div>
            {message && <p>{message}</p>}
        </div>
    );
};

export default Register;
