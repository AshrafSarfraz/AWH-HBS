// /src/hbs/chat/chatSocket.js
const { Chat } = require("./model/chat");
const { Message } = require("./model/message");
const { Server } = require("socket.io");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const sendFCMMessage = require("./sendFCMMessage");
const Device = require("./model/device");
const { Block } = require("./model/block");
const { isRateLimited } = require("../utils/socketratelimiter");

const OnlineUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = String(decoded.id || decoded._id || "");
      if (!socket.userId) return next(new Error("Unauthorized: no userId in token"));
      next();
    } catch (err) {
      console.error("[AUTH ERROR]", err.message);
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;

    if (!OnlineUsers.has(userId)) OnlineUsers.set(userId, new Set());
    OnlineUsers.get(userId).add(socket.id);
    socket.join(`user:${userId}`);

    socket.broadcast.emit("user-online", { userId });
    socket.emit("online-users", Array.from(OnlineUsers.keys()));

    socket.on("request-online-sync", () => {
      socket.emit("online-users", Array.from(OnlineUsers.keys()));
    });

    // ON CONNECT: Mark pending as delivered
    try {
      const userChats = await Chat.find({ participants: userId }).select("_id");
      const chatIds = userChats.map((c) => c._id);

      const undelivered = await Message.find({
        chat: { $in: chatIds },
        sender: { $ne: userId },
        status: "sent",
      }).select("_id sender chat");

      if (undelivered.length > 0) {
        const ids = undelivered.map((m) => m._id);
        await Message.updateMany({ _id: { $in: ids } }, { status: "delivered" });

        const grouped = undelivered.reduce((acc, m) => {
          const sid = String(m.sender);
          if (!acc[sid]) acc[sid] = { chatId: String(m.chat), ids: [] };
          acc[sid].ids.push(String(m._id));
          return acc;
        }, {});

        for (const [senderId, data] of Object.entries(grouped)) {
          io.to(`user:${senderId}`).emit("messages-read", {
            chatId: data.chatId,
            messageIds: data.ids,
            msgStatus: "delivered",
          });
        }
      }
    } catch (err) {
      console.error("[CONNECT-DELIVER ERROR]", err.message);
    }

    // JOIN CHAT
    socket.on("join-chat", async (chatId) => {
      socket.join(`chat:${chatId}`);

      try {
        const unreadMessages = await Message.find({
          chat: chatId,
          sender: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
          deletedFor: { $ne: userId },
        }).select("_id sender");

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map((m) => m._id);
          await Message.updateMany({ _id: { $in: messageIds } }, { status: "seen" });

          await Chat.updateOne(
            { _id: chatId },
            { $set: { [`unreadCount.${userId}`]: 0 } }
          );

          const grouped = unreadMessages.reduce((acc, m) => {
            const sid = String(m.sender);
            if (!acc[sid]) acc[sid] = [];
            acc[sid].push(String(m._id));
            return acc;
          }, {});

          for (const [senderId, ids] of Object.entries(grouped)) {
            io.to(`user:${senderId}`).emit("messages-read", {
              chatId, messageIds: ids, msgStatus: "seen",
            });
          }
        }
      } catch (err) {
        console.error("[JOIN-CHAT ERROR]", err.message);
      }
    });

    // LEAVE CHAT
    socket.on("leave-chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // SEND MESSAGE
    socket.on("send-message", async ({ chatId, text, tempId, replyTo, mediaUrl, mediaType, mediaName }) => {
      try {
        if (isRateLimited(userId, 30, 60000)) {
          return socket.emit("message-error", {
            tempId,
            message: "Aap bahut tezi se messages bhej rahe hain.",
          });
        }

        const trimmedText = text?.trim() || "";
        if (!trimmedText && !mediaUrl) return;
        if (trimmedText.length > 1000) {
          return socket.emit("message-error", { tempId, message: "Max 1000 characters." });
        }

        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) return socket.emit("message-status", { tempId, status: "failed" });

        const otherUserId = chat.participants.map((p) => String(p)).find((id) => id !== userId);

        const blockExists = await Block.findOne({
          $or: [
            { blocker: userId, blocked: otherUserId },
            { blocker: otherUserId, blocked: userId },
          ],
        });
        if (blockExists) return socket.emit("message-status", { tempId, status: "failed", reason: "blocked" });

        const isOnline = OnlineUsers.has(otherUserId) && OnlineUsers.get(otherUserId).size > 0;
        const msgStatus = isOnline ? "delivered" : "sent";

        let replyToId = null;
        if (replyTo) {
          const replyMsg = await Message.findById(replyTo).select("_id chat");
          if (replyMsg && String(replyMsg.chat) === chatId) replyToId = replyMsg._id;
        }

        const message = await Message.create({
          chat: chatId, sender: userId,
          text: trimmedText, status: msgStatus,
          replyTo: replyToId,
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          mediaName: mediaName || null,
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        await chat.save();

        await message.populate("sender", "name email avatar");
        await message.populate({
          path: "replyTo",
          select: "text sender mediaType mediaUrl deleted",
          populate: { path: "sender", select: "name" },
        });

        await Chat.updateOne({ _id: chatId }, { $pull: { deletedFor: { $in: chat.participants } } });
        await Chat.updateOne({ _id: chatId }, { $inc: { [`unreadCount.${otherUserId}`]: 1 } });

        const formattedMessage = {
          _id: String(message._id),
          text: message.text,
          createdAt: message.createdAt,
          status: msgStatus,
          sender: { _id: String(message.sender._id), name: message.sender.name, avatar: message.sender.avatar || null },
          replyTo: message.replyTo || null,
          mediaUrl: message.mediaUrl || null,
          mediaType: message.mediaType || null,
          mediaName: message.mediaName || null,
          reactions: {},
          tempId,
        };

        socket.to(`chat:${chatId}`).emit("receive-message", formattedMessage);
        socket.emit("message-status", { tempId, status: "sent", message: formattedMessage, msgStatus });

        io.to(`user:${userId}`).emit("chat-updated", {
          chatId, lastMessage: formattedMessage,
          lastMessageAt: message.createdAt, incrementUnread: false, unreadCount: 0,
        });

        const updatedChat = await Chat.findById(chatId).select("unreadCount");
        const receiverUnread = updatedChat?.unreadCount?.get(otherUserId) || 1;
        io.to(`user:${otherUserId}`).emit("chat-updated", {
          chatId, lastMessage: formattedMessage,
          lastMessageAt: message.createdAt, incrementUnread: true, unreadCount: receiverUnread,
        });

        // FCM — HAMESHA
        try {
          const isMuted = chat.mutedBy?.some((id) => String(id) === otherUserId) || false;
          if (!isMuted) {
            const devices = await Device.find({ userId: otherUserId });
            const tokens = devices.map((d) => d.token).filter(Boolean);
            if (tokens.length > 0) {
              const notifBody = mediaUrl
                ? `📎 ${mediaType === "image" ? "Photo" : mediaType === "video" ? "Video" : "Document"}`
                : trimmedText;
              for (const deviceToken of tokens) {
                await sendFCMMessage({
                  to: deviceToken,
                  title: message.sender.name || "New Message",
                  body: notifBody,
                  data: { chatId, senderId: userId },
                });
              }
              console.log(`[FCM] Sent to ${tokens.length} device(s) of "${otherUserId}"`);
            } else {
              console.log(`[FCM] No devices for "${otherUserId}"`);
            }
          } else {
            console.log(`[FCM] Skipped — muted for "${otherUserId}"`);
          }
        } catch (fcmErr) {
          console.error("[FCM ERROR]", fcmErr.message);
        }

      } catch (err) {
        console.error("[SEND-MSG ERROR]", err.message);
        socket.emit("message-status", { tempId, status: "failed" });
      }
    });

    // EDIT MESSAGE
    socket.on("edit-message", async ({ messageId, chatId, newText }) => {
      try {
        if (!newText?.trim()) return socket.emit("message-error", { message: "Empty text" });
        if (newText.length > 1000) return socket.emit("message-error", { message: "Max 1000 characters" });

        const message = await Message.findById(messageId);
        if (!message) return;
        if (String(message.sender) !== userId) return socket.emit("message-error", { message: "Sirf apna message edit karo" });
        if (message.deleted) return socket.emit("message-error", { message: "Deleted message edit nahi ho sakta" });
        if (message.mediaUrl) return socket.emit("message-error", { message: "Media message edit nahi ho sakta" });

        message.text = newText.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        io.to(`chat:${chatId}`).emit("message-edited", {
          messageId, chatId, newText: message.text, editedAt: message.editedAt,
        });
      } catch (err) {
        console.error("[EDIT-MSG ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ DELETE MESSAGE — delete for everyone OR delete for me
    // ─────────────────────────────────────────────────────────────────────────
    socket.on("delete-message", async ({ messageId, chatId, deleteForEveryone }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (deleteForEveryone) {
          // Sirf sender delete for everyone kar sakta hai
          if (String(message.sender) !== userId) {
            return socket.emit("message-error", { message: "Sirf apna message delete kar sakte ho" });
          }

          message.text = "This message was deleted";
          message.deleted = true;
          message.mediaUrl = null;
          message.mediaType = null;
          message.mediaName = null;
          await message.save();

          io.to(`chat:${chatId}`).emit("message-deleted", {
            messageId,
            deleteForEveryone: true,
          });

          const chat = await Chat.findById(chatId);
          if (chat) {
            const deletedMsg = { _id: String(message._id), text: message.text, deleted: true };
            chat.participants.map((p) => String(p)).forEach((pid) => {
              io.to(`user:${pid}`).emit("chat-updated", {
                chatId, lastMessage: deletedMsg,
                lastMessageAt: message.createdAt, incrementUnread: false,
              });
            });
          }
        } else {
          // ✅ Delete for me — sirf is user ke liye hide karo
          await Message.updateOne(
            { _id: messageId },
            { $addToSet: { deletedFor: userId } }
          );

          // Sirf is socket ko notify karo
          socket.emit("message-hidden", { messageId, chatId });
        }
      } catch (err) {
        console.error("[DELETE-MSG ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────────────────────────────────────
    // ✅ REACT TO MESSAGE
    // emoji: "❤️" | "😂" | "👍" | "😮" | "😢" | "🔥" | null (remove)
    // ─────────────────────────────────────────────────────────────────────────
    socket.on("react-message", async ({ messageId, chatId, emoji }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message || message.deleted) return;

        if (emoji) {
          message.reactions.set(userId, emoji);
        } else {
          message.reactions.delete(userId);
        }
        await message.save();

        const reactionsObj = Object.fromEntries(message.reactions);

        io.to(`chat:${chatId}`).emit("message-reaction", {
          messageId,
          chatId,
          reactions: reactionsObj,
          userId,
          emoji: emoji || null,
        });
      } catch (err) {
        console.error("[REACT-MSG ERROR]", err.message);
      }
    });

    // MARK READ
    socket.on("mark-read", async ({ chatId, messageId }) => {
      try {
        if (!messageId) return;
        const message = await Message.findById(messageId);
        if (!message) return;
        if (String(message.sender) === userId) return;
        if (message.status === "seen") return;

        message.status = "seen";
        await message.save();

        io.to(`user:${String(message.sender)}`).emit("messages-read", {
          chatId, messageIds: [String(messageId)], msgStatus: "seen",
        });
      } catch (err) {
        console.error("[MARK-READ ERROR]", err.message);
      }
    });

    // TYPING
    socket.on("typing", ({ chatId }) => { socket.to(`chat:${chatId}`).emit("typing", { userId }); });
    socket.on("stop-typing", ({ chatId }) => { socket.to(`chat:${chatId}`).emit("stop-typing", { userId }); });

    // DISCONNECT
    socket.on("disconnect", async () => {
      const sockets = OnlineUsers.get(userId);
      if (!(sockets instanceof Set)) { OnlineUsers.delete(userId); return; }

      sockets.delete(socket.id);
      if (sockets.size === 0) {
        OnlineUsers.delete(userId);
        const lastSeen = new Date();
        try {
          await User.findByIdAndUpdate(userId, { lastSeen });
          socket.broadcast.emit("user-offline", { userId, lastSeen });
          console.log(`[OFFLINE] userId: "${userId}" | lastSeen: ${lastSeen}`);
        } catch (err) {
          console.error("[LAST SEEN ERROR]", err.message);
        }
      }
    });
  });

  return io;
};

module.exports = initializeSocket;
module.exports.OnlineUsers = OnlineUsers;