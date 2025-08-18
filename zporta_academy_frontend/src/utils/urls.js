// src/utils/urls.js (CRA app)
const rawEnv = (process.env.REACT_APP_QUIZ_ORIGIN || '').trim();

const inferLocalNext =
  /^localhost$|^127\.0\.0\.1$/.test(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : window.location.origin;

export const QUIZ_ORIGIN = (rawEnv || inferLocalNext).replace(/\/+$/, '');

if (process.env.NODE_ENV === 'development') {
  // eslint-disable-next-line no-console
  console.log('[QUIZ_ORIGIN]', QUIZ_ORIGIN, '(env:', rawEnv || '—', ')');
}

export const quizPermalinkToUrl = (permalink) => {
  const path = String(permalink || '').replace(/^\/+|\/+$/g, '');
  return `${QUIZ_ORIGIN}/quizzes/${path}/`;
};

export const quizPartsToUrl = (u, s, d, slug) =>
  `${QUIZ_ORIGIN}/quizzes/${u}/${s}/${d}/${slug}/`;
