// /src/hbs/mapGallery/models/location.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const locationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
    },
    brand: {type: mongoose.Schema.Types.ObjectId, ref: "Brand"},
    location: {
      type: new mongoose.Schema({
        type: {type: String, default: "Point"},
        coordinates: {type: [Number], required: true},
      }, {_id: false}),
      default: undefined,
    },
  },
  { timestamps: true }
);

locationSchema.index({ location: "2dsphere", name: 1 });

locationSchema.index({brand: 1}, {unique: true, partialFilterExpression: {brand: {$type: "objectId"}}});

module.exports = HBS_DB.model("Location", locationSchema);