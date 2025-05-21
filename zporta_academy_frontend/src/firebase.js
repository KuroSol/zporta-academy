// ✅ Only used in App.js
import { initializeApp } from "firebase/app";
import { getMessaging } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyBJLv_ajyGfVC3OvcSGmLvk_5Cg0fU21A",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.appspot.com",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:74ee4bb56d3415af366126",
  measurementId: "G-FHLP3HQ0EP"
};

const app = initializeApp(firebaseConfig);
export const messaging = getMessaging(app);
