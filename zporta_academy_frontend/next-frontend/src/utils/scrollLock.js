// src/utils/scrollLock.js
const LOCK_KEY = '__zporta_scroll_locks__';
const BODY_CLASS = 'modal-open';

function getLocks() {
  if (typeof window === 'undefined') return 0;
  return window[LOCK_KEY] ?? 0;
}
function setLocks(n) {
  if (typeof window === 'undefined') return;
  window[LOCK_KEY] = n;
}

function setScrollbarVar() {
  if (typeof window === 'undefined') return;
  const docEl = document.documentElement;
  const width = window.innerWidth - docEl.clientWidth; // current scrollbar width
  docEl.style.setProperty('--scrollbar-width', `${Math.max(0, width)}px`);
}

export function lockBodyScroll() {
  if (typeof document === 'undefined') return;
  if (getLocks() === 0) {
    setScrollbarVar();
    document.documentElement.classList.add(BODY_CLASS);
    document.body.classList.add(BODY_CLASS);
  }
  setLocks(getLocks() + 1);
}

export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;
  const next = Math.max(0, getLocks() - 1);
  setLocks(next);
  if (next === 0) {
    document.documentElement.classList.remove(BODY_CLASS);
    document.body.classList.remove(BODY_CLASS);
    document.documentElement.style.removeProperty('--scrollbar-width');
  }
}
