// /src/hbs/chat/chatSocket.js
const { Chat } = require("./chat");
const { Message } = require("./message");
const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const OnlineUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});
  // JWT auth for socket
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id || decoded._id;
      next();
    } catch (err) {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;
    OnlineUsers.set(userId, socket.id);
    socket.join(`user:${userId}`);
    socket.broadcast.emit("user-online", { userId });

    // join chat room
    socket.on("join-chat", (chatId) => socket.join(`chat:${chatId}`));
    socket.on("leave-chat", (chatId) => socket.leave(`chat:${chatId}`));

    // send message
    socket.on("send-message", async ({ chatId, text }) => {
  try {
    if (!text || text.trim().length === 0) return;

    const chat = await Chat.findOne({ _id: chatId, participants: userId });
    if (!chat)
      return socket.emit("socket-error", { message: "Chat not found" });

    const message = await Message.create({
      chat: chatId,
      sender: userId,
      text: text.trim(),
    });

    chat.lastMessage = message._id;
    chat.lastMessageAt = new Date();
    await chat.save();

    await message.populate("sender", "name email");

    // ✅ ONLY THIS LINE
    io.to(`chat:${chatId}`).emit("new-message", message);

  } catch (err) {
    socket.emit("socket-error", { message: "Something went wrong" });
  }
});

    // mark message seen
    socket.on("mark-seen", async (messageId) => {
  const msg = await Message.findByIdAndUpdate(
    messageId,
    { status: "seen" },
    { new: true }
  );

  if (!msg) return;

  io.to(`chat:${msg.chat}`).emit("message-seen", { messageId });
});

    socket.on("typing", (chatId) => socket.to(`chat:${chatId}`).emit("user-typing", { userId }));

    socket.on("disconnect", () => {
      OnlineUsers.delete(userId);
      socket.broadcast.emit("user-offline", { userId });
    });
  });

  return io;
};

module.exports = initializeSocket;
module.exports.OnlineUsers = OnlineUsers;


