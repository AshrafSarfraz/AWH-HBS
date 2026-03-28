// /src/hbs/chat/chatSocket.js
const { Chat } = require("./chat");
const { Message } = require("./message");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const sendFCMMessage = require("../Notifications/sendFCMMessage");
const Device = require("./device");

const OnlineUsers = new Map();

const initializeSocket = (server) => {

  const io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  // ---------------- AUTH ----------------

  io.use((socket, next) => {

    try {

      const token = socket.handshake.auth?.token;

      if (!token) return next(new Error("Unauthorized"));

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      socket.userId = decoded.id || decoded._id;

      next();

    } catch {

      next(new Error("Unauthorized"));

    }

  });

  // ---------------- CONNECTION ----------------

  io.on("connection", (socket) => {

    const userId = socket.userId;

    OnlineUsers.set(userId, socket.id);

    socket.join(`user:${userId}`);

    socket.broadcast.emit("user-online", { userId });

    // ---------------- JOIN CHAT ----------------

    socket.on("join-chat", (chatId) => {

      socket.join(`chat:${chatId}`);

    });

    socket.on("leave-chat", (chatId) => {

      socket.leave(`chat:${chatId}`);

    });

    // ---------------- SEND MESSAGE ----------------

    socket.on("send-message", async ({ chatId, text, tempId }) => {

      try {

        if (!text || !text.trim()) return;

        const chat = await Chat.findOne({
          _id: chatId,
          participants: userId
        });

        if (!chat) {

          return socket.emit("message-status", {
            tempId,
            status: "failed",
            reason: "Chat not found"
          });

        }

        // SAVE MESSAGE

        const message = await Message.create({
          chat: chatId,
          sender: userId,
          text: text.trim()
        });

        chat.lastMessage = message._id;
        chat.lastMessageAt = message.createdAt;

        await chat.save();

        await message.populate("sender", "name email");

        // REMOVE BOTH USERS FROM deletedFor (IMPORTANT)
// REMOVE BOTH USERS FROM deletedFor (IMPORTANT)
await Chat.updateOne(
  { _id: chatId },
  { $pull: { deletedFor: { $in: chat.participants } } }
);

        const formattedMessage = {

          _id: message._id,

          text: message.text,

          createdAt: message.createdAt,

          sender: {
            _id: message.sender._id,
            name: message.sender.name
          }

        };

        // SEND TO OTHER USER

        socket.to(`chat:${chatId}`).emit(
          "receive-message",
          formattedMessage
        );

        // UPDATE CHAT LIST

        io.to(`chat:${chatId}`).emit(
          "chat-updated",
          {
            chatId,
            lastMessage: formattedMessage,
            lastMessageAt: message.createdAt
          }
        );

        // CONFIRM TO SENDER

        socket.emit(
          "message-status",
          {
            tempId,
            status: "sent",
            message: formattedMessage
          }
        );

        // ---------------- PUSH NOTIFICATION ----------------

        const participants = chat.participants
          .map(p => p.toString())
          .filter(id => id !== userId);

          console.log("📩 SENDING NOTIFICATION TO:", participants);

        for (const pid of participants) {

          const devices = await Device.find({ userId: pid });

          console.log("📱 DEVICES:", devices);

          // duplicate tokens remove karo
const uniqueTokens = [
  ...new Set(devices.map(d => d.token))
];

for (const token of uniqueTokens) {

  if (!token) continue;

  await sendFCMMessage({
    to: token,
    title: `New message from ${formattedMessage.sender.name}`,
    body: formattedMessage.text,
    data: {
      screen: "ChatScreen",
      chatId
    }
  });
}

        }

      } catch (err) {

        console.error("[ERROR] send-message:", err?.message || err);

        socket.emit(
          "message-status",
          {
            tempId,
            status: "failed",
            reason: "Something went wrong"
          }
        );

      }

    });

    // ---------------- DISCONNECT ----------------

    socket.on("disconnect", () => {

      OnlineUsers.delete(userId);

      socket.broadcast.emit("user-offline", { userId });

    });

    // --------------- delete Message  ----------------

    socket.on("delete-message", async ({ messageId, chatId }) => {
  try {
    const message = await Message.findById(messageId);

    if (!message) return;

    // only sender can delete
    if (message.sender.toString() !== userId) return;

    message.text = "This message was deleted";
    message.deleted = true;

    await message.save();

    const updatedMessage = {
      _id: message._id,
      text: message.text,
      deleted: true,
      createdAt: message.createdAt,
      sender: {
        _id: userId
      }
    };

    // send to all users in chat
    const participants = chat.participants.map(p => p.toString());

participants.forEach(pid => {
  io.to(`user:${pid}`).emit("chat-updated", {
    chatId,
    lastMessage: formattedMessage,
    lastMessageAt: message.createdAt,
    participants: chat.participants,
  });
});

  } catch (err) {
    console.error("delete-message error:", err.message);
  }
});

  });

  return io;

};

module.exports = initializeSocket;
module.exports.OnlineUsers = OnlineUsers;