// /src/hbs/chat/chat.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect"); 
const { Schema } = mongoose;

const ChatSchema = new Schema(
  {
    participants: [
  {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
 
],
deletedFor: [
  {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
],

    lastMessage: { type: Schema.Types.ObjectId, ref: "Message", default: null },
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
ChatSchema.path("participants").validate(
  (arr) => arr.length === 2,
  "Only 1-1 chat allowed"
);

ChatSchema.index({ participants: 1 }, { unique: false });

const Chat = HBS_DB.models.Chat || HBS_DB.model("Chat", ChatSchema);

module.exports = { Chat };