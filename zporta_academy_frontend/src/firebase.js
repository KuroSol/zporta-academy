// ✅ Only used in App.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0",
  authDomain: "zporta-academy-web.firebaseapp.com",
  projectId: "zporta-academy-web",
  storageBucket: "zporta-academy-web.firebasestorage.app",
  messagingSenderId: "798909537942",
  appId: "1:798909537942:web:e5e7d4b1f41c7c216a6cb7",
  measurementId: "G-DZB2R5TFCE"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const messaging = getMessaging(firebaseApp);
