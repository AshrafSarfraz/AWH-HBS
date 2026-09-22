// src/hbs/chat/model/chat.js
//
// KYA BADLA:
//  - Pehle sirf { participants: 1 } index tha. Chat list ki query
//    participants + lastMessageAt sort par chalti hai — ab compound index hai,
//    to sort bhi index se hota hai (pehle memory me sort ho raha tha).

const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");
const { Schema } = mongoose;

const ChatSchema = new Schema(
  {
    participants: [
      { type: Schema.Types.ObjectId, ref: "User", required: true },
    ],
    deletedFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    mutedBy: [{ type: Schema.Types.ObjectId, ref: "User" }],

    unreadCount: { type: Map, of: Number, default: {} },

    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

ChatSchema.path("participants").validate(
  (arr) => arr.length === 2,
  "Only 1-1 chat allowed"
);

// Chat list: find({ participants: me }).sort({ lastMessageAt: -1 })
ChatSchema.index({ participants: 1, lastMessageAt: -1, _id: -1 });

const Chat = HBS_DB.models.Chat || HBS_DB.model("Chat", ChatSchema);

module.exports = { Chat };
