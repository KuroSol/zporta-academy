// frontend/src/firebase.js

import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// ✅ Your Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0",
  authDomain: "zporta-academy-web.firebaseapp.com",
  projectId: "zporta-academy-web",
  storageBucket: "zporta-academy-web.appspot.com",
  messagingSenderId: "798909537942",
  appId: "1:798909537942:web:e5e7d4b1f41c7c216a6cb7",
  measurementId: "G-DZB2R5TFCE"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// ✅ Add permission handler here
export const requestNotificationPermission = async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'YOUR_PUBLIC_VAPID_KEY'  // ⚠️ You must get this from Firebase Console
      });
      console.log("✅ FCM Token:", token);

      // TODO: send `token` to your Django backend
    } else {
      console.warn("🚫 Notification permission denied");
    }
  } catch (err) {
    console.error("❌ Error getting permission or token:", err);
  }
};

// Export messaging and helpers
export { messaging, getToken, onMessage };
