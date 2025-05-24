// --------------- Firebase Service Worker: public/firebase-messaging-sw.js ---------------
// Must be in the public folder

// Use the same Firebase SDK version as your app for compatibility
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js'); // Or your specific version
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// **IMPORTANT**: Replace with your actual Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyApf4q80uDu3A70eDf5khygnNgdELL0-u0", // From your Firebase project settings
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
  firebase.app(); // if already initialized, use that one
}

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || payload.data?.title || 'New Message';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'You have a new update.',
    icon: payload.notification?.icon || payload.data?.icon || '/logo192.png', // Default icon
    badge: payload.data?.badge || '/badge-icon.png', // A small monochrome icon for the status bar
    image: payload.data?.image, // An image to display in the notification
    tag: payload.data?.tag, // An ID for the notification; new notifications with the same tag replace old ones
    renotify: payload.data?.renotify === 'true', // Vibrate/sound even if tag matches (if supported)
    data: { // Custom data to pass to the notification click event
        url: payload.data?.url || '/', // URL to open on click
        // Add any other data you want to access when the notification is clicked
        ...payload.data 
    },
    // actions: payload.data?.actions ? JSON.parse(payload.data.actions) : [] // e.g. [{ action: 'open_url', title: 'Open', icon: '/open-icon.png' }]
  };
  
  // Example: Add actions if provided in the payload data
  if (payload.data?.actions) {
    try {
        notificationOptions.actions = JSON.parse(payload.data.actions);
    } catch (e) {
        console.error("Error parsing actions from payload", e);
    }
  }


  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function(event) {
  console.log('[firebase-messaging-sw.js] Notification click Received.', event.notification);
  event.notification.close(); // Close the notification

  const targetUrl = event.notification.data?.url || '/';

  // This looks to see if the current PWA is already open and focuses it.
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      for (let i = 0; i < clientList.length; i++) {
        let client = clientList[i];
        // Check if the client URL is already the target URL or a base path of it
        // and if it's focused. If so, just focus it.
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // If no matching client is found or focused, open a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});