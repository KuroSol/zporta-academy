import React, { useEffect, useMemo, useRef, useState } from "react";

// Simple "show once" tooltip for new/updated options.
// Usage: wrap the control that needs an onboarding hint.
// <FeatureTooltip id="new-dashboard-filter" title={t('...')} description={t('...')}>
//   <button>New Filter</button>
// </FeatureTooltip>

const baseStyle = {
  position: "absolute",
  zIndex: 9999,
  minWidth: "220px",
  maxWidth: "320px",
  background: "#111827",
  color: "#f9fafb",
  borderRadius: "10px",
  boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
  padding: "12px 14px",
  fontSize: "14px",
  lineHeight: 1.4,
};

const arrowStyle = {
  position: "absolute",
  width: "0",
  height: "0",
  borderStyle: "solid",
};

function computePosition(placement) {
  switch (placement) {
    case "left":
      return {
        container: {
          top: "50%",
          right: "calc(100% + 10px)",
          transform: "translateY(-50%)",
        },
        arrow: {
          top: "50%",
          right: "-8px",
          borderWidth: "8px 0 8px 8px",
          borderColor: "transparent transparent transparent #111827",
        },
      };
    case "bottom":
      return {
        container: {
          top: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
        },
        arrow: {
          top: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: "0 8px 8px 8px",
          borderColor: "transparent transparent #111827 transparent",
        },
      };
    case "top":
    default:
      return {
        container: {
          bottom: "calc(100% + 10px)",
          left: "50%",
          transform: "translateX(-50%)",
        },
        arrow: {
          bottom: "-8px",
          left: "50%",
          transform: "translateX(-50%)",
          borderWidth: "8px 8px 0 8px",
          borderColor: "#111827 transparent transparent transparent",
        },
      };
  }
}

function storageKey(id) {
  return `feature_tip_${id}`;
}

export default function FeatureTooltip({
  id,
  title,
  description,
  placement = "top",
  autoHideMs = 0,
  children,
}) {
  const [visible, setVisible] = useState(false);
  const triggerRef = useRef(null);

  const positions = useMemo(() => computePosition(placement), [placement]);

  useEffect(() => {
    if (!id || typeof window === "undefined") return;
    const seen = window.localStorage.getItem(storageKey(id));
    if (!seen) {
      setVisible(true);
    }
  }, [id]);

  useEffect(() => {
    if (!visible || !autoHideMs) return;
    const timer = setTimeout(() => dismiss(), autoHideMs);
    return () => clearTimeout(timer);
  }, [visible, autoHideMs]);

  const dismiss = () => {
    if (id && typeof window !== "undefined") {
      window.localStorage.setItem(storageKey(id), "1");
    }
    setVisible(false);
  };

  return (
    <span
      style={{ position: "relative", display: "inline-block" }}
      ref={triggerRef}
    >
      {children}
      {visible && (
        <div
          style={{ ...baseStyle, ...positions.container }}
          role="tooltip"
          aria-live="polite"
        >
          <div style={{ ...arrowStyle, ...positions.arrow }} />
          {title && (
            <div style={{ fontWeight: 700, marginBottom: description ? 6 : 0 }}>
              {title}
            </div>
          )}
          {description && <div style={{ opacity: 0.9 }}>{description}</div>}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={dismiss}
              style={{
                background: "#2563eb",
                color: "white",
                border: "none",
                borderRadius: "6px",
                padding: "6px 10px",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
