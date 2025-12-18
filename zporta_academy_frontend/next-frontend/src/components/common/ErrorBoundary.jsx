import React from "react";

function ErrorFallback({ error, reset }) {
  return (
    <div style={{ padding: "1rem", maxWidth: 720, margin: "2rem auto" }}>
      <div
        style={{
          border: "1px solid var(--border-color)",
          borderRadius: 8,
          background: "var(--bg-container)",
          boxShadow: "var(--shadow-md)",
          padding: "1rem",
        }}
      >
        <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
        <p style={{ color: "var(--text-secondary)" }}>
          {error?.message || "Unexpected error occurred."}
        </p>
        <button
          onClick={reset}
          style={{
            padding: "0.4rem 0.8rem",
            borderRadius: 6,
            border: "1px solid var(--border-color)",
            background: "var(--bg-subtle)",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // Optionally log to a service
    // console.error('ErrorBoundary caught:', error, info);
  }

  reset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} reset={this.reset} />;
    }
    return this.props.children;
  }
}
