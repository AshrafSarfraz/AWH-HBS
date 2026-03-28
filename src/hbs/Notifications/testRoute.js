const express = require("express");
const router = express.Router();
const getAccessToken = require("./getAccessToken");
const fetch = require("node-fetch"); // agar already global fetch hai to remove kr de

// 🔥 TEST NOTIFICATION ROUTE
router.get("/send", async (req, res) => {
  try {
    const accessToken = await getAccessToken();

    const message = {
      message: {
        token: "f8sDWvibSkmLxDK2pAHcEa:APA91bFMDgRTakOfH_hQU4GJKvdVF4KD2OnHTUhltxzlr_uYDUhSzNgcjQuOnMcIDTRKpxTiaqV6PgsxJWT8J83LS1OaZJu4kp_pGq-9tKh2hmx1uPUkgDw", // 👈 apna mobile ka FCM token yahan paste kr
        notification: {
          title: "Test Notification ✅",
          body: "Bhai notification aa gayi 🚀",
        },
        data: {
          screen: "Home",
        },
      },
    };

    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/west-walk-163cb/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      }
    );

    const data = await response.json();

    console.log("📩 FCM RESPONSE:", data);

    res.json({
      success: true,
      fcmResponse: data,
    });
  } catch (err) {
    console.error("❌ ERROR SENDING NOTIFICATION:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;