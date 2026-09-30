// /src/hbs/mapGallery/models/photos.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const photoSchema = new mongoose.Schema(
  {
    location: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Location",
      required: true,
    },

    image: {
      type: String,
      required: true,
    },

    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    brand: {type: mongoose.Schema.Types.ObjectId, ref: "Brand"},
    caption: String,
  },
  { timestamps: true }
);

photoSchema.index({brand: 1, createdAt: -1});

module.exports = HBS_DB.model("Photo", photoSchema);