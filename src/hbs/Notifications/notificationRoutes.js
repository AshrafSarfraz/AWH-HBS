const express = require("express");
const router = express.Router();
const Venue = require("../models/venue");
const geolib = require("geolib");
const sendDelayedNotification = require("./delayNotification");

// ✅ Per device per day limit (memory)
const dailyCount = {}; 
// dailyCount[token] = { date: "YYYY-MM-DD", count: number }

router.post("/send-venue-notification", async (req, res) => {
  try {
    const { token, userLatitude, userLongitude } = req.body;

    if (!token || userLatitude == null || userLongitude == null) {
      return res.status(400).json({ error: "Missing data" });
    }

    const uLat = parseFloat(userLatitude);
    const uLng = parseFloat(userLongitude);

    if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
      return res.status(400).json({ error: "Invalid userLatitude/userLongitude" });
    }

    // ✅ daily limit set here
    const DAILY_LIMIT = 100;

    // ✅ Today key
    const today = new Date().toISOString().slice(0, 10);

    // init/reset per day
    if (!dailyCount[token] || dailyCount[token].date !== today) {
      dailyCount[token] = { date: today, count: 0 };
    }

    // limit already reached
    if (dailyCount[token].count >= DAILY_LIMIT) {
      return res.json({
        success: true,
        message: `Daily limit reached (${DAILY_LIMIT} notifications).`,
        today,
      });
    }

    const venues = await Venue.find();
    const radius = 2000;

    let sentNow = 0;

    for (const venue of venues) {
      // stop if limit reached
      if (dailyCount[token].count >= DAILY_LIMIT) break;

      // ✅ validate venue coords
      const vLat = parseFloat(venue.latitude);
      const vLng = parseFloat(venue.longitude);
      if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) continue;

      const distance = geolib.getDistance(
        { latitude: uLat, longitude: uLng },
        { latitude: vLat, longitude: vLng }
      );

      if (distance <= radius) {
        // ✅ send notification + pass venueId so app opens SelectedVenue
        await sendDelayedNotification(
          token,
          "Hala B Saudi",
          `You're near ${venue.venueName || "our venue"}! Tap to unlock exclusive discounts with Hala B Saudi.`,
          0,
          { screen: "SelectedVenue", venueId: venue._id }
        );
        

        dailyCount[token].count += 1;
        sentNow += 1;
      }
    }

    return res.json({
      success: true,
      message: `Sent ${sentNow} notifications now. Total today: ${dailyCount[token].count}/${DAILY_LIMIT}.`,
      today,
    });
  } catch (err) {
    console.error("send-venue-notification error:", err);
    return res.status(500).json({ error: err.message });
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