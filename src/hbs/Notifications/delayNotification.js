const getAccessToken = require("./getAccessToken");

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

async function sendNotification(token, title, body, extraData = {}) {
  if (!PROJECT_ID) {
    throw new Error("FIREBASE_PROJECT_ID is missing in .env");
  }

  const accessToken = await getAccessToken();

  // ✅ IMPORTANT: data values MUST be strings
  const dataPayload = {
    screen: String(extraData.screen || "SelectedVenue"),
    venueId: String(extraData.venueId || ""),
    title: String(title || ""),
    body: String(body || ""),
  };

  const message = {
    message: {
      token: String(token),
      notification: { title, body },
      data: dataPayload,
      // ✅ (optional) Android priority
      android: { priority: "HIGH" },
    },
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    }
  );

  const result = await response.json().catch(() => ({}));

  // ✅ DEBUG LOGS (super important)
  console.log("FCM status:", response.status);
  console.log("FCM result:", JSON.stringify(result));

  if (!response.ok) {
    throw new Error(result?.error?.message || "FCM send failed");
  }

  return result;
}

function sendDelayedNotification(token, title, body, delayHours = 0, extraData = {}) {
  const delayMs = delayHours * 60 * 60 * 1000;

  setTimeout(async () => {
    try {
      await sendNotification(token, title, body, extraData);
    } catch (err) {
      console.error("Failed to send notification:", err.message);
    }
  }, delayMs);
}

module.exports = sendDelayedNotification;
