import React from "react";

/**
 * BioRenderer - Renders biography text with semantic HTML and line break support
 *
 * Features:
 * - Preserves user line breaks from the bio string
 * - Renders each line as its own <p> tag for semantic HTML
 * - SEO-friendly (no dangerouslySetInnerHTML, text in DOM)
 * - Supports emojis and special characters
 * - Respects natural text wrapping
 */
export default function BioRenderer({
  bio,
  sectionClass = "bio-section",
  contentClass = "bio-content",
}) {
  if (!bio || typeof bio !== "string") {
    return null;
  }

  // Split bio on newlines and filter out empty strings
  const bioLines = bio.split(/\r?\n/).filter((line) => line.trim() !== "");

  // If only one line (no line breaks), just render as a single paragraph
  if (bioLines.length <= 1) {
    return (
      <section className={sectionClass}>
        <p className={contentClass}>{bio}</p>
      </section>
    );
  }

  // Multiple lines: render each as its own paragraph
  return (
    <section className={sectionClass}>
      {bioLines.map((line, index) => (
        <p key={index} className={contentClass}>
          {line}
        </p>
      ))}
    </section>
  );
}
