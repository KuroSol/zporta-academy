// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// THIS IS WHERE YOU PASTE THE NEW CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyCGLsllyYug2cEDf_gLn1divUD8xCCg0O8", // NEW Key
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.firebasestorage.app",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:3f5d33753bb59628366126", // NEW App ID
  measurementId: "G-LKF5HSHBHW"
};

firebase.initializeApp(firebaseConfig); // Make sure this line is present
const messaging = firebase.messaging(); // Make sure this line is present

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
    badge: payload.notification.badge,
    actions: payload.notification.actions,
    data: { url: payload.data.url || 'https://zportaacademy.com' }
  };
  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  const url = event.notification.data.url;
  event.waitUntil(clients.openWindow(url));
});