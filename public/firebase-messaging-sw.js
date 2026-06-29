importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCWej3bGdeTX-m1zW2sa_gtWkWWJLjt_Os",
  authDomain: "abonelik-takibi-9a7f9.firebaseapp.com",
  projectId: "abonelik-takibi-9a7f9",
  storageBucket: "abonelik-takibi-9a7f9.firebasestorage.app",
  messagingSenderId: "608678371695",
  appId: "1:608678371695:web:24cc69caead0579f28889a"
});

try {
  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title = payload?.notification?.title || "Abonelik Takip";
    const body = payload?.notification?.body || "Yeni bildirimin var.";

    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png"
    });
  });
} catch (error) {
  console.error("Firebase Messaging Service Worker hatası:", error);
}
