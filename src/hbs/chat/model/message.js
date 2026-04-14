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

    // ✅ NEW: Reply to message
    replyTo: {
      type: Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    // ✅ NEW: Edit message
    edited: {
      type: Boolean,
      default: false,
    },
    editedAt: {
      type: Date,
      default: null,
    },

    // ✅ NEW: Media support (image, video, document)
    mediaUrl: {
      type: String,
      default: null,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "document", null],
      default: null,
    },
    mediaName: {
      type: String,
      default: null, // original file name (documents ke liye)
    },

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    deleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message =
  HBS_DB.models.Message || HBS_DB.model("Message", MessageSchema);

module.exports = { Message };