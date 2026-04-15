// /src/hbs/chat/controllers/messageController.js
const { Chat } = require("../model/chat");
const { Message } = require("../model/message");

// ─────────────────────────────────────────
// GET /api/messages/chat/:chatId
// Messages fetch karo (paginated)
// ─────────────────────────────────────────
async function getMessages(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) return res.status(404).json({ error: "Chat not found or access denied" });

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      Message.find({ chat: chatId })
        .populate("sender", "name email avatar")
        .populate({
          path: "replyTo",
          select: "text sender mediaUrl mediaType mediaName deleted",
          populate: { path: "sender", select: "name" },
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Message.countDocuments({ chat: chatId }),
    ]);

    res.json({
      messages: messages.reverse(),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
      },
    });
  } catch (error) {
    console.error("GET MESSAGE ERROR:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

// ─────────────────────────────────────────
// POST /api/messages/upload
// Media file upload karo
// ─────────────────────────────────────────
async function uploadMedia(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { mimetype, filename, originalname, size } = req.file;

    let mediaType = "document";
    if (mimetype.startsWith("image/")) mediaType = "image";
    if (mimetype.startsWith("video/")) mediaType = "video";

    const mediaUrl = `/uploads/chat/${filename}`;

    res.json({
      mediaUrl,
      mediaType,
      mediaName: originalname,
      mediaSize: size,
    });
  } catch (error) {
    console.error("UPLOAD ERROR:", error);
    res.status(500).json({ error: "Upload failed" });
  }
}

// ─────────────────────────────────────────
// PUT /api/messages/chat/:chatId/read
// Bulk mark read
// ─────────────────────────────────────────
async function bulkMarkRead(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    await Message.updateMany(
      {
        chat: chatId,
        sender: { $ne: userId },
        status: { $in: ["sent", "delivered"] },
      },
      { status: "seen" }
    );

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