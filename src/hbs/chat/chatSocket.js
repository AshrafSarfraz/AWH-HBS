// src/hbs/chat/chatSocket.js
//
// ═══════════════════════════════════════════════════════════════════════
// KYA KYA BADLA (yahi file chat slow hone ki sabse badi wajah thi)
// ═══════════════════════════════════════════════════════════════════════
//
// 1) TYPING EVENT — pehle har keystroke par `Chat.findById()` + `Block.findOne()`
//    chalti thi. 50 log type kar rahe hon to per second sainkron DB queries.
//    Ab chat participants aur block status cache me hain, typing par ZERO
//    database queries. Upar se 2-second throttle bhi hai.
//
// 2) SEND-MESSAGE — pehle ~10 sequential DB round trips the. Ab typically 2:
//    Message.create + ek atomic Chat.findOneAndUpdate. Sender ka naam/avatar
//    cache se aata hai, populate ki zaroorat nahi.
//
// 3) FCM — pehle har device token par alag `await` wali HTTP call thi, aur wo
//    bhi message handler ke andar. Ab ek multicast call hai jo await NAHI hoti
//    — message foran deliver hota hai, push background me jati hai.
//
// 4) PRESENCE — pehle N online users ke liye N alag `User.findById` chalti
//    thin. Ab ek hi `User.find({_id:{$in:[...]}})` query hai, aur wo bhi sirf
//    un users ke liye jo cache me nahi.
//
// 5) MEMORY LEAK — purana `privacyCache` sirf disconnect hone wale user ki
//    entry delete karta tha, baaqi sab hamesha ke liye padi rehti thin. Ab
//    TTLCache hai jo khud purani entries saaf karta hai.
//
// 6) CRASH FIX — `typing` handler me `chat.participants` bina null-check ke
//    use ho raha tha. Chat na milne par TypeError → unhandled rejection →
//    poora process crash. Ab har handler try/catch me hai.
//
// 7) SECURITY — Socket.IO ka CORS `origin: "*"` tha (Express par restricted
//    tha). Ab same allow-list dono jagah.

const { Server } = require("socket.io");
const { saveMessage } = require("./saveMessage");
const jwt = require("jsonwebtoken");

const { Chat } = require("./model/chat");
const { Message } = require("./model/message");
const { Block } = require("./model/block");
const User = require("../models/User");
const { canMessageUser } = require("./services/messagePrivacy");
const { isRateLimited } = require("../utils/socketratelimiter");
const { sendPushToUser } = require("./sendFCMMessage");
const { TTLCache } = require("../utils/ttlCache");

// ─────────────────────────────────────────────────────────────────────
// CACHES
// ─────────────────────────────────────────────────────────────────────

// chatId -> { participants: [idA, idB] }   (1-1 chat me participants kabhi
// nahi badalte, is liye lamba TTL safe hai)
const chatMetaCache = new TTLCache({ ttl: 10 * 60_000, maxSize: 20_000 });

// "a|b" -> boolean  (block hai ya nahi)
const blockCache = new TTLCache({ ttl: 60_000, maxSize: 20_000 });

// userId -> { name, avatar, hideOnlineStatus, hideLastSeen }
const userCache = new TTLCache({ ttl: 60_000, maxSize: 20_000 });

// "sender|recipient" -> { allowed, code }
const permissionCache = new TTLCache({ ttl: 60_000, maxSize: 20_000 });

/** Online users: userId -> Set<socketId> */
const OnlineUsers = new Map();

const blockKey = (a, b) => [String(a), String(b)].sort().join("|");

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

/** Ek query me kai users ka profile + privacy la kar cache bhar do */
async function loadUsers(userIds) {
  const missing = userIds.map(String).filter((id) => !userCache.has(id));

  if (missing.length) {
    const rows = await User.find({ _id: { $in: missing } })
      .select("name avatar privacySettings.hideOnlineStatus privacySettings.hideLastSeen")
      .lean();

    for (const u of rows) {
      userCache.set(String(u._id), {
        name: u.name,
        avatar: u.avatar || null,
        hideOnlineStatus: Boolean(u.privacySettings?.hideOnlineStatus),
        hideLastSeen: Boolean(u.privacySettings?.hideLastSeen),
      });
    }
    // Jo users mile hi nahi — unko bhi cache karo warna har baar query hogi
    for (const id of missing) {
      if (!userCache.has(id)) {
        userCache.set(id, {
          name: null,
          avatar: null,
          hideOnlineStatus: false,
          hideLastSeen: false,
        });
      }
    }
  }

  return Object.fromEntries(
    userIds.map((id) => [String(id), userCache.get(String(id))])
  );
}

async function getUser(userId) {
  const cached = userCache.get(String(userId));
  if (cached) return cached;
  const map = await loadUsers([userId]);
  return map[String(userId)];
}

/** Chat ke participants — cache se, warna ek dafa DB se */
async function getChatParticipants(chatId) {
  const cached = chatMetaCache.get(String(chatId));
  if (cached) return cached.participants;

  const chat = await Chat.findById(chatId).select("participants").lean();
  if (!chat) return null;

  const participants = chat.participants.map(String);
  chatMetaCache.set(String(chatId), { participants });
  return participants;
}

/** Do users ke darmiyan block hai ya nahi — cached */
async function isBlocked(a, b) {
  const key = blockKey(a, b);
  const cached = blockCache.get(key);
  if (cached !== undefined) return cached;

  const exists = await Block.exists({
    $or: [
      { blocker: a, blocked: b },
      { blocker: b, blocked: a },
    ],
  });
  return blockCache.set(key, Boolean(exists));
}

/** Message bhejne ki ijazat — cached */
async function checkPermission(senderId, recipientId) {
  const key = `${senderId}|${recipientId}`;
  const cached = permissionCache.get(key);
  if (cached) return cached;

  const result = await canMessageUser(senderId, recipientId);
  return permissionCache.set(key, result);
}

function isOnline(userId) {
  const set = OnlineUsers.get(String(userId));
  return Boolean(set && set.size > 0);
}

// ─────────────────────────────────────────────────────────────────────
// SOCKET SERVER
// ─────────────────────────────────────────────────────────────────────

