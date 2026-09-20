// src/hbs/models/User.js
//
// KYA BADLA:
//  - `name` par index (user search ke liye) — pehle har search full scan thi.
//  - OTP ab plain text me store nahi hoga: `otpHash` + `otpAttempts`.
//    (phoneAuth.js isay use karta hai — dono files saath change karni hain.)
//  - email lowercase + trim automatic.

const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: { type: String, required: true, unique: true, trim: true },
    isPhoneVerified: { type: Boolean, default: false },

    // ── Profile ────────────────────────────────────────────────────────
    avatar: { type: String, default: null },
    bio: { type: String, default: null, maxlength: 150 },
    birthday: { type: Date, default: null },

    // ── OTP (hashed) ───────────────────────────────────────────────────
    lastOtpSentAt: { type: Date, default: null },
    otpHash: { type: String, default: null, select: false }, // NEW
    otpExpiresAt: { type: Date, default: null },
    otpAttempts: { type: Number, default: 0 }, // NEW — brute force rokne ke liye

    // ── Presence ───────────────────────────────────────────────────────
    lastSeen: { type: Date, default: null },
    privacySettings: {
      hideOnlineStatus: { type: Boolean, default: false },
      hideLastSeen: { type: Boolean, default: false },
      isPrivate: { type: Boolean, default: false },
      messagePermission: {
        type: String,
        enum: ["everyone", "followers", "following", "mutual", "nobody"],
        default: "followers",
      },
    },
  },
  { collection: "Users", timestamps: true }
);

// User search — prefix search ab index use karegi
UserSchema.index({ name: 1 });
// Naam se full-text search chahiye to yeh bhi (optional):
// UserSchema.index({ name: "text" });

module.exports = HBS_DB.models.User || HBS_DB.model("User", UserSchema);
