// authentication/index.js
const express = require("express");
const router = express.Router();
const { login } = require("../controllers/externalApi/login.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// 🔓 login route (yahan tum url/base64 doge)
router.post("/login", login);

// 🔒 example protected route (baad me jitni chaho bana lo)
router.get("/test-protected", authMiddleware, (req, res) => {
  res.json({
    message: "Ye protected route hai, authKey sahi thi.",
    user: req.user,
  });
});

module.exports = router;
