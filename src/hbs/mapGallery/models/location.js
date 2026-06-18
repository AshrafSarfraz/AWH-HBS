// /src/hbs/mapGallery/models/location.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    location: {
      type: {
        type: String,
        default: "Point",
      },
      coordinates: {
        type: [Number],
        required: true,
      },
    },
  },
  { timestamps: true }
);

locationSchema.index({ location: "2dsphere", name: 1 });

module.exports = HBS_DB.model("Location", locationSchema);