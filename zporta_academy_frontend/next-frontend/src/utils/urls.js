// src/utils/urls.js

/** Build a client URL from a quiz permalink coming from the API */
export function quizPermalinkToUrl(permalink) {
  if (!permalink) return '#';
  // if API already returns full slug like "alex/english/2025-05-04/xyz"
  if (!permalink.startsWith('/')) return `/quizzes/${permalink}`;
  // if API already includes a leading slash (rare), just pass it through
  return permalink;
}
