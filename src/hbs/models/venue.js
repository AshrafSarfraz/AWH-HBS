const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const VenueSchema = new mongoose.Schema(
  {
    venueNameAr: { type: String, trim: true },
    venueName: { type: String, trim: true, required: true },

    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },

    city: { type: String, trim: true },
    country: { type: String, trim: true },

    img: { type: String, trim: true },

    time: { type: Date, default: Date.now },
  },
  {
    collection: "H-Venues",
    timestamps: true,
  }
);

module.exports = HBS_DB.model("Venue", VenueSchema);
