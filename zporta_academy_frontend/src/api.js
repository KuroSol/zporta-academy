// src/api.js
// This file configures and exports a central Axios instance for making API calls.

import axios from 'axios';

// Helper function to retrieve the auth token from storage.
// Adjust if you store the token differently (e.g., sessionStorage, context).
const getToken = () => localStorage.getItem('token');

// Create a new Axios instance with custom configuration.
const apiClient = axios.create({
  // Set the base URL using the environment variable.
  // This automatically switches between local dev URL and production URL.
  baseURL: process.env.REACT_APP_API_BASE_URL,

  // Optional: Set a timeout for requests (in milliseconds).
  timeout: 10000,
});

// Use an Axios Request Interceptor to automatically add the
// Authorization header to every outgoing request if a token exists.
apiClient.interceptors.request.use(
  (config) => {
    // Get the token before each request.
    const token = getToken();
    if (token) {
      // If token exists, add it to the Authorization header.
      // Adjust 'Token ${token}' if your backend expects 'Bearer ${token}'.
      config.headers['Authorization'] = `Token ${token}`;
    }
    // Important: return the config object for the request to proceed.
    return config;
  },
  (error) => {
    // Handle request configuration errors (optional).
    return Promise.reject(error);
  }
);

// Export the configured Axios instance to be used elsewhere in the app.
export default apiClient;