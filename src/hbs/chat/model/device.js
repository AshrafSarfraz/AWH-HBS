// /src/hbs/chat/model/device.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const DeviceSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    token: {
      type: String,
      required: true,
      // ⚠️ FIX: yahan `unique: true` bhi tha aur neeche schema.index() bhi —
      // Mongoose "Duplicate schema index" warning deta tha aur do index
      // banane ki koshish hoti thi. Ab sirf neeche wala index hai.
    },
    platform: {
      type: String,
      enum: ["android", "ios"],
      default: "android",
    },
  },
  { timestamps: true }
);

// One token = one device (upsert ke liye)
DeviceSchema.index({ token: 1 }, { unique: true });
DeviceSchema.index({ userId: 1 });

const Device = HBS_DB.models.Device || HBS_DB.model("Device", DeviceSchema);

module.exports = Device;