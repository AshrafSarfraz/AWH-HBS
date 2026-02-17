const express = require("express");
const router = express.Router();
const sendDelayedNotification = require("./delayNotification"); 
const cron = require("node-cron");
const { getAllVenues } = require("../controllers/venueController"); // or call Venue model directly
const geolib = require("geolib");

// Track last notification per device per venue
const lastNotified = {}; // { deviceToken: { venueId: timestamp } }

router.post("/send-venue-notification", async (req, res) => {
  try {
    const { token, userLatitude, userLongitude } = req.body;
    if (!token || !userLatitude || !userLongitude)
      return res.status(400).json({ error: "Missing required fields" });

    const venues = await getAllVenues(); // Returns array of venues with lat/lng

    const radiusMeters = 2000; // 2 km radius

    for (let venue of venues) {
      if (!venue.latitude || !venue.longitude) continue;

      const distance = geolib.getDistance(
        { latitude: parseFloat(userLatitude), longitude: parseFloat(userLongitude) },
        { latitude: parseFloat(venue.latitude), longitude: parseFloat(venue.longitude) }
      );

      // Check 2 km radius
      if (distance <= radiusMeters) {
        const now = Date.now();
        lastNotified[token] = lastNotified[token] || {};

        // Check if already notified today for this venue
        const lastTime = lastNotified[token][venue._id] || 0;
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (now - lastTime > oneDayMs) {
          // Send notification
          const title = "Hala B Saudi";
          const body = `Visit ${venue.venueName} and get extreme discounts using Hala B Saudi!`;

          await sendDelayedNotification(token, title, body, 0);
          lastNotified[token][venue._id] = now;
          console.log(`Notification sent to ${token} for venue ${venue.venueName}`);
        }
      }
    }

    res.json({ success: true, message: "Nearby venue check complete" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;






// const express = require("express");
// const router = express.Router();
// // We use delayNotification exclusively because it uses the modern FCM v1 API
// const sendDelayedNotification = require("./delayNotification"); 
// const cron = require("node-cron");

// let deviceTokens = [];

// function scheduleRepeatingNotification(token, title, body, intervalHours = 0.01) {
//   if (intervalHours < 1) {
//     const delayMs = intervalHours * 60 * 60 * 1000;
//     setInterval(async () => {
//       try {
//         // Use 0 delay to send "immediately" within the interval
//         await sendDelayedNotification(token, title, body, 0); 
//       } catch (err) {
//         console.error("Interval failed:", err.message);
//       }
//     }, delayMs);
//   } else {
//     const cronExpression = `0 */${intervalHours} * * *`;
//     cron.schedule(cronExpression, async () => {
//       try {
//         await sendDelayedNotification(token, title, body, 0);
//       } catch (err) {
//         console.error("Cron failed:", err.message);
//       }
//     });
//   }
// }

// router.post("/save-token", (req, res) => {
//   const { token } = req.body;
//   if (!token) return res.status(400).json({ error: "Token missing" });

//   if (!deviceTokens.includes(token)) {
//     deviceTokens.push(token);
//     // Standardizing the payload to include 'Home' screen
//     scheduleRepeatingNotification(token, "Hala B Saudi", "Don't forget to check the app!", 0.01);
//   }
//   res.json({ success: true });
// });

// // Immediate send now uses the same V1 logic as the delayed one
// router.post("/send-notification", async (req, res) => {
//   const { token, title, body } = req.body;
//   try {
//     await sendDelayedNotification(token, title || "Hala B Saudi", body || "Check!", 0);
//     res.json({ success: true });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;