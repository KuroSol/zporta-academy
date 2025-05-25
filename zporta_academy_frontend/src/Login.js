import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Keep Link
import { AuthContext } from './context/AuthContext';
import apiClient from './api';
import styles from './Login.module.css'; // <-- Import the CSS module
import { requestPermissionAndGetToken } from './firebase';
import { v4 as uuidv4 } from 'uuid';

// --- Placeholder for AI Image ---
// Ideally, host this image somewhere accessible (e.g., your public folder or a CDN)
// For example purposes, using a placeholder service or a relative path if in public folder:
// const aiImageUrl = '/images/login-visual.png'; // If image is in public/images
// detect iOS device
const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
// detect Chrome on iOS
const isIosChrome = isIOS && /CriOS/.test(navigator.userAgent);
const aiImageUrl = 'https://zportaacademy.com/media/managed_images/MakeLearningSimple.png'; // Example image (Replace with your actual AI-generated image URL)


const Login = () => {
    const { login } = useContext(AuthContext);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'error' or 'success'

    const showMessage = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    }

    // --- Google Sign-In Logic ---
    const handleGoogleResponse = useCallback(async (response) => {
        const token = response.credential;
        try {
            showMessage(''); // Clear message
            const apiResponse = await apiClient.post('/users/google-login/', { token });
            const data = apiResponse.data;
            console.log("🔍 Google login response:", data);
            if (data.token && data.user) {
                login(data.user, data.token);
                showMessage("Google login successful!", 'success'); // Use success type
            } else {
                showMessage("Google verification successful, but login failed. Please check backend configuration.");
            }
        } catch (error) {
            console.error("Google login error:", error.response ? error.response.data : error.message);
            const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Google login failed.";
            showMessage(errorMsg);
        }
    }, [login]);

// INSIDE your Login component...

