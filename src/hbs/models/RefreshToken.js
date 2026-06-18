// /src/hbs/models/RefreshToken.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");
const { Schema } = mongoose;

const RefreshTokenSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  token: {
    type: String,
    required: true,
    unique: true,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Expired tokens automatically delete karo (MongoDB TTL index)
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RefreshToken =
  HBS_DB.models.RefreshToken ||
  HBS_DB.model("RefreshToken", RefreshTokenSchema);

module.exports = { RefreshToken };