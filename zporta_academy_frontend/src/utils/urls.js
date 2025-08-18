// src/utils/urls.js (CRA app)
const rawEnv = (process.env.REACT_APP_QUIZ_ORIGIN || '').trim();

// If no env provided, and we're running locally on 127.0.0.1/localhost,
// default to Next dev on :3001. In prod, fall back to current origin.
const inferLocalNext =
  /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : window.location.origin;

export const QUIZ_ORIGIN = (rawEnv || inferLocalNext).replace(/\/+$/, '');

// TEMP debug (remove after verifying)
if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('[QUIZ_ORIGIN]', QUIZ_ORIGIN, '(env:', rawEnv || '—', ')');
}

// Accepts "username/subject/date/slug"
export const quizPermalinkToUrl = (permalink, opts = {}) => {
  const path = String(permalink || '').replace(/^\/+|\/+$/g, '');
  const suffix = opts.review ? '' : '';
  return `${QUIZ_ORIGIN}/quizzes/${path}`;
};

// Optional builder
export const quizPartsToUrl = (u, s, d, slug) =>
  `${QUIZ_ORIGIN}/quizzes/${u}/${s}/${d}/${slug}/`;
