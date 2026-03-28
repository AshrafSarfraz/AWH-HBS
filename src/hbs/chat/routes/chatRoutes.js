// /src/hbs/chat/routes/chatRoutes.js
const express = require("express");
const router = express.Router();
const { getChats, getOrCreateChat, deleteChat } = require("../controllers/chatController");
const { authMiddleware } = require("../../../hbs/middleware/auth.middleware");

router.get("/", authMiddleware, getChats);
router.post("/with/:participantId", authMiddleware, getOrCreateChat);
//delete chat
router.delete("/:chatId", authMiddleware, deleteChat);

module.exports = router;