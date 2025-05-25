// src/firebase.js

// 1) Core Firebase imports
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

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

// 4) Your exact Web Push (VAPID) public key from Firebase Console
const PUBLIC_VAPID_KEY = 
  'BDm-BOtLstlVLYXxuVIyNwFzghCGtiFD5oFd1qkrMrRG_sRTTmE-GE_tL5I8Qu355iun2xAmqukiQIRvU4ZJKcw';

/**
 * requestPermissionAndGetToken()
 * - Call this from a click handler (e.g. right after login)
 * - It asks permission, registers SW, then returns the FCM token.
 */
export async function requestPermissionAndGetToken() {
  // A) Ask the user to allow notifications
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission not granted');
  }

  // B) Register the Service Worker at your site root
  const swRegistration = await navigator.serviceWorker.register(
    '/firebase-messaging-sw.js'
  );
  console.log('[firebase.js] SW registered at', swRegistration.scope);

  // C) Fetch the FCM token
  const fcmToken = await getToken(messaging, {
    vapidKey: PUBLIC_VAPID_KEY,
    serviceWorkerRegistration: swRegistration
  });

  if (!fcmToken) {
    throw new Error('Failed to get FCM token');
  }

  console.log('[firebase.js] FCM token:', fcmToken);
  return fcmToken;
}

// 5) Optionally export onMessage if you want to handle incoming pushes in-app
export { onMessage };
