import React, { useState } from "react";
import { useRouter } from "next/router";
import styles from "@/styles/LoginModal.module.css";

const LoginModal = ({ open = false, onClose = () => {} }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("login"); // "login" or "register"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");

  if (!open) return null;

  const handleLoginRedirect = () => {
    onClose();
    router.push("/login");
  };

  const handleRegisterRedirect = () => {
    onClose();
    router.push("/register");
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Login or Register" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        
        <div className={styles.tabs}>
          <button 
            className={`${styles.tab} ${activeTab === "login" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("login")}
          >
            Log In
          </button>
          <button 
            className={`${styles.tab} ${activeTab === "register" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("register")}
          >
            Sign Up
          </button>
        </div>

        {activeTab === "login" ? (
          <>
            <h2 className={styles.title}>Welcome back!</h2>
            <p className={styles.subtitle}>Sign in to continue learning</p>
            <div className={styles.form}>
              <button className={styles.fullPageBtn} onClick={handleLoginRedirect}>
                Go to Login Page
              </button>
              <div className={styles.divider}>
                <span>or continue here</span>
              </div>
              <button className={styles.googleBtn} type="button" disabled title="Coming soon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className={styles.title}>Join Zporta Academy</h2>
            <p className={styles.subtitle}>Create your account to start learning</p>
            <div className={styles.form}>
              <button className={styles.fullPageBtn} onClick={handleRegisterRedirect}>
                Go to Registration Page
              </button>
              <div className={styles.divider}>
                <span>or sign up here</span>
              </div>
              <button className={styles.googleBtn} type="button" disabled title="Coming soon">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9.003 18c2.43 0 4.467-.806 5.956-2.18L12.05 13.56c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.96v2.332C2.438 15.983 5.482 18 9.003 18z" fill="#34A853"/>
                  <path d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.71 0-.593.102-1.17.282-1.71V4.96H.957C.347 6.175 0 7.55 0 9.002c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9.003 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.464.891 11.426 0 9.003 0 5.482 0 2.438 2.017.96 4.958L3.967 7.29c.708-2.127 2.692-3.71 5.036-3.71z" fill="#EA4335"/>
                </svg>
                Sign up with Google
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LoginModal;
