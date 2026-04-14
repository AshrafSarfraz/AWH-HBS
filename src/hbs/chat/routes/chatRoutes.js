// /src/hbs/chat/routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const {
  getChats,
  getOrCreateChat,
  deleteChat,
  muteChat,     // ✅ NEW
  unmuteChat,   // ✅ NEW
} = require("../controllers/chatController");
const { authMiddleware } = require("../../../hbs/middleware/auth.middleware");

router.get("/", authMiddleware, getChats);
router.post("/with/:participantId", authMiddleware, getOrCreateChat);
router.delete("/:chatId", authMiddleware, deleteChat);

// ✅ NEW: Mute / Unmute
router.post("/:chatId/mute", authMiddleware, muteChat);
router.delete("/:chatId/mute", authMiddleware, unmuteChat);

module.exports = router;