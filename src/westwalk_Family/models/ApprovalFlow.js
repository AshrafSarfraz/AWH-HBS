// src/hr-system/models/ApprovalFlow.js
const mongoose = require("mongoose");
const { WESTWALK_DB } = require("../../database/connect");

// FIX: requesterName/Email are no longer required.
//      External / public users don't have accounts.
//      Name & email are extracted from answers if present, else "Guest" is used.
const ApprovalFlowSchema = new mongoose.Schema(
  {
    formName: { type: String, required: true }, // same as formKey
    formId:   { type: mongoose.Schema.Types.ObjectId }, // optional link back to Form

    // Not required — pulled from form answers or defaulted to "Guest"
    requesterName:  { type: String, default: "Guest" },
    requesterEmail: { type: String, default: "guest@form.com" },

    currentStep: { type: Number, default: 1 }, // 1-based
    status: {
      type:    String,
      default: "Pending",
      enum:    ["Pending", "Approved", "Rejected"],
    },

    printedStatus: {
      type:    String,
      default: "No",
      enum:    ["Yes", "No"],
    },

    approvals: [
      {
        role:  String,
        email: String,
        name:  String,
        status: {
          type:    String,
          default: "Pending",
          enum:    ["Pending", "Approved", "Rejected"],
        },
        approvedAt: Date,
        comment:    String,
      },
    ],

    // Submitted form data: { answers: { fieldKey: value, ... } }
    formDataPayload: { type: Object },
  },
  { timestamps: true }
);

module.exports = WESTWALK_DB.model("ApprovalFlow", ApprovalFlowSchema);






// const mongoose = require("mongoose");
// const { WESTWALK_DB } = require("../../database/connect");
// // single submission instance going through approvals
// const ApprovalFlowSchema = new mongoose.Schema(
//   {
//     formName: { type: String, required: true }, // same as formKey
//     formId: { type: mongoose.Schema.Types.ObjectId }, // optional: link back to Form or submission storage

//     requesterName: { type: String, required: true },
//     requesterEmail: { type: String, required: true },

//     currentStep: { type: Number, default: 1 }, // 1-based
//     status: {
//       type: String,
//       default: "Pending",
//       enum: ["Pending", "Approved", "Rejected"],
//     },
    
//     printedStatus: { // ✅ your new field
//       type: String,
//       default: "No",
//       enum: ["Yes", "No"],
//     },



//     approvals: [
//       {
//         role: String,
//         email: String,
//         name:String,
//         status: {
//           type: String,
//           default: "Pending",
//           enum: ["Pending", "Approved", "Rejected"],
//         },
//         approvedAt: Date,
//         comment: String,
//       },
//     ],

//     // store user's submitted data
//     formDataPayload: { type: Object }, // { employee:{...}, answers:{...} }
//   },
//   { timestamps: true }
// );

// module.exports = WESTWALK_DB.model("ApprovalFlow", ApprovalFlowSchema);
