// public/firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.0/firebase-messaging.js');

firebase.initializeApp({
  apiKey: "AIzaSyBJLv_ajyGfVC3OvcSGmLvk_5CgQfu21A",
  authDomain: "zporta-academy.firebaseapp.com",
  projectId: "zporta-academy",
  storageBucket: "zporta-academy.appspot.com",
  messagingSenderId: "521005152211",
  appId: "1:521005152211:web:74ee4bb56d3415af366126",
  measurementId: "G-FHLP3HQ0EP"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const { title, body } = payload.notification;
  const notificationOptions = {
    body: body,
    icon: '/logo192.png', // Replace with your icon
  };

  self.registration.showNotification(title, notificationOptions);
});
