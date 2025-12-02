import React, { useState } from "react";
import styles from "@/styles/LoginModal.module.css";

const LoginModal = ({ open = false, onClose = () => {} }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  if (!open) return null;

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Login">
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="Close">×</button>
        <h2 className={styles.title}>Welcome back</h2>
        <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
          <label className={styles.label}>
            Email
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label className={styles.label}>
            Password
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </label>
          <div className={styles.actions}>
            <button className={styles.primaryBtn} type="submit">Log In</button>
            <button className={styles.secondaryBtn} type="button" onClick={onClose}>Cancel</button>
          </div>
        </form>
        <div className={styles.oauthRow}>
          <button className={styles.googleBtn} type="button" disabled title="Coming soon">Continue with Google</button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
