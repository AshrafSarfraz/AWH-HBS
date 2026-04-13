// /src/hbs/chat/chatSocket.js
const { Chat } = require("./chat");
const { Message } = require("./message");
const { Server } = require("socket.io");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const sendFCMMessage = require("../Notifications/sendFCMMessage");
const Device = require("./device");
const { Block } = require("./block");

const OnlineUsers = new Map(); 
// userId -> Set(socketId)

const initializeSocket = (server) => {

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
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
      console.log(`[AUTH] Token decoded. userId: "${socket.userId}"`);
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
if (!OnlineUsers.has(userId)) {
  OnlineUsers.set(userId, new Set());
}

OnlineUsers.get(userId).add(socket.id);
    socket.join(`user:${userId}`);
    socket.broadcast.emit("user-online", { userId });

    // Update user's lastSeen to null (indicating online)
    OnlineUsers.set(userId, socket.id);

  setTimeout(() => {
  socket.emit("online-users", Array.from(OnlineUsers.keys()));
}, 300);

  io.to(`user:${userId}`).emit("user-online", {
    userId,
  });

    console.log(`[CONNECT] userId: "${userId}" | socketId: "${socket.id}"`);
    console.log(`[CONNECT] OnlineUsers now:`, [...OnlineUsers.keys()]);

    // ─────────────────────────────────────────
    // ON CONNECT: Mark pending messages as delivered
    // ─────────────────────────────────────────

    try {
      const userChats = await Chat.find({ participants: userId }).select("_id");
      const chatIds = userChats.map(c => c._id);

      const undelivered = await Message.find({
        chat: { $in: chatIds },
        sender: { $ne: userId },
        status: "sent",
      }).select("_id sender chat");

      if (undelivered.length > 0) {
        const ids = undelivered.map(m => m._id);
        await Message.updateMany({ _id: { $in: ids } }, { status: "delivered" });

        const grouped = undelivered.reduce((acc, m) => {
          const sid = String(m.sender);
          if (!acc[sid]) acc[sid] = { chatId: String(m.chat), ids: [] };
          acc[sid].ids.push(String(m._id));
          return acc;
        }, {});

        for (const [senderId, data] of Object.entries(grouped)) {
          console.log(`[CONNECT] ${data.ids.length} msg(s) delivered for sender "${senderId}"`);
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


    // Send currently online users to new user
socket.emit("online-users", Array.from(OnlineUsers.keys()));
socket.on("request-online-sync", () => {
  socket.emit("online-users", Array.from(OnlineUsers.keys()));
});


    // ─────────────────────────────────────────
    // JOIN CHAT
    // ─────────────────────────────────────────

    socket.on("join-chat", async (chatId) => {
      socket.join(`chat:${chatId}`);
      console.log(`[JOIN-CHAT] userId: "${userId}" joined chatId: "${chatId}"`);
      console.log(`[JOIN-CHAT] OnlineUsers:`, [...OnlineUsers.keys()]);

      try {
        const unreadMessages = await Message.find({
          chat: chatId,
          sender: { $ne: userId },
          status: { $in: ["sent", "delivered"] },
        }).select("_id sender");

        if (!unreadMessages.length) return;

        const messageIds = unreadMessages.map(m => m._id);
        await Message.updateMany({ _id: { $in: messageIds } }, { status: "seen" });

        const grouped = unreadMessages.reduce((acc, m) => {
          const sid = String(m.sender);
          if (!acc[sid]) acc[sid] = [];
          acc[sid].push(String(m._id));
          return acc;
        }, {});

        for (const [senderId, ids] of Object.entries(grouped)) {
          console.log(`[JOIN-CHAT] Notifying "${senderId}" — ${ids.length} msg(s) seen`);
          io.to(`user:${senderId}`).emit("messages-read", {
            chatId,
            messageIds: ids,
            msgStatus: "seen",
          });
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
      console.log(`[LEAVE-CHAT] userId: "${userId}" left chatId: "${chatId}"`);
    });

    // ─────────────────────────────────────────
    // SEND MESSAGE
    // ─────────────────────────────────────────

    socket.on("send-message", async ({ chatId, text, tempId }) => {
      try {
        if (!text || !text.trim()) {
          console.log(`[SEND-MSG] Empty text from "${userId}", ignoring.`);
          return;
        }

        const chat = await Chat.findOne({ _id: chatId, participants: userId });
        if (!chat) {
          console.log(`[SEND-MSG] Chat "${chatId}" not found for user "${userId}"`);
          return socket.emit("message-status", { tempId, status: "failed" });
        }

        const otherUserId = chat.participants
          .map(p => String(p))
          .find(id => id !== userId);

        console.log(`[SEND-MSG] sender: "${userId}" | otherUserId: "${otherUserId}"`);
        console.log(`[SEND-MSG] OnlineUsers.has(otherUserId) →`, OnlineUsers.has(otherUserId));

        const blockExists = await Block.findOne({
          $or: [
            { blocker: userId, blocked: otherUserId },
            { blocker: otherUserId, blocked: userId },
          ]
        });

        if (blockExists) {
          console.log(`[SEND-MSG] Block found between "${userId}" and "${otherUserId}"`);
          return socket.emit("message-status", { tempId, status: "failed", reason: "blocked" });
        }

        const isOnline =
  OnlineUsers.has(otherUserId) &&
  OnlineUsers.get(otherUserId).size > 0;
        const msgStatus = isOnline ? "delivered" : "sent";
        console.log(`[SEND-MSG] isOnline: ${isOnline} | msgStatus: "${msgStatus}" | tempId: "${tempId}"`);

        const message = await Message.create({
          chat: chatId,
          sender: userId,
          text: text.trim(),
          status: msgStatus,
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;
        await chat.save();
        await message.populate("sender", "name email");

        await Chat.updateOne(
          { _id: chatId },
          { $pull: { deletedFor: { $in: chat.participants } } }
        );

        const formattedMessage = {
          _id: String(message._id),
          text: message.text,
          createdAt: message.createdAt,
          status: msgStatus,
          sender: {
            _id: String(message.sender._id),
            name: message.sender.name,
          },
          tempId,
        };

        // ── Send message to receiver in chat room ──
        socket.to(`chat:${chatId}`).emit("receive-message", formattedMessage);

        // ── Confirm to sender (for tick update in chatScreen) ──
        const statusPayload = {
          tempId,
          status: "sent",
          message: formattedMessage,
          msgStatus,
        };
        console.log(`[SEND-MSG] Emitting message-status:`, JSON.stringify(statusPayload));
        socket.emit("message-status", statusPayload);

        // ✅ FIX: Emit chat-updated to each participant's USER room
        // This ensures the conversation list screen receives it
        // even when the user is NOT inside the chat room
        //
        // Sender gets incrementUnread: false (they sent it)
        io.to(`user:${userId}`).emit("chat-updated", {
          chatId,
          lastMessage: formattedMessage,
          lastMessageAt: message.createdAt,
          incrementUnread: false,
        });

        // Receiver gets incrementUnread: true (new unread message)
        io.to(`user:${otherUserId}`).emit("chat-updated", {
          chatId,
          lastMessage: formattedMessage,
          lastMessageAt: message.createdAt,
          incrementUnread: true,
        });

        console.log(`[SEND-MSG] chat-updated emitted to user:${userId} and user:${otherUserId}`);

        // ── Push notification if offline ──
        if (!isOnline) {
          try {
            const devices = await Device.find({ user: otherUserId });
            const tokens = devices.map(d => d.fcmToken).filter(Boolean);
            if (tokens.length > 0) {
              await sendFCMMessage(tokens, {
                title: message.sender.name || "New Message",
                body: message.text,
                data: { chatId, senderId: userId },
              });
              console.log(`[FCM] Sent push to ${tokens.length} device(s) of "${otherUserId}"`);
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
    // MARK READ
    // ─────────────────────────────────────────

    socket.on("mark-read", async ({ chatId, messageId }) => {
      try {
        if (!messageId) return;

        const message = await Message.findById(messageId);
        if (!message) {
          console.log(`[MARK-READ] Message "${messageId}" not found`);
          return;
        }

        if (String(message.sender) === userId) return;
        if (message.status === "seen") return;

        message.status = "seen";
        await message.save();

        const senderId = String(message.sender);
        const payload = {
          chatId,
          messageIds: [String(messageId)],
          msgStatus: "seen",
        };

        console.log(`[MARK-READ] "${messageId}" seen. Notifying sender: "${senderId}"`);
        io.to(`user:${senderId}`).emit("messages-read", payload);

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
        if (!message) {
          console.log(`[DELETE-MSG] Message "${messageId}" not found`);
          return;
        }

        if (String(message.sender) !== userId) {
          console.log(`[DELETE-MSG] Unauthorized delete by "${userId}"`);
          return;
        }

        message.text = "This message was deleted";
        message.deleted = true;
        await message.save();

        console.log(`[DELETE-MSG] Message "${messageId}" deleted by "${userId}"`);
        io.to(`chat:${chatId}`).emit("message-deleted", { messageId });

        const chat = await Chat.findById(chatId);
        if (chat) {
          const deletedFormattedMessage = {
            _id: String(message._id),
            text: message.text,
            deleted: true,
          };

          // ✅ Also emit to user rooms so conversation list updates
          chat.participants.map(p => String(p)).forEach(pid => {
            io.to(`user:${pid}`).emit("chat-updated", {
              chatId,
              lastMessage: deletedFormattedMessage,
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
      console.log(`[TYPING] "${typingUserId}" typing in chat "${chatId}"`);
      socket.to(`chat:${chatId}`).emit("typing", { userId: typingUserId });
    });

    socket.on("stop-typing", ({ chatId, userId: typingUserId }) => {
      console.log(`[STOP-TYPING] "${typingUserId}" stopped in chat "${chatId}"`);
      socket.to(`chat:${chatId}`).emit("stop-typing", { userId: typingUserId });
    });

    // ─────────────────────────────────────────
    // DISCONNECT
    // ─────────────────────────────────────────

    socket.on("disconnect", async () => {
  let sockets = OnlineUsers.get(userId);

  // 🔥 SAFETY FIX (IMPORTANT)
  if (!(sockets instanceof Set)) {
    sockets = new Set();
  }

  if (sockets && sockets instanceof Set) {
    sockets.delete(socket.id);

    if (sockets.size === 0) {
      OnlineUsers.delete(userId);

      const lastSeen = new Date();

      try {
        await User.findByIdAndUpdate(userId, { lastSeen });

        socket.broadcast.emit("user-offline", {
          userId,
          lastSeen,
        });

        console.log(`[OFFLINE] userId: ${userId}`);
      } catch (err) {
        console.error("[LAST SEEN ERROR]", err.message);
      }
    } else {
      OnlineUsers.set(userId, sockets);
    }
  }
});

  });

  return io;
};

module.exports = initializeSocket;
module.exports.OnlineUsers = OnlineUsers;