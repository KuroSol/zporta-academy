import React, { useState, useContext, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import apiClient from './api';
import styles from './Login.module.css';

// --- Placeholder for AI Image ---
const aiImageUrl = 'https://zportaacademy.com/media/managed_images/MakeLearningSimple.png';

const Login = ({ onSuccess, skipRedirect }) => {
    const { login } = useContext(AuthContext);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // State for all form inputs
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [emailForMagicLink, setEmailForMagicLink] = useState('');

    // State for UI feedback
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState(''); // 'error', 'success', or 'info'
    const [isLoading, setIsLoading] = useState(false);

    // Reusable message utility
    const showMessage = (text, type = 'error') => {
        setMessage(text);
        setMessageType(type);
    };

    // --- Magic Link Token Handling ---
    // This effect runs when the component loads to check if a magic link token is in the URL
    useEffect(() => {
        const token = searchParams.get('token');
        if (token) {
            const handleMagicTokenLogin = async () => {
                setIsLoading(true);
                showMessage("Verifying your login link...", 'info');
                try {
                    // Store the token so the API client can use it for the next call
                    localStorage.setItem('token', token);
                    // Fetch the user's profile using the token
                    const profileResponse = await apiClient.get('/users/profile/');
                    
                    // Use the main login function from context to set the user state
                    login(profileResponse.data, token);
                    
                    // Redirect to the home page upon success
                    navigate('/home');
                } catch (error) {
                    localStorage.removeItem('token'); // Clean up on failure
                    showMessage("Login failed. The link may be invalid or expired.", 'error');
                    // Remove the token from the URL to avoid loops
                    navigate('/login', { replace: true }); 
                } finally {
                    setIsLoading(false);
                }
            };
            handleMagicTokenLogin();
        }
    }, [searchParams, login, navigate]);


    // --- Google Sign-In Logic ---
    const handleGoogleResponse = useCallback(async (response) => {
        const token = response.credential;
        setIsLoading(true);
        showMessage('Verifying with Google...', 'info');
        try {
            const apiResponse = await apiClient.post('/users/google-login/', { token });
            login(apiResponse.data.user, apiResponse.data.token);
            navigate('/home');
        } catch (error) {
            const errorMsg = error.response?.data?.error || "Google login failed. Please try again.";
            showMessage(errorMsg, 'error');
            setIsLoading(false);
        }
    }, [login, navigate]);

    useEffect(() => {
        // This logic remains the same to render the Google button
        if (window.google && window.google.accounts && window.google.accounts.id) {
            window.google.accounts.id.initialize({
                client_id: "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
                callback: handleGoogleResponse,
            });
            const buttonContainer = document.getElementById("google-login-button");
            if (buttonContainer) {
                buttonContainer.innerHTML = '';
                window.google.accounts.id.renderButton(buttonContainer, {
                    theme: "outline", size: "large", type: "standard", text: "signin_with", shape: "rectangular"
                });
            }
        }
    }, [handleGoogleResponse]);


    // --- Standard Username/Password Login ---
    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        showMessage('Logging in...', 'info');
        try {
            const response = await apiClient.post('/users/login/', { username, password });
            login(response.data, response.data.token, { skipRedirect });
            if (!skipRedirect && onSuccess) navigate('/home');
            else if (onSuccess) onSuccess();
        } catch (error) {
            const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
            showMessage(errorMsg, 'error');
            setIsLoading(false);
        }
    };

    // --- Magic Link Request Handler ---
    const handleMagicLinkRequest = async (e) => {
        e.preventDefault();
        if (!emailForMagicLink) {
            showMessage("Please enter your email address.", 'error');
            return;
        }
        setIsLoading(true);
        showMessage('Sending login link...', 'info');
        try {
            await apiClient.post('/users/magic-link-request/', { email: emailForMagicLink });
            showMessage("Success! If an account exists, a login link has been sent to your email.", 'success');
        } catch (error) {
            // For security, always show a success-like message
            showMessage("Success! If an account exists, a login link has been sent to your email.", 'success');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className={styles.loginPageContainer}>
            <div className={styles.loginBox}>
                {/* Left Panel with Image and Welcome Text */}
                <div className={styles.imagePanel}>
                    <img src={aiImageUrl} alt="A visual representation of collaborative learning" />
                    <h2>Welcome to Zporta Academy</h2>
                    <p>Your journey into collaborative learning starts here. Log in to explore and create.</p>
                </div>

                {/* Right Panel with Login Forms */}
                <div className={styles.formPanel}>
                    <h2>Sign In</h2>
                    <p className={styles.subtitle}>Choose your preferred method to continue.</p>

                    {/* Message Display Area */}
                    {message && (
                        <div className={`${styles.message} ${styles[messageType]}`}>
                            {message}
                        </div>
                    )}

                    {/* Standard Login Form */}
                    <form onSubmit={handleLogin} className={styles.formSection}>
                        <div className={styles.formGroup}>
                            <label htmlFor="login-username">Username or Email</label>
                            <input
                                id="login-username"
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                required
                                disabled={isLoading}
                                className={styles.input}
                                autoComplete="username"
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label htmlFor="login-password">Password</label>
                            <input
                                id="login-password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                disabled={isLoading}
                                className={styles.input}
                                autoComplete="current-password"
                            />
                        </div>
                        <button type="submit" className={styles.submitButton} disabled={isLoading}>
                            {isLoading ? 'Please wait...' : 'Login with Password'}
                        </button>
                        <Link to="/password-reset" className={styles.subtleLink}>Forgot Password?</Link>
                    </form>

                    <div className={styles.separator}><span>Or</span></div>

                    {/* Passwordless & Social Logins */}
                    <div className={styles.alternativeLogins}>
                        {/* Magic Link */}
                        <form onSubmit={handleMagicLinkRequest} className={styles.magicLinkForm}>
                             <div className={styles.formGroup}>
                                <label htmlFor="magic-email">Continue with a Login Link</label>
                                <div className={styles.magicLinkInputGroup}>
                                    <input
                                        id="magic-email"
                                        type="email"
                                        value={emailForMagicLink}
                                        onChange={(e) => setEmailForMagicLink(e.target.value)}
                                        placeholder="Enter your email"
                                        disabled={isLoading}
                                        className={styles.input}
                                    />
                                    <button type="submit" className={styles.magicLinkButton} disabled={isLoading}>Send</button>
                                </div>
                            </div>
                        </form>
                        
                        {/* Google Login */}
                        <div id="google-login-button" className={styles.googleButtonContainer}></div>
                    </div>

                    <p className={styles.registerLink}>
                        New to the academy? <Link to="/register">Create an account</Link>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Login;
