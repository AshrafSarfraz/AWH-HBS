// src/hbs/models/GroupAccount.js
const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const ContactPersonSchema = new mongoose.Schema(
  {
    name: String,
    phone: String,
    email: String,
    position: String,
  },
  { _id: false }
);

const GroupAccountSchema = new mongoose.Schema(
  {
    supplierName: { type: String, required: true },  // "Ashraf Sarfraz"
    groupName: { type: String, required: true },     // "West Walk"
    email: { type: String },                         // "halabsaudi@gmail.com"
    phoneNumber: { type: String },                   // "7382781371"
    crNumber: { type: String },                      // "" (optional)
    contractHolder: { type: String },                // "" (optional)
    ourRepresentative: { type: String },             // "" (optional)

    contactPerson: ContactPersonSchema,              // embedded object

    time: { type: Date, default: Date.now },
  },
  {
    collection: "H-Group-Accounts",
    timestamps: false,
  }
);

module.exports = HBS_DB.model("GroupAccount", GroupAccountSchema);
