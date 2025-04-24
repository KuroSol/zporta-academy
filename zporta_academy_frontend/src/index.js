import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom'; // ✅ Import Router
import './index.css';
import App from './App';
import { reportWebVitals } from './reportWebVitals';
import { HelmetProvider } from 'react-helmet-async';
import { AuthProvider } from './context/AuthContext';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <Router> {/* ✅ Wrap inside Router */}
        <AuthProvider>
          <App />
        </AuthProvider>
      </Router>
    </HelmetProvider>
  </React.StrictMode>
);

reportWebVitals();
