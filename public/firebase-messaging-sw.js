importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCWej3bGdeTX-m1zW2sa_gtWkWWJLjt_Os",
  authDomain: "abonelik-takibi-9a7f9.firebaseapp.com",
  projectId: "abonelik-takibi-9a7f9",
  storageBucket: "abonelik-takibi-9a7f9.firebasestorage.app",
  messagingSenderId: "608678371695",
  appId: "1:608678371695:web:24cc69caead0579f28889a",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: "/icon-192.png",
    badge: "/icon-192.png",
  });
});
