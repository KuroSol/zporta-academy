// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ← Initialize the Firebase App
firebase.initializeApp({
  apiKey: "AIzaSyDN8ndlbKavL7o827TMn7uiy0OUhxVrtIA",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.appspot.com", // ← should be .appspot.com
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:55926c3d556c622d366126",
  measurementId: "G-5RG79GDJC5"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, { body, icon });
});
