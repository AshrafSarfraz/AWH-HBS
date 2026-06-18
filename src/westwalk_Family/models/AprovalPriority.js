const mongoose = require("mongoose");
const { WESTWALK_DB } = require("../../database/connect");
// who approves each formKey, in what order
const ApprovalPrioritySchema = new mongoose.Schema(
  {
    formName: { type: String, required: true, unique: true }, 
    // NOTE: formName === formKey from Form model

    sequence: [
      {
        role: { type: String, required: true },   // e.g. "Manager"
        name: { type: String, required: true },   // e.g. "Ali Khan"
        email: { type: String, required: true },  // approver email
        order: { type: Number, required: true },  // 1,2,3...
      }
    ]
  },
  { timestamps: true }
);

module.exports = WESTWALK_DB.model("ApprovalPriority", ApprovalPrioritySchema);
