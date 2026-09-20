// src/hbs/chat/routes/messageRoutes.js
//
// KYA BADLA:
//  - Multer errors ab saaf JSON dete hain (file bari, type allowed nahi).
//    Pehle in cases me generic 500 aata tha aur app ko samajh nahi aata tha.

const express = require("express");
const router = express.Router();

const { authMiddleware } = require("../../middleware/auth.middleware");
const {
  getMessages,
  uploadMedia,
  bulkMarkRead,
} = require("../controllers/messageController");

const upload = require("../middleware/upload");
const { handleUploadErrors, enforcePerTypeSize } = require("../middleware/upload");

// GET /api/messages/chat/:chatId?limit=25&before=<ISO>
router.get("/chat/:chatId", authMiddleware, getMessages);

// POST /api/messages/upload   (multipart/form-data: file, [chatId])
router.post(
  "/upload",
  authMiddleware,
  upload.single("file"),
  handleUploadErrors, // ✅ multer ke errors yahan pakde jate hain
  enforcePerTypeSize,
  uploadMedia
);

// PUT /api/messages/chat/:chatId/read
router.put("/chat/:chatId/read", authMiddleware, bulkMarkRead);

module.exports = router;
