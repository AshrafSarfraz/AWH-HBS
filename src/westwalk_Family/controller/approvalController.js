// src/hr-system/controller/approvalController.js

const ApprovalFlow = require("../models/ApprovalFlow");
const {
  sendEmail,
  hrApprovalNotificationEmail,
  hrApprovedEmail,
  hrRejectedEmail,
} = require("../utils/sendEmail");

// GET /api/westwalk/approvals/my-requests?email=
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

// GET /api/westwalk/approvals/:flowId
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

// DELETE /api/westwalk/approvals/:flowId
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

// POST /api/westwalk/approvals/:flowId/action
// body OR query: { step, decision, comment }
// FIX: reads params from BOTH req.body and req.query so it works
//      whether frontend sends POST body or query string
async function handleApprovalAction(req, res) {
  try {
    const { flowId } = req.params;

    // FIX: support both query params and body params
    const step     = req.body?.step     ?? req.query?.step;
    const decision = req.body?.decision ?? req.query?.decision;
    const comment  = req.body?.comment  ?? req.query?.comment ?? "";

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

    if (!flow.approvals?.[stepIndex])
      return res.status(400).json({ error: "Invalid approval step" });

    flow.approvals[stepIndex].status     = decision === "approve" ? "Approved" : "Rejected";
    flow.approvals[stepIndex].approvedAt = new Date();
    flow.approvals[stepIndex].comment    = comment || null;

    /* ===== REJECT ===== */
    if (decision === "reject") {
      flow.status = "Rejected";
      await flow.save();
      try {
        const { subject, html, body } = hrRejectedEmail(flow, stepIndex, comment);
        await sendEmail({ to: flow.requesterEmail, subject, body, html });
      } catch (e) {
        console.error("sendEmail (reject) failed:", e);
      }
      return res.json({ ok: true, message: "Request has been REJECTED." });
    }

    /* ===== LAST STEP — FULLY APPROVED ===== */
    if (stepNum === flow.approvals.length) {
      flow.status = "Approved";
      await flow.save();
      try {
        const { subject, html, body } = hrApprovedEmail(flow);
        await sendEmail({ to: flow.requesterEmail, subject, body, html });
      } catch (e) {
        console.error("sendEmail (final approve) failed:", e);
      }
      return res.json({ ok: true, message: "Request is FULLY APPROVED. 🎉" });
    }

    /* ===== NEXT APPROVER ===== */
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

    return res.json({ ok: true, message: `Step ${stepNum} APPROVED. Next approver notified.` });

  } catch (err) {
    console.error("handleApprovalAction error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/westwalk/approvals?email=
// Returns flows where this approver has a PENDING step AND it's their turn (currentStep matches)
async function getPendingForApprover(req, res) {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();
    if (!email) return res.status(400).json({ error: "email is required" });

    // FIX: also filter by currentStep matching the approver's position
    //      so approvers don't see flows that are waiting for someone else first
    const flows = await ApprovalFlow.find({
      status: "Pending",
      approvals: {
        $elemMatch: {
          email:  email,
          status: "Pending",
        },
      },
    }).sort({ createdAt: -1 }).lean();

    // Further filter: only show flows where it's actually THIS approver's turn
    const myTurn = flows.filter((f) => {
      const stepIndex = (f.currentStep || 1) - 1;
      const current   = f.approvals?.[stepIndex];
      return current?.email?.toLowerCase() === email && current?.status === "Pending";
    });

    return res.json(myTurn);
  } catch (err) {
    console.error("getPendingForApprover error:", err);
    return res.status(500).json({ error: err.message });
  }
}

// GET /api/westwalk/approvals/all
async function getAllApprovals(req, res) {
  try {
    const flows = await ApprovalFlow.find(
      {},
      {
        formName: 1, status: 1, createdAt: 1, currentStep: 1,
        approvals: 1, requesterName: 1, requesterEmail: 1,
        formDataPayload: 1, printedStatus: 1,
      }
    ).sort({ createdAt: -1 }).lean();

    const shaped = flows.map((f) => ({
      _id:           f._id,
      formName:      f.formName,
      status:        f.status,
      createdAt:     f.createdAt,
      currentStep:   f.currentStep,
      printedStatus: f.printedStatus || "No",
      requester: {
        name:       f.requesterName  || "Guest",
        email:      f.requesterEmail || "—",
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

// PUT /api/westwalk/approvals/:flowId/printed
async function markPrinted(req, res) {
  try {
    const { flowId } = req.params;
    const flow = await ApprovalFlow.findByIdAndUpdate(
      flowId,
      { printedStatus: "Yes" },
      { new: true }
    );
    if (!flow) return res.status(404).json({ error: "Flow not found" });
    return res.json({ success: true, printedStatus: flow.printedStatus });
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




