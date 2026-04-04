// /src/hbs/Notifications/notificationRoutes.js
const express = require("express");
const router = express.Router();
const Venue = require("../models/venue");
const geolib = require("geolib");
const sendDelayedNotification = require("./delayNotification");

const Notification = require("../models/locationbasedNotification/NotificationVenue");
const VenueNotificationLog = require("../models/locationbasedNotification/VenueNotificationLog");

router.post("/send-venue-notification", async (req, res) => {
  try {
    const { token, userLatitude, userLongitude, userId } = req.body;

    if (!token || userLatitude == null || userLongitude == null) {
      return res.status(400).json({ error: "Missing data (token/lat/lng)" });
    }

    const uLat = parseFloat(userLatitude);
    const uLng = parseFloat(userLongitude);

    if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
      return res.status(400).json({ error: "Invalid userLatitude/userLongitude" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const radius = 1000;

    const venues = await Venue.find();

    // Find nearest venue within radius (ONLY ONE)
    let nearestVenue = null;
    let nearestDistance = Infinity;

    for (const venue of venues) {
      const vLat = parseFloat(venue.latitude);
      const vLng = parseFloat(venue.longitude);

      if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) continue;

      const distance = geolib.getDistance(
        { latitude: uLat, longitude: uLng },
        { latitude: vLat, longitude: vLng }
      );

      if (distance <= radius && distance < nearestDistance) {
        nearestVenue = venue;
        nearestDistance = distance;
      }
    }

    if (!nearestVenue) {
      return res.json({
        success: true,
        message: "No nearby venue found in radius.",
        today,
        sentNow: 0,
      });
    }

    // Check if this device/token already got notification for this venue today
    const alreadyNotified = await VenueNotificationLog.findOne({
      token,
      venueId: nearestVenue._id,
      date: today,
    });

    if (alreadyNotified) {
      return res.json({
        success: true,
        message: "Already notified on this device for this venue today.",
        today,
        venueId: nearestVenue._id,
        venueName: nearestVenue.venueName,
        sentNow: 0,
      });
    }

    // Send notification
    const title = "Hala B Saudi";
    const body = `You're near ${nearestVenue.venueName || "our venue"}! Tap to unlock exclusive discounts with Hala B Saudi.`;

    let fcmResult = {};
    let status = "SENT";
    let errorMessage = "";

    try {
      fcmResult = await sendDelayedNotification(token, title, body, 0, {
        screen: "SelectedVenue",
        venueId: nearestVenue._id,
      });

      // Create log AFTER successful send
      await VenueNotificationLog.create({
        token,
        venueId: nearestVenue._id,
        date: today,
      });
    } catch (err) {
      status = "FAILED";
      errorMessage = err.message || "Unknown error";
    }

    // Store notification (success OR fail)
    await Notification.create({
      userId,
      token,
      title,
      body,
      screen: "SelectedVenue",
      venueId: nearestVenue._id,

      userLatitude: uLat,
      userLongitude: uLng,
      venueLatitude: parseFloat(nearestVenue.latitude),
      venueLongitude: parseFloat(nearestVenue.longitude),
      distanceMeters: nearestDistance,

      status,
      fcmResponse: fcmResult,
      errorMessage,
    });

    return res.json({
      success: true,
      message:
        status === "SENT"
          ? "Notification sent (1 per device per venue per day)."
          : "Notification failed.",
      today,
      sentNow: status === "SENT" ? 1 : 0,
      venueId: nearestVenue._id,
      venueName: nearestVenue.venueName,
      distanceMeters: nearestDistance,
      status,
      errorMessage,
    });
  } catch (err) {
    console.error("send-venue-notification error:", err);
    return res.status(500).json({ error: err.message });
  }
});

router.post("/reset-venue-notification-test", async (req, res) => {
  try {
    const { token, venueId } = req.body;

    if (!token) {
      return res.status(400).json({ error: "token required" });
    }

    const today = new Date().toISOString().slice(0, 10);

    const query = { token, date: today };

    if (venueId) {
      query.venueId = venueId;
    }

    const result = await VenueNotificationLog.deleteMany(query);

    return res.json({
      success: true,
      message: "Testing log reset successful",
      deletedCount: result.deletedCount,
      today,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }

});

module.exports = router;















// const express = require("express");
// const router = express.Router();
// const Venue = require("../models/venue");
// const geolib = require("geolib");
// const sendDelayedNotification = require("./delayNotification");

// const Notification = require("../models/locationbasedNotification/NotificationVenue");
// const VenueNotificationLog = require("../models/locationbasedNotification/VenueNotificationLog");

// router.post("/send-venue-notification", async (req, res) => {
//   try {
//     const { token, userLatitude, userLongitude, userId } = req.body;

//     if (!userId || !token || userLatitude == null || userLongitude == null) {
//       return res.status(400).json({ error: "Missing data (userId/token/lat/lng)" });
//     }

//     const uLat = parseFloat(userLatitude);
//     const uLng = parseFloat(userLongitude);

//     if (!Number.isFinite(uLat) || !Number.isFinite(uLng)) {
//       return res.status(400).json({ error: "Invalid userLatitude/userLongitude" });
//     }

//     const today = new Date().toISOString().slice(0, 10);
//     const radius = 2000;

//     const venues = await Venue.find();

//     // ✅ Find nearest venue within radius (ONLY ONE)
//     let nearestVenue = null;
//     let nearestDistance = Infinity;

//     for (const venue of venues) {
//       const vLat = parseFloat(venue.latitude);
//       const vLng = parseFloat(venue.longitude);
//       if (!Number.isFinite(vLat) || !Number.isFinite(vLng)) continue;

//       const distance = geolib.getDistance(
//         { latitude: uLat, longitude: uLng },
//         { latitude: vLat, longitude: vLng }
//       );

//       if (distance <= radius && distance < nearestDistance) {
//         nearestVenue = venue;
//         nearestDistance = distance;
//       }
//     }

//     if (!nearestVenue) {
//       return res.json({
//         success: true,
//         message: "No nearby venue found in radius.",
//         today,
//         sentNow: 0,
//       });
//     }

//     // ✅ Check if user already got notification for this venue today
//     const alreadyNotified = await VenueNotificationLog.findOne({
//       userId,
//       venueId: nearestVenue._id,
//       date: today,
//     });

//     if (alreadyNotified) {
//       return res.json({
//         success: true,
//         message: "Already notified for this venue today.",
//         today,
//         venueId: nearestVenue._id,
//         venueName: nearestVenue.venueName,
//         sentNow: 0,
//       });
//     }

//     // ✅ Send notification
//     const title = "Hala B Saudi";
//     const body = `You're near ${nearestVenue.venueName || "our venue"}! Tap to unlock exclusive discounts with Hala B Saudi.`;

//     let fcmResult = {};
//     let status = "SENT";
//     let errorMessage = "";

//     try {
//       fcmResult = await sendDelayedNotification(token, title, body, 0, {
//         screen: "SelectedVenue",
//         venueId: nearestVenue._id,
//       });

//       // ✅ Create log AFTER successful send
//       await VenueNotificationLog.create({
//         userId,
//         venueId: nearestVenue._id,
//         date: today,
//       });
//     } catch (err) {
//       status = "FAILED";
//       errorMessage = err.message || "Unknown error";
//     }

//     // ✅ Store notification (success OR fail)
//     await Notification.create({
//       userId,
//       token,
//       title,
//       body,
//       screen: "SelectedVenue",
//       venueId: nearestVenue._id,

//       userLatitude: uLat,
//       userLongitude: uLng,
//       venueLatitude: parseFloat(nearestVenue.latitude),
//       venueLongitude: parseFloat(nearestVenue.longitude),
//       distanceMeters: nearestDistance,

//       status,
//       fcmResponse: fcmResult,
//       errorMessage,
//     });

//     return res.json({
//       success: true,
//       message:
//         status === "SENT"
//           ? "Notification sent (1 per venue per day)."
//           : "Notification failed.",
//       today,
//       sentNow: status === "SENT" ? 1 : 0,
//       venueId: nearestVenue._id,
//       venueName: nearestVenue.venueName,
//       distanceMeters: nearestDistance,
//       status,
//       errorMessage,
//     });
//   } catch (err) {
//     console.error("send-venue-notification error:", err);
//     return res.status(500).json({ error: err.message });
//   }
// });

// module.exports = router;


