// /src/hbs/chat/routes/messageRoutes.js
const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../../../hbs/middleware/auth.middleware");
const { getMessages, uploadMedia, bulkMarkRead } = require("../controllers/messageController");
const upload = require("../middleware/upload"); // ✅ NEW: multer

// Messages fetch (paginated)
router.get("/chat/:chatId", authMiddleware, getMessages);

// ✅ NEW: Media upload — pehle file upload karo, phir URL socket se bhejo
router.post("/upload", authMiddleware, upload.single("file"), uploadMedia);

// ✅ NEW: Bulk mark read (REST se)
router.put("/chat/:chatId/read", authMiddleware, bulkMarkRead);

module.exports = router;