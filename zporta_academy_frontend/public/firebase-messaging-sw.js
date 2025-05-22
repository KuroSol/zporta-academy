// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ← Initialize the Firebase App
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

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, { body, icon });
});
