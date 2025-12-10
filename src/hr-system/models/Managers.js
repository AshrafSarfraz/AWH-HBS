const mongoose = require("mongoose");
const { HR_DB } = require("../../database/connect");


const ManagerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    department: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = HR_DB.model("Manager", ManagerSchema);
