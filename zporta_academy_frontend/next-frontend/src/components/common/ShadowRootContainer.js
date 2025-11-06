// A minimal Shadow DOM host that renders children into a shadowRoot via React portal.
// Works with React 18/19 without external dependencies.
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * ShadowRootContainer
 * - Renders a host element (default: div) and attaches an open shadow root.
 * - Children are portaled into the shadow root, so styles are scoped.
 *
 * Props:
 * - as?: string | React.ComponentType - tag/component to render as host (default 'div')
 * - className?: string - applied to the host element
 * - style?: React.CSSProperties - applied to the host element
 * - children: React.ReactNode - rendered inside the shadow root
 */
const ShadowRootContainer = ({ as = "div", className, style, children, ...rest }) => {
  const hostRef = useRef(null);
  const [shadowRoot, setShadowRoot] = useState(null);

  useEffect(() => {
    if (!hostRef.current) return;
    if (!shadowRoot) {
      const root = hostRef.current.attachShadow({ mode: "open" });
      setShadowRoot(root);
    }
  }, [shadowRoot]);

  const Host = as;
  return (
    <Host ref={hostRef} className={className} style={style} {...rest}>
      {shadowRoot ? createPortal(children, shadowRoot) : null}
    </Host>
  );
};

export default ShadowRootContainer;
