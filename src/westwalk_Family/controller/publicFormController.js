// src/hr-system/controller/publicFormController.js

const Form             = require("../models/Form");
const ApprovalPriority = require("../models/AprovalPriority");
const ApprovalFlow     = require("../models/ApprovalFlow");
const { sendEmail, hrApprovalNotificationEmail } = require("../utils/sendEmail");

// GET /api/westwalk/admin-forms
async function getForms(req, res) {
  try {
    const forms = await Form.find({ active: true })
      .select("formKey displayName description active")
      .lean();
    return res.json(forms);
  } catch (err) {
    console.error("getForms error", err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/westwalk/public-forms/:formKey
async function getFormDefinition(req, res) {
  try {
    const { formKey } = req.params;
    const formDef = await Form.findOne({ formKey, active: true }).lean();
    if (!formDef) return res.status(404).json({ error: "Form not found or inactive" });
    return res.json(formDef);
  } catch (err) {
    console.error("getFormDefinition error", err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/westwalk/public-forms/:formKey/submit
// body = { answers: { ... } }
// FIX: No requester login required. Anyone can submit.
//      Name/email pulled from answers if present, else defaults used.
//      Manager selection removed — approval chain is fixed per form.
async function submitForm(req, res) {
  try {
    const { formKey } = req.params;
    const { answers = {} } = req.body || {};

    // 1) Load form
    const formDef = await Form.findOne({ formKey, active: true }).lean();
    if (!formDef) return res.status(404).json({ error: "Form not found or inactive" });

    // 2) Load approval chain
    const priority = await ApprovalPriority.findOne({ formName: formKey }).lean();
    if (!priority || !Array.isArray(priority.sequence) || priority.sequence.length === 0) {
      return res.status(400).json({ error: "No approval chain configured for this form" });
    }

    // 3) Try to pull submitter name/email from answers (case-insensitive)
    //    Looks for keys like "name", "email", "full name", "your name" etc.
    const findAnswer = (patterns) => {
      const keys = Object.keys(answers);
      for (const pattern of patterns) {
        const key = keys.find((k) =>
          k.toLowerCase().replace(/[\s_-]/g, "").includes(pattern)
        );
        if (key && answers[key]) return String(answers[key]).trim();
      }
      return null;
    };

    const requesterName  = findAnswer(["fullname", "name", "yourname", "employeename"]) || "Guest";
    const requesterEmail = findAnswer(["email", "youremail", "workemail", "mail"])       || "guest@form.com";

    // 4) Build approvals array from fixed chain (no manager self-select)
    const approvalsArray = [...priority.sequence]
      .sort((a, b) => a.order - b.order)
      .map((a) => ({
        role:       a.role,
        name:       a.name,
        email:      String(a.email || "").toLowerCase(),
        status:     "Pending",
        approvedAt: null,
        comment:    null,
      }));

    // 5) Create approval flow
    const flowDoc = await ApprovalFlow.create({
      formName:        formKey,
      formId:          formDef._id,
      requesterName,
      requesterEmail,
      currentStep:     1,
      status:          "Pending",
      approvals:       approvalsArray,
      formDataPayload: { answers },
    });

    // 6) Notify first approver
    const firstApprover = approvalsArray[0];
    if (!firstApprover?.email) {
      return res.status(500).json({ error: "First approver missing email" });
    }

    try {
      const { subject, html, body } = hrApprovalNotificationEmail(flowDoc, 1);
      await sendEmail({ to: firstApprover.email, subject, body, html });
    } catch (mailErr) {
      console.error("sendEmail (submit notify) failed:", mailErr);
      // Don't fail the whole request if email fails
    }

    return res.json({
      ok:      true,
      message: "Form submitted successfully",
      flowId:  flowDoc._id,
    });

  } catch (err) {
    console.error("submitForm error", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getForms, getFormDefinition, submitForm };







// // src/hr-system/controller/publicFormController.js

// const Form             = require("../models/Form");
// const ApprovalPriority = require("../models/AprovalPriority");
// const ApprovalFlow     = require("../models/ApprovalFlow");
// const { sendEmail, hrApprovalNotificationEmail } = require("../utils/sendEmail");

// // GET /api/westwalk/admin-forms
// async function getForms(req, res) {
//   try {
//     const forms = await Form.find({ active: true })
//       .select("formKey displayName description active")
//       .lean();
//     return res.json(forms);
//   } catch (err) {
//     console.error("getForms error", err);
//     return res.status(500).json({ error: err.message });
//   }
// }

// // GET /api/westwalk/public-forms/:formKey
// async function getFormDefinition(req, res) {
//   try {
//     const { formKey } = req.params;
//     const formDef = await Form.findOne({ formKey, active: true }).lean();
//     if (!formDef) return res.status(404).json({ error: "Form not found or inactive" });
//     return res.json(formDef);
//   } catch (err) {
//     console.error("getFormDefinition error", err);
//     return res.status(500).json({ error: err.message });
//   }
// }

// // POST /api/westwalk/public-forms/:formKey/submit
// // body = { answers:{...} }   <-- employee info NOT required anymore
// async function submitForm(req, res) {
//   try {
//     const { formKey } = req.params;
//     const { answers = {} } = req.body || {};

//     // 1) Load form
//     const formDef = await Form.findOne({ formKey, active: true }).lean();
//     if (!formDef) return res.status(404).json({ error: "Form not found or inactive" });

//     // 2) Load approval chain
//     const priority = await ApprovalPriority.findOne({ formName: formKey }).lean();
//     if (!priority || !Array.isArray(priority.sequence) || priority.sequence.length === 0) {
//       return res.status(400).json({ error: "No approval chain configured for this form" });
//     }

//     // 3) Shape approvals array (sorted by order)
//     const approvalsArray = [...priority.sequence]
//       .sort((a, b) => a.order - b.order)
//       .map((a) => ({
//         role:       a.role,
//         name:       a.name,
//         email:      String(a.email || "").toLowerCase(),
//         status:     "Pending",
//         approvedAt: null,
//         comment:    null,
//       }));

//     // 4) Create approval flow — no employee info needed
//     const flowDoc = await ApprovalFlow.create({
//       formName:        formKey,
//       formId:          formDef._id,
//       requesterName:   "Public",
//       requesterEmail:  "public@form.com",
//       currentStep:     1,
//       status:          "Pending",
//       approvals:       approvalsArray,
//       formDataPayload: { answers },
//     });

//     // 5) Notify first approver
//     const firstApprover = approvalsArray[0];
//     if (!firstApprover || !firstApprover.email) {
//       return res.status(500).json({ error: "First approver missing email" });
//     }

//     const { subject, html, body } = hrApprovalNotificationEmail(flowDoc, 1);
//     await sendEmail({ to: firstApprover.email, subject, body, html });

//     return res.json({
//       ok:      true,
//       message: "Form submitted successfully",
//       flowId:  flowDoc._id,
//     });

//   } catch (err) {
//     console.error("submitForm error", err);
//     return res.status(500).json({ error: err.message });
//   }
// }

// module.exports = { getForms, getFormDefinition, submitForm };