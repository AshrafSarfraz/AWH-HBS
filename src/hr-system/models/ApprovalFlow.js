const mongoose = require("mongoose");
const { HR_DB } = require("../../database/connect");
// single submission instance going through approvals
const ApprovalFlowSchema = new mongoose.Schema(
  {
    formName: { type: String, required: true }, // same as formKey
    formId: { type: mongoose.Schema.Types.ObjectId }, // optional: link back to Form or submission storage

    requesterName: { type: String, required: true },
    requesterEmail: { type: String, required: true },

    currentStep: { type: Number, default: 1 }, // 1-based
    status: {
      type: String,
      default: "Pending",
      enum: ["Pending", "Approved", "Rejected"],
    },
    
    printedStatus: { // ✅ your new field
      type: String,
      default: "No",
      enum: ["Yes", "No"],
    },



    approvals: [
      {
        role: String,
        email: String,
        name:String,
        status: {
          type: String,
          default: "Pending",
          enum: ["Pending", "Approved", "Rejected"],
        },
        approvedAt: Date,
        comment: String,
      },
    ],

    // store user's submitted data
    formDataPayload: { type: Object }, // { employee:{...}, answers:{...} }
  },
  { timestamps: true }
);

module.exports = HR_DB.model("ApprovalFlow", ApprovalFlowSchema);
