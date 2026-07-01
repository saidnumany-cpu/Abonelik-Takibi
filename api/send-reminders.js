const { initializeApp, getApps, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
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

function getTurkeyToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    key: `${map.year}-${map.month}-${map.day}`,
  };
}

function daysUntilPayment(subscription, today) {
  const paymentDay = Math.min(
    Math.max(Number(subscription.paymentDay || 1), 1),
    28
  );

  const cycle = subscription.cycle || "monthly";
  const todayDate = Date.UTC(today.year, today.month - 1, today.day);

  let paymentYear = today.year;
  let paymentMonth = today.month;

  if (cycle === "yearly") {
    paymentMonth = Math.min(
      Math.max(Number(subscription.paymentMonth || 1), 1),
      12
    );
  }

  let paymentDate = Date.UTC(paymentYear, paymentMonth - 1, paymentDay);

  if (paymentDate < todayDate) {
    if (cycle === "yearly") {
      paymentDate = Date.UTC(paymentYear + 1, paymentMonth - 1, paymentDay);
    } else {
      const nextMonth = paymentMonth === 12 ? 1 : paymentMonth + 1;
      const nextYear = paymentMonth === 12 ? paymentYear + 1 : paymentYear;

      paymentDate = Date.UTC(nextYear, nextMonth - 1, paymentDay);
    }
  }

  return Math.ceil((paymentDate - todayDate) / 86400000);
}

function formatPrice(subscription) {
  const price = Number(subscription.price || 0);
  const currency = subscription.currency || "TRY";

  if (currency === "TRY") {
    return `${price.toLocaleString("tr-TR")} TL`;
  }

  return `${price.toLocaleString("tr-TR")} ${currency}`;
}

module.exports = async function handler(req, res) {
  try {
    initFirebaseAdmin();

    const db = getFirestore();
    const messaging = getMessaging();
    const today = getTurkeyToday();

    const usersSnapshot = await db.collection("users").get();

    let checkedUsers = 0;
    let sentCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let deletedTokenCount = 0;

    for (const userDoc of usersSnapshot.docs) {
      checkedUsers += 1;

      const user = userDoc.data();

      if (user.notificationsEnabled !== true) {
        skippedCount += 1;
        continue;
      }

      if (user.lastReminderDate === today.key) {
        skippedCount += 1;
        continue;
      }

      const subscriptionsSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("subscriptions")
        .get();

      const dueSubscriptions = [];

      subscriptionsSnapshot.forEach((subDoc) => {
        const subscription = subDoc.data();
        const daysLeft = daysUntilPayment(subscription, today);

        if (daysLeft === 0 || daysLeft === 1) {
          dueSubscriptions.push({
            ...subscription,
            daysLeft,
          });
        }
      });

      if (!dueSubscriptions.length) {
        skippedCount += 1;
        continue;
      }

      const tokensSnapshot = await db
        .collection("users")
        .doc(userDoc.id)
        .collection("notificationTokens")
        .where("enabled", "==", true)
        .get();

      const tokens = [];

      tokensSnapshot.forEach((tokenDoc) => {
        const data = tokenDoc.data();

        if (data.token) {
          tokens.push({
            id: tokenDoc.id,
            ref: tokenDoc.ref,
            token: data.token,
          });
        }
      });

      if (!tokens.length) {
        skippedCount += 1;
        continue;
      }

      const first = dueSubscriptions[0];

      let title = "Abonelik hatırlatması";
      let body = "";

      if (dueSubscriptions.length === 1) {
        title = first.daysLeft === 0 ? "Bugün ödeme var" : "Yarın ödeme var";
        body = `${first.name} için ${formatPrice(first)} ödeme ${
          first.daysLeft === 0 ? "bugün" : "yarın"
        }.`;
      } else {
        title = "Yaklaşan abonelik ödemeleri";
        body = `${dueSubscriptions.length} abonelik için bugün veya yarın ödeme var.`;
      }

      const results = await Promise.allSettled(
        tokens.map((item) =>
          messaging.send({
            token: item.token,
            notification: {
              title,
              body,
            },
            data: {
              title,
              body,
              url: "/",
            },
            webpush: {
              notification: {
                title,
                body,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                tag: "abonelik-takip-reminder",
                renotify: "true",
                requireInteraction: "true",
              },
              fcmOptions: {
                link: "https://abonelik-takibi.vercel.app",
              },
            },
          })
        )
      );

      let userSentCount = 0;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const tokenItem = tokens[i];

        if (result.status === "fulfilled") {
          userSentCount += 1;
          sentCount += 1;
          continue;
        }

        failedCount += 1;

        const errorCode = result.reason?.errorInfo?.code || result.reason?.code;

        if (
          errorCode === "messaging/registration-token-not-registered" ||
          errorCode === "messaging/invalid-registration-token"
        ) {
          await tokenItem.ref.delete();
          deletedTokenCount += 1;
        }

        console.error("Bildirim gönderilemedi:", {
          userId: userDoc.id,
          tokenDocId: tokenItem.id,
          errorCode,
          message: result.reason?.message,
        });
      }

      if (userSentCount > 0) {
        await userDoc.ref.set(
          {
            lastReminderDate: today.key,
            lastReminderAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }
    }

    return res.status(200).json({
      ok: true,
      date: today.key,
      checkedUsers,
      sentCount,
      skippedCount,
      failedCount,
      deletedTokenCount,
    });
  } catch (error) {
    console.error("send-reminders error:", error);

    return res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
};
