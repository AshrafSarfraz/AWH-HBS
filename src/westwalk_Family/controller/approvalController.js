// src/hr-system/controller/approvalController.js

const ApprovalFlow = require("../models/ApprovalFlow");
const {
  sendEmail,
  hrApprovalNotificationEmail,
  hrApprovedEmail,
  hrRejectedEmail,
} = require("../utils/sendEmail");

// GET /api/approvals/my-requests?email=
async function getMyRequests(req, res) {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email is required" });

    const flows = await ApprovalFlow.find(
      { requesterEmail: email },
      { formName: 1, status: 1, createdAt: 1, approvals: 1, currentStep: 1, printedStatus: 1 }
    ).sort({ createdAt: -1 }).lean();

    const shaped = flows.map((f) => ({
      _id:           f._id,
      formName:      f.formName,
      status:        f.status,
      createdAt:     f.createdAt,
      currentStep:   f.currentStep,
      printedStatus: f.printedStatus || "No",
      approvals:     (f.approvals || []).map((a) => ({
        role:    a.role,
        name:    a.name,
        email:   a.email,
        status:  a.status,
        comment: a.comment,
      })),
    }));

    return res.json(shaped);
  } catch (err) {
    console.error("getMyRequests error", err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/approvals/:flowId
async function getFlowStatus(req, res) {
  try {
    const { flowId } = req.params;
    const flow = await ApprovalFlow.findById(flowId).lean();
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    return res.json(flow);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// DELETE /api/approvals/:flowId
async function deleteFlow(req, res) {
  try {
    const { flowId } = req.params;
    const deleted = await ApprovalFlow.findByIdAndDelete(flowId);
    if (!deleted) return res.status(404).json({ error: "Flow not found" });
    return res.json({ success: true, message: "Flow deleted successfully" });
  } catch (err) {
    console.error("deleteFlow error", err);
    return res.status(500).json({ error: err.message });
  }
}

// POST /api/approvals/:flowId/action?step=1&decision=approve&comment=...
async function handleApprovalAction(req, res) {
  try {
    const { flowId }                  = req.params;
    const { step, decision, comment } = req.query;

    const stepNum   = Number(step);
    const stepIndex = stepNum - 1;

    if (!["approve", "reject"].includes(decision))
      return res.status(400).json({ error: "Invalid decision" });

    if (!stepNum || stepNum < 1)
      return res.status(400).json({ error: "Invalid step" });

    const flow = await ApprovalFlow.findById(flowId);
    if (!flow) return res.status(404).json({ error: "Flow not found" });

    if (flow.currentStep !== stepNum)
      return res.status(400).json({ error: "This step is not active anymore" });

    if (!flow.approvals || !flow.approvals[stepIndex])
      return res.status(400).json({ error: "Invalid approval step" });

    flow.approvals[stepIndex].status     = decision === "approve" ? "Approved" : "Rejected";
    flow.approvals[stepIndex].approvedAt = new Date();
    flow.approvals[stepIndex].comment    = comment || null;

    /* ========== 1) REJECT ========== */
    if (decision === "reject") {
      flow.status = "Rejected";
      await flow.save();

      try {
        const { subject, html, body } = hrRejectedEmail(flow, stepIndex, comment);
        await sendEmail({ to: flow.requesterEmail, subject, body, html });
      } catch (e) {
        console.error("sendEmail (reject) failed:", e);
      }

      return res.send("Request has been marked as REJECTED. ✅");
    }

    /* ========== 2) LAST STEP — FULLY APPROVED ========== */
    const isLastStep = stepNum === flow.approvals.length;

    if (isLastStep) {
      flow.status = "Approved";
      await flow.save();

      try {
        const { subject, html, body } = hrApprovedEmail(flow);
        await sendEmail({ to: flow.requesterEmail, subject, body, html });
      } catch (e) {
        console.error("sendEmail (final approve) failed:", e);
      }

      return res.send("Request is FULLY APPROVED. 🎉");
    }

    /* ========== 3) NEXT APPROVER — SIRF NOTIFICATION ========== */
    const nextStep = stepNum + 1;
    flow.currentStep = nextStep;
    await flow.save();

    const nextApprover = flow.approvals[nextStep - 1];

    try {
      const { subject, html, body } = hrApprovalNotificationEmail(flow, nextStep);
      await sendEmail({ to: nextApprover.email, subject, body, html });
    } catch (e) {
      console.error("sendEmail (next approver) failed:", e);
    }

    return res.send(`Step ${stepNum} APPROVED ✅. Next approver notified.`);

  } catch (err) {
    console.error("handleApprovalAction error:", err);
    return res.status(200).send("Request processed, but internal error was logged.");
  }
}

// GET /api/approvals/pending?email=
async function getPendingForApprover(req, res) {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ error: "email is required" });

    const flows = await ApprovalFlow.find({
      status:    { $ne: "Rejected" },
      approvals: { $elemMatch: { email: email.toLowerCase(), status: "Pending" } },
    }).sort({ createdAt: -1 }).lean();

    return res.json(flows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/approvals/all
async function getAllApprovals(req, res) {
  try {
    const flows = await ApprovalFlow.find(
      {},
      { formName: 1, status: 1, createdAt: 1, currentStep: 1, approvals: 1,
        requesterName: 1, requesterEmail: 1, formDataPayload: 1, printedStatus: 1 }
    ).sort({ createdAt: -1 }).lean();

    const shaped = flows.map((f) => ({
      _id:           f._id,
      formName:      f.formName,
      status:        f.status,
      createdAt:     f.createdAt,
      currentStep:   f.currentStep,
      printedStatus: f.printedStatus || "No",
      requester: {
        name:       f.requesterName,
        email:      f.requesterEmail,
        department: f.formDataPayload?.employee?.department || "",
      },
      approvals: (f.approvals || []).map((a) => ({
        role:       a.role,
        name:       a.name,
        email:      a.email,
        status:     a.status,
        comment:    a.comment,
        approvedAt: a.approvedAt,
      })),
    }));

    return res.json(shaped);
  } catch (err) {
    console.error("getAllApprovals error", err);
    return res.status(500).json({ error: err.message });
  }
}

// PUT /api/approvals/:flowId/printed
async function markPrinted(req, res) {
  try {
    const { flowId } = req.params;
    const flow = await ApprovalFlow.findByIdAndUpdate(
      flowId,
      { printedStatus: "Yes" },
      { new: true }
    );
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    return res.json({ success: true, message: "Printed status updated ✅", printedStatus: flow.printedStatus });
  } catch (err) {
    console.error("markPrinted error:", err);
    return res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getMyRequests,
  getFlowStatus,
  handleApprovalAction,
  getPendingForApprover,
  getAllApprovals,
  deleteFlow,
  markPrinted,
};