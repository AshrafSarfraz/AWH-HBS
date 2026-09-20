// src/hbs/chat/model/message.js
//
// KYA BADLA:
//  - Pehle is model par EK BHI INDEX nahi tha. Har chat query poori collection
//    scan karti thi. Yehi chat slow hone ki sabse badi wajah thi.
//  - Media ke liye thumbnailUrl / width / height / size add kiye taake app
//    chat list me halka thumbnail dikha sake, full image tabhi load ho jab
//    user tap kare.

const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");
const { Schema } = mongoose;

const MessageSchema = new Schema(
  {
    chat: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
    sender: { type: Schema.Types.ObjectId, ref: "User", required: true },

    text: { type: String, trim: true, default: "", maxlength: 4000 },

    replyTo: { type: Schema.Types.ObjectId, ref: "Message", default: null },

    edited: { type: Boolean, default: false },
    editedAt: { type: Date, default: null },

    // ── Media ──────────────────────────────────────────────────────────
    mediaUrl: { type: String, default: null },
    thumbnailUrl: { type: String, default: null }, // NEW — chhota preview
    mediaType: {
      type: String,
      enum: ["image", "video", "document", "audio", null],
      default: null,
    },
    mediaName: { type: String, default: null },
    mediaSize: { type: Number, default: null }, // NEW — bytes
    mediaWidth: { type: Number, default: null }, // NEW — aspect ratio ke liye
    mediaHeight: { type: Number, default: null }, // NEW

    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },

    deleted: { type: Boolean, default: false },
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],

    reactions: { type: Map, of: String, default: {} },
  },
  { timestamps: true }
);

// ─────────────────────────────────────────────────────────────────────
// INDEXES — ye sab missing the
// ─────────────────────────────────────────────────────────────────────

// Chat kholte hi messages latest-first aate hain. Sabse zaroori index.
MessageSchema.index({ chat: 1, createdAt: -1 });

// "Is chat me mere liye unread kya hai" — join-chat aur bulkMarkRead
MessageSchema.index({ chat: 1, sender: 1, status: 1 });

// Connect hote hi "sab undelivered → delivered" wali query
MessageSchema.index({ sender: 1, status: 1, chat: 1 });

// Chat ki media gallery
MessageSchema.index({ chat: 1, mediaType: 1, createdAt: -1 });

const Message = HBS_DB.models.Message || HBS_DB.model("Message", MessageSchema);

module.exports = { Message };
