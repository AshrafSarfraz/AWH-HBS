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
    clientRequestId: String,
  },
  { timestamps: true }
);

photoSchema.index({brand: 1, createdAt: -1});
// Older clients omit this field. New clients can retry an uncertain save safely.
photoSchema.index({user: 1, clientRequestId: 1}, {
  unique: true,
  partialFilterExpression: {clientRequestId: {$type: "string"}},
});

module.exports = HBS_DB.model("Photo", photoSchema);
