const getAccessToken = require("./getAccessToken");
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

async function sendNotification(token, title, body, extraData = {}) {
  if (!PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID is missing in .env");

  const accessToken = await getAccessToken();

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

  console.log("FCM status:", response.status);
  console.log("FCM result:", JSON.stringify(result));

  if (!response.ok) {
    throw new Error(result?.error?.message || "FCM send failed");
  }

  return result;
}

// delayHours = 0 => send immediately and return result
async function sendDelayedNotification(token, title, body, delayHours = 0, extraData = {}) {
  const delayMs = delayHours * 60 * 60 * 1000;

  if (delayMs <= 0) {
    return await sendNotification(token, title, body, extraData);
  }

  // if delayed: schedule but return a "scheduled" response
  setTimeout(async () => {
    try {
      await sendNotification(token, title, body, extraData);
    } catch (err) {
      console.error("Failed to send delayed notification:", err.message);
    }
  }, delayMs);

  return { scheduled: true, delayMs };
}

module.exports = sendDelayedNotification;







// const getAccessToken = require("./getAccessToken");
// const PROJECT_ID = process.env.FIREBASE_PROJECT_ID;

// async function sendNotification(token, title, body, extraData = {}) {
//   if (!PROJECT_ID) throw new Error("FIREBASE_PROJECT_ID is missing in .env");

//   const accessToken = await getAccessToken();

//   const dataPayload = {
//     screen: String(extraData.screen || "SelectedVenue"),
//     venueId: String(extraData.venueId || ""),
//     title: String(title || ""),
//     body: String(body || ""),
//   };

//   const message = {
//     message: {
//       token: String(token),
//       notification: { title, body },
//       data: dataPayload,
//       android: { priority: "HIGH" },
//     },
//   };

//   const response = await fetch(
//     `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
//     {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${accessToken}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(message),
//     }
//   );

//   const result = await response.json().catch(() => ({}));

//   console.log("FCM status:", response.status);
//   console.log("FCM result:", JSON.stringify(result));

//   if (!response.ok) {
//     throw new Error(result?.error?.message || "FCM send failed");
//   }

//   return result;
// }

// // ✅ delayHours = 0 => send immediately and return result
// async function sendDelayedNotification(token, title, body, delayHours = 0, extraData = {}) {
//   const delayMs = delayHours * 60 * 60 * 1000;

//   if (delayMs <= 0) {
//     return await sendNotification(token, title, body, extraData);
//   }

//   // if delayed: schedule but return a "scheduled" response
//   setTimeout(async () => {
//     try {
//       await sendNotification(token, title, body, extraData);
//     } catch (err) {
//       console.error("Failed to send delayed notification:", err.message);
//     }
//   }, delayMs);

//   return { scheduled: true, delayMs };
// }

// module.exports = sendDelayedNotification;



