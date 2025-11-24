// src/hr-system/controller/approvalController.js
const ApprovalFlow = require("../models/ApprovalFlow");
// sendEmail should send plain emails. dummy OK for now.
const sendEmail = require("../utils/sendEmail");

/**
 * GET /api/approvals/my-requests?email=abc@company.com
 *  -> employee ke saare submitted flows (newest first)
 */

async function getMyRequests(req, res) {
  try {
    const email = String(req.query.email || "").toLowerCase().trim();

    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    // sirf us user ki submitted requests lao
    const flows = await ApprovalFlow.find(
      { requesterEmail: email },
      {
        formName: 1,
        status: 1,
        createdAt: 1,
        approvals: 1,
        currentStep: 1,
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    // sirf readable summary banao
    const shaped = flows.map((f) => ({
      _id: f._id,
      formName: f.formName,
      status: f.status, // "Pending" | "Approved" | "Rejected"
      createdAt: f.createdAt,
      currentStep: f.currentStep,
      approvals: (f.approvals || []).map((a) => ({
        role: a.role,
        name: a.name,
        email: a.email,
        status: a.status,
        comment:a.comment
      })),
    }));

    return res.json(shaped);
  } catch (err) {
    console.error("getMyRequests error", err);
    return res.status(500).json({ error: err.message });
  }
}



/**
 * GET /api/approvals/:flowId
 * ek flow ka full timeline
 */
async function getFlowStatus(req, res) {
  try {
    const { flowId } = req.params;
    const flow = await ApprovalFlow.findById(flowId).lean();
    if (!flow) {
      return res.status(404).json({ error: "Flow not found" });
    }
    return res.json(flow);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}

/**
 * GET /api/approvals/:flowId/action?step=1&decision=approve&comment=ok
 * email se approver click karega
 */


async function handleApprovalAction(req, res) {
  try {
    const { flowId } = req.params;
    const { step, decision, comment } = req.query;

    const stepNum = Number(step);
    const stepIndex = stepNum - 1;

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    const flow = await ApprovalFlow.findById(flowId);
    if (!flow) {
      return res.status(404).json({ error: "Flow not found" });
    }

    // yeh step abhi active hai?
    if (flow.currentStep !== stepNum) {
      return res
        .status(400)
        .json({ error: "This step is not active anymore" });
    }

    // update approver status
    flow.approvals[stepIndex].status =
      decision === "approve" ? "Approved" : "Rejected";
    flow.approvals[stepIndex].approvedAt = new Date();
    flow.approvals[stepIndex].comment = comment || null;

    // 1) REJECT
    if (decision === "reject") {
      flow.status = "Rejected";
      await flow.save();

      // email requester
      await sendEmail({
        to: flow.requesterEmail,
        subject: `Your ${flow.formName} request was rejected`,
        body: `Your ${flow.formName} request has been rejected by ${flow.approvals[stepIndex].name}.`,
      });

      return res.send("Request has been marked as REJECTED. ✅");
    }
     // 2) APPROVED
     const isLastStep = stepNum === flow.approvals.length;

     if (isLastStep) {
       // sab approve
       flow.status = "Approved";
       await flow.save();
 
       await sendEmail({
         to: flow.requesterEmail,
         subject: `Your ${flow.formName} request is fully approved 🎉`,
         body: `Your ${flow.formName} request has been approved by all approvers.`,
       });
 
       return res.send("Request is FULLY APPROVED. 🎉");
     } else {
       // next approver ko bhejo
       const nextStep = stepNum + 1;
       flow.currentStep = nextStep;
       await flow.save();
 
       const nextApprover = flow.approvals[nextStep - 1];
 
      //  // 👉 Links ab wapas active (agar chahiye)
       const approveLink = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=approve`;
       const rejectLink  = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=reject`;
 
       // 🔥 HTML Email Template
       const html = `
       <div style="font-family: Arial, sans-serif;  ">
         <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px; margin:0 auto; background:#f5f5f5;  border-radius:8px; overflow:hidden;">
           <tr>
             <td style="background:#31368A; padding:16px 24px; color:#ffffff;">
               <table width="100%">
                 <tr>
                   <td style="font-size:20px; font-weight:bold;">
                     <img src="https://alwessilholding.com/wp-content/uploads/elementor/thumbs/white-logo-without-bg-rcstibzjkvfhqjzwzokn5khk5v46zznyb6bizwhx3s.png"
                          alt="Company Logo"
                          style="height:40px; vertical-align:middle; margin-right:8px;">
                   </td>
                   <td style="text-align:right; font-size:12px;">
                    Notification
                   </td>
                 </tr>
               </table>
             </td>
           </tr>
     
           <tr>
             <td style="padding:24px;">
                  <h1 style="margin:0 0 8px 0; font-size:20px; color:#333;">
                  <strong>${formDef.displayName || formKey}</strong>
                </h1>

                 <p style="margin:0 0 16px 0; color:#555; font-size:14px;">
                 A new request has been submitted and needs your review.
                 </p>

               <h3 style="margin:16px 0 8px 0; font-size:16px; color:#333;">Employee Details</h3>
               <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size:14px;">
                 <tr>
                   <td style="border:1px solid #ddd; font-weight:bold; width:30%;">Employee</td>
                   <td style="border:1px solid #ddd;">${flow.requesterName} (${flow.requesterEmail})</td>
                 </tr>
                 <tr>
                   <td style="border:1px solid #ddd; font-weight:bold;">Department</td>
                   <td style="border:1px solid #ddd;">
                     ${(flow.formDataPayload?.employee?.department) || "-"}
                   </td>
                 </tr>
               </table>
     
               <h3 style="margin:16px 0 8px 0; font-size:16px; color:#333;">Request Details</h3>
               <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse; font-size:14px;">
                 ${Object.entries(flow.formDataPayload?.answers || {})
                   .map(
                     ([k, v]) => `
                       <tr>
                         <td style="border:1px solid #ddd; font-weight:bold; width:30%;">${k}</td>
                         <td style="border:1px solid #ddd;">${v}</td>
                       </tr>
                     `
                   )
                   .join("")}
               </table>
     
               <p style="margin-top:24px; font-size:12px; color:#999; text-align:center;">
                 This is an automated email from the Al Wessil HR workflow system.
               </p>
             </td>
           </tr>
         </table>
       </div>
     `;
     
 
       // Plain-text fallback (agar koi client HTML support na kare)
       const emailBody = `
 You have a pending approval for ${flow.formName}.
 
 Requested by: ${flow.requesterName} (${flow.requesterEmail})
 
 Details:
 ${Object.entries(flow.formDataPayload?.answers || {})
   .map(([k, v]) => `${k}: ${v}`)
   .join("\n")}
 
 Approve: ${approveLink}
 Reject: ${rejectLink}
 `;
 
       await sendEmail({
         to: nextApprover.email,
         subject: `Approval required: ${flow.formName} - Step ${nextStep}`,
         body: emailBody,
         html, // 👉 yahan HTML bhi send ho raha hai
       });
 
       return res.send(
         `Step ${stepNum} APPROVED ✅. Next approver notified.`
       );
     }
 
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .send("Internal server error: " + err.message);
  }
}








// jis approver ki email de, uske saare "Pending" steps wale flows de do
async function getPendingForApprover(req, res) {
  try {
    const { email } = req.query;
    if (!email) {
      return res.status(400).json({ error: "email is required" });
    }

    const normalized = email.toLowerCase();

    const flows = await ApprovalFlow.find({
      status: { $ne: "Rejected" }, // reject ho chuka to inbox me kyu?
      approvals: {
        $elemMatch: {
          email: normalized,
          status: "Pending",
        },
      },
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.json(flows);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}


/**
 * GET /api/approvals/all
 *  -> saare flows (newest first)
 */
async function getAllApprovals(req, res) {
  try {
    const flows = await ApprovalFlow.find(
      {},
      {
        formName: 1,
        status: 1,
        createdAt: 1,
        currentStep: 1,
        approvals: 1,
        requesterName: 1,
        requesterEmail: 1,
        formDataPayload: 1, 
      }
    )
      .sort({ createdAt: -1 })
      .lean();

    const shaped = flows.map((f) => ({
      _id: f._id,
      formName: f.formName,
      status: f.status,
      createdAt: f.createdAt,
      currentStep: f.currentStep,
      requester: {
        name: f.requesterName,
        email: f.requesterEmail,
        department: f.formDataPayload?.employee?.department || "",  // 👈 yahan se
       
      },
      approvals: (f.approvals || []).map((a) => ({
        role: a.role,
        name: a.name,
        email: a.email,
        status: a.status,
        comment: a.comment,
        approvedAt: a.approvedAt,
      })),
    }));

    return res.json(shaped);
  } catch (err) {
    console.error("getAllApprovals error", err);
    return res.status(500).json({ error: err.message });
  }
}




module.exports = {
  getMyRequests,     // 👈 naya
  getFlowStatus,
  handleApprovalAction,
  getPendingForApprover,
  getAllApprovals,
};