useEffect(() => {
  // Function to initialize and render the Google button for THIS component
  const initializeAndRenderButton = () => {
      // Check if the Google library is loaded and ready
      if (window.google && window.google.accounts && window.google.accounts.id) {
          console.log("Login: Google library ready. Initializing and rendering button.");
          try {
              // Initialize: Configures the client ID and callback for this instance
              window.google.accounts.id.initialize({
                  client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com", // Your Client ID
                  callback: handleGoogleResponse, // The callback specific to Login
                  ux_mode: "popup",
              });

              // Find the button container specific to the Login page
              const buttonContainer = document.getElementById("google-login-button");
              if (buttonContainer) {
                  // Clear the container first - important if re-rendering
                  buttonContainer.innerHTML = '';
                  // Render the button into the Login page's container
                  window.google.accounts.id.renderButton(buttonContainer, {
                      theme: "outline",
                      size: "large",
                      type: "standard",
                      text: "signin_with",
                      shape: "rectangular",
                      width: "300" // Example width
                  });
                  console.log("Login: Google button rendered.");
              } else {
                  // If the container isn't found when the library is ready, log an error
                  console.error("Login: google-login-button container not found in DOM.");
              }
          } catch (error) {
              console.error("Login: Error initializing/rendering Google Sign-In:", error);
              showMessage("Failed to initialize Google Sign-In.");
          }
      } else {
          // This should ideally not happen if called after script load, but good to log
          console.error("Login: Google library not available when initAndRender was called.");
           showMessage("Failed to initialize Google Sign-In library.");
      }
  };

  // --- Script Loading Logic ---
  // Check if the script tag already exists
  if (document.getElementById('google-jssdk')) {
      console.log("Login: Google script tag found.");
      // If script tag exists, assume it's loaded or loading.
      // Check if the 'google' object is ready.
      if (window.google && window.google.accounts && window.google.accounts.id) {
           console.log("Login: Google library already ready. Initializing/Rendering button.");
           // Library is ready, proceed to initialize and render for Login page
           initializeAndRenderButton();
      } else {
           // Script tag exists, but library isn't ready yet.
           // This might happen if navigate happens *while* script is loading.
           // The 'onload' of the *original* script tag should handle calling initAndRender.
           // We can add a fallback just in case onload was missed or fired early.
           console.log("Login: Google script tag found, but library not ready. Waiting for its onload.");
           // Optional: Add a small delay or poll for window.google if onload proves unreliable across navigations.
           // However, often the existing script's onload will trigger correctly.
      }
  } else {
      // Script doesn't exist, create and load it
      console.log("Login: Google script tag not found. Loading script.");
      const script = document.createElement("script");
      script.id = 'google-jssdk'; // Add the ID
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      // Set the onload handler *before* appending
      script.onload = () => {
          console.log("Login: Google script finished loading via onload.");
          initializeAndRenderButton(); // Initialize and render AFTER script loads
      };
      script.onerror = () => {
          console.error("Login: Failed to load Google API script.");
          showMessage("Failed to load Google API script.");
      };
      document.body.appendChild(script);
  }

  // Cleanup function (Optional: You might want to clear the button on unmount)
  return () => {
       console.log("Login component unmounting/effect re-running.");
       // Example: Clearing the button if it causes issues during navigation
       // const buttonContainer = document.getElementById("google-login-button");
       // if (buttonContainer) {
       //     buttonContainer.innerHTML = '';
       // }
  };
}, [handleGoogleResponse]); // Keep dependency on the callback handler


    // --- Standard Username/Password Login Handler ---
    const handleLogin = async (e) => {
        e.preventDefault();
        showMessage(''); // Clear message

        try {
            const response = await apiClient.post('/users/login/', { username, password });
            const data = response.data;
            console.log("🔍 Standard login response:", data);
            login(data, data.token);
             showMessage("Login successful!", 'success'); // Show success briefly
            // —— FCM: ask permission & get token on successful login ——
            try {
                if (!isIosChrome) {
                    try {
                    const fcmToken = await requestPermissionAndGetToken();
                    await apiClient.post(
                        '/api/notifications/save-fcm-token/',
                        { token: fcmToken, device_id: uuidv4() },
                        { headers: { Authorization: `Token ${data.token}` } }
                    );
                    console.log('[Login] FCM token saved on server');
                    } catch (err) {
                    console.warn('[Login] Could not register FCM (probably iOS Chrome):', err);
                    }
                }
            console.log('[Login] FCM token saved on server');
            } catch (err) {
            console.warn('[Login] Could not register FCM:', err);
            }

        } catch (error) {
            console.error('Error during standard login:', error);
            const backendError = error.response?.data?.error ||
                                 error.response?.data?.detail ||
                                 (error.response?.data?.non_field_errors ? error.response.data.non_field_errors.join(' ') : null) ||
                                 'Login failed. Please check credentials.';
            showMessage(backendError);
        }
    };

    return (
        // Apply styles using CSS Modules
        <div className={styles.loginPageContainer}>
            <div className={styles.loginBox}>

                {/* Image Panel (Left Side) */}
                <div className={styles.imagePanel}>
                    <img src={aiImageUrl} alt="Educational Platform Visual" />
                    <h2>Welcome Back!</h2>
                    <p>Log in to continue your learning journey with ZPorta Academy.</p>
                    {/* You can add more branding or info here */}
                </div>

                {/* Form Panel (Right Side) */}
                <div className={styles.formPanel}>
                    <h2>Login to Your Account</h2>

                     {/* Display Message */}
                    {message && (
                        <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                            {message}
                        </p>
                     )}

                    {/* Standard Login Form */}
                    <form onSubmit={handleLogin}>
                        <div className={styles.formGroup}>
                            <label htmlFor="login-username" className={styles.label}>Username or Email</label>
                            <input
                                id="login-username"
                                type="text" // Consider type="email" if backend primarily uses email
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                autoComplete="username"
                                className={styles.input}
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="login-password" className={styles.label}>Password</label>
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                                className={styles.input}
                            />
                        </div>

                        {/* Forgot Password Link */}
                        <Link to="/password-reset" className={styles.forgotPasswordLink}>Forgot your password?</Link>

                        <button type="submit" className={styles.submitButton}>Login</button>
                    </form>

                    {/* Separator */}
                    <div className={styles.separator}>Or</div>

                    {/* Google Login Button Container */}
                    <div id="google-login-button" className={styles.googleButtonContainer}>
                        {/* Google button is rendered here by the script */}
                    </div>

                    {/* Link to Register Page */}
                    <p className={styles.registerLink}>
                        Don't have an account? <Link to="/register">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;