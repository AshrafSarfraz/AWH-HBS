// models/Form.js
const mongoose = require("mongoose");
const { HR_DB } = require("../../database/connect");

const FieldSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    label: { type: String, required: true },
    type: { type: String, required: true }, // "text" | "number" | "date" | "textarea" | "select"
    required: { type: Boolean, default: false },
    options: { type: [String], default: [] },
  },
  { _id: false }
);

const FormSchema = new mongoose.Schema(
  {
    formKey: { type: String, required: true, unique: true },
    displayName: { type: String, required: true },
    description: { type: String, default: "" },

    includeEmployeeInfo: { type: Boolean, default: false },

    // 👇 NEW: enable user to pick their manager at submit time
    allowSelfSelectManager: { type: Boolean, default: false },

    isLocked: { type: Boolean, default: true },
    active: { type: Boolean, default: true },

    fields: { type: [FieldSchema], default: [] },
  },
  { timestamps: true }
);

module.exports = HR_DB.model("Form", FormSchema);
