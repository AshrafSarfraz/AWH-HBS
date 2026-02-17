// src/hbs/models/Venue.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const VenueSchema = new mongoose.Schema(
  {
    venueNameAr: { type: String, trim: true }, // "بلاس فاندوم"
    venueName:   { type: String, trim: true }, // "Place Vendôme"
    
    longitude: { type: Number, required: true },
    latitude:  { type: Number, required: true },

  
    city:    { type: String, trim: true },     // "Doha"
    country: { type: String, trim: true },     // "qatar"

    img:  { type: String, trim: true },        // image URL
    time: { type: Date, default: Date.now },   // "2025-09-01T13:02:38.363+00:00"
  },
  {
    collection: "H-Venues",
    timestamps: true, // tum already 'time' rakh rahe ho
  }
);

module.exports = HBS_DB.model("Venue", VenueSchema);
