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
      return { ok: false, message: "Bildirim açmak için önce Google ile giriş yapmalısın." };
    }

    if (!db) {
      return { ok: false, message: "Firebase veritabanı bağlantısı bulunamadı." };
    }

    if (!("Notification" in window)) {
      return { ok: false, message: "Bu tarayıcı bildirim desteklemiyor." };
    }

    const permission = await Notification.requestPermission();

    if (permission !== "granted") {
      return { ok: false, message: "Bildirim izni verilmedi." };
    }

    const messaging = await getFirebaseMessaging();

    if (!messaging) {
      return { ok: false, message: "Bu cihazda bildirim desteklenmiyor." };
    }

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const token = await getToken(messaging, {
      vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      return { ok: false, message: "Bildirim token'ı alınamadı." };
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

    return { ok: true, message: "Bildirimler bu cihaz için açıldı." };
  } catch (error) {
    console.error("Bildirim açma hatası:", error);
    return { ok: false, message: "Bildirim açılamadı: " + error.message };
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
