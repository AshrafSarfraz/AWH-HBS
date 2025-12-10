// models/Redeem.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const RedeemSchema = new mongoose.Schema(
  {
    date: { type: String },                 // "2025-11-25"
    code: { type: String, required: true }, // "WHT4Y0"
    phoneNumber: String,                    // "+966573884832"
    address: String,                        // "Dafna"
    Redeempin: String,                      // "533086"
    Username: String,                       // "Mr Bahravi"
    percentage: String,                     // "-15% Discount on Final Bill"

    // yahan brandId string hai (shayad Firebase/Mongo id)
    brandId: String,                        // "2EXjhXPlaoMSYzRs2BHd"
    brand: String,                          // "Sterling Grill"

    userId: String,                         // "6925b2c2b5ca74b8078d2e7e"

    // tumhara custom createdAt string
    createdAt: String                       // "063899675550.648000000"
  },
  {
    collection: "H-Redeem", // 👈 apne DB ka actual collection name yahan daal dena
    timestamps: false        // agar Mongo ka apna createdAt/updatedAt nahi chahiye
  }
);

module.exports = HBS_DB.model("Redeem", RedeemSchema);
