// src/hr-system/controller/publicFormController.js

const Form           = require("../models/Form");
const ApprovalPriority = require("../models/AprovalPriority");
const ApprovalFlow   = require("../models/ApprovalFlow");
const { sendEmail, hrApprovalNotificationEmail } = require("../utils/sendEmail");

// GET /api/forms
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

// GET /api/forms/:formKey
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

// POST /api/forms/:formKey/submit
// body = { employee:{name,email,...}, answers:{...} }
async function submitForm(req, res) {
  try {
    const { formKey } = req.params;
    const { employee, answers = {} } = req.body || {};

    if (!employee || !employee.name || !employee.email) {
      return res.status(400).json({ error: "Missing employee info (name/email required)" });
    }

    const requesterName  = String(employee.name).trim();
    const requesterEmail = String(employee.email).toLowerCase().trim();

    // 1) Load form
    const formDef = await Form.findOne({ formKey, active: true }).lean();
    if (!formDef) return res.status(404).json({ error: "Form not found or inactive" });

    // 2) Load approval chain
    const priority = await ApprovalPriority.findOne({ formName: formKey }).lean();
    if (!priority || !Array.isArray(priority.sequence) || priority.sequence.length === 0) {
      return res.status(400).json({ error: "No approval chain configured for this form" });
    }

    // 3) Shape approvals array (sorted by order)
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

    // 4) Create approval flow
    const flowDoc = await ApprovalFlow.create({
      formName:        formKey,
      formId:          formDef._id,
      requesterName,
      requesterEmail,
      currentStep:     1,
      status:          "Pending",
      approvals:       approvalsArray,
      formDataPayload: { employee, answers },
    });

    // 5) Notify first approver
    const firstApprover = approvalsArray[0];
    if (!firstApprover || !firstApprover.email) {
      return res.status(500).json({ error: "First approver missing email" });
    }

    const { subject, html, body } = hrApprovalNotificationEmail(flowDoc, 1);
    await sendEmail({ to: firstApprover.email, subject, body, html });

    return res.json({
      ok:      true,
      message: "Form submitted and first approver notified",
      flowId:  flowDoc._id,
    });
  } catch (err) {
    console.error("submitForm error", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = { getForms, getFormDefinition, submitForm };