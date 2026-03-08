// /src/hbs/chat/controllers/messageController.js
const { Chat } = require("../chat");
const { Message } = require("../message");

async function getMessages(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const chatId = req.params.chatId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const chat = await Chat.findOne({
      _id: chatId,
      participants: userId,
    });

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or access denied" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ chat: chatId })
      .populate("sender", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({ messages: messages.reverse() });
  } catch (error) {
    console.error("GET MESSAGE ERROR:", error);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
}

module.exports = { getMessages };
