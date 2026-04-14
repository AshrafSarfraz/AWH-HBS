// /src/hbs/chat/controllers/chatController.js
const mongoose = require("mongoose");
const { Chat } = require("../model/chat");
require("../../models/User");
const { Message } = require("../model/message");

const { Types } = mongoose;

/**
 * GET /api/chat
 * Fetch all chats for logged-in user
 */
async function getChats(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userObjId = new Types.ObjectId(userId);

    const chats = await Chat.find({
      participants: userObjId,
      deletedFor: { $ne: userObjId },
    })
      .populate("participants", "name email avatar")
      .populate({
        path: "lastMessage",
        populate: { path: "replyTo", select: "text sender" },
      })
      .sort({ lastMessageAt: -1 });

    const formattedChats = chats.map((chat) => {
      const otherParticipant = chat.participants.find(
        (p) => !p._id.equals(userObjId)
      );

      // ✅ NEW: Is user ka unread count nikalo
      const unreadCount = chat.unreadCount?.get(String(userObjId)) || 0;

      // ✅ NEW: Check karo ke muted hai ya nahi
      const isMuted = chat.mutedBy?.some((id) => id.equals(userObjId)) || false;

      return {
        _id: chat._id,
        participant: otherParticipant || null,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        unreadCount,   // ✅ NEW
        isMuted,       // ✅ NEW
      };
    });

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

    const userObjId = new mongoose.Types.ObjectId(userId);
    const participantObjId = new mongoose.Types.ObjectId(participantId);

    let chat = await Chat.findOne({
      participants: { $all: [userObjId, participantObjId] },
    })
      .populate("participants", "name email avatar")
      .populate("lastMessage");

    if (!chat) {
      chat = await Chat.create({
        participants: [userObjId, participantObjId],
      });
      await chat.populate("participants", "name email avatar");
    } else {
      // ✅ FIX: Agar chat deletedFor mein thi, restore kar do
      if (chat.deletedFor?.some((id) => id.equals(userObjId))) {
        await Chat.updateOne(
          { _id: chat._id },
          { $pull: { deletedFor: userObjId } }
        );
      }
    }

    const otherParticipant = chat.participants.find(
      (p) => !p._id.equals(userObjId)
    );

    res.json({
      _id: chat._id,
      participant: otherParticipant,
      lastMessage: chat.lastMessage,
      lastMessageAt: chat.lastMessageAt || chat.createdAt,
      unreadCount: chat.unreadCount?.get(String(userObjId)) || 0,
      isMuted: chat.mutedBy?.some((id) => id.equals(userObjId)) || false,
    });
  } catch (error) {
    console.error("CHAT CREATE ERROR:", error);
    res.status(500).json({ error: "Failed to create or get chat" });
  }
}

/**
 * DELETE /api/chat/:chatId
 * Soft delete — sirf us user ke liye
 */
async function deleteChat(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userObjId = new mongoose.Types.ObjectId(userId);
    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    const isParticipant = chat.participants.some((p) => p.equals(userObjId));
    if (!isParticipant) return res.status(403).json({ error: "Access denied" });

    await Chat.updateOne(
      { _id: chatId },
      { $addToSet: { deletedFor: userObjId } }
    );

    const updatedChat = await Chat.findById(chatId);
    const allDeleted = updatedChat.participants.every((p) =>
      updatedChat.deletedFor.some((d) => d.equals(p))
    );

    if (allDeleted) {
      await Message.deleteMany({ chat: chatId });
      await Chat.findByIdAndDelete(chatId);
    }

    res.json({ message: "Chat deleted successfully", chatId });
  } catch (error) {
    console.error("DELETE CHAT ERROR:", error);
    res.status(500).json({ error: "Delete failed" });
  }
}

// ─────────────────────────────────────────
// ✅ NEW: POST /api/chat/:chatId/mute
// Chat mute karo
// ─────────────────────────────────────────
async function muteChat(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    await Chat.updateOne(
      { _id: chatId },
      { $addToSet: { mutedBy: userId } }
    );

    res.json({ message: "Chat muted", isMuted: true });
  } catch (error) {
    console.error("MUTE ERROR:", error);
    res.status(500).json({ error: "Mute failed" });
  }
}

// ─────────────────────────────────────────
// ✅ NEW: DELETE /api/chat/:chatId/mute
// Chat unmute karo
// ─────────────────────────────────────────
async function unmuteChat(req, res) {
  try {
    const userId = req.user?.id || req.user?._id;
    const { chatId } = req.params;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    await Chat.updateOne(
      { _id: chatId },
      { $pull: { mutedBy: userId } }
    );

    res.json({ message: "Chat unmuted", isMuted: false });
  } catch (error) {
    console.error("UNMUTE ERROR:", error);
    res.status(500).json({ error: "Unmute failed" });
  }
}

module.exports = {
  getChats,
  getOrCreateChat,
  deleteChat,
  muteChat,
  unmuteChat,
};









