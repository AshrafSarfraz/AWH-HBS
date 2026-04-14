const fetch = require("node-fetch");
const getAccessToken = require("./getAccessToken");

async function sendFCMMessage({ to, title, body, data = {} }) {
  try {
    const accessToken = await getAccessToken();
    const message = {
      message: {
        token: to,
        notification: { title, body },
        data: Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key]);
          return acc;
        }, {}),
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } },
      },
    };

    const res = await fetch(
      "https://fcm.googleapis.com/v1/projects/west-walk-163cb/messages:send",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(message),
      }
    );

    const json = await res.json();
    if (json.error) throw new Error(JSON.stringify(json.error));
    console.log("FCM sent:", title);
    return json;
  } catch (err) {
    console.error("FCM ERROR:", err.message);
  }
}

module.exports = sendFCMMessage;