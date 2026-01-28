// src/hbs/models/City.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const CitySchema = new mongoose.Schema(
  {
    cityName: { type: String, required: true },
    countryName: { type: String, required: true },
    countryCode: { type: String, required: true },  // e.g., +974
    time: { type: Date, default: Date.now }
  },
  {
    collection: "H-Cities",
    timestamps: true
  }
);

module.exports = HBS_DB.model("City", CitySchema);
