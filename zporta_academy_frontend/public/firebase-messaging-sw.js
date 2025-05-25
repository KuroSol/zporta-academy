
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0",
  authDomain: "zporta-academy-web.firebaseapp.com",
  projectId: "zporta-academy-web",
  storageBucket: "zporta-academy-web.firebasestorage.app",
  messagingSenderId: "798909537942",
  appId: "1:798909537942:web:e5e7d4b1f41c7c216a6cb7",
  measurementId: "G-DZB2R5TFCE"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app();
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update.',
    icon: payload.notification?.icon || payload.data?.icon || '/logo192.png',
    badge: payload.data?.badge || '/badge-icon.png',
    image: payload.data?.image,
    tag: payload.data?.tag,
    renotify: payload.data?.renotify === 'true',
    data: {
        url: payload.data?.url || '/',
        ...payload.data 
    },
  };
  
  if (payload.data?.actions) {
    try {
        notificationOptions.actions = JSON.parse(payload.data.actions);
    } catch (e) {
        console.error("Error parsing actions from payload", e);
    }
  }

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  event.notification.close(); 

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});