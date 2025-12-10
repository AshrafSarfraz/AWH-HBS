const mongoose = require("mongoose");
const { HBS_DB} = require("../../database/connect");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      unique: true, // yahan E.164 format rakhna behtar: +923xxxxxxxxx
      trim: true,
    },
    isPhoneVerified: {
      type: Boolean,
      default: false,
    },
    lastOtpSentAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const User = HBS_DB.model("User", userSchema);

module.exports = User;
