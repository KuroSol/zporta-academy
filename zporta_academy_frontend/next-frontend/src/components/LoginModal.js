import React from "react";
import { useRouter } from "next/router";
import styles from "@/styles/LoginModal.module.css";

const LoginModal = ({ open = false, onClose = () => {} }) => {
  const router = useRouter();

  if (!open) return null;

  const handleLogin = () => {
    onClose();
    router.push("/login");
  };

  const handleRegister = () => {
    onClose();
    router.push("/register");
  };

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Login" onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>Sign in to continue</h2>
        <p className={styles.subtitle}>Access premium content, track your progress, and more</p>
        <div className={styles.actions}>
          <button className={styles.primaryBtn} onClick={handleLogin}>
            Log In
          </button>
          <button className={styles.secondaryBtn} onClick={handleRegister}>
            Create Account
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
