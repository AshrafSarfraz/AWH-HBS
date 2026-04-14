// /src/hbs/chat/controllers/messageController.js
const { Chat } = require("../model/chat");
const { Message } = require("../model/message");
const path = require("path");

// ─────────────────────────────────────────
// GET /api/messages/chat/:chatId
// Messages fetch karo (paginated)
// ─────────────────────────────────────────
async function getMessages(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const chatId = req.params.chatId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) return res.status(404).json({ error: "Chat not found or access denied" });

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name email")
      // ✅ NEW: replyTo bhi populate karo
      .populate({
        path: "replyTo",
        select: "text sender mediaUrl mediaType deleted",
        populate: { path: "sender", select: "name" },
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("GET MESSAGE ERROR:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// ─────────────────────────────────────────
// ✅ NEW: POST /api/messages/upload
// Media file upload karo — URL milega jo send-message mein use hoga
// ─────────────────────────────────────────
async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { mimetype, filename, originalname } = req.file;

    // Media type determine karo
    let mediaType = "document";
    if (mimetype.startsWith("image/")) mediaType = "image";
    if (mimetype.startsWith("video/")) mediaType = "video";

    // URL banao — app.js mein /uploads static serve hona chahiye
    const mediaUrl = `/uploads/chat/${filename}`;

    res.json({
      mediaUrl,
      mediaType,
      mediaName: originalname,
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ error: "Upload failed" });
  }
}

// ─────────────────────────────────────────
// ✅ NEW: PUT /api/messages/chat/:chatId/read
// Saare messages ek saath seen karo (REST se bhi possible)
// ─────────────────────────────────────────
async function bulkMarkRead(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Saare unread messages update karo
    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        status: { $in: ["sent", "delivered"] },
      },
      { status: "seen" }
    );

    // ✅ Unread count reset karo
    await Chat.updateOne(
      { _id: chatId },
      { $set: { [`unreadCount.${userId}`]: 0 } }
    );

    res.json({ message: "All messages marked as seen" });
  } catch (error) {
    console.error("BULK READ ERROR:", error);
    res.status(500).json({ error: "Failed to mark messages as read" });
  }
}

module.exports = { getMessages, uploadMedia, bulkMarkRead };














// // /src/hbs/chat/controllers/messageController.js
// const { Chat } = require("../model/chat");
// const { Message } = require("../model/message");

// async function getMessages(req, res) {
//   try {
//     const userId = req.user?.id || req.user?._id;
//     const chatId = req.params.chatId;

//     if (!userId) {
//       return res.status(401).json({ error: "Unauthorized" });
//     }

//     const chat = await Chat.findOne({
//       _id: chatId,
//       participants: userId,
//     });

//     if (!chat) {
//       return res.status(404).json({ error: "Chat not found or access denied" });
//     }

//     const page = parseInt(req.query.page) || 1;
//     const limit = 20;
//     const skip = (page - 1) * limit;

//     const messages = await Message.find({ chat: chatId })
//       .populate("sender", "name email")
//       .sort({ createdAt: -1 })
//       .skip(skip)
//       .limit(limit);

//     res.json({ messages: messages.reverse() });
//   } catch (error) {
//     console.error("GET MESSAGE ERROR:", error);
//     res.status(500).json({ error: "Failed to fetch messages" });
//   }
// }

// module.exports = { getMessages };
