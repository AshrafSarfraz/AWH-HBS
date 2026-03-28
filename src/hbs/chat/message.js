// /src/hbs/chat/message.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");
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
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    deleted: {
  type: Boolean,
  default: false
},
  },
  { timestamps: true }
);

const Message =
  HBS_DB.models.Message || HBS_DB.model("Message", MessageSchema);

module.exports = { Message };



// /src/hbs/chat/message.js
// const mongoose = require("mongoose");
// const { Schema } = mongoose;

// const MessageSchema = new Schema(
//   {
//     chat: { type: Schema.Types.ObjectId, ref: "Chat", required: true },
//     sender: { type: Schema.Types.ObjectId, ref: "User", required: true },
//     text: { type: String, required: true, trim: true },
//     status: { type: String, enum: ["sent", "delivered", "seen"], default: "sent" },
//   },
//   { timestamps: true }
// );

// MessageSchema.index({ chat: 1, createdAt: -1 });

// const Message = mongoose.models.Message || mongoose.model("Message", MessageSchema);

// module.exports = { Message };
