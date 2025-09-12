import { useState } from "react";
import Link from "next/link";
import apiClient from "@/api";
import styles from "@/styles/PasswordReset.module.css";

export default function ResetPasswordConfirm({ uid, token, onSuccess }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [type, setType] = useState(""); // 'success' | 'error'

  const show = (t, k = "error") => { setMsg(t); setType(k); };

  const submit = async (e) => {
    e.preventDefault();
    show("");

    if (!uid || !token) return show("Invalid reset link.");
    if (newPassword !== confirmPassword) return show("Passwords do not match.");
    if (newPassword.length < 8) return show("Password must be at least 8 characters.");

    try {
      await apiClient.post("/users/password-reset/confirm/", {
        uid, token, new_password: newPassword,
      });
      show("Password reset successful. Redirecting…", "success");
      if (onSuccess) setTimeout(() => onSuccess(), 1500);
    } catch (error) {
      const d = error?.response?.data;
      const m =
        d?.error ||
        d?.detail ||
        (d?.token && `Token Error: ${[].concat(d.token).join(" ")}`) ||
        (d?.uid && `UID Error: ${[].concat(d.uid).join(" ")}`) ||
        (d?.new_password && `Password Error: ${[].concat(d.new_password).join(" ")}`) ||
        (d?.non_field_errors && [].concat(d.non_field_errors).join(" ")) ||
        "Password reset failed. Link may be invalid or expired.";
      show(m);
    }
  };

  return (
    <div className={styles.resetPageContainer}>
      <div className={styles.resetBox}>
        <h1 className={styles.title}>Set New Password</h1>
        <p className={styles.instructions}>Please enter your new password below.</p>

        {msg && (
          <p className={`${styles.message} ${type === "success" ? styles.success : styles.error}`}>{msg}</p>
        )}

        <form onSubmit={submit}>
          <div className={styles.formGroup}>
            <label htmlFor="new-password" className={styles.label}>New Password</label>
            <input id="new-password" type="password" value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)} required className={styles.input}
              autoComplete="new-password" />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="confirm-password" className={styles.label}>Confirm New Password</label>
            <input id="confirm-password" type="password" value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)} required className={styles.input}
              autoComplete="new-password" />
          </div>
          <button type="submit" className={styles.submitButton}>Reset Password</button>
        </form>

        <div className={styles.backLink}><Link href="/login">Back to Login</Link></div>
      </div>
    </div>
  );
}
