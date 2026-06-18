// models/HAdminEmail.js
const mongoose = require("mongoose");
const { WESTWALK_DB } = require("../../database/connect");

const AdminEmailSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    label: {
      type: String,
      trim: true,
      default: "", // optional display name e.g. "Property Manager"
    },
    isActive: {
      type: Boolean,
      default: true, // easy way to disable without deleting
    },
  },
  {
    collection: "AdminEmails",
    timestamps: true,
  }
);

module.exports = WESTWALK_DB.model("AdminEmail", AdminEmailSchema);
