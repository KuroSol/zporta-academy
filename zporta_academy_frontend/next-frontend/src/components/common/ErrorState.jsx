import React from "react";

export default function ErrorState({
  title = "Error",
  message = "Something went wrong.",
  onRetry,
  compact = false,
}) {
  return (
    <div
      style={{
        textAlign: "center",
        padding: compact ? "1rem" : "3rem 1rem",
        color: "#6b7280",
      }}
    >
      <h2 style={{ marginTop: 0 }}>{title}</h2>
      <p>{message}</p>
      {typeof onRetry === "function" && (
        <button
          onClick={onRetry}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: 6,
            border: "1px solid var(--border-color)",
            background: "var(--bg-container)",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
