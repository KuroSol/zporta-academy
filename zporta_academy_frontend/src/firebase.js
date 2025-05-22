// ✅ Only used in App.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyCGLsllyYug2cEDf_gLn1divUD8xCCg0O8",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.firebasestorage.app",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:3f5d33753bb59628366126",
  measurementId: "G-LKF5HSHBHW"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
