// src/hbs/chat/sendFCMMessage.js
//
// KYA BADLA:
//  - Pehle har device token par ALAG HTTP request jati thi, aur wo bhi
//    `await` ke saath ek loop me. 3 devices = 3 sequential network calls,
//    aur ye sab message bhejne ke handler ke ANDAR — user ka message tab tak
//    ruka rehta tha jab tak FCM jawab na de.
//    Ab `sendEachForMulticast` se ek hi call me 500 tak tokens jate hain.
//  - node-fetch + manual OAuth token ki zaroorat khatam — firebase-admin
//    (jo pehle se dependency hai) khud handle karta hai.
//  - Stale/unregistered tokens automatically DB se delete ho jate hain.
//  - Image message me notification ke saath thumbnail bhi jata hai.

const { admin } = require("../../database/firebase");
const Device = require("./model/device");

/**
 * Ek user ke saare devices par notification bhejo.
 * Ye function kabhi throw nahi karta — push fail hone se chat nahi ruknI chahiye.
 *
 * @param {object} params
 * @param {string} params.userId       kis user ko bhejni hai
 * @param {string} params.title
 * @param {string} params.body
 * @param {object} [params.data]       extra payload (sab values string banengi)
 * @param {string} [params.imageUrl]   image message ka thumbnail
 */
async function sendPushToUser({ userId, title, body, data = {}, imageUrl }) {
  try {
    const devices = await Device.find({ userId }).select("token").lean();
    const tokens = devices.map((d) => d.token).filter(Boolean);

    if (!tokens.length) return { sent: 0, failed: 0 };

    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
    );

    const message = {
      notification: { title, body, ...(imageUrl ? { imageUrl } : {}) },
      data: stringData,
      android: {
        priority: "high",
        notification: {
          sound: "default",
          channelId: "chat_messages",
          ...(imageUrl ? { imageUrl } : {}),
        },
      },
      apns: {
        headers: { "apns-priority": "10", "apns-push-type": "alert" },
        payload: {
          aps: {
            sound: "default",
            badge: 1,
            "mutable-content": 1,
          },
        },
        ...(imageUrl ? { fcmOptions: { imageUrl } } : {}),
      },
    };

    // FCM ek call me max 500 tokens leta hai
    const chunks = [];
    for (let i = 0; i < tokens.length; i += 500) {
      chunks.push(tokens.slice(i, i + 500));
    }

    let sent = 0;
    let failed = 0;
    const staleTokens = [];

    for (const chunk of chunks) {
      const resp = await admin
        .messaging()
        .sendEachForMulticast({ ...message, tokens: chunk });

      sent += resp.successCount;
      failed += resp.failureCount;

      resp.responses.forEach((r, idx) => {
        if (r.success) return;
        const code = r.error?.code || "";
        if (
          code === "messaging/registration-token-not-registered" ||
          code === "messaging/invalid-registration-token" ||
          code === "messaging/invalid-argument"
        ) {
          staleTokens.push(chunk[idx]);
        }
      });
    }

    if (staleTokens.length) {
      await Device.deleteMany({ token: { $in: staleTokens } }).catch(() => {});
      console.warn(`[FCM] ${staleTokens.length} stale token(s) removed`);
    }

    return { sent, failed };
  } catch (err) {
    console.error("[FCM ERROR]", err.message);
    return { sent: 0, failed: 0, error: err.message };
  }
}

/**
 * Purana single-token API — backward compatibility ke liye rakha hai
 * taake koi doosri jagah ka code na toote.
 */
async function sendFCMMessage({ to, title, body, data = {} }) {
  try {
    const stringData = Object.fromEntries(
      Object.entries(data).map(([k, v]) => [k, String(v ?? "")])
    );
    return await admin.messaging().send({
      token: to,
      notification: { title, body },
      data: stringData,
      android: { priority: "high" },
    });
  } catch (err) {
    const code = err?.errorInfo?.code || err?.code || "";
    if (code.includes("registration-token-not-registered")) {
      await Device.deleteOne({ token: to }).catch(() => {});
    }
    console.error("[FCM ERROR]", err.message);
    return null;
  }
}

module.exports = sendFCMMessage;
module.exports.sendFCMMessage = sendFCMMessage;
module.exports.sendPushToUser = sendPushToUser;
