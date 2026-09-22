// src/hbs/chat/controllers/chatController.js
//
// KYA BADLA:
//  - Chat list par pagination (pehle SAARI chats ek saath aati thin, har ek ka
//    participant aur lastMessage populate hota tha).
//  - `.lean()` — mongoose document objects banane ka overhead khatam.
//  - Purana commented-out code (200+ lines) hata diya.
//  - deleteChat ab background me messages update karta hai taake API foran
//    jawab de.

const mongoose = require("mongoose");
const {pageLimit, encodeCursor, cursorFilter} = require("../pagination");
const { Chat } = require("../model/chat");
const { Message } = require("../model/message");
const { canMessageUser } = require("../services/messagePrivacy");
require("../../models/User"); // populate ke liye model register hona zaroori hai

const { Types } = mongoose;
const MAX_CHAT_PAGE = 50;

function userIdOf(req) {
  return String(req.user?.id || req.user?._id || "");
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/chat?limit=30&before=<ISO>
// ─────────────────────────────────────────────────────────────────────
async function getChats(req, res, next) {
  try {
    const userId = userIdOf(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const userObjId = new Types.ObjectId(userId);
    const limit = pageLimit(req.query.limit, 30, MAX_CHAT_PAGE);

    const filter = {
      participants: userObjId,
      deletedFor: { $ne: userObjId },
      lastMessage: { $ne: null },
    };

    if (req.query.before) {
      Object.assign(filter, cursorFilter(req.query.before, "lastMessageAt"));
    }

    const rows = await Chat.find(filter)
      .populate("participants", "name email avatar lastSeen privacySettings")
      .populate({
        path: "lastMessage",
        select:
          "text sender mediaUrl thumbnailUrl mediaType mediaName deleted createdAt status",
      })
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const chats = hasMore ? rows.slice(0, limit) : rows;

    const formatted = chats.map((chat) => {
      const other =
        chat.participants.find((p) => String(p._id) !== userId) || null;

      return {
        _id: chat._id,
        participant: other,
        lastMessage: chat.lastMessage,
        lastMessageAt: chat.lastMessageAt,
        // .lean() ke baad Map plain object ban jata hai
        unreadCount: chat.unreadCount?.[userId] || 0,
        isMuted: (chat.mutedBy || []).some((id) => String(id) === userId),
        participantLastSeen: other?.privacySettings?.hideLastSeen
          ? null
          : other?.lastSeen || null,
        participantHidesOnline: Boolean(
          other?.privacySettings?.hideOnlineStatus
        ),
      };
    });

    res.json({
      chats: formatted,
      hasMore,
      nextCursor: encodeCursor(chats[chats.length - 1], "lastMessageAt"),
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/chat/with/:participantId
// ─────────────────────────────────────────────────────────────────────
async function getOrCreateChat(req, res, next) {
  try {
    const userId = userIdOf(req);
    const participantId = req.params.participantId;

    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!mongoose.isValidObjectId(participantId)) {
      return res.status(400).json({ error: "Invalid participantId" });
    }
    if (userId === String(participantId)) {
      return res
        .status(400)
        .json({ error: "You cannot create a chat with yourself" });
    }

    const privacy = await canMessageUser(userId, participantId);
    if (!privacy.allowed) {
      const status = privacy.code === "USER_NOT_FOUND" ? 404 : 403;
      return res.status(status).json({
        error:
          privacy.code === "BLOCKED"
            ? "You cannot message this user"
            : "This user does not allow messages from you",
        code: privacy.code,
      });
    }

    const userObjId = new Types.ObjectId(userId);
    const participantObjId = new Types.ObjectId(participantId);

    // Upsert — pehle findOne, phir shayad create (2 round trips) hota tha.
    // Ab ek atomic operation, aur race condition bhi nahi.
    const chat = await Chat.findOneAndUpdate(
      { participants: { $all: [userObjId, participantObjId], $size: 2 } },
      {
        $setOnInsert: { participants: [userObjId, participantObjId] },
        $pull: { deletedFor: userObjId },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate("participants", "name email avatar lastSeen privacySettings")
      .populate("lastMessage")
      .lean();

    const other =
      chat.participants.find((p) => String(p._id) !== userId) || null;

    res.json({
      _id: chat._id,
      participant: other,
      lastMessage: chat.lastMessage || null,
      lastMessageAt: chat.lastMessageAt || chat.createdAt,
      unreadCount: chat.unreadCount?.[userId] || 0,
      isMuted: (chat.mutedBy || []).some((id) => String(id) === userId),
      participantLastSeen: other?.privacySettings?.hideLastSeen
        ? null
        : other?.lastSeen || null,
      participantHidesOnline: Boolean(other?.privacySettings?.hideOnlineStatus),
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// DELETE /api/chat/:chatId
// ─────────────────────────────────────────────────────────────────────
async function deleteChat(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    if (!mongoose.isValidObjectId(chatId)) {
      return res.status(400).json({ error: "Invalid chatId" });
    }

    const userObjId = new Types.ObjectId(userId);

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, participants: userObjId },
      { $addToSet: { deletedFor: userObjId } },
      { new: true, projection: "participants deletedFor" }
    ).lean();

    if (!chat) {
      return res.status(404).json({ error: "Chat not found or access denied" });
    }

    const allDeleted = chat.participants.every((p) =>
      (chat.deletedFor || []).some((d) => String(d) === String(p))
    );

    // API foran jawab de — bhaari kaam background me
    res.json({ message: "Chat deleted successfully", chatId });

    setImmediate(async () => {
      try {
        if (allDeleted) {
          await Message.deleteMany({ chat: chatId });
          await Chat.deleteOne({ _id: chatId });
        } else {
          await Message.updateMany(
            { chat: chatId },
            { $addToSet: { deletedFor: userObjId } }
          );
        }
      } catch (e) {
        console.error("[deleteChat background]", e.message);
      }
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// Mute / Unmute
// ─────────────────────────────────────────────────────────────────────
async function muteChat(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await Chat.updateOne(
      { _id: chatId, participants: userId },
      { $addToSet: { mutedBy: userId } }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ error: "Chat not found" });
    }
    res.json({ message: "Chat muted", isMuted: true });
  } catch (err) {
    next(err);
  }
}

async function unmuteChat(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const result = await Chat.updateOne(
      { _id: chatId, participants: userId },
      { $pull: { mutedBy: userId } }
    );
    if (!result.matchedCount) {
      return res.status(404).json({ error: "Chat not found" });
    }
    res.json({ message: "Chat unmuted", isMuted: false });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getChats,
  getOrCreateChat,
  deleteChat,
  muteChat,
  unmuteChat,
};
