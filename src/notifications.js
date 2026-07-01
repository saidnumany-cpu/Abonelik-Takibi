import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, getFirebaseMessaging } from "./firebase";

let foregroundListenerStarted = false;

function getDeviceId() {
  const key = "abonelik-device-id";
  let deviceId = localStorage.getItem(key);

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(key, deviceId);
  }

  return deviceId;
}

export async function enableNotifications(user) {
  try {
    if (!user) {
      alert("Bildirim açmak için önce Google ile giriş yapmalısın.");
      return;
    }

    if (!db) {
      alert("Firebase veritabanı bağlantısı bulunamadı.");
      return;
    }

    if (!("Notification" in window)) {
      alert("Bu tarayıcı bildirim desteklemiyor.");
      return;
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      alert("Bildirim izni verilmedi.");
      return;
    }

    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      alert("Bu cihazda bildirim desteklenmiyor.");
      return;
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      alert("Bildirim token'ı alınamadı.");
      return;
    }

    const deviceId = getDeviceId();

    await setDoc(
      doc(db, "users", user.uid),
      {
        email: user.email || "",
        displayName: user.displayName || "",
        notificationsEnabled: true,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    await setDoc(
      doc(db, "users", user.uid, "notificationTokens", deviceId),
      {
        token,
        deviceId,
        userAgent: navigator.userAgent,
        enabled: true,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );

    startForegroundNotifications();

    alert("Bildirimler açıldı ve bu cihaz Firebase'e kaydedildi.");
  } catch (error) {
    console.error("Bildirim açma hatası:", error);
    alert("Bildirim açılırken hata oluştu: " + error.message);
  }
}

export async function startForegroundNotifications() {
  try {
    if (foregroundListenerStarted) return;

    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const messaging = await getFirebaseMessaging();

    if (!messaging) return;

    foregroundListenerStarted = true;

    onMessage(messaging, (payload) => {
      const title =
        payload?.notification?.title ||
        payload?.data?.title ||
        "Abonelik Takip";

      const body =
        payload?.notification?.body ||
        payload?.data?.body ||
        "Yeni bildirimin var.";

      new Notification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
      });
    });
  } catch (error) {
    console.error("Ön plan bildirim dinleyici hatası:", error);
  }
}
