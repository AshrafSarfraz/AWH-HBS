const express = require("express");
const router = express.Router();
const Device = require("../model/device");
const { authMiddleware } = require("../../middleware/auth.middleware");

// register device
router.post("/register", authMiddleware, async (req, res) => {
  try {
    const { token, platform } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token missing" });
    }

    const userId = req.user.id || req.user._id;

    const existing = await Device.findOne({ token });

    if (existing) {
      existing.userId = userId;
      existing.platform = platform;
      await existing.save();
    } else {
      await Device.create({
        userId,
        token,
        platform,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Device register error:", err);
    res.status(500).json({ error: "Device register failed" });
  }
});

// remove device token
router.delete("/remove", authMiddleware, async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Token missing" });
    }

    await Device.deleteOne({ token });

    res.json({ success: true, message: "Device removed" });
  } catch (err) {
    console.error("Device remove error:", err);
    res.status(500).json({ error: "Device remove failed" });
  }
});

module.exports = router;