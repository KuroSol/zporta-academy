// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getMessaging } from 'firebase/messaging'; // ✅ Add this line

const firebaseConfig = {
  apiKey: "AIzaSyBJLv_ajyGFVC3OvceSGmlvk_5CgQfu21A",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.firebasestorage.app",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:74ee4bb56d3415af366126",
  measurementId: "G-FHLP3HQ0EP"
};

const app = initializeApp(firebaseConfig);

// ✅ Add this line to initialize messaging
const messaging = getMessaging(app);

export { messaging };