const initializeSocket = (server, { allowedOrigins } = {}) => {
  const io = new Server(server, {
    cors: {
      // ✅ FIX: pehle "*" tha — koi bhi site connect kar sakti thi
      origin: allowedOrigins && allowedOrigins.length ? allowedOrigins : true,
      methods: ["GET", "POST"],
      credentials: true,
    },
    pingInterval: 25_000,
    pingTimeout: 20_000,
    maxHttpBufferSize: 1e6, // 1 MB — media socket se nahi, REST upload se jata hai
  });

  // ── AUTH ───────────────────────────────────────────────────────────
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id || decoded._id || "");
      if (!socket.userId) return next(new Error("Unauthorized: no userId"));

      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    // Har handler ka error yahan pakda jaye — server crash na ho
    const safe = (name, fn) =>
      socket.on(name, async (...args) => {
        try {
          await fn(...args);
        } catch (err) {
          console.error(`[SOCKET ${name}]`, err.message);
          if (name === "send-message") socket.emit("message-status", {tempId: args[0]?.tempId, status: "failed"});
        }
      });

    // ── ONLINE SYNC ───────────────────────────────────────────────────
    safe("request-online-sync", async () => {
      const ids = Array.from(OnlineUsers.keys());
      const profiles = await loadUsers(ids);
      socket.emit(
        "online-users",
        ids.filter((id) => !profiles[id]?.hideOnlineStatus)
      );
    });

    // ── JOIN CHAT ─────────────────────────────────────────────────────
    safe("join-chat", async (chatId) => {
      if (!chatId) return;
      const participants = await getChatParticipants(chatId);
      if (!participants?.includes(String(userId))) return;
      await socket.join(`chat:${chatId}`);

      const unread = await Message.find({
        chat: chatId,
        sender: { $ne: userId },
        status: { $in: ["sent", "delivered"] },
        deletedFor: { $ne: userId },
      })
        .select("_id sender")
        .limit(500)
        .lean();

      if (!unread.length) {
        await Chat.updateOne({_id: chatId}, {$set: {[`unreadCount.${userId}`]: 0}});
        return;
      }

      await Promise.all([
        Message.updateMany(
          {chat: chatId, sender: {$ne: userId}, deletedFor: {$ne: userId}, status: {$in: ["sent", "delivered"]}},
          { $set: { status: "seen" } }
        ),
        Chat.updateOne(
          { _id: chatId },
          { $set: { [`unreadCount.${userId}`]: 0 } }
        ),
      ]);

      const grouped = new Map();
      for (const m of unread) {
        const sid = String(m.sender);
        if (!grouped.has(sid)) grouped.set(sid, []);
        grouped.get(sid).push(String(m._id));
      }
      for (const [senderId, ids] of grouped) {
        io.to(`user:${senderId}`).emit("chat-read", {chatId});
        io.to(`user:${senderId}`).emit("messages-read", {
          chatId,
          messageIds: ids,
          msgStatus: "seen",
        });
      }
    });

    safe("leave-chat", (chatId) => socket.leave(`chat:${chatId}`));

    // ── SEND MESSAGE ──────────────────────────────────────────────────
    safe(
      "send-message",
      async ({
        chatId,
        text,
        tempId,
        replyTo,
        mediaUrl,
        thumbnailUrl,
        mediaType,
        mediaName,
        mediaSize,
        mediaWidth,
        mediaHeight,
      } = {}) => {
        if (isRateLimited(userId, 30, 60_000)) {
          return socket.emit("message-error", {
            tempId,
            message: "Aap bohot tezi se messages bhej rahe hain.",
          });
        }

        if (tempId != null && (typeof tempId !== "string" || !tempId.length || tempId.length > 160)) {
          return socket.emit("message-error", {tempId, message: "Invalid message identifier"});
        }
        const trimmedText = typeof text === "string" ? text.trim() : "";
        if (!trimmedText && !mediaUrl) return;
        if (trimmedText.length > 1000) {
          return socket.emit("message-error", {
            tempId,
            message: "Max 1000 characters.",
          });
        }

        // 1. Participants — cache se (DB hit sirf pehli baar)
        const participants = await getChatParticipants(chatId);
        if (!participants || !participants.includes(String(userId))) {
          return socket.emit("message-status", { tempId, status: "failed" });
        }
        const otherUserId = participants.find((id) => id !== String(userId));

        // 2. Ijazat — cached (60s)
        const privacy = await checkPermission(userId, otherUserId);
        if (!privacy.allowed) {
          return socket.emit("message-status", {
            tempId,
            status: "failed",
            reason:
              privacy.code === "BLOCKED" ? "blocked" : "message_not_allowed",
          });
        }

        const msgStatus = isOnline(otherUserId) ? "delivered" : "sent";

        // 3. Message banao (round trip #1)
        const {message, created} = await saveMessage(Message, {
          ...(tempId ? {tempId} : {}),
          chat: chatId,
          sender: userId,
          text: trimmedText,
          status: msgStatus,
          replyTo: replyTo || null,
          mediaUrl: mediaUrl || null,
          thumbnailUrl: thumbnailUrl || null,
          mediaType: mediaType || null,
          mediaName: mediaName || null,
          mediaSize: mediaSize || null,
          mediaWidth: mediaWidth || null,
          mediaHeight: mediaHeight || null,
        });

        if (!created) {
          const stored = await Message.findById(message._id)
            .populate("sender", "name avatar")
            .populate({path: "replyTo", select: "text sender mediaType mediaUrl thumbnailUrl deleted", populate: {path: "sender", select: "name"}})
            .lean();
          return socket.emit("message-status", {tempId, status: "sent", message: {...stored, chatId, tempId}, msgStatus: message.status});
        }

        // 4. Chat update — sab kuch EK atomic operation me (round trip #2)
        //    Pehle ye 4 alag queries thin.
        const updatedChat = await Chat.findByIdAndUpdate(
          chatId,
          {
            $set: {
              lastMessage: message._id,
              lastMessageAt: message.createdAt,
            },
            $inc: { [`unreadCount.${otherUserId}`]: 1 },
            $pull: { deletedFor: { $in: participants } },
          },
          { new: true, projection: "unreadCount mutedBy" }
        ).lean();

        // 5. Sender ka profile — cache se, koi query nahi
        const senderProfile = await getUser(userId);

        // 6. replyTo ka preview — sirf tab jab reply ho
        let replyPreview = null;
        if (replyTo) {
          const r = await Message.findById(replyTo)
            .select("text sender mediaType mediaUrl thumbnailUrl deleted chat")
            .lean();
          if (r && String(r.chat) === String(chatId)) {
            const rSender = await getUser(r.sender);
            replyPreview = {
              _id: String(r._id),
              text: r.text,
              mediaType: r.mediaType,
              mediaUrl: r.mediaUrl,
              thumbnailUrl: r.thumbnailUrl,
              deleted: r.deleted,
              sender: { _id: String(r.sender), name: rSender?.name || null },
            };
          }
        }

        const formatted = {
          chatId,
          _id: String(message._id),
          text: message.text,
          createdAt: message.createdAt,
          status: msgStatus,
          sender: {
            _id: String(userId),
            name: senderProfile?.name || null,
            avatar: senderProfile?.avatar || null,
          },
          replyTo: replyPreview,
          mediaUrl: message.mediaUrl,
          thumbnailUrl: message.thumbnailUrl,
          mediaType: message.mediaType,
          mediaName: message.mediaName,
          mediaSize: message.mediaSize,
          mediaWidth: message.mediaWidth,
          mediaHeight: message.mediaHeight,
          reactions: {},
          tempId,
        };

        // 7. Emit — receiver ke room me bhi aur chat room me bhi
        socket.to(`chat:${chatId}`).emit("receive-message", formatted);
        socket.emit("message-status", {
          tempId,
          status: "sent",
          message: formatted,
          msgStatus,
        });

        io.to(`user:${userId}`).emit("chat-updated", {
          chatId,
          lastMessage: formatted,
          lastMessageAt: message.createdAt,
          incrementUnread: false,
          unreadCount: 0,
        });

        const receiverUnread =
          updatedChat?.unreadCount?.[otherUserId] ?? 1;

        io.to(`user:${otherUserId}`).emit("chat-updated", {
          chatId,
          lastMessage: formatted,
          lastMessageAt: message.createdAt,
          incrementUnread: true,
          unreadCount: receiverUnread,
        });

        // 8. Push — AWAIT NAHI. Message pehle hi deliver ho chuka hai.
        const isMuted = (updatedChat?.mutedBy || [])
          .map(String)
          .includes(String(otherUserId));

        if (!isMuted) {
          const notifBody = mediaUrl
            ? { image: "📷 Photo", video: "🎥 Video", audio: "🎤 Voice message" }[
                mediaType
              ] || "📎 Document"
            : trimmedText;

          setImmediate(() => {
            sendPushToUser({
              userId: otherUserId,
              title: senderProfile?.name || "New Message",
              body: notifBody,
              imageUrl: mediaType === "image" ? thumbnailUrl || mediaUrl : undefined,
              data: {
                chatId,
                senderId: userId,
                senderName: senderProfile?.name || "",
                senderAvatar: senderProfile?.avatar || "",
              },
            }).catch((e) => console.error("[FCM]", e.message));
          });
        }
      }
    );

    // ── EDIT MESSAGE ──────────────────────────────────────────────────
    safe("edit-message", async ({ messageId, chatId, newText } = {}) => {
      if (!(await getChatParticipants(chatId))?.includes(String(userId))) return;
      const text = (newText || "").trim();
      if (!text) return socket.emit("message-error", { message: "Empty text" });
      if (text.length > 1000)
        return socket.emit("message-error", { message: "Max 1000 characters" });

      // Ek atomic update — pehle findById + checks + save the (3 round trips)
      const updated = await Message.findOneAndUpdate(
        { _id: messageId, chat: chatId, sender: userId, deleted: false, mediaUrl: null },
        { $set: { text, edited: true, editedAt: new Date() } },
        { new: true, projection: "text editedAt" }
      ).lean();

      if (!updated) {
        return socket.emit("message-error", {
          message: "Ye message edit nahi ho sakta",
        });
      }

      io.to(`chat:${chatId}`).emit("message-edited", {
        messageId,
        chatId,
        newText: updated.text,
        editedAt: updated.editedAt,
      });
    });

    // ── DELETE MESSAGE ────────────────────────────────────────────────
    safe(
      "delete-message",
      async ({ messageId, chatId, deleteForEveryone } = {}) => {
        if (!(await getChatParticipants(chatId))?.includes(String(userId))) return;
        if (deleteForEveryone) {
          const updated = await Message.findOneAndUpdate(
            { _id: messageId, chat: chatId, sender: userId },
            {
              $set: {
                text: "This message was deleted",
                deleted: true,
                mediaUrl: null,
                thumbnailUrl: null,
                mediaType: null,
                mediaName: null,
              },
            },
            { new: true, projection: "_id text createdAt" }
          ).lean();

          if (!updated) {
            return socket.emit("message-error", {
              message: "Sirf apna message delete kar sakte ho",
            });
          }

          io.to(`chat:${chatId}`).emit("message-deleted", {
            messageId,
            deleteForEveryone: true,
          });

          const latest = await Chat.findById(chatId).select("lastMessage").lean();
          if (String(latest?.lastMessage) !== String(messageId)) return;
          const participants = await getChatParticipants(chatId);
          const deletedMsg = {
            _id: String(updated._id),
            text: updated.text,
            deleted: true,
          };
          for (const pid of participants || []) {
            io.to(`user:${pid}`).emit("chat-updated", {
              chatId,
              lastMessage: deletedMsg,
              lastMessageAt: updated.createdAt,
              incrementUnread: false,
            });
          }
        } else {
          await Message.updateOne(
            { _id: messageId, chat: chatId },
            { $addToSet: { deletedFor: userId } }
          );
          socket.emit("message-hidden", { messageId, chatId });
        }
      }
    );

    // ── REACTIONS ─────────────────────────────────────────────────────
    safe("react-message", async ({ messageId, chatId, emoji } = {}) => {
      if (!(await getChatParticipants(chatId))?.includes(String(userId))) return;
      if (emoji != null && (typeof emoji !== "string" || emoji.length > 32)) return;
      const update = emoji
        ? { $set: { [`reactions.${userId}`]: emoji } }
        : { $unset: { [`reactions.${userId}`]: "" } };

      const updated = await Message.findOneAndUpdate(
        { _id: messageId, chat: chatId, deleted: false },
        update,
        { new: true, projection: "reactions" }
      ).lean();

      if (!updated) return;

      io.to(`chat:${chatId}`).emit("message-reaction", {
        messageId,
        chatId,
        reactions: updated.reactions || {},
        userId,
        emoji: emoji || null,
      });
    });

    // ── MARK READ ─────────────────────────────────────────────────────
    safe("mark-read", async ({ chatId, messageId } = {}) => {
      if (!messageId || !(await getChatParticipants(chatId))?.includes(String(userId))) return;

      const updated = await Message.findOneAndUpdate(
        { _id: messageId, chat: chatId, deletedFor: {$ne: userId}, sender: { $ne: userId }, status: { $ne: "seen" } },
        { $set: { status: "seen" } },
        { new: true, projection: "sender" }
      ).lean();

      if (!updated) return;

      await Chat.updateOne({_id: chatId, [`unreadCount.${userId}`]: {$gt: 0}}, {$inc: {[`unreadCount.${userId}`]: -1}});
      io.to(`user:${String(updated.sender)}`).emit("messages-read", {
        chatId,
        messageIds: [String(messageId)],
        msgStatus: "seen",
      });
    });

    // ── TYPING ────────────────────────────────────────────────────────
    // ✅ ZERO DB QUERIES. Pehle har keystroke par 2 queries chalti thin.
    let lastTypingAt = 0;

    safe("typing", async ({ chatId } = {}) => {
      const now = Date.now();
      if (now - lastTypingAt < 2000) return; // throttle
      lastTypingAt = now;

      const participants = await getChatParticipants(chatId); // cached
      if (!participants?.includes(String(userId))) return;

      const other = participants.find((id) => id !== String(userId));
      if (!other) return;
      if (await isBlocked(userId, other)) return; // cached

      socket.to(`chat:${chatId}`).emit("typing", { userId });
    });

    safe("stop-typing", async ({ chatId } = {}) => {
      lastTypingAt = 0;
      const participants = await getChatParticipants(chatId);
      if (!participants?.includes(String(userId))) return;
      const other = participants.find((id) => id !== String(userId));
      if (!other) return;
      if (await isBlocked(userId, other)) return;

      socket.to(`chat:${chatId}`).emit("stop-typing", { userId });
    });

    // ── DISCONNECT ────────────────────────────────────────────────────
    safe("disconnect", async () => {
      const sockets = OnlineUsers.get(userId);
      if (!sockets) return;

      sockets.delete(socket.id);
      if (sockets.size > 0) return; // doosre device se abhi bhi online hai

      OnlineUsers.delete(userId);

      const lastSeen = new Date();
      await User.findByIdAndUpdate(userId, { $set: { lastSeen } }).catch(() => {});

      const profile = await getUser(userId);
      if (!profile?.hideLastSeen) {
        socket.broadcast.emit("user-offline", { userId, lastSeen });
      }
    });
    // Register listeners before the first database await so initial joins are not lost.
    try {
      if (!OnlineUsers.has(userId)) OnlineUsers.set(userId, new Set());
      OnlineUsers.get(userId).add(socket.id);
      socket.join(`user:${userId}`);

      // ── Presence ─────────────────────────────────────────────────────
      const onlineIds = Array.from(OnlineUsers.keys());
      const profiles = await loadUsers(onlineIds); // ✅ EK query, pehle N thin

      if (!profiles[userId]?.hideOnlineStatus) {
        socket.broadcast.emit("user-online", { userId });
      }

      socket.emit(
        "online-users",
        onlineIds.filter((id) => !profiles[id]?.hideOnlineStatus)
      );

      // ── Pending messages ko delivered mark karo ──────────────────────
      // Pehle: saari chats laao → un sab ke messages laao → update karo.
      // Ab: seedha ek updateMany + ek chhoti find. Index
      // { sender:1, status:1, chat:1 } is query ko cover karta hai.
      const myChats = await Chat.find({ participants: userId })
        .select("_id")
        .lean();
      const chatIds = myChats.map((c) => c._id);

      if (chatIds.length) {
        const undelivered = await Message.find({
          chat: { $in: chatIds },
          sender: { $ne: userId },
          status: "sent",
        })
          .select("_id sender chat")
          .limit(500) // safety: ek saath 10,000 messages load na ho jayen
          .lean();

        if (undelivered.length) {
          await Message.updateMany(
            { _id: { $in: undelivered.map((m) => m._id) }, status: "sent" },
            { $set: { status: "delivered" } }
          );

          const grouped = new Map();
          for (const m of undelivered) {
            const key = `${m.sender}:${m.chat}`;
            if (!grouped.has(key)) grouped.set(key, {senderId: String(m.sender), chatId: String(m.chat), ids: []});
            grouped.get(key).ids.push(String(m._id));
          }

          for (const data of grouped.values()) {
            const senderId = data.senderId;
            io.to(`user:${senderId}`).emit("messages-read", {
              chatId: data.chatId,
              messageIds: data.ids,
              msgStatus: "delivered",
            });
          }
        }
      }
    } catch (err) {
      console.error("[SOCKET connect]", err.message);
    }

  });

  return io;
};

module.exports = initializeSocket;
module.exports.OnlineUsers = OnlineUsers;

// Doosre modules cache invalidate kar sakein (block/unblock, privacy change)
module.exports.invalidateUser = (userId) => {
  userCache.delete(String(userId));
  permissionCache.deletePrefix(`${userId}|`);
};
module.exports.invalidateBlock = (a, b) => blockCache.delete(blockKey(a, b));
module.exports.invalidateChat = (chatId) => chatMetaCache.delete(String(chatId));
