// src/components/Login.js
import React, { useState, useContext, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { AuthContext } from '@/context/AuthContext';
import apiClient from '@/api';
import styles from '@/styles/Login.module.css';

const aiImageUrl = 'https://zportaacademy.com/media/managed_images/MakeLearningSimple.png';

export default function Login({ onSuccess, skipRedirect, inModal = false }) {
  const router = useRouter();
  const { login } = useContext(AuthContext);

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emailForMagicLink, setEmailForMagicLink] = useState('');

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'error' | 'success' | 'info'
  const [isLoading, setIsLoading] = useState(false);

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  // Magic-link token handler (?token=...)
  useEffect(() => {
    const token = router.query?.token;
    if (!token) return;

    const handleMagicTokenLogin = async () => {
      setIsLoading(true);
      showMessage('Verifying your login link...', 'info');
      try {
        localStorage.setItem('token', token);
        const profileResponse = await apiClient.get('/users/profile/');
        login(profileResponse.data, token);
        router.push('/home');
      } catch {
        localStorage.removeItem('token');
        showMessage('Login failed. The link may be invalid or expired.', 'error');
        router.replace('/login');
      } finally {
        setIsLoading(false);
      }
    };
    handleMagicTokenLogin();
  }, [router.query?.token, login, router]);

  // Google Sign-In
  const handleGoogleResponse = useCallback(
    async (response) => {
      const token = response?.credential;
      if (!token) {
        showMessage('Invalid Google response.', 'error');
        return;
      }
      setIsLoading(true);
      showMessage('Verifying with Google...', 'info');
      try {
        const { data } = await apiClient.post('/users/google-login/', { token });
        login(data.user, data.token);
        router.push('/home');
      } catch (error) {
        const errorMsg = error.response?.data?.error || 'Google login failed. Please try again.';
        showMessage(errorMsg, 'error');
        setIsLoading(false);
      }
    },
    [login, router]
  );

  // Load Google script and render button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const renderButton = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: '805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com',
          callback: handleGoogleResponse,
        });
        const el = document.getElementById('google-login-button');
        if (el) {
          el.innerHTML = '';
          window.google.accounts.id.renderButton(el, {
            theme: 'outline',
            size: 'large',
            type: 'standard',
            text: 'signin_with',
            shape: 'rectangular',
          });
        }
      }
    };

    const existing = document.getElementById('google-jssdk');
    if (existing) {
      renderButton();
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.body.appendChild(script);
  }, [handleGoogleResponse]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    showMessage('Logging in...', 'info');
    try {
      const { data } = await apiClient.post('/users/login/', { username, password });
      login(data, data.token, { skipRedirect });
      if (!skipRedirect && onSuccess) router.push('/home');
      else if (onSuccess) onSuccess();
    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Login failed. Please check your credentials.';
      showMessage(errorMsg, 'error');
      setIsLoading(false);
    }
  };

  const handleMagicLinkRequest = async (e) => {
    e.preventDefault();
    if (!emailForMagicLink) {
      showMessage('Please enter your email address.', 'error');
      return;
    }
    setIsLoading(true);
    showMessage('Sending login link...', 'info');
    try {
      await apiClient.post('/users/magic-link-request/', { email: emailForMagicLink });
      showMessage('Success! If an account exists, a login link has been sent to your email.', 'success');
    } catch {
      // Same success-style message for security
      showMessage('Success! If an account exists, a login link has been sent to your email.', 'success');
    } finally {
      setIsLoading(false);
    }
  };

  // Modal variant early return
  if (inModal) {
    return (
      <div className={styles.modalLoginContainer}>
        <h2>Sign In</h2>
        {message && <div className={`${styles.message} ${styles[messageType]}`}>{message}</div>}

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
            {isLoading ? 'Please wait...' : 'Login'}
          </button>
        </form>

        <div className={styles.separator}><span>Or</span></div>
        {/* magic-link + Google button can be added here if needed */}
      </div>
    );
  }

  return (
    <div className={styles.loginPageContainer}>
      <div className={styles.loginBox}>
        {/* Left: image */}
        <div className={styles.imagePanel}>
          <img src={aiImageUrl} alt="Collaborative learning" />
          <h2>Welcome to Zporta Academy</h2>
          <p>Your journey into collaborative learning starts here. Log in to explore and create.</p>
        </div>

        {/* Right: forms */}
        <div className={styles.formPanel}>
          <h2>Sign In</h2>
          <p className={styles.subtitle}>Choose your preferred method to continue.</p>

          {message && <div className={`${styles.message} ${styles[messageType]}`}>{message}</div>}

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

            <Link href="/password-reset" className={styles.subtleLink}>
              Forgot Password?
            </Link>
          </form>

          <div className={styles.separator}><span>Or</span></div>

          <div className={styles.alternativeLogins}>
            {/* Magic link */}
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
                  <button type="submit" className={styles.magicLinkButton} disabled={isLoading}>
                    Send
                  </button>
                </div>
              </div>
            </form>

            {/* Google login button mounts here */}
            <div id="google-login-button" className={styles.googleButtonContainer} />
          </div>

          <p className={styles.registerLink}>
            New to the academy?{' '}
            <Link href="/register">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
