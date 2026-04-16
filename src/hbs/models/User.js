const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");
 
const UserSchema = new mongoose.Schema(
  {
    name:            { type: String, required: true },
    email:           { type: String, required: true, unique: true },
    phone:           { type: String, required: true, unique: true },
    isPhoneVerified: { type: Boolean, default: false },
 
    // ── Profile fields ──────────────────────────────────────────────────
    avatar:   { type: String, default: null },  // profile picture URL
    bio:      { type: String, default: null, maxlength: 150 },
    birthday: { type: Date,   default: null },
 
    // ── OTP ─────────────────────────────────────────────────────────────
    lastOtpSentAt: { type: Date,   default: null },
    otpCode:       { type: String, default: null },
    otpExpiresAt:  { type: Date,   default: null },
 
    // ── Presence ─────────────────────────────────────────────────────────
    lastSeen: { type: Date, default: null },
  },
  {
    collection: "Users",
    timestamps: true,
  }
);
 
module.exports = HBS_DB.model("User", UserSchema);
 