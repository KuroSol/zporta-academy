// /next-frontend/src/firebase/index.js

// 1) Core Firebase imports
import { initializeApp, getApps, getApp } from 'firebase/app';
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

// 3) Your Firebase web config (should be in environment variables)
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

// 4) Initialize Firebase App (SSR-safe)
// This prevents re-initializing the app on every hot-reload in development
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getDatabase(app);

// 5) Initialize Firebase services that are CLIENT-SIDE ONLY
let messaging;
if (typeof window !== 'undefined') {
  console.log("[firebase] Initializing messaging service in the browser.");
  messaging = getMessaging(app);
} else {
  console.log("[firebase] Messaging service not initialized (server-side).");
}


// ─── Realtime Database helper functions (Unchanged) ───────────────────
/**
 * Write JSON data to a path
 * @param {string} path   Database path (e.g. sessions/roomId/cursors/userId)
 * @param {any}    data   JSON-serializable data
 * @returns {Promise<void>}
 */
export const writeTo = async (path, data) => {
  try {
    const refPath = ref(db, path);
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

// ─── Notification helpers (Adapted for Next.js) ─────────────────────
const PUBLIC_VAPID_KEY =
  'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw';

/**
 * Request permission and retrieve FCM token. This function will only work
 * on the client-side.
 */
export async function requestPermissionAndGetToken() {
  // First, check if we are in a browser environment and if messaging was initialized.
  if (!messaging) {
    console.log("Firebase Messaging is not available in this environment.");
    return null;
  }

  try {
    console.debug('[firebase.js] Permission before:', Notification.permission);
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
      console.debug('[firebase.js] Permission after request:', permission);
    }
    if (permission !== 'granted') {
        console.log("Notification permission not granted.");
        return null;
    }
    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const fcmToken = await getToken(messaging, { vapidKey: PUBLIC_VAPID_KEY, serviceWorkerRegistration: swReg });
    console.debug('[firebase.js] FCM token:', fcmToken);
    return fcmToken;
  } catch (error) {
    console.error('[firebase.js] Error getting FCM token:', error);
    return null;
  }
}

// Export the initialized db and the onMessage function for foreground message handling
export { db, messaging, onMessage as subscribeToMessages };