// // /src/hbs/chat/controllers/chatController.js
// const mongoose = require("mongoose");
// const { Chat } = require("../model/chat");
// require("../../models/User");
// const { Message } = require("../model/message");

// const { Types } = mongoose;

// /**
//  * GET /api/chat
//  * Fetch all chats for logged-in user
//  */
// async function getChats(req, res) {
//   try {
//     const userId = req.user?.id || req.user?._id;
//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     const userObjId = new Types.ObjectId(userId);

//     const chats = await Chat.find({
//       participants: userObjId,
//       deletedFor: { $ne: userObjId },
//     })
//       .populate("participants", "name email avatar")
//       .populate("lastMessage")
//       .sort({ lastMessageAt: -1 });

//     const formattedChats = chats.map((chat) => {
//       const otherParticipant = chat.participants.find(
//         (p) => !p._id.equals(userObjId)
//       );

//       return {
//         _id: chat._id,
//         participant: otherParticipant || null,
//         lastMessage: chat.lastMessage,
//         lastMessageAt: chat.lastMessageAt,
//       };
//     });

//     res.json(formattedChats);
//   } catch (error) {
//     console.error("CHAT FETCH ERROR:", error);
//     res.status(500).json({ error: "Failed to fetch chats" });
//   }
// }

// /**
//  * POST /api/chat/with/:participantId
//  * Get or create chat with a specific participant
//  */
// async function getOrCreateChat(req, res) {
//   try {
//     const userId = req.user?.id || req.user?._id;
//     const participantId = req.params.participantId;

//     if (!userId) return res.status(401).json({ error: "Unauthorized" });
//     if (!participantId) return res.status(400).json({ error: "participantId required" });

//     const userObjId = new mongoose.Types.ObjectId(userId);
//     const participantObjId = new mongoose.Types.ObjectId(participantId);

//     let chat = await Chat.findOne({
//       participants: { $all: [userObjId, participantObjId] },
//     })
//       .populate("participants", "name email avatar")
//       .populate("lastMessage");

//     if (!chat) {
//       chat = await Chat.create({
//         participants: [userObjId, participantObjId],
//       });
//       await chat.populate("participants", "name email avatar");
//     } else {
//       // ✅ FIX: Agar chat deletedFor mein thi, restore kar do
//       if (chat.deletedFor && chat.deletedFor.some(id => id.equals(userObjId))) {
//         await Chat.updateOne(
//           { _id: chat._id },
//           { $pull: { deletedFor: userObjId } }
//         );
//       }
//     }

//     const otherParticipant = chat.participants.find(
//       (p) => !p._id.equals(userObjId)
//     );

//     res.json({
//       _id: chat._id,
//       participant: otherParticipant,
//       lastMessage: chat.lastMessage,
//       lastMessageAt: chat.lastMessageAt || chat.createdAt,
//     });
//   } catch (error) {
//     console.error("CHAT CREATE ERROR:", error);
//     res.status(500).json({ error: "Failed to create or get chat" });
//   }
// }

// /**
//  * DELETE /api/chat/:chatId
//  * ✅ FIX: Soft delete — sirf us user ke liye delete hogi, dusre ka data safe rahega
//  * Agar dono users ne delete kar diya tab permanently delete hogi
//  */
// async function deleteChat(req, res) {
//   try {
//     const userId = req.user?.id || req.user?._id;
//     const { chatId } = req.params;

//     if (!userId) return res.status(401).json({ error: "Unauthorized" });

//     const userObjId = new mongoose.Types.ObjectId(userId);

//     const chat = await Chat.findById(chatId);
//     if (!chat) return res.status(404).json({ error: "Chat not found" });

//     // Check karo ke yeh user is chat ka participant hai ya nahi
//     const isParticipant = chat.participants.some(p => p.equals(userObjId));
//     if (!isParticipant) return res.status(403).json({ error: "Access denied" });

//     // ✅ FIX: Is user ke liye soft delete
//     await Chat.updateOne(
//       { _id: chatId },
//       { $addToSet: { deletedFor: userObjId } }
//     );

//     // Check karo agar dono users ne delete kar diya
//     const updatedChat = await Chat.findById(chatId);
//     const allDeleted = updatedChat.participants.every(p =>
//       updatedChat.deletedFor.some(d => d.equals(p))
//     );

//     // Agar dono ne delete kiya tab permanent delete karo
//     if (allDeleted) {
//       await Message.deleteMany({ chat: chatId });
//       await Chat.findByIdAndDelete(chatId);
//       console.log(`[DELETE-CHAT] Permanently deleted chatId: "${chatId}"`);
//     } else {
//       console.log(`[DELETE-CHAT] Soft deleted for userId: "${userId}" | chatId: "${chatId}"`);
//     }

//     res.json({ message: "Chat deleted successfully", chatId });
//   } catch (error) {
//     console.error("DELETE CHAT ERROR:", error);
//     res.status(500).json({ error: "Delete failed" });
//   }
// }

// module.exports = {
//   getChats,
//   getOrCreateChat,
//   deleteChat,
// };
