// /src/hbs/routes/refreshTokenRoute.js
const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { RefreshToken } = require("../../models/RefreshToken");

// ─────────────────────────────────────────
// POST /api/auth/refresh
// Naya access token lo refresh token se
// ─────────────────────────────────────────
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: "Refresh token required" });
    }

    const tokenDoc = await RefreshToken.findOne({ token: refreshToken });

    if (!tokenDoc) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }

    if (tokenDoc.expiresAt < new Date()) {
      await RefreshToken.deleteOne({ token: refreshToken });
      return res.status(401).json({ error: "Refresh token expired, please login again" });
    }

    // Naya access token banao
    const newAccessToken = jwt.sign(
      { id: tokenDoc.userId },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    console.error("[REFRESH TOKEN ERROR]", err.message);
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// ─────────────────────────────────────────
// POST /api/auth/logout
// Refresh token delete karo (proper logout)
// ─────────────────────────────────────────
router.post("/logout", async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await RefreshToken.deleteOne({ token: refreshToken });
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ error: "Logout failed" });
  }
});

module.exports = router;

// ─────────────────────────────────────────
// ⚠️ IMPORTANT: Apne login controller mein yeh add karo:
// ─────────────────────────────────────────
//
// const crypto = require("crypto");
// const { RefreshToken } = require("../models/RefreshToken");
//
// // Login ke baad:
// const accessToken = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "15m" });
//
// const refreshTokenValue = crypto.randomBytes(40).toString("hex");
// await RefreshToken.create({
//   userId: user._id,
//   token: refreshTokenValue,
//   expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 din
// });
//
// res.json({ accessToken, refreshToken: refreshTokenValue });