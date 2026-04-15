// /src/hbs/chat/sendFCMMessage.js
const fetch = require("node-fetch");
const getAccessToken = require("./getAccessToken");
const Device = require("./model/device");

async function sendFCMMessage({ to, title, body, data = {} }) {
  try {
    const accessToken = await getAccessToken();

    const message = {
      message: {
        token: to,
        notification: {
          title,
          body,
        },
        data: Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
        android: {
          priority: "high",
          notification: {
            sound: "default",
            channelId: "chat_messages",
          },
        },
        apns: {
          headers: {
            "apns-priority": "10",
            "apns-push-type": "alert",
          },
          payload: {
            aps: {
              sound: "default",
              badge: 1,
              "content-available": 1,
              "mutable-content": 1,
            },
          },
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${process.env.FCM_PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    const json = await res.json();

    if (json.error) {
      // ✅ Stale/invalid token — DB se delete karo
      const errorCode = json.error?.status || json.error?.code;
      if (
        errorCode === "NOT_FOUND" ||
        errorCode === 404 ||
        errorCode === "UNREGISTERED" ||
        json.error?.details?.some?.((d) => d.errorCode === "INVALID_ARGUMENT")
      ) {
        console.warn(`[FCM] Stale token removed: ${to}`);
        await Device.deleteOne({ token: to }).catch(() => {});
      }

      throw new Error(JSON.stringify(json.error));
    }

    console.log(`[FCM] Sent: "${title}" → ${to.slice(0, 20)}...`);
    return json;
  } catch (err) {
    console.error("[FCM ERROR]", err.message);
    // Error throw mat karo — notification fail hone se message fail nahi hona chahiye
  }
}

module.exports = sendFCMMessage;