// models/HComplaint.js
const mongoose = require('mongoose');
const { WESTWALK_DB } = require("../../database/connect");

const ComplaintSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    qid: {
      type: String,
      required: true,
      trim: true,
    },
    unitno: {
      type: String,
      required: true,
      trim: true,
    },
    buildingno: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    images: {
      type: [String], // ✅ array of URLs (was `image: String`)
      default: [],
    },
    status: {
      type: String,
      enum: ['Pending', 'In Progress', 'Resolved', 'Rejected'],
      default: 'Pending',
    },
  },
  {
    collection: 'Complaints',
    timestamps: true,
  }
);

module.exports = WESTWALK_DB.model('Complaints', ComplaintSchema);