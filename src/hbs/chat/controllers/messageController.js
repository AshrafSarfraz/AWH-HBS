const { canMessageUser } = require("../services/messagePrivacy");
// src/hbs/chat/controllers/messageController.js
//
// KYA BADLA:
//  - `.lean()` har read query par — mongoose documents banane ka overhead khatam.
//  - `countDocuments` sirf pehli page par (pehle HAR page par chalta tha).
//  - Cursor pagination (`before`) add ki — deep pages par `.skip()` slow hota
//    hai. Purana `page` param bhi kaam karta rahega, app tootegi nahi.
//  - `getChatMedia` par pagination — pehle chat ka SAARA media ek saath aata tha.
//  - Upload ab compress + thumbnail banata hai aur chat membership verify
//    karta hai (pehle koi bhi logged-in user kuch bhi upload kar sakta tha).

const mongoose = require("mongoose");
const {pageLimit, encodeCursor, cursorFilter} = require("../pagination");
const { Chat } = require("../model/chat");
const { Message } = require("../model/message");
const { uploadMediaBuffer } = require("../../utils/mediaUpload");

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 25;

function userIdOf(req) {
  return String(req.user?.id || req.user?._id || "");
}

/** Sirf chat ke participant ko aage jane do */
async function assertParticipant(chatId, userId) {
  if (!mongoose.isValidObjectId(chatId)) return null;
  return Chat.findOne({ _id: chatId, participants: userId })
    .select("_id participants")
    .lean();
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/messages/chat/:chatId
// ?limit=25&before=<ISO date | messageId>   (recommended)
// ?page=2                                    (purana tareeqa, ab bhi chalega)
// ─────────────────────────────────────────────────────────────────────
async function getMessages(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await assertParticipant(chatId, userId);
    if (!chat)
      return res.status(404).json({ error: "Chat not found or access denied" });

    const limit = pageLimit(req.query.limit, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    const query = { chat: chatId, deletedFor: { $ne: userId } };

    // ── Cursor mode (tez) ──────────────────────────────────────────────
    let usingCursor = false;
    if (req.query.before) {
      usingCursor = true;
      const before = req.query.before;
      if (mongoose.isValidObjectId(before)) {
        const anchor = await Message.findOne({_id: before, chat: chatId, deletedFor: {$ne: userId}}).select("createdAt").lean();
        if (!anchor) return res.status(400).json({error: "Invalid pagination cursor"});
        Object.assign(query, cursorFilter(encodeCursor(anchor)));
      } else {
        Object.assign(query, cursorFilter(before));
      }
    }

    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const skip = usingCursor ? 0 : (page - 1) * limit;

    const finder = Message.find(query)
      .populate("sender", "name avatar")
      .populate({
        path: "replyTo",
        select: "text sender mediaUrl thumbnailUrl mediaType mediaName deleted",
        populate: { path: "sender", select: "name" },
      })
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit + 1) // ek extra taake hasMore pata chale bina count ke
      .lean();

    // Total sirf pehli request par — har page par count karna mehnga tha
    const needTotal = !usingCursor && page === 1;
    const [rows, total] = await Promise.all([
      finder,
      needTotal ? Message.countDocuments(query) : Promise.resolve(null),
    ]);

    const hasMore = rows.length > limit;
    const messages = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      messages: messages.reverse(), // frontend ko oldest→newest chahiye
      pagination: {
        page,
        limit,
        total,
        totalPages: total == null ? null : Math.ceil(total / limit),
        hasMore,
        // agli request me isay `before` ke taur par bhejein
        nextCursor: encodeCursor(messages[0]),
      },
    });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/messages/upload   (multipart: file, optional chatId)
// ─────────────────────────────────────────────────────────────────────
async function uploadMedia(req, res, next) {
  try {
    const userId = userIdOf(req);
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Agar chatId diya gaya ho to verify karo ke user us chat ka member hai
    const { chatId } = req.body;
    if (chatId) {
      const chat = await assertParticipant(chatId, userId);
      if (!chat) return res.status(403).json({ error: "Access denied for this chat" });
      const otherId = chat.participants.find(id => String(id) !== String(userId));
      if (!(await canMessageUser(userId, otherId)).allowed) return res.status(403).json({error: "Mutual following is required"});
    }

    const result = await uploadMediaBuffer({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: "chat",
    });

    // Purane frontend ke liye same keys, plus naye fields
    res.json({
      mediaUrl: result.mediaUrl,
      thumbnailUrl: result.thumbnailUrl,
      mediaType: result.mediaType,
      mediaName: result.mediaName,
      mediaSize: result.mediaSize,
      mediaWidth: result.width,
      mediaHeight: result.height,
    });
  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// PUT /api/messages/chat/:chatId/read
// ─────────────────────────────────────────────────────────────────────
async function bulkMarkRead(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await assertParticipant(chatId, userId);
    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Dono updates parallel — pehle sequential the
    await Promise.all([
      Message.updateMany(
        {
          chat: chatId,
          sender: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
        },
        { $set: { status: "seen" } }
      ),
      Chat.updateOne(
        { _id: chatId },
        { $set: { [`unreadCount.${userId}`]: 0 } }
      ),
    ]);

    // Sender ko live bata do (agar socket attached hai)
    const io = req.app.get("io");
    if (io) {
      const other = chat.participants
        .map(String)
        .find((id) => id !== String(userId));
      if (other) io.to(`user:${other}`).emit("chat-read", { chatId });
    }

    res.json({ message: "All messages marked as seen" });
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────────────────
// GET /api/chat/:chatId/media?type=image&limit=30&before=<ISO>
// ─────────────────────────────────────────────────────────────────────
async function getChatMedia(req, res, next) {
  try {
    const userId = userIdOf(req);
    const { chatId } = req.params;
    const { type } = req.query;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const chat = await assertParticipant(chatId, userId);
    if (!chat)
      return res.status(404).json({ error: "Chat not found or access denied" });

    const limit = pageLimit(req.query.limit, 30, MAX_PAGE_SIZE);

    const filter = {
      chat: chatId,
      deletedFor: { $ne: userId },
      deleted: false,
      mediaUrl: { $ne: null },
    };
    if (["image", "video", "document", "audio"].includes(type)) {
      filter.mediaType = type;
    }
    if (req.query.before) {
      Object.assign(filter, cursorFilter(req.query.before));
    }

    const rows = await Message.find(filter)
      .select("mediaUrl thumbnailUrl mediaType mediaName mediaSize createdAt sender")
      .populate("sender", "name avatar")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const media = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      media,
      hasMore,
      nextCursor: encodeCursor(media[media.length - 1]),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getMessages, uploadMedia, bulkMarkRead, getChatMedia };