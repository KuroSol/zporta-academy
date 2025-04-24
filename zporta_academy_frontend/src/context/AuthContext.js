import React, { createContext, useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../api"; // <-- Adjust path if needed (e.g., './api')

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token") || null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const logout = useCallback(() => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setUser(null);
    setToken(null);
    // Optional: delete apiClient.defaults.headers.common['Authorization'];
    navigate("/login");
  }, [navigate]);

  const fetchUserProfile = useCallback(async (authToken) => {
    if (!authToken) {
      setLoading(false);
      return;
    }
    try {
      const response = await apiClient.get('/users/profile/'); // Uses baseURL + relative path; Auth handled by interceptor
      const userData = response.data;
      setUser(userData);
      localStorage.setItem("user", JSON.stringify(userData));
    } catch (error) {
      console.error("Auth Error fetching profile:", error.response ? error.response.data : error.message);
      logout(); // Logout if fetching profile fails (e.g., bad token)
    } finally {
      setLoading(false);
    }
  }, [logout]);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
      fetchUserProfile(storedToken);
    } else {
      setLoading(false);
    }
  }, [fetchUserProfile]); // Dependency array ensures fetchUserProfile is stable due to useCallback

  const login = (userData, authToken) => {
    setUser(userData);
    setToken(authToken);
    localStorage.setItem("user", JSON.stringify(userData));
    localStorage.setItem("token", authToken);
    if (userData.username) {
        localStorage.setItem("username", userData.username);
    }
    // Optional: apiClient.defaults.headers.common['Authorization'] = `Token ${authToken}`;
    navigate("/profile");
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {!loading ? children : null /* Or a loading spinner */}
    </AuthContext.Provider>
  );
};