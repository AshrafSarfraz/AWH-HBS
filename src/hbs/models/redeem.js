const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const RedeemSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },   // "YYYY-MM-DD"
    code: { type: String, required: true },

    phoneNumber: String,
    address: String,
    Redeempin: String,
    Username: String,
    percentage: String,

    brandId: { type: String, required: true },
    brand: String,

    userId: { type: String, required: true },

    createdAt: String
  },
  {
    collection: "H-Redeem",
    timestamps: true
  }
);

// ✅ one redeem per (userId, brandId, date)
RedeemSchema.index({ userId: 1, brandId: 1, date: 1 }, { unique: true });

// ─────────────────────────────────────────────────────────────────────
// NEW INDEXES
// Upar wala compound index sirf tab kaam karta hai jab query `userId` se
// shuru ho. Lekin vendor panel sirf brandId se query karta hai
// (POST /api/hbs/vender/redemption) — wo full collection scan tha.
// ─────────────────────────────────────────────────────────────────────
RedeemSchema.index({ brandId: 1, date: -1 });
RedeemSchema.index({ userId: 1, date: -1 });
RedeemSchema.index({ createdAt: -1 });

module.exports = HBS_DB.model("Redeem", RedeemSchema);
