// block.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const BlockSchema = new mongoose.Schema(
  {
    blocker: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    blocked: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }
);

// Ek user ek hi baar kisi ko block kar sake
BlockSchema.index({ blocker: 1, blocked: 1 }, { unique: true });

const Block = HBS_DB.models.Block || HBS_DB.model("Block", BlockSchema);

module.exports = { Block };