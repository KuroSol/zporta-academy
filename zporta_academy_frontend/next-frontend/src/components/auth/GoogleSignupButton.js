// src/components/auth/GoogleSignupButton.js
import React, { useEffect, useCallback, useContext } from "react";
import { useRouter } from "next/router";
import { AuthContext } from "@/context/AuthContext";
import apiClient from "@/api";

/**
 * Renders a "Sign up with Google" button using Google Identity Services.
 * Places the button inside a div with id `google-signup`.
 * - Shows a popup for Google auth
 * - Calls backend `/users/google-login/` with the returned credential
 * - On success, logs user in via `AuthContext.login`
 */
export default function GoogleSignupButton({ className }) {
  const router = useRouter();
  const { login } = useContext(AuthContext);

  const handleGoogleResponse = useCallback(
    async (response) => {
      const token = response?.credential;
      if (!token) return;
      try {
        const { data } = await apiClient.post("/users/google-login/", {
          token,
        });
        if (data?.token && data?.user) {
          login(data.user, data.token);
        } else {
          // If backend returns only linking confirmation
          setTimeout(() => router.push("/login"), 800);
        }
      } catch (err) {
        // Non-blocking: leave button as-is
        console.error(
          "Google signup error",
          err?.response?.data || err?.message
        );
      }
    },
    [login, router]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;

    const ensureRender = () => {
      try {
        window.google?.accounts?.id?.initialize({
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
      } catch (e) {
        console.warn("Google button render failed", e);
      }
    };

    // If script already present
    if (document.getElementById("google-jssdk")) {
      ensureRender();
      return;
    }

    const script = document.createElement("script");
    script.id = "google-jssdk";
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = ensureRender;
    document.body.appendChild(script);
  }, [handleGoogleResponse]);

  return <div id="google-signup" className={className} />;
}
