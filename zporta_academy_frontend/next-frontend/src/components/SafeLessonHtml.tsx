import React, { useEffect, useRef } from "react";

type Props = { html: string; className?: string };

/**
 * SSR-safe renderer for stored lesson HTML
 * Fixes hydration issues with <audio>, <details>, and inline <style> tags
 */
export default function SafeLessonHtml({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    
    // 1) Strip top-level <style> tags to avoid SSR/CSP issues
    const sanitized = html.replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "");
    
    // 2) Tweak <audio> tags: preload="none" to avoid blocking hydration
    const tweaked = sanitized.replace(
      /<audio\b([^>]*)>/gi,
      (m, attrs) => `<audio preload="none" controlsList="nodownload noplaybackrate"${attrs.replace(/^/, " ")}>`
    );
    
    ref.current.innerHTML = tweaked;
  }, [html]);

  // suppressHydrationWarning prevents React from complaining about mismatches
  return <div ref={ref} className={className} suppressHydrationWarning />;
}
