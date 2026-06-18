// /src/hbs/chat/model/message.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
      required: true,
    },
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },

    // Reply to message
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // Edit
    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    // Media
    mediaUrl:  { type: String, default: null },
    mediaType: { type: String, enum: ["image", "video", "document", null], default: null },
    mediaName: { type: String, default: null },

    // Status
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    // Delete for everyone
    deleted: { type: Boolean, default: false },

    // ✅ NEW: Delete for me — userId list jo is message ko nahi dekhna chahte
    deletedFor: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // ✅ NEW: Reactions — { userId: emoji }
    reactions: {
      type: Map,
      of: String, // userId -> emoji (e.g. "❤️", "😂", "👍")
      default: {},
    },
  },
  { timestamps: true }
);

const Message = HBS_DB.models.Message || HBS_DB.model("Message", MessageSchema);

module.exports = { Message };