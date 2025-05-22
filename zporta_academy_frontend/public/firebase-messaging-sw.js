// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// ← Initialize the Firebase App
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

// 2) **Initialize the default app** before anything else
firebase.initializeApp(firebaseConfig);

// 3) Now grab messaging
const messaging = firebase.messaging();

// 4) Handle background pushes
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification || {};
  self.registration.showNotification(title, { body, icon });
});
