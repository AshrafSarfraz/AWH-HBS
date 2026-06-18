

const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const VendorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, 
    email: { type: String, required: true },
    password: { type: String, required: true },  // plain text (as you said)
    role: { type: String, default: "Vendor" },
    time: { type: Date, default: Date.now }
  },
  {
    collection: "H-Vender_Account", // 👈 collection name tumhari choice
    timestamps: true,
  }
);

module.exports = HBS_DB.model("Vendor", VendorSchema);



