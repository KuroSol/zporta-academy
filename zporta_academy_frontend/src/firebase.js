// src/firebase.js

// 1) Core Firebase imports
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// 2) Realtime Database imports
import {
  getDatabase,
  ref,
  set,
  onValue,
  push,
  onChildAdded
} from 'firebase/database';

// 3) Your Firebase web config (added databaseURL)
const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0",
  authDomain: "zporta-academy-web.firebaseapp.com",
  projectId: "zporta-academy-web",
  storageBucket: "zporta-academy-web.appspot.com",
  messagingSenderId: "798909537942",
  appId: "1:798909537942:web:e5e7d4b1f41c7c216a6cb7",
  measurementId: "G-DZB2R5TFCE",
  databaseURL: "https://zporta-academy-web-default-rtdb.asia-southeast1.firebasedatabase.app"
};

// 4) Initialize Firebase app and services
const app = initializeApp(firebaseConfig);
console.log("[firebase] initialized with databaseURL →", firebaseConfig.databaseURL);
export const messaging = getMessaging(app);
export const db = getDatabase(app);

// ─── Realtime Database helper functions ───────────────────────
/**
 * Write JSON data to a path
 * @param {string} path   Database path (e.g. `sessions/roomId/cursors/userId`)
 * @param {any}    data   JSON-serializable data
 * @returns {Promise<void>}
 */
export const writeTo = async (path, data) => {
  try {
    const refPath = ref(db, path);                  // ← use the exported `db`
    console.log("[FIREBASE ▶ WRITE]", path, data);
    await set(refPath, data);
  } catch (err) {
    console.error("[FIREBASE ✖ WRITE]", path, err);
  }
};

/**
 * Subscribe to value changes at a path
 * @param {string}   path       Database path
 * @param {function} callback   Called with new data on each change
 * @returns {function} unsubscribe
 */
export function subscribeTo(path, callback) {
  const dbRef = ref(db, path);
  const unsubscribe = onValue(
    dbRef,
    snapshot => {
      const val = snapshot.val();
      console.debug(`[firebase] subscribeTo ${path}`, val);
      callback(val);
    },
    error => console.error(`[firebase] subscribeTo error: ${path}`, error)
  );
  return unsubscribe;
}

/**
 * Push a new child under a path
 * @param {string} path
 * @param {any}    data
 * @returns {Promise<import('firebase/database').ThenableReference>}
 */
export function pushTo(path, data) {
  const dbRef = ref(db, path);
  return push(dbRef, data)
    .then(ref => {
      console.debug(`[firebase] pushTo success: ${path}`, ref.key);
      return ref;
    })
    .catch(err => {
      console.error(`[firebase] pushTo error: ${path}`, err);
      throw err;
    });
}

/**
 * Subscribe to each new child added under a path
 * @param {string}   path      Database path
 * @param {function} callback  Called with (childKey, childData)
 * @returns {function} unsubscribe
 */
export function subscribeChildAdded(path, callback) {
  const dbRef = ref(db, path);
  const unsubscribe = onChildAdded(
    dbRef,
    snapshot => {
      const key = snapshot.key;
      const val = snapshot.val();
      console.debug(`[firebase] subscribeChildAdded ${path}`, key, val);
      callback(key, val);
    },
    error => console.error(`[firebase] subscribeChildAdded error: ${path}`, error)
  );
  return unsubscribe;
}

// ─── Notification helpers (unchanged) ────────────────────────
const PUBLIC_VAPID_KEY =
  'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw';

/**
 * Request permission and retrieve FCM token
 */
export async function requestPermissionAndGetToken() {
  try {
    console.debug('[firebase.js] Permission before:', Notification.permission);
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
      console.debug('[firebase.js] Permission after request:', permission);
    }
    if (permission !== 'granted') return null;
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const fcmToken = await getToken(messaging, { vapidKey: PUBLIC_VAPID_KEY, serviceWorkerRegistration: swReg });
    console.debug('[firebase.js] FCM token:', fcmToken);
    return fcmToken;
  } catch (error) {
    console.error('[firebase.js] Error getting FCM token:', error);
    return null;
  }
}

// Export onMessage for foreground message handling
export { onMessage as subscribeToMessages };
