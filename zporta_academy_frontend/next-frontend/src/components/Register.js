// src/components/Register.js
import React, { useState, useEffect, useCallback, useContext } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import apiClient from '@/api';
import { AuthContext } from '@/context/AuthContext';
import styles from '@/styles/Register.module.css';

const aiImageUrl =
  'https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZWR1Y2F0aW9uJTIwY29sbGFib3JhdGlvbnxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60';

export default function Register() {
  const router = useRouter();
  const { login } = useContext(AuthContext);

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    role: 'explorer',
    bio: '',
  });

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); // 'error' | 'success'

  const showMessage = (text, type = 'error') => {
    setMessage(text);
    setMessageType(type);
  };

  // Google Sign-In callback
  const handleGoogleResponse = useCallback(
    async (response) => {
      const token = response?.credential;
      if (!token) {
        showMessage('Invalid Google response.');
        return;
      }
      try {
        showMessage('');
        const { data } = await apiClient.post('/users/google-login/', { token });
        if (data.token && data.user) {
          login(data.user, data.token);
          showMessage('Google registration successful!', 'success');
        } else {
          showMessage('Google account linked! Redirecting to login...', 'success');
          setTimeout(() => router.push('/login'), 1500);
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'Google signup failed.';
        showMessage(errorMsg);
      }
    },
    [login, router]
  );

  // Load Google script and render the button
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const existing = document.getElementById('google-jssdk');
    if (existing) {
      // If already loaded, try to render the button again
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id:
              '805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com',
            callback: handleGoogleResponse,
            ux_mode: 'popup',
          });
          const el = document.getElementById('google-signup');
          if (el) {
            window.google.accounts.id.renderButton(el, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              text: 'signup_with',
              shape: 'rectangular',
              width: '300',
            });
          }
        }
      } catch {
        /* no-op */
      }
      return;
    }

    const script = document.createElement('script');
    script.id = 'google-jssdk';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id:
              '805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com',
            callback: handleGoogleResponse,
            ux_mode: 'popup',
          });
          const el = document.getElementById('google-signup');
          if (el) {
            window.google.accounts.id.renderButton(el, {
              theme: 'outline',
              size: 'large',
              type: 'standard',
              text: 'signup_with',
              shape: 'rectangular',
              width: '300',
            });
          }
        } else {
          showMessage('Failed to load Google Sign-In.');
        }
      } catch {
        showMessage('Failed to initialize Google Sign-In.');
      }
    };
    script.onerror = () => showMessage('Failed to load Google API script.');
    document.body.appendChild(script);
  }, [handleGoogleResponse]);

  const handleChange = (e) =>
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    showMessage('');
    try {
      await apiClient.post('/users/register/', formData);
      showMessage('Registration successful! Redirecting to login...', 'success');
      setTimeout(() => router.push('/login'), 1500);
    } catch (err) {
      let errorMsg = 'Registration failed. Please check the fields.';
      if (err.response?.data) {
        if (typeof err.response.data === 'object') {
          errorMsg = Object.entries(err.response.data)
            .map(([field, messages]) => {
              const text = Array.isArray(messages) ? messages.join(' ') : messages;
              return `${field.charAt(0).toUpperCase() + field.slice(1)}: ${text}`;
            })
            .join(' | ');
        } else {
          errorMsg = err.response.data.error || err.response.data.detail || errorMsg;
        }
      } else if (err.request) {
        errorMsg = 'Network error. Could not connect to the server.';
      }
      showMessage(errorMsg);
    }
  };

  return (
    <div className={styles.registerPageContainer}>
      <div className={styles.registerBox}>
        {/* Left: Image panel */}
        <div className={styles.imagePanel}>
          <img src={aiImageUrl} alt="Zporta Academy Registration Visual" />
          <h2>Join Zporta Academy</h2>
          <p>Unlock a world of knowledge. Sign up to start exploring and guiding.</p>
        </div>

        {/* Right: Form panel */}
        <div className={styles.formPanel}>
          <h2>Create Your Account</h2>

          {message && (
            <p
              className={`${styles.message} ${
                messageType === 'success' ? styles.success : styles.error
              }`}
            >
              {message}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="reg-username" className={styles.label}>
                Username
              </label>
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
              <label htmlFor="reg-email" className={styles.label}>
                Email
              </label>
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
              <label htmlFor="reg-password" className={styles.label}>
                Password
              </label>
              <input
                id="reg-password"
                type="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                className={styles.input}
                autoComplete="new-password"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="reg-bio" className={styles.label}>
                Short Bio (Optional)
              </label>
              <textarea
                id="reg-bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className={styles.textarea}
                placeholder="Tell us a little about yourself or your interests..."
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              Register
            </button>
          </form>

          <div className={styles.separator}>Or</div>

          {/* Google button renders here */}
          <div id="google-signup" className={styles.googleButtonContainer} />

          <p className={styles.authLink}>
            Already have an account?{' '}
            <Link href="/login">
              Login here
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
