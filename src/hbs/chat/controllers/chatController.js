// src/hbs/chat/controllers/chatController.js
const mongoose = require("mongoose");
const { Chat } = require("../chat");
require("../../models/User"); // ✅ Ensure User model is loaded
require("../message")

const { Types } = mongoose; // ✅ Modern ObjectId usage

/**
 * GET /api/chat
 * Fetch all chats for logged-in user
 */
async function getChats(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userObjId = new Types.ObjectId(userId); // ✅ Correct

    const chats = await Chat.find({
  participants: userObjId,
  deletedFor: { $ne: userObjId },
})
      .populate("participants", "name email avatar")
      .populate("lastMessage")
      .sort({ lastMessageAt: -1 });

    const formattedChats = chats.map((chat) => {
      // Safety check: ensure participants exist before finding
      const otherParticipant = chat.participants.find(
  (p) => !p._id.equals(userObjId)
);

      
      return {
        _id: chat._id,
        participant: otherParticipant || null, 
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
      };
    });

    console.log("getChats userId:", userId);
    res.json(formattedChats);
  } catch (error) {
    console.error("CHAT FETCH ERROR:", error);
    res.status(500).json({ error: "Failed to fetch chats" });
  }
}



/**
 * POST /api/chat/with/:participantId
 * Get or create chat with a specific participant
 */
async function getOrCreateChat(req, res) {
  
  try {
    const userId = req.user?.id || req.user?._id;
    const participantId = req.params.participantId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!participantId) return res.status(400).json({ error: "participantId required" });

    // ✅ Mongoose v7+ compatible ObjectId
const userObjId = new mongoose.Types.ObjectId(userId);
const participantObjId = new mongoose.Types.ObjectId(participantId);

    // Find existing chat
    let chat = await Chat.findOne({
      participants: { $all: [userObjId, participantObjId] },
    })
      .populate("participants", "name email avatar")
      .populate("lastMessage");

    // Create new chat if none exists
    if (!chat) {
      chat = await Chat.create({
        participants: [userObjId, participantObjId],
      });
      await chat.populate("participants", "name email avatar");
    }

    const otherParticipant = chat.participants.find(
  (p) => !p._id.equals(userObjId)
);


    res.json({
      _id: chat._id,
      participant: otherParticipant,
      lastMessage: chat.lastMessage,
      lastMessageAt: chat.createdAt,
    });
  } catch (error) {
    console.error("CHAT FETCH ERROR:", error);
    res.status(500).json({ error: "Failed to create or get chat" });
  }
}

/**
 * DELETE /api/chat/:chatId
 * Delete a chat for logged-in user
 */
async function deleteChat(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const userObjId = new mongoose.Types.ObjectId(userId);

    if (!chat.deletedFor) chat.deletedFor = [];

    if (!chat.deletedFor.some(id => id.equals(userObjId))) {
      chat.deletedFor.push(userObjId);
      await chat.save();
    }

    res.json({ message: "Chat deleted for you", chatId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Delete failed" });
  }
}


module.exports = {
  getChats,
  getOrCreateChat,
  deleteChat,
};