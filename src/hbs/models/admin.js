// models/HAdmin.js
const mongoose = require('mongoose');
const { HBS_DB} = require("../../database/connect");
const AdminSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true, // optional, but usually emails are unique
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
      // In production you should store a hashed password, not plain text
    },
    role: {
      type: String,
      required: true,
      default: 'Admin',
    },
    time: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: 'H-Admins', // use your exact collection name
    timestamps: true,      // you already have "time", so no need for createdAt/updatedAt
  }
);

module.exports = HBS_DB.model('Admin', AdminSchema);
