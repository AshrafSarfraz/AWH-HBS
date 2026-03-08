// /src/hbs/chat/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../hbs/middleware/auth.middleware");
const { getMessages } = require("../controllers/messageController");

router.get("/chat/:chatId", authMiddleware, getMessages);

module.exports = router;