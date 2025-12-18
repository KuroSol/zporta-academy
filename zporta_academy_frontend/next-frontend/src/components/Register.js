// src/components/Register.js
import React, { useState, useEffect, useCallback, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import apiClient from "@/api";
import { AuthContext } from "@/context/AuthContext";
import { useT } from "@/context/LanguageContext";
import styles from "@/styles/Register.module.css";

const aiImageUrl =
  "https://images.unsplash.com/photo-1516321497487-e288fb19713f?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxzZWFyY2h8NXx8ZWR1Y2F0aW9uJTIwY29sbGFib3JhdGlvbnxlbnwwfHwwfHw%3D&auto=format&fit=crop&w=500&q=60";

export default function Register() {
  const router = useRouter();
  const { login } = useContext(AuthContext);
  const t = useT();
  const { token: invitationToken } = router.query;

  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
    role: "explorer",
    bio: "",
  });

  const [invitationData, setInvitationData] = useState(null);
  const [manualInvitationCode, setManualInvitationCode] = useState("");
  const [applyForTeacher, setApplyForTeacher] = useState(false);
  const [teacherApplication, setTeacherApplication] = useState({
    motivation: "",
    experience: "",
    subjects_to_teach: "",
  });
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState(""); // 'error' | 'success'

  const showMessage = (text, type = "error") => {
    setMessage(text);
    setMessageType(type);
  };

  // Define fetchInvitationDetails BEFORE useEffect that uses it
  const fetchInvitationDetails = useCallback(async (token) => {
    try {
      const { data } = await apiClient.get(
        `/users/invitations/accept/?token=${token}`
      );
      setInvitationData(data);
      // Pre-fill email if invitation exists
      if (data.invitation?.invitee_email) {
        setFormData((prev) => ({
          ...prev,
          email: data.invitation.invitee_email,
          role: "guide",
        }));
      }
      showMessage(
        `You've been invited by ${data.inviter_name} to become a teacher!`,
        "success"
      );
    } catch (err) {
      showMessage(err.response?.data?.detail || "Invalid invitation code.");
    }
  }, []);

  // Check invitation token if present
  useEffect(() => {
    if (invitationToken) {
      fetchInvitationDetails(invitationToken);
    }
  }, [invitationToken, fetchInvitationDetails]);

  // Google Sign-In callback
  const handleGoogleResponse = useCallback(
    async (response) => {
      const token = response?.credential;
      if (!token) {
        showMessage("Invalid Google response.");
        return;
      }
      try {
        showMessage("");
        const { data } = await apiClient.post("/users/google-login/", {
          token,
        });
        if (data.token && data.user) {
          login(data.user, data.token);
          showMessage("Google registration successful!", "success");
        } else {
          showMessage(
            "Google account linked! Redirecting to login...",
            "success"
          );
          setTimeout(() => router.push("/login"), 1500);
        }
      } catch (err) {
        const errorMsg =
          err.response?.data?.error ||
          err.response?.data?.detail ||
          "Google signup failed.";
        showMessage(errorMsg);
      }
    },
    [login, router]
  );

  // Load Google script and render the button
  useEffect(() => {
    if (typeof window === "undefined") return;

    const existing = document.getElementById("google-jssdk");
    if (existing) {
      // If already loaded, try to render the button again
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id:
              "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
            callback: handleGoogleResponse,
            ux_mode: "popup",
          });
          const el = document.getElementById("google-signup");
          if (el) {
            window.google.accounts.id.renderButton(el, {
              theme: "outline",
              size: "large",
              type: "standard",
              text: "signup_with",
              shape: "rectangular",
              width: "300",
            });
          }
        }
      } catch {
        /* no-op */
      }
      return;
    }

    const script = document.createElement("script");
    script.id = "google-jssdk";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => {
      try {
        if (window.google?.accounts?.id) {
          window.google.accounts.id.initialize({
            client_id:
              "805972576303-q8o7etck8qjrjiapfre4df9j7oocl37s.apps.googleusercontent.com",
            callback: handleGoogleResponse,
            ux_mode: "popup",
          });
          const el = document.getElementById("google-signup");
          if (el) {
            window.google.accounts.id.renderButton(el, {
              theme: "outline",
              size: "large",
              type: "standard",
              text: "signup_with",
              shape: "rectangular",
              width: "300",
            });
          }
        } else {
          showMessage("Failed to load Google Sign-In.");
        }
      } catch {
        showMessage("Failed to initialize Google Sign-In.");
      }
    };
    script.onerror = () => showMessage("Failed to load Google API script.");
    document.body.appendChild(script);
  }, [handleGoogleResponse]);

  const handleChange = (e) =>
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleAppChange = (e) =>
    setTeacherApplication((s) => ({ ...s, [e.target.name]: e.target.value }));

  const handleVerifyInvitation = async () => {
    if (!manualInvitationCode.trim()) {
      showMessage("Please enter an invitation code.");
      return;
    }
    await fetchInvitationDetails(manualInvitationCode.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    showMessage("");
    try {
      // Register the user
      await apiClient.post("/users/register/", formData);

      // Login first to get token for subsequent operations
      const loginRes = await apiClient.post("/users/login/", {
        username: formData.username,
        password: formData.password,
      });

      if (!loginRes.data.token) {
        showMessage(
          "Registration successful! Redirecting to login...",
          "success"
        );
        setTimeout(() => router.push("/login"), 1500);
        return;
      }

      const authHeader = {
        headers: { Authorization: `Token ${loginRes.data.token}` },
      };

      // Path 1: If invitation token exists, accept it (automatic approval)
      const activeInvitationToken =
        invitationToken || manualInvitationCode.trim();
      if (activeInvitationToken) {
        try {
          await apiClient.post(
            "/users/invitations/accept/",
            { token: activeInvitationToken },
            authHeader
          );
          showMessage(
            "Registration successful! You are now an approved teacher.",
            "success"
          );
          setTimeout(() => {
            login(loginRes.data.user, loginRes.data.token);
          }, 1500);
          return;
        } catch (invErr) {
          console.error("Invitation acceptance error:", invErr);
          showMessage(
            "Registration successful, but invitation acceptance failed. Please contact support.",
            "success"
          );
        }
      }

      // Path 2: If user applied for teacher, submit application (requires admin approval)
      if (applyForTeacher && teacherApplication.motivation.trim()) {
        try {
          await apiClient.post(
            "/users/guide-application/",
            teacherApplication,
            authHeader
          );
          showMessage(
            "Registration successful! Your teacher application has been submitted for admin review.",
            "success"
          );
        } catch (appErr) {
          console.error("Teacher application error:", appErr);
          showMessage(
            "Registration successful, but teacher application failed. You can reapply later from your profile.",
            "success"
          );
        }
      } else {
        showMessage(
          "Registration successful! Redirecting to login...",
          "success"
        );
      }

      setTimeout(() => router.push("/login"), 2000);
    } catch (err) {
      let errorMsg = "Registration failed. Please check the fields.";
      if (err.response?.data) {
        if (typeof err.response.data === "object") {
          errorMsg = Object.entries(err.response.data)
            .map(([field, messages]) => {
              const text = Array.isArray(messages)
                ? messages.join(" ")
                : messages;
              return `${
                field.charAt(0).toUpperCase() + field.slice(1)
              }: ${text}`;
            })
            .join(" | ");
        } else {
          errorMsg =
            err.response.data.error || err.response.data.detail || errorMsg;
        }
      } else if (err.request) {
        errorMsg = "Network error. Could not connect to the server.";
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
          <h2>{t("register.main.joinZporta")}</h2>
          <p>{t("register.main.joinSubtitle")}</p>
        </div>

        {/* Right: Form panel */}
        <div className={styles.formPanel}>
          <h2>{t("register.main.pageTitle")}</h2>

          {/* Google at the top */}
          <div className={styles.oauthTop}>
            <div className={styles.oauthTitle}>{(t("auth.continueWithGoogle") && t("auth.continueWithGoogle").includes(".")) ? "Continue with Google" : (t("auth.continueWithGoogle") || "Continue with Google")}</div>
            <div id="google-signup" className={styles.googleButtonContainer} />
          </div>

          {message && (
            <p
              className={`${styles.message} ${
                messageType === "success" ? styles.success : styles.error
              }`}
            >
              {message}
            </p>
          )}

          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="reg-username" className={styles.label}>
                {t("register.main.usernameLabel")}
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
                {t("register.main.emailLabel")}
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
                {t("register.main.passwordLabel")}
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

            {!invitationToken && !invitationData && (
              <div className={styles.formGroup}>
                <label htmlFor="reg-invitation" className={styles.label}>
                  {t("register.main.invitationCode")}
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    id="reg-invitation"
                    type="text"
                    value={manualInvitationCode}
                    onChange={(e) => setManualInvitationCode(e.target.value)}
                    className={styles.input}
                    placeholder={t("register.main.invitationPlaceholder")}
                    style={{ flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleVerifyInvitation}
                    className={styles.verifyButton}
                    disabled={!manualInvitationCode.trim()}
                  >
                    {t("register.main.verifyButton")}
                  </button>
                </div>
                <small className={styles.helpText}>
                  {t("register.main.invitationHelpText")}
                </small>
              </div>
            )}

            {!invitationToken && !invitationData && (
              <div className={styles.formGroup}>
                <label htmlFor="reg-role" className={styles.label}>
                  {t("register.main.joinAs")}
                </label>
                <select
                  id="reg-role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className={styles.select}
                >
                  <option value="explorer">
                    {t("register.main.explorer")}
                  </option>
                  <option value="guide">{t("register.main.guide")}</option>
                </select>
                <small className={styles.helpText}>
                  {t("register.main.roleHelpText")}
                </small>
              </div>
            )}

            {!invitationToken &&
              !invitationData &&
              formData.role === "guide" && (
                <div className={styles.formGroup}>
                  <label className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={applyForTeacher}
                      onChange={(e) => setApplyForTeacher(e.target.checked)}
                      className={styles.checkbox}
                    />
                    <span>{t("register.main.applyTeacher")}</span>
                  </label>
                  <small className={styles.helpText}>
                    {t("register.main.applyTeacherHelpText")}
                  </small>
                </div>
              )}

            {applyForTeacher && !invitationToken && (
              <>
                <div className={styles.formGroup}>
                  <label htmlFor="reg-motivation" className={styles.label}>
                    {t("register.main.whyTeach")}
                  </label>
                  <textarea
                    id="reg-motivation"
                    name="motivation"
                    value={teacherApplication.motivation}
                    onChange={handleAppChange}
                    required={applyForTeacher}
                    className={styles.textarea}
                    placeholder={t("register.main.motivation")}
                    rows="3"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reg-experience" className={styles.label}>
                    {t("register.main.teachingExperience")}
                  </label>
                  <textarea
                    id="reg-experience"
                    name="experience"
                    value={teacherApplication.experience}
                    onChange={handleAppChange}
                    className={styles.textarea}
                    placeholder={t("register.main.experiencePlaceholder")}
                    rows="3"
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="reg-subjects" className={styles.label}>
                    {t("register.main.whatTeach")}
                  </label>
                  <input
                    id="reg-subjects"
                    type="text"
                    name="subjects_to_teach"
                    value={teacherApplication.subjects_to_teach}
                    onChange={handleAppChange}
                    required={applyForTeacher}
                    className={styles.input}
                    placeholder={t("register.main.teachPlaceholder")}
                  />
                </div>
              </>
            )}

            {(invitationToken || invitationData) && (
              <div className={styles.formGroup}>
                <div className={styles.invitationBadge}>
                  {t("register.main.teacherInvitation")}
                  <small>{t("register.main.teacherApproved")}</small>
                </div>
              </div>
            )}

            <div className={styles.formGroup}>
              <label htmlFor="reg-bio" className={styles.label}>
                {t("register.main.shortBio")}
              </label>
              <textarea
                id="reg-bio"
                name="bio"
                value={formData.bio}
                onChange={handleChange}
                className={styles.textarea}
                placeholder={t("register.main.bioPlaceholder")}
              />
            </div>

            <button type="submit" className={styles.submitButton}>
              {t("register.main.register")}
            </button>
          </form>

          <div className={styles.separator}>{t("register.main.or")}</div>

          <p className={styles.authLink}>
            {t("register.main.alreadyHaveAccount")}{" "}
            <Link href="/login">{t("register.main.loginHere")}</Link>
          </p>

          {/* Small legal note inside the card */}
          <div className={styles.legalNote}>
            © {new Date().getFullYear()} Zporta Academy • <Link href="/legal/tokushoho">Legal</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
