import React, { useState, useContext, useEffect, useCallback } from 'react'; // Import useEffect, useCallback
import { useNavigate, Link } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import apiClient from './api';

const Login = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    // const navigate = useNavigate(); // Still likely not needed if context handles it

    // --- START: Google Sign-In Logic (Copied & Adapted from Register.js) ---

    const handleGoogleResponse = useCallback(async (response) => {
        const token = response.credential; // This is the Google ID Token

        try {
            setMessage(''); // Clear previous messages
            console.log("Sending Google token to backend...");
            // Send the token to your backend endpoint (SAME as in Register.js)
            const apiResponse = await apiClient.post('/users/google-login/', { token });
            const data = apiResponse.data; // Use apiResponse.data

            // Check if the backend successfully logged in/created the user
            // and returned the necessary data (user object and app token)
            if (data.token && data.user) {
                console.log("Google login/signup success:", data);
                // Use the login function from AuthContext to set user state and redirect
                login(data.user, data.token);
                // Message might briefly appear before navigation handled by login()
                setMessage("Google login successful!");
            } else {
                // Handle cases where backend might just confirm/create account
                // without returning a login token (less common for seamless flow)
                console.warn("Google action successful, but no token/user returned by backend:", data);
                setMessage("Google account verified, but login failed. Backend might need adjustment or contact support.");
                // You might want to navigate somewhere specific or show a more detailed error
            }

        } catch (error) {
            // Handle Axios errors specifically for Google login
            console.error("Google login error:", error.response ? error.response.data : error.message);
            if (error.response && error.response.data) {
                // Extract specific error message from backend if available
                 setMessage(error.response.data.error || error.response.data.detail || "Google login failed.");
            } else if (error.request) {
                setMessage('Network error during Google login. Please check your connection.');
            } else {
                setMessage('An unexpected error occurred during Google login.');
            }
        }
    }, [login]); // Add 'login' from context as a dependency


    useEffect(() => {
        // Ensure the Google script is loaded only once, even if component re-renders
        if (document.getElementById('google-jssdk')) return; // Check if script already exists

        const script = document.createElement("script");
        script.id = 'google-jssdk'; // Give the script an ID to prevent duplicates
        script.src = "https://accounts.google.com/gsi/client";
        script.async = true;
        script.defer = true;

        // On successful load of the script
        script.onload = () => {
            if (window.google && window.google.accounts && window.google.accounts.id) {
                // Initialize Google login
                try {
                    window.google.accounts.id.initialize({
                        // IMPORTANT: Use the SAME Google Client ID as in your Register component
                        client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
                        callback: handleGoogleResponse, // Use the handler defined above
                        ux_mode: "popup", // Or "redirect"
                        // auto_select: true, // Optionally enable one-tap sign-in prompt
                    });

                    // Render Google Sign-In button specifically for the login page
                    const buttonContainer = document.getElementById("google-login-button"); // Use a unique ID for the login button container
                    if (buttonContainer) {
                         window.google.accounts.id.renderButton(buttonContainer, {
                            theme: "outline",
                            size: "large",
                            type: "standard", // Standard button look
                            text: "signin_with", // Text like "Sign in with Google"
                         });
                    } else {
                         console.error("Google Login button container ('google-login-button') not found.");
                         //setMessage("Could not display Google Login button.");
                    }

                    // Optional: Display One Tap prompt
                    // window.google.accounts.id.prompt();

                } catch (error) {
                     console.error("Error initializing Google Sign-In:", error);
                     setMessage("Failed to initialize Google Sign-In.");
                }
            } else {
                console.error("Google Sign-In library failed to load.");
                setMessage("Failed to load Google Sign-In.");
            }
        };

        // Handle script loading errors
        script.onerror = () => {
            console.error("Failed to load Google API script.");
            setMessage("Failed to load Google API script. Check network connection or ad blockers.");
        };

        // Append the script to the body
        document.body.appendChild(script);

        // Cleanup function when the component unmounts
        return () => {
            const scriptTag = document.getElementById('google-jssdk');
            if (scriptTag) {
                // document.body.removeChild(scriptTag); // Be cautious removing script if other components might need it.
            }
             // It's generally good practice to clear the rendered button too if needed
             const buttonContainer = document.getElementById("google-login-button");
             if (buttonContainer) {
                 // buttonContainer.innerHTML = ''; // Clear previous button render
             }
             // You might want to cancel any ongoing Google processes if applicable
             // if (window.google && window.google.accounts && window.google.accounts.id) {
             //   window.google.accounts.id.cancel();
             // }
        };
    }, [handleGoogleResponse]); // useEffect depends on the callback


    // --- END: Google Sign-In Logic ---


    // Standard Username/Password Login Handler (Keep as is)
    const handleLogin = async (e) => {
        e.preventDefault();
        setMessage('');

        try {
            const response = await apiClient.post('/users/login/', {
                username, // Or 'email' if your backend expects that
                password,
            });
            const data = response.data;
            login(data.user, data.token); // Use context login (assuming backend returns user and token keys)

        } catch (error) {
            console.error('Error during standard login:', error);
            if (error.response && error.response.data) {
                const backendError = error.response.data.error ||
                                     error.response.data.detail ||
                                     (error.response.data.non_field_errors ? error.response.data.non_field_errors.join(' ') : null) ||
                                     'Login failed. Please check credentials.';
                setMessage(backendError);
            } else if (error.request) {
                setMessage('Network error. Could not connect to the server.');
            } else {
                setMessage('An unexpected error occurred. Please try again.');
            }
        }
    };

    // --- JSX Modification ---
    return (
        <div style={{ padding: "20px", maxWidth: "400px", margin: "auto" }}> {/* Basic styling */}
            <h2>Login</h2>

            {/* Standard Login Form */}
            <form onSubmit={handleLogin}>
                <div>
                    <label>Username:</label> {/* Or Email */}
                    <input
                        type="text" // Or type="email"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                        style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
                    />
                </div>
                <div>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                        style={{ width: '100%', padding: '8px', marginBottom: '10px', boxSizing: 'border-box' }}
                    />
                </div>
                 <div style={{ marginBottom: '10px', textAlign: 'right' }}>
                     <Link to="/password-reset">Forgot your password?</Link>
                 </div>
                <button type="submit" style={{ width: '100%', padding: '10px', marginBottom: '15px' }}>Login</button>
            </form>

            {/* Separator */}
            <div style={{ textAlign: 'center', margin: '20px 0', color: '#888' }}>OR</div>

            {/* Google Login Button Container */}
            {/* Make sure this ID matches the one used in useEffect: getElementById("google-login-button") */}
            <div id="google-login-button" style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
                {/* Google button will be rendered here by the script */}
            </div>

            {/* Messages */}
            {message && <p style={{ color: message.toLowerCase().includes('success') ? 'green' : 'red', textAlign: 'center', marginTop: '10px' }}>{message}</p>}

            {/* Link to Register Page */}
            <p style={{ textAlign: 'center', marginTop: '20px' }}>
                Don't have an account? <Link to="/register">Register here</Link>
            </p>
        </div>
    );
};

export default Login;