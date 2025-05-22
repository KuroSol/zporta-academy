// ✅ Only used in App.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDN8ndlbKavL7o827TMn7uiy0OUhxVrtIA",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.firebasestorage.app",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:55926c3d556c622d366126",
  measurementId: "G-5RG79GDJC5"
};

export const firebaseApp = initializeApp(firebaseConfig);
export const messaging = getMessaging(firebaseApp);
