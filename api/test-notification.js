const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : undefined;

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
  });
}

module.exports = async function handler(req, res) {
  try {
    initFirebaseAdmin();

    const db = getFirestore();
    const messaging = getMessaging();

    const usersSnapshot = await db.collection("users").get();

    let sentCount = 0;
    let skippedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();

      if (!user.notificationToken || user.notificationsEnabled !== true) {
        skippedCount += 1;
        continue;
      }

      await messaging.send({
        token: user.notificationToken,
        notification: {
          title: "Test bildirimi",
          body: "Abonelik Takip bildirim sistemi çalışıyor.",
        },
        webpush: {
          notification: {
            title: "Test bildirimi",
            body: "Abonelik Takip bildirim sistemi çalışıyor.",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
          },
        },
      });

      sentCount += 1;
    }

    return res.status(200).json({
      ok: true,
      sentCount,
      skippedCount,
    });
  } catch (error) {
    console.error("test-notification error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
