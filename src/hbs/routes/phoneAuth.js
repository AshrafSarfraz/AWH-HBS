// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const {
  registerUser,
  requestOtp,
  verifyOtpAndLogin,
  getMyProfile,
  getUserProfile,
  updateProfile,
  uploadAvatar,
  removeAvatar,
} = require("../controllers/phoneAuth");
const phoneAuthMiddleware = require("../middleware/phoneAuth.middleware");
const refreshRouter   = require("../chat/routes/refreshRoute");

const multer = require("multer");
const upload = multer({ storage: multer.memoryStorage() });

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post("/register",           registerUser);
router.post("/login/request-otp",  requestOtp);
router.post("/login/verify-otp",   verifyOtpAndLogin);
router.use("/", refreshRouter);

// ── Profile (login required) ──────────────────────────────────────────────────
router.get ("/profile/me",        phoneAuthMiddleware,     getMyProfile);
router.put ("/profile/update",    phoneAuthMiddleware,     updateProfile);
router.post("/profile/avatar",    phoneAuthMiddleware,     upload.single("file"), uploadAvatar);
router.delete("/profile/avatar",  phoneAuthMiddleware,     removeAvatar);
router.get ("/profile/:userId",   phoneAuthMiddleware,     getUserProfile);

module.exports = router;