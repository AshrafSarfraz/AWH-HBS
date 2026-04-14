// /src/hbs/chat/chatSocket.js
const { Chat } = require("./model/chat");
const { Message } = require("./model/message");
const { Server } = require("socket.io");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const sendFCMMessage = require("./sendFCMMessage");
const Device = require("./model/device");
const { Block } = require("./model/block");
const { isRateLimited } = require("../utils/socketratelimiter"); // ✅ NEW

// userId -> Set(socketIds)
const OnlineUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  // ─────────────────────────────────────────
  // AUTH MIDDLEWARE
  // ─────────────────────────────────────────

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

  // ─────────────────────────────────────────
  // CONNECTION
  // ─────────────────────────────────────────

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

    // ─────────────────────────────────────────
    // ON CONNECT: Mark pending messages as delivered
    // ─────────────────────────────────────────

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

    // ─────────────────────────────────────────
    // JOIN CHAT
    // ─────────────────────────────────────────

    socket.on("join-chat", async (chatId) => {
      socket.join(`chat:${chatId}`);

      try {
        const unreadMessages = await Message.find({
          chat: chatId,
          sender: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
        }).select("_id sender");

        if (unreadMessages.length > 0) {
          const messageIds = unreadMessages.map((m) => m._id);
          await Message.updateMany({ _id: { $in: messageIds } }, { status: "seen" });

          // ✅ NEW: Unread count reset karo
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
              chatId,
              messageIds: ids,
              msgStatus: "seen",
            });
          }
        }
      } catch (err) {
        console.error("[JOIN-CHAT ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────
    // LEAVE CHAT
    // ─────────────────────────────────────────

    socket.on("leave-chat", (chatId) => {
      socket.leave(`chat:${chatId}`);
    });

    // ─────────────────────────────────────────
    // SEND MESSAGE
    // ✅ NEW: replyTo, media, rate limit, length check, unread count, mute check
    // ─────────────────────────────────────────

    socket.on("send-message", async ({ chatId, text, tempId, replyTo, mediaUrl, mediaType, mediaName }) => {
      try {
        // ✅ NEW: Rate limiting — 30 messages per minute per user
        if (isRateLimited(userId, 30, 60000)) {
          return socket.emit("message-error", {
            tempId,
            message: "Aap bahut tezi se messages bhej rahe hain. Thodi der ruko.",
          });
        }

        const trimmedText = text?.trim() || "";

        // ✅ NEW: Text ya media mein se kuch ek hona chahiye
        if (!trimmedText && !mediaUrl) return;

        // ✅ NEW: Max 1000 characters
        if (trimmedText.length > 1000) {
          return socket.emit("message-error", {
            tempId,
            message: "Message bahut lamba hai (max 1000 characters).",
          });
        }

        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          return socket.emit("message-status", { tempId, status: "failed" });
        }

        const otherUserId = chat.participants
          .map((p) => String(p))
          .find((id) => id !== userId);

        // Block check
        const blockExists = await Block.findOne({
          $or: [
            { blocker: userId, blocked: otherUserId },
            { blocker: otherUserId, blocked: userId },
          ],
        });

        if (blockExists) {
          return socket.emit("message-status", { tempId, status: "failed", reason: "blocked" });
        }

        const isOnline = OnlineUsers.has(otherUserId) && OnlineUsers.get(otherUserId).size > 0;
        const msgStatus = isOnline ? "delivered" : "sent";

        // ✅ NEW: replyTo validate karo — same chat ka message hona chahiye
        let replyToId = null;
        if (replyTo) {
          const replyMsg = await Message.findById(replyTo).select("_id chat");
          if (replyMsg && String(replyMsg.chat) === chatId) {
            replyToId = replyMsg._id;
          }
        }

        const message = await Message.create({
          chat: chatId,
          sender: userId,
          text: trimmedText,
          status: msgStatus,
          replyTo: replyToId,
          mediaUrl: mediaUrl || null,
          mediaType: mediaType || null,
          mediaName: mediaName || null,
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        await chat.save();

        await message.populate("sender", "name email");
        await message.populate({
          path: "replyTo",
          select: "text sender mediaType deleted",
          populate: { path: "sender", select: "name" },
        });

        // Chat restore karo agar kisi ne delete ki thi
        await Chat.updateOne(
          { _id: chatId },
          { $pull: { deletedFor: { $in: chat.participants } } }
        );

        // ✅ NEW: Receiver ka unread count increment karo
        await Chat.updateOne(
          { _id: chatId },
          { $inc: { [`unreadCount.${otherUserId}`]: 1 } }
        );

        const formattedMessage = {
          _id: String(message._id),
          text: message.text,
          createdAt: message.createdAt,
          status: msgStatus,
          sender: { _id: String(message.sender._id), name: message.sender.name },
          replyTo: message.replyTo || null,
          mediaUrl: message.mediaUrl || null,
          mediaType: message.mediaType || null,
          mediaName: message.mediaName || null,
          tempId,
        };

        socket.to(`chat:${chatId}`).emit("receive-message", formattedMessage);

        socket.emit("message-status", {
          tempId,
          status: "sent",
          message: formattedMessage,
          msgStatus,
        });

        io.to(`user:${userId}`).emit("chat-updated", {
          chatId,
          lastMessage: formattedMessage,
          lastMessageAt: message.createdAt,
          incrementUnread: false,
          unreadCount: 0,
        });

        // ✅ NEW: Exact unread count receiver ko bhejo
        const updatedChat = await Chat.findById(chatId).select("unreadCount");
        const receiverUnread = updatedChat?.unreadCount?.get(otherUserId) || 1;

        io.to(`user:${otherUserId}`).emit("chat-updated", {
          chatId,
          lastMessage: formattedMessage,
          lastMessageAt: message.createdAt,
          incrementUnread: true,
          unreadCount: receiverUnread,
        });

        // ✅ FIX + NEW: Push notification with mute check
        if (!isOnline) {
          try {
            // ✅ NEW: Mute check
            const chatForMute = await Chat.findById(chatId).select("mutedBy");
            const isMuted = chatForMute?.mutedBy?.some((id) => String(id) === otherUserId);

            if (!isMuted) {
              // ✅ FIX: Sahi field names
              const devices = await Device.find({ userId: otherUserId });
              const tokens = devices.map((d) => d.token).filter(Boolean);

              for (const deviceToken of tokens) {
                await sendFCMMessage({
                  to: deviceToken,
                  title: message.sender.name || "New Message",
                  body: message.mediaUrl
                    ? `📎 ${message.mediaType === "image" ? "Photo" : message.mediaType === "video" ? "Video" : "Document"}`
                    : message.text,
                  data: { chatId, senderId: userId },
                });
              }

              if (tokens.length > 0) {
                console.log(`[FCM] Sent to ${tokens.length} device(s) of "${otherUserId}"`);
              }
            } else {
              console.log(`[FCM] Skipped — muted for "${otherUserId}"`);
            }
          } catch (fcmErr) {
            console.error("[FCM ERROR]", fcmErr.message);
          }
        }
      } catch (err) {
        console.error("[SEND-MSG ERROR]", err.message);
        socket.emit("message-status", { tempId, status: "failed" });
      }
    });

    // ─────────────────────────────────────────
    // ✅ NEW: EDIT MESSAGE
    // ─────────────────────────────────────────

    socket.on("edit-message", async ({ messageId, chatId, newText }) => {
      try {
        if (!newText?.trim()) {
          return socket.emit("message-error", { message: "Empty text se edit nahi ho sakta" });
        }

        if (newText.length > 1000) {
          return socket.emit("message-error", { message: "Message bahut lamba hai (max 1000 characters)" });
        }

        const message = await Message.findById(messageId);
        if (!message) return;

        if (String(message.sender) !== userId) {
          return socket.emit("message-error", { message: "Sirf apna message edit kar sakte ho" });
        }

        if (message.deleted) {
          return socket.emit("message-error", { message: "Deleted message edit nahi ho sakta" });
        }

        if (message.mediaUrl) {
          return socket.emit("message-error", { message: "Media message edit nahi ho sakta" });
        }

        message.text = newText.trim();
        message.edited = true;
        message.editedAt = new Date();
        await message.save();

        console.log(`[EDIT-MSG] Message "${messageId}" edited by "${userId}"`);

        io.to(`chat:${chatId}`).emit("message-edited", {
          messageId,
          chatId,
          newText: message.text,
          editedAt: message.editedAt,
        });
      } catch (err) {
        console.error("[EDIT-MSG ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────
    // MARK READ (single message)
    // ─────────────────────────────────────────

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
          chatId,
          messageIds: [String(messageId)],
          msgStatus: "seen",
        });
      } catch (err) {
        console.error("[MARK-READ ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────
    // DELETE MESSAGE
    // ─────────────────────────────────────────

    socket.on("delete-message", async ({ messageId, chatId }) => {
      try {
        const message = await Message.findById(messageId);
        if (!message) return;

        if (String(message.sender) !== userId) {
          return socket.emit("message-error", { message: "Sirf apna message delete kar sakte ho" });
        }

        message.text = "This message was deleted";
        message.deleted = true;
        message.mediaUrl = null;
        message.mediaType = null;
        await message.save();

        io.to(`chat:${chatId}`).emit("message-deleted", { messageId });

        const chat = await Chat.findById(chatId);
        if (chat) {
          const deletedMsg = { _id: String(message._id), text: message.text, deleted: true };
          chat.participants.map((p) => String(p)).forEach((pid) => {
            io.to(`user:${pid}`).emit("chat-updated", {
              chatId,
              lastMessage: deletedMsg,
              lastMessageAt: message.createdAt,
              incrementUnread: false,
            });
          });
        }
      } catch (err) {
        console.error("[DELETE-MSG ERROR]", err.message);
      }
    });

    // ─────────────────────────────────────────
    // TYPING
    // ─────────────────────────────────────────

    socket.on("typing", ({ chatId, userId: typingUserId }) => {
      socket.to(`chat:${chatId}`).emit("typing", { userId: typingUserId });
    });

    socket.on("stop-typing", ({ chatId, userId: typingUserId }) => {
      socket.to(`chat:${chatId}`).emit("stop-typing", { userId: typingUserId });
    });

    // ─────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────

    socket.on("disconnect", async () => {
      const sockets = OnlineUsers.get(userId);

      if (!(sockets instanceof Set)) {
        OnlineUsers.delete(userId);
        return;
      }

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












// // /src/hbs/chat/chatSocket.js
// const { Chat } = require("./model/chat");
// const { Message } = require("./model/message");
// const { Server } = require("socket.io");
// const User = require("../models/User");
// const jwt = require("jsonwebtoken");
// const sendFCMMessage = require("./sendFCMMessage");
// const Device = require("./model/device");
// const { Block } = require("./model/block");

// // userId -> Set(socketIds)
// const OnlineUsers = new Map();

// const initializeSocket = (server) => {
//   const io = new Server(server, {
//     cors: {
//       origin: "*",
//       methods: ["GET", "POST"],
//     },
//   });

//   // ─────────────────────────────────────────
//   // AUTH MIDDLEWARE
//   // ─────────────────────────────────────────

//   io.use((socket, next) => {
//     try {
//       const token = socket.handshake.auth?.token;
//       if (!token) return next(new Error("Unauthorized"));
//       const decoded = jwt.verify(token, process.env.JWT_SECRET);
//       socket.userId = String(decoded.id || decoded._id || "");
//       if (!socket.userId) return next(new Error("Unauthorized: no userId in token"));
//       console.log(`[AUTH] Token decoded. userId: "${socket.userId}"`);
//       next();
//     } catch (err) {
//       console.error("[AUTH ERROR]", err.message);
//       next(new Error("Unauthorized"));
//     }
//   });

//   // ─────────────────────────────────────────
//   // CONNECTION
//   // ─────────────────────────────────────────

//   io.on("connection", async (socket) => {
//     const userId = socket.userId;

//     if (!OnlineUsers.has(userId)) {
//       OnlineUsers.set(userId, new Set());
//     }
//     OnlineUsers.get(userId).add(socket.id);

//     socket.join(`user:${userId}`);

//     console.log(`[CONNECT] userId: "${userId}" | socketId: "${socket.id}"`);
//     console.log(`[CONNECT] OnlineUsers now:`, [...OnlineUsers.keys()]);

//     socket.broadcast.emit("user-online", { userId });
//     socket.emit("online-users", Array.from(OnlineUsers.keys()));

//     socket.on("request-online-sync", () => {
//       socket.emit("online-users", Array.from(OnlineUsers.keys()));
//     });

//     // ─────────────────────────────────────────
//     // ON CONNECT: Mark pending messages as delivered
//     // ─────────────────────────────────────────

//     try {
//       const userChats = await Chat.find({ participants: userId }).select("_id");
//       const chatIds = userChats.map((c) => c._id);

//       const undelivered = await Message.find({
//         chat: { $in: chatIds },
//         sender: { $ne: userId },
//         status: "sent",
//       }).select("_id sender chat");

//       if (undelivered.length > 0) {
//         const ids = undelivered.map((m) => m._id);
//         await Message.updateMany({ _id: { $in: ids } }, { status: "delivered" });

//         const grouped = undelivered.reduce((acc, m) => {
//           const sid = String(m.sender);
//           if (!acc[sid]) acc[sid] = { chatId: String(m.chat), ids: [] };
//           acc[sid].ids.push(String(m._id));
//           return acc;
//         }, {});

//         for (const [senderId, data] of Object.entries(grouped)) {
//           console.log(`[CONNECT] ${data.ids.length} msg(s) delivered for sender "${senderId}"`);
//           io.to(`user:${senderId}`).emit("messages-read", {
//             chatId: data.chatId,
//             messageIds: data.ids,
//             msgStatus: "delivered",
//           });
//         }
//       }
//     } catch (err) {
//       console.error("[CONNECT-DELIVER ERROR]", err.message);
//     }

//     // ─────────────────────────────────────────
//     // JOIN CHAT
//     // ─────────────────────────────────────────

//     socket.on("join-chat", async (chatId) => {
//       socket.join(`chat:${chatId}`);
//       console.log(`[JOIN-CHAT] userId: "${userId}" joined chatId: "${chatId}"`);

//       try {
//         const unreadMessages = await Message.find({
//           chat: chatId,
//           sender: { $ne: userId },
//           status: { $in: ["sent", "delivered"] },
//         }).select("_id sender");

//         if (!unreadMessages.length) return;

//         const messageIds = unreadMessages.map((m) => m._id);
//         await Message.updateMany({ _id: { $in: messageIds } }, { status: "seen" });

//         const grouped = unreadMessages.reduce((acc, m) => {
//           const sid = String(m.sender);
//           if (!acc[sid]) acc[sid] = [];
//           acc[sid].push(String(m._id));
//           return acc;
//         }, {});

//         for (const [senderId, ids] of Object.entries(grouped)) {
//           console.log(`[JOIN-CHAT] Notifying "${senderId}" — ${ids.length} msg(s) seen`);
//           io.to(`user:${senderId}`).emit("messages-read", {
//             chatId,
//             messageIds: ids,
//             msgStatus: "seen",
//           });
//         }
//       } catch (err) {
//         console.error("[JOIN-CHAT ERROR]", err.message);
//       }
//     });

//     // ─────────────────────────────────────────
//     // LEAVE CHAT
//     // ─────────────────────────────────────────

//     socket.on("leave-chat", (chatId) => {
//       socket.leave(`chat:${chatId}`);
//       console.log(`[LEAVE-CHAT] userId: "${userId}" left chatId: "${chatId}"`);
//     });

//     // ─────────────────────────────────────────
//     // SEND MESSAGE
//     // ─────────────────────────────────────────

//     socket.on("send-message", async ({ chatId, text, tempId }) => {
//       try {
//         if (!text || !text.trim()) {
//           console.log(`[SEND-MSG] Empty text from "${userId}", ignoring.`);
//           return;
//         }

//         const chat = await Chat.findOne({ _id: chatId, participants: userId });
//         if (!chat) {
//           console.log(`[SEND-MSG] Chat "${chatId}" not found for user "${userId}"`);
//           return socket.emit("message-status", { tempId, status: "failed" });
//         }

//         const otherUserId = chat.participants
//           .map((p) => String(p))
//           .find((id) => id !== userId);

//         console.log(`[SEND-MSG] sender: "${userId}" | otherUserId: "${otherUserId}"`);

//         const blockExists = await Block.findOne({
//           $or: [
//             { blocker: userId, blocked: otherUserId },
//             { blocker: otherUserId, blocked: userId },
//           ],
//         });

//         if (blockExists) {
//           console.log(`[SEND-MSG] Block found between "${userId}" and "${otherUserId}"`);
//           return socket.emit("message-status", {
//             tempId,
//             status: "failed",
//             reason: "blocked",
//           });
//         }

//         const isOnline =
//           OnlineUsers.has(otherUserId) &&
//           OnlineUsers.get(otherUserId).size > 0;

//         const msgStatus = isOnline ? "delivered" : "sent";
//         console.log(`[SEND-MSG] isOnline: ${isOnline} | msgStatus: "${msgStatus}" | tempId: "${tempId}"`);

//         const message = await Message.create({
//           chat: chatId,
//           sender: userId,
//           text: text.trim(),
//           status: msgStatus,
//         });

//         chat.lastMessage = message._id;
//         chat.lastMessageAt = message.createdAt;
//         await chat.save();
//         await message.populate("sender", "name email");

//         // Agar kisi ne bhi chat delete ki thi, restore kar do
//         await Chat.updateOne(
//           { _id: chatId },
//           { $pull: { deletedFor: { $in: chat.participants } } }
//         );

//         const formattedMessage = {
//           _id: String(message._id),
//           text: message.text,
//           createdAt: message.createdAt,
//           status: msgStatus,
//           sender: {
//             _id: String(message.sender._id),
//             name: message.sender.name,
//           },
//           tempId,
//         };

//         socket.to(`chat:${chatId}`).emit("receive-message", formattedMessage);

//         const statusPayload = {
//           tempId,
//           status: "sent",
//           message: formattedMessage,
//           msgStatus,
//         };
//         console.log(`[SEND-MSG] Emitting message-status:`, JSON.stringify(statusPayload));
//         socket.emit("message-status", statusPayload);

//         io.to(`user:${userId}`).emit("chat-updated", {
//           chatId,
//           lastMessage: formattedMessage,
//           lastMessageAt: message.createdAt,
//           incrementUnread: false,
//         });

//         io.to(`user:${otherUserId}`).emit("chat-updated", {
//           chatId,
//           lastMessage: formattedMessage,
//           lastMessageAt: message.createdAt,
//           incrementUnread: true,
//         });

//         console.log(`[SEND-MSG] chat-updated emitted to user:${userId} and user:${otherUserId}`);

//         // ─────────────────────────────────────────
//         // ✅ FIX: Push notification — sahi fields aur sahi function call
//         // ─────────────────────────────────────────
//         if (!isOnline) {
//           try {
//             // ✅ FIX: "userId" field use karo, "user" nahi
//             const devices = await Device.find({ userId: otherUserId });

//             // ✅ FIX: "token" field use karo, "fcmToken" nahi
//             const tokens = devices.map((d) => d.token).filter(Boolean);

//             if (tokens.length > 0) {
//               // ✅ FIX: Har device ke liye alag call, sahi object format mein
//               for (const deviceToken of tokens) {
//                 await sendFCMMessage({
//                   to: deviceToken,
//                   title: message.sender.name || "New Message",
//                   body: message.text,
//                   data: { chatId, senderId: userId },
//                 });
//               }
//               console.log(`[FCM] Sent push to ${tokens.length} device(s) of "${otherUserId}"`);
//             }
//           } catch (fcmErr) {
//             console.error("[FCM ERROR]", fcmErr.message);
//           }
//         }
//       } catch (err) {
//         console.error("[SEND-MSG ERROR]", err.message);
//         socket.emit("message-status", { tempId, status: "failed" });
//       }
//     });

//     // ─────────────────────────────────────────
//     // MARK READ
//     // ─────────────────────────────────────────

//     socket.on("mark-read", async ({ chatId, messageId }) => {
//       try {
//         if (!messageId) return;

//         const message = await Message.findById(messageId);
//         if (!message) {
//           console.log(`[MARK-READ] Message "${messageId}" not found`);
//           return;
//         }

//         if (String(message.sender) === userId) return;
//         if (message.status === "seen") return;

//         message.status = "seen";
//         await message.save();

//         const senderId = String(message.sender);
//         const payload = {
//           chatId,
//           messageIds: [String(messageId)],
//           msgStatus: "seen",
//         };

//         console.log(`[MARK-READ] "${messageId}" seen. Notifying sender: "${senderId}"`);
//         io.to(`user:${senderId}`).emit("messages-read", payload);
//       } catch (err) {
//         console.error("[MARK-READ ERROR]", err.message);
//       }
//     });

//     // ─────────────────────────────────────────
//     // DELETE MESSAGE
//     // ─────────────────────────────────────────

//     socket.on("delete-message", async ({ messageId, chatId }) => {
//       try {
//         const message = await Message.findById(messageId);
//         if (!message) {
//           console.log(`[DELETE-MSG] Message "${messageId}" not found`);
//           return;
//         }

//         if (String(message.sender) !== userId) {
//           console.log(`[DELETE-MSG] Unauthorized delete by "${userId}"`);
//           return;
//         }

//         message.text = "This message was deleted";
//         message.deleted = true;
//         await message.save();

//         console.log(`[DELETE-MSG] Message "${messageId}" deleted by "${userId}"`);
//         io.to(`chat:${chatId}`).emit("message-deleted", { messageId });

//         const chat = await Chat.findById(chatId);
//         if (chat) {
//           const deletedFormattedMessage = {
//             _id: String(message._id),
//             text: message.text,
//             deleted: true,
//           };

//           chat.participants
//             .map((p) => String(p))
//             .forEach((pid) => {
//               io.to(`user:${pid}`).emit("chat-updated", {
//                 chatId,
//                 lastMessage: deletedFormattedMessage,
//                 lastMessageAt: message.createdAt,
//                 incrementUnread: false,
//               });
//             });
//         }
//       } catch (err) {
//         console.error("[DELETE-MSG ERROR]", err.message);
//       }
//     });

//     // ─────────────────────────────────────────
//     // TYPING
//     // ─────────────────────────────────────────

//     socket.on("typing", ({ chatId, userId: typingUserId }) => {
//       console.log(`[TYPING] "${typingUserId}" typing in chat "${chatId}"`);
//       socket.to(`chat:${chatId}`).emit("typing", { userId: typingUserId });
//     });

//     socket.on("stop-typing", ({ chatId, userId: typingUserId }) => {
//       console.log(`[STOP-TYPING] "${typingUserId}" stopped in chat "${chatId}"`);
//       socket.to(`chat:${chatId}`).emit("stop-typing", { userId: typingUserId });
//     });

//     // ─────────────────────────────────────────
//     // DISCONNECT
//     // ─────────────────────────────────────────

//     socket.on("disconnect", async () => {
//       const sockets = OnlineUsers.get(userId);

//       if (!(sockets instanceof Set)) {
//         OnlineUsers.delete(userId);
//         return;
//       }

//       sockets.delete(socket.id);

//       if (sockets.size === 0) {
//         OnlineUsers.delete(userId);

//         const lastSeen = new Date();

//         try {
//           await User.findByIdAndUpdate(userId, { lastSeen });

//           socket.broadcast.emit("user-offline", {
//             userId,
//             lastSeen,
//           });

//           console.log(`[OFFLINE] userId: "${userId}" | lastSeen: ${lastSeen}`);
//         } catch (err) {
//           console.error("[LAST SEEN ERROR]", err.message);
//         }
//       } else {
//         console.log(`[DISCONNECT] userId: "${userId}" still has ${sockets.size} socket(s) active`);
//       }
//     });
//   });

//   return io;
// };

// module.exports = initializeSocket;
// module.exports.OnlineUsers = OnlineUsers;

