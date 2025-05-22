// ✅ Only used in App.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDvly8G3XTRBUzdq-N8LaaOHDgPr2AnO2o",
  authDomain: "zporta-academy-firebase.firebaseapp.com",
  projectId: "zporta-academy-firebase",
  storageBucket: "zporta-academy-firebase.firebasestorage.app",
  messagingSenderId: "389677350718",
  appId: "1:389677350718:web:33dce48c2a8e405416366f",
  measurementId: "G-VP2BJCZK9S"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const messaging = getMessaging(firebaseApp);
