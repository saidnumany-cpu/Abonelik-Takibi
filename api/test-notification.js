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

// Test bildirimi tüm kullanıcılara gider, bu yüzden sadece CRON_SECRET ile çağrılabilir:
// curl -H "Authorization: Bearer <CRON_SECRET>" https://abonelik-takibi.vercel.app/api/test-notification
module.exports = async function handler(req, res) {
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ ok: false, error: "Yetkisiz" });
  }

  try {
    initFirebaseAdmin();

    const db = getFirestore();
    const messaging = getMessaging();

    const usersSnapshot = await db.collection("users").get();

    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      const user = userDoc.data();

      if (user.notificationsEnabled !== true) {
        skippedCount += 1;
        continue;
      }

      // Token'lar artık users/{uid}/notificationTokens altında tutuluyor
      const tokensSnapshot = await userDoc.ref
        .collection("notificationTokens")
        .where("enabled", "==", true)
        .get();

      const tokens = tokensSnapshot.docs.map((d) => d.data().token).filter(Boolean);

      if (!tokens.length) {
        skippedCount += 1;
        continue;
      }

      const results = await Promise.allSettled(
        tokens.map((token) =>
          messaging.send({
            token,
            notification: {
              title: "Test bildirimi",
              body: "Abonelik Takip bildirim sistemi çalışıyor.",
            },
            data: {
              title: "Test bildirimi",
              body: "Abonelik Takip bildirim sistemi çalışıyor.",
              url: "/",
            },
            webpush: {
              notification: {
                title: "Test bildirimi",
                body: "Abonelik Takip bildirim sistemi çalışıyor.",
                icon: "/icon-192.png",
                badge: "/badge-96.png",
              },
            },
          })
        )
      );

      for (const result of results) {
        if (result.status === "fulfilled") sentCount += 1;
        else failedCount += 1;
      }
    }

    return res.status(200).json({
      ok: true,
      sentCount,
      skippedCount,
      failedCount,
    });
  } catch (error) {
    console.error("test-notification error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
