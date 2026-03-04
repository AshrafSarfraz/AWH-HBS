const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const venueNotificationLogSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    venueId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    date: { type: String, required: true, index: true }, // YYYY-MM-DD
  },
  { collection: "H-VenueNotificationLog", timestamps: true }
);

// ✅ 1 user can get 1 notification per venue per day
venueNotificationLogSchema.index({ userId: 1, venueId: 1, date: 1 }, { unique: true });

module.exports =
  HBS_DB.model("VenueNotificationLog", venueNotificationLogSchema);