import { getToken } from "firebase/messaging";
import { doc, setDoc } from "firebase/firestore";
import { db, getFirebaseMessaging } from "./firebase";

export async function enableNotifications(user) {
  if (!user) {
    alert("Bildirim açmak için önce Google ile giriş yapmalısın.");
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

  const token = await getToken(messaging, {
    vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY,
  });

  if (!token) {
    alert("Bildirim token'ı alınamadı.");
    return;
  }

  await setDoc(
    doc(db, "users", user.uid),
    {
      notificationToken: token,
      notificationsEnabled: true,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  alert("Bildirimler açıldı.");
}
