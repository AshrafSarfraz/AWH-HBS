// src/hbs/models/brands.js

const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

// Discount Schema
const DiscountSchema = new mongoose.Schema(
  {
    value: { type: Number, required: true },
    descriptionEng: { type: String, required: true },
    descriptionArabic: { type: String },
  },
  { _id: false }
);

// Timings Schema
const TimingsSchema = new mongoose.Schema(
  {
    monday: String,
    tuesday: String,
    wednesday: String,
    thursday: String,
    friday: String,
    saturday: String,
    sunday: String,
  },
  { _id: false }
);

const BrandSchema = new mongoose.Schema(
  {
    nameEng: { type: String, required: true },
    nameArabic: { type: String, required: true },

    // Multiple discounts support
    discounts: [DiscountSchema],

    discountUsageMode: {
      type: String,
      enum: ["one-per-day", "all-per-day"],
      default: "one-per-day",
    },

    vendorGroupId: { type: String },

    isFlatOffer: { type: Boolean, default: false },

    descriptionEng: String,
    descriptionArabic: String,

    // NOTE: existing data me key "PhoneNumber" hai, isliye yahan bhi waise hi rakha
    PhoneNumber: String,
    longitude: String,
    latitude: String,
    address: String,
    menuUrl: String,

    timings: TimingsSchema,

    startAt: Date,
    endAt: Date,

    selectedCategory: String,
    pin: String,

    isBestSeller: { type: Boolean, default: false },
    isVenue: { type: Boolean, default: false },

    selectedCity: String,
    selectedCountry: String,
    selectedVenue: String,

    status: { type: String, default: "Active" }, // default Active rakha

    // Firebase URLs
    img: String,                // logo image url
    pdfUrl: String,             // menu pdf url
    multiImageUrls: [String],   // gallery images
    heroImage: String,          // hero image

    // legacy (optional) – agar chaho to hata bhi sakte ho
    nodeImg: String,
    nodePdfUrl: String,

    time: { type: Date, default: Date.now },
  },
  {
    collection: "H-Brands",
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────
// NEW INDEXES — brand list in filters par chalti hai, pehle koi index nahi tha
// ─────────────────────────────────────────────────────────────────────
BrandSchema.index({ status: 1, time: -1 });
BrandSchema.index({ selectedCity: 1, status: 1 });
BrandSchema.index({ selectedCategory: 1, status: 1 });
BrandSchema.index({ pin: 1 }); // vendor login by pin
BrandSchema.index({ selectedVenue: 1 });

module.exports = HBS_DB.models.Brand || HBS_DB.model("Brand", BrandSchema);
