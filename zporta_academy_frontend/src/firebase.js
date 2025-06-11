// src/firebase.js

// 1) Core Firebase imports
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';


// New database imports:
import {
  getDatabase,
  ref,
  onValue,
  set,
  push,
  onChildAdded
} from 'firebase/database';

// 2) Your Firebase web config
const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0",
  authDomain: "zporta-academy-web.firebaseapp.com",
  projectId: "zporta-academy-web",
  storageBucket: "zporta-academy-web.appspot.com",
  messagingSenderId: "798909537942",
  appId: "1:798909537942:web:e5e7d4b1f41c7c216a6cb7",
  measurementId: "G-DZB2R5TFCE"
};

// 3) Initialize Firebase + Messaging
const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);

// ⬇️ Initialize Realtime Database
const db = getDatabase(app);

// ─── Realtime Database helper functions ───────────────────────
/** write JSON data to a path */
export function writeTo(path, data) {
  return set(ref(db, path), data);
}

/** subscribe to value changes at a path */
export function subscribeTo(path, callback) {
  return onValue(ref(db, path), snapshot => callback(snapshot.val()));
}

/** push a new child under a path (for drawing strokes) */
export function pushTo(path, data) {
  return push(ref(db, path), data);
}

/** subscribe to each new child under a path */
export function subscribeChildAdded(path, callback) {
  return onChildAdded(ref(db, path), snapshot => callback(snapshot.key, snapshot.val()));
}
// ─────────────────────────────────────────────────────────────



// 4) Your Web Push (VAPID) public key from Firebase Console
const PUBLIC_VAPID_KEY =
  'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw';

/**
 * requestPermissionAndGetToken()
 * - Call this after login or from a button handler
 * - Prompts if needed, registers SW, and returns the FCM token
 */
export async function requestPermissionAndGetToken() {
  try {
    console.debug('[firebase.js] ▶ Notification.permission before:', Notification.permission);

    // Only ask if user hasn't decided yet
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
      console.debug('[firebase.js] ▶ Notification.permission after request:', permission);
    }

    if (permission !== 'granted') {
      console.warn('[firebase.js] ⚠ Notification permission not granted.');
      return null;
    }

    // Register the Service Worker for FCM
    const swRegistration = await navigator.serviceWorker.register(
      '/firebase-messaging-sw.js'
    );
    console.debug('[firebase.js] ✅ SW registered at:', swRegistration.scope);

    // Attempt to retrieve the FCM token
    const fcmToken = await getToken(messaging, {
      vapidKey: PUBLIC_VAPID_KEY,
      serviceWorkerRegistration: swRegistration,
    });

    if (!fcmToken) {
      console.warn('[firebase.js] ⚠ No FCM token retrieved.');
      return null;
    }

    console.debug('[firebase.js] 🎉 FCM token:', fcmToken);
    return fcmToken;
  } catch (error) {
    console.error('[firebase.js] ❌ Error retrieving FCM token:', error);
    return null;
  }
}

// Export onMessage to handle incoming messages in the foreground
export { onMessage };
