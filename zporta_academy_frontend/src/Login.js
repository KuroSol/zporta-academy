import React, { useState, useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom'; // Keep Link, useNavigate might not be needed if context handles it
import { AuthContext } from './context/AuthContext';
import apiClient from './api'; // <--- Import the apiClient instance (adjust path if needed, e.g., '../api')

const Login = () => {
  const { login } = useContext(AuthContext);
  const [username, setUsername] = useState(''); // Ensure backend expects 'username' (or change to email if needed)
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  // const navigate = useNavigate(); // You likely don't need this if login() in AuthContext handles navigation

  const handleLogin = async (e) => {
    e.preventDefault();
    setMessage('');

    try {
      // Use apiClient.post with relative URL and data object
      const response = await apiClient.post('/users/login/', {
        username, // Or 'email' if your backend expects that
        password,
      });

      // Axios successful response (status 2xx)
      const data = response.data; // Data is directly in response.data
      login(data, data.token); // Call context login function

    } catch (error) {
      // Axios error handling
      console.error('Error during login:', error);
      if (error.response && error.response.data) {
        // Server responded with an error status code (4xx, 5xx)
        // Adjust keys based on your Django API error format ('error', 'detail', 'non_field_errors')
        const backendError = error.response.data.error ||
                             error.response.data.detail ||
                             (error.response.data.non_field_errors ? error.response.data.non_field_errors.join(' ') : null) ||
                             'Login failed. Please check credentials.'; // Fallback error message
        setMessage(backendError);
      } else if (error.request) {
        // Network error (no response received)
        setMessage('Network error. Could not connect to the server.');
      } else {
        // Other errors (e.g., setting up the request)
        setMessage('An unexpected error occurred. Please try again.');
      }
    }
  };

  // The JSX part remains the same as your original component
  return (
    <div>
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        <div>
          {/* Use "Email" if your backend expects email for login */}
          <label>Username:</label>
          <input
            type="text" // Or type="email"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoComplete="username" // Add autocomplete hint
          />
        </div>
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password" // Add autocomplete hint
          />
        </div>
        <div>
          <p>Forgot your password?</p>
          <Link to="/password-reset">Reset Password</Link>
        </div>
        <button type="submit">Login</button>
      </form>
      {message && <p style={{ color: 'red' }}>{message}</p>}
      {/* Link to Register Page */}
      <p>Don't have an account? <Link to="/register">Register here</Link></p>
    </div>
  );
};

export default Login;