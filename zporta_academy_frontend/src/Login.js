import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // Keep Link
import { AuthContext } from './context/AuthContext';
import apiClient from './api';
import styles from './Login.module.css'; // <-- Import the CSS module
// import { requestPermissionAndGetToken } from './firebase'; // No longer directly used here
// import { v4 as uuidv4 } from 'uuid'; // No longer directly used here

// --- Placeholder for AI Image ---
const aiImageUrl = 'https://zportaacademy.com/media/managed_images/MakeLearningSimple.png'; // Example image (Replace with your actual AI-generated image URL)

// detect iOS device (can be moved to a utility file if used elsewhere)
// const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
// Chrome on iOS userAgent substring (can be moved to a utility file)
// const isIosChrome = isIOS && /CriOS/.test(navigator.userAgent);


// helper: are we running as an installed PWA? (can be moved to a utility file)
// export const isStandalonePWA = () => { // This is also in App.js, consider a shared utility
//   if (isIOS) {
//     return !!window.navigator.standalone;
//   }
//   return window.matchMedia('(display-mode: standalone)').matches;
// };

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
                login(data.user, data.token); // AuthContext login
                showMessage("Google login successful!", 'success');
                // FCM registration will be handled by App.js's useFCM hook upon login state change
            } else {
                showMessage("Google verification successful, but login failed. Please check backend configuration.");
            }
        } catch (error) {
            console.error("Google login error:", error.response ? error.response.data : error.message);
            const errorMsg = error.response?.data?.error || error.response?.data?.detail || "Google login failed.";
            showMessage(errorMsg);
        }
    }, [login]); // login from AuthContext

    useEffect(() => {
      const initializeAndRenderButton = () => {
          if (window.google && window.google.accounts && window.google.accounts.id) {
              console.log("Login: Google library ready. Initializing and rendering button.");
              try {
                  window.google.accounts.id.initialize({
                      client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
                      callback: handleGoogleResponse,
                      ux_mode: "popup",
                  });

                  const buttonContainer = document.getElementById("google-login-button");
                  if (buttonContainer) {
                      buttonContainer.innerHTML = '';
                      window.google.accounts.id.renderButton(buttonContainer, {
                          theme: "outline",
                          size: "large",
                          type: "standard",
                          text: "signin_with",
                          shape: "rectangular",
                          width: "300"
                      });
                      console.log("Login: Google button rendered.");
                  } else {
                      console.error("Login: google-login-button container not found in DOM.");
                  }
              } catch (error) {
                  console.error("Login: Error initializing/rendering Google Sign-In:", error);
                  showMessage("Failed to initialize Google Sign-In.");
              }
          } else {
              console.error("Login: Google library not available when initAndRender was called.");
              showMessage("Failed to initialize Google Sign-In library.");
          }
      };

      if (document.getElementById('google-jssdk')) {
          console.log("Login: Google script tag found.");
          if (window.google && window.google.accounts && window.google.accounts.id) {
               console.log("Login: Google library already ready. Initializing/Rendering button.");
               initializeAndRenderButton();
          } else {
               console.log("Login: Google script tag found, but library not ready. Waiting for its onload.");
          }
      } else {
          console.log("Login: Google script tag not found. Loading script.");
          const script = document.createElement("script");
          script.id = 'google-jssdk';
          script.src = "https://accounts.google.com/gsi/client";
          script.async = true;
          script.defer = true;
          script.onload = () => {
              console.log("Login: Google script finished loading via onload.");
              initializeAndRenderButton();
          };
          script.onerror = () => {
              console.error("Login: Failed to load Google API script.");
              showMessage("Failed to load Google API script.");
          };
          document.body.appendChild(script);
      }

      return () => {
           console.log("Login component unmounting/effect re-running.");
      };
    }, [handleGoogleResponse]);


    // --- Standard Username/Password Login Handler ---
    const handleLogin = async (e) => {
        e.preventDefault();
        showMessage(''); // Clear message

        try {
            const response = await apiClient.post('/users/login/', { username, password });
            const data = response.data;
            console.log("🔍 Standard login response:", data);
            login(data, data.token); // AuthContext login
            showMessage("Login successful!", 'success');
            // FCM registration will be handled by App.js's useFCM hook upon login state change
            // The direct FCM call previously here has been removed.
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
        <div className={styles.loginPageContainer}>
            <div className={styles.loginBox}>
                <div className={styles.imagePanel}>
                    <img src={aiImageUrl} alt="Educational Platform Visual" />
                    <h2>Welcome Back!</h2>
                    <p>Log in to continue your learning journey with ZPorta Academy.</p>
                </div>
                <div className={styles.formPanel}>
                    <h2>Login to Your Account</h2>
                    {message && (
                        <p className={`${styles.message} ${messageType === 'success' ? styles.success : styles.error}`}>
                            {message}
                        </p>
                     )}
                    <form onSubmit={handleLogin}>
                        <div className={styles.formGroup}>
                            <label htmlFor="login-username" className={styles.label}>Username or Email</label>
                            <input
                                id="login-username"
                                type="text"
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
                        <Link to="/password-reset" className={styles.forgotPasswordLink}>Forgot your password?</Link>
                        <button type="submit" className={styles.submitButton}>Login</button>
                    </form>
                    <div className={styles.separator}>Or</div>
                    <div id="google-login-button" className={styles.googleButtonContainer}>
                        {/* Google button is rendered here by the script */}
                    </div>
                    <p className={styles.registerLink}>
                        Don't have an account? <Link to="/register">Register here</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
