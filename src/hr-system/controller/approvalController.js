const ApprovalFlow = require("../models/ApprovalFlow");
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
        printedStatus: 1,
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
      printedStatus: f.printedStatus || "No",
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




// DELETE /api/approvals/:flowId
async function deleteFlow(req, res) {
  try {
    const { flowId } = req.params;
    const deleted = await ApprovalFlow.findByIdAndDelete(flowId);

    if (!deleted) {
      return res.status(404).json({ error: "Flow not found" });
    }

    return res.json({ success: true, message: "Flow deleted successfully" });
  } catch (err) {
    console.error("deleteFlow error", err);
    return res.status(500).json({ error: err.message });
  }
}


// async function handleApprovalAction(req, res) {
//   try {
//     const { flowId } = req.params;
//     const { step, decision, comment } = req.query;

//     const stepNum = Number(step);
//     const stepIndex = stepNum - 1;

//     if (!["approve", "reject"].includes(decision)) {
//       return res.status(400).json({ error: "Invalid decision" });
//     }

//     if (!stepNum || stepNum < 1) {
//       return res.status(400).json({ error: "Invalid step" });
//     }

//     const flow = await ApprovalFlow.findById(flowId);
//     if (!flow) {
//       return res.status(404).json({ error: "Flow not found" });
//     }

//     // yeh step abhi active hai?
//     if (flow.currentStep !== stepNum) {
//       return res
//         .status(400)
//         .json({ error: "This step is not active anymore" });
//     }

//     if (!flow.approvals || !flow.approvals[stepIndex]) {
//       return res.status(400).json({ error: "Invalid approval step" });
//     }

//     // update approver status
//     flow.approvals[stepIndex].status =
//       decision === "approve" ? "Approved" : "Rejected";
//     flow.approvals[stepIndex].approvedAt = new Date();
//     flow.approvals[stepIndex].comment = comment || null;

//     /* ========== 1) REJECT ========== */
//     if (decision === "reject") {
//       flow.status = "Rejected";
//       await flow.save();

//       // email fail ho bhi jaye to bhi 200 hi dena hai
//       try {
//         await sendEmail({
//           to: flow.requesterEmail,
//           subject: `Your ${flow.formName} request was rejected`,
//           body: `Your ${flow.formName} request has been rejected by ${
//             flow.approvals[stepIndex].name || "approver"
//           }.`,
//         });
//       } catch (e) {
//         console.error("sendEmail (reject) failed:", e);
//       }

//       return res.send("Request has been marked as REJECTED. ✅");
//     }

//     /* ========== 2) APPROVE ========== */
//     const isLastStep = stepNum === flow.approvals.length;

//     if (isLastStep) {
//       // sab approve ho gaye
//       flow.status = "Approved";
//       await flow.save();

//       try {
//         await sendEmail({
//           to: flow.requesterEmail,
//           subject: `Your ${flow.formName} request is fully approved 🎉`,
//           body: `Your ${flow.formName} request has been approved by all approvers.`,
//         });
//       } catch (e) {
//         console.error("sendEmail (final approve) failed:", e);
//       }

//       return res.send("Request is FULLY APPROVED. 🎉");
//     }

//     /* ========== 3) NEXT APPROVER KO BEJNA ========== */

//     const nextStep = stepNum + 1;
//     flow.currentStep = nextStep;
//     await flow.save();

//     const nextApprover = flow.approvals[nextStep - 1];

//     const approveLink = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=approve`;
//     const rejectLink = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=reject`;

//     const html = `
//     <table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
//       <tr>
//         <td align="center" style="padding:16px 8px;">
//           <!-- Main container -->
//           <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;background:#ffffff;border-radius:4px;overflow:hidden;border:1px solid #e5e7eb;">
//             <!-- Header -->
//             <tr>
//               <td bgcolor="#31368A" style="padding:16px 20px;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">
//                 <table width="100%" cellpadding="0" cellspacing="0" border="0">
//                   <tr>
//                     <td valign="middle" style="font-size:18px;font-weight:bold;line-height:1.2;">
//                       <!-- Logo (optional) -->
//                       <img 
//                         src="https://alwessilholding.com/wp-content/uploads/elementor/thumbs/white-logo-without-bg-rcstibzjkvfhqjzwzokn5khk5v46zznyb6bizwhx3s.png"
//                         alt="Al Wessil Holding"
//                         width="130"
//                         style="display:block;border:0;outline:none;text-decoration:none;margin:0;padding:0;max-width:100%;"
//                       />
//                     </td>
//                     <td align="right" valign="middle" style="font-size:12px;">
//                       HR Workflow Notification
//                     </td>
//                   </tr>
//                 </table>
//               </td>
//             </tr>
    
//             <!-- Title / Intro -->
//             <tr>
//               <td style="padding:20px 20px 8px 20px;font-family:Arial,Helvetica,sans-serif;">
//                 <h1 style="margin:0 0 6px 0;font-size:18px;line-height:1.4;color:#111827;">
//                   ${flow.formName}
//                 </h1>
//                 <p style="margin:0;font-size:14px;line-height:1.6;color:#4b5563;">
//                   A new request has been submitted and requires your review.
//                 </p>
//               </td>
//             </tr>
    
//             <!-- Employee details -->
//             <tr>
//               <td style="padding:8px 20px 4px 20px;font-family:Arial,Helvetica,sans-serif;">
//                 <h2 style="margin:0 0 6px 0;font-size:14px;color:#111827;">Employee Details</h2>
//               </td>
//             </tr>
//             <tr>
//               <td style="padding:0 20px 12px 20px;">
//                 <table width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
//                   <tr>
//                     <td width="30%" style="border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;color:#111827;">
//                       Employee
//                     </td>
//                     <td style="border:1px solid #e5e7eb;color:#111827;">
//                       ${flow.requesterName} (${flow.requesterEmail})
//                     </td>
//                   </tr>
//                   <tr>
//                     <td width="30%" style="border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;color:#111827;">
//                       Department
//                     </td>
//                     <td style="border:1px solid #e5e7eb;color:#111827;">
//                       ${(flow.formDataPayload?.employee?.department) || "-"}
//                     </td>
//                   </tr>
//                 </table>
//               </td>
//             </tr>
    
//             <!-- Request details -->
//             <tr>
//               <td style="padding:4px 20px 4px 20px;font-family:Arial,Helvetica,sans-serif;">
//                 <h2 style="margin:0 0 6px 0;font-size:14px;color:#111827;">Request Details</h2>
//               </td>
//             </tr>
//             <tr>
//               <td style="padding:0 20px 16px 20px;">
//                 <table width="100%" cellpadding="6" cellspacing="0" border="0" style="border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:13px;">
//                   ${Object.entries(flow.formDataPayload?.answers || {})
//                     .map(
//                       ([k, v]) => `
//                         <tr>
//                           <td width="30%" style="border:1px solid #e5e7eb;font-weight:bold;background:#f9fafb;color:#111827;">
//                             ${k}
//                           </td>
//                           <td style="border:1px solid #e5e7eb;color:#111827;">
//                             ${v}
//                           </td>
//                         </tr>
//                       `
//                     )
//                     .join("")}
//                 </table>
//               </td>
//             </tr>
    
//             <!-- CTA buttons -->
//             <tr>
//               <td align="center" style="padding:8px 20px 20px 20px;font-family:Arial,Helvetica,sans-serif;">
//                 <table cellpadding="0" cellspacing="0" border="0">
//                   <tr>
//                     <td align="center" style="padding:4px 4px;">
//                       <a href="${approveLink}"
//                         style="display:inline-block;padding:10px 18px;background-color:#10B981;color:#ffffff;
//                                text-decoration:none;font-size:14px;border-radius:4px;font-weight:bold;">
//                         Approve
//                       </a>
//                     </td>
//                     <td align="center" style="padding:4px 4px;">
//                       <a href="${rejectLink}"
//                         style="display:inline-block;padding:10px 18px;background-color:#EF4444;color:#ffffff;
//                                text-decoration:none;font-size:14px;border-radius:4px;font-weight:bold;">
//                         Reject
//                       </a>
//                     </td>
//                   </tr>
//                 </table>
//               </td>
//             </tr>
    
//             <!-- Footer -->
//             <tr>
//               <td style="padding:12px 20px 16px 20px;font-family:Arial,Helvetica,sans-serif;border-top:1px solid #e5e7eb;">
//                 <p style="margin:0;font-size:11px;line-height:1.5;color:#9ca3af;text-align:center;">
//                   This is an automated email from the Al Wessil HR workflow system.<br/>
//                   If you believe you received this in error, please contact HR.
//                 </p>
//               </td>
//             </tr>
//           </table>
//         </td>
//       </tr>
//     </table>
//     `;
    

//     const emailBody = `
// You have a pending approval for ${flow.formName}.

// Requested by: ${flow.requesterName} (${flow.requesterEmail})

// Details:
// ${Object.entries(flow.formDataPayload?.answers || {})
//   .map(([k, v]) => `${k}: ${v}`)
//   .join("\n")}

// Approve: ${approveLink}
// Reject: ${rejectLink}
// `;

//     try {
//       await sendEmail({
//         to: nextApprover.email,
//         subject: `Approval required: ${flow.formName} - Step ${nextStep}`,
//         body: emailBody,
//         html,
//       });
//     } catch (e) {
//       console.error("sendEmail (next approver) failed:", e);
//       // approval phir bhi success, sirf email me problem
//     }

//     return res.send(`Step ${stepNum} APPROVED ✅. Next approver notified.`);
//   } catch (err) {
//     console.error("handleApprovalAction error:", err);
//     // ✅ yahan se ab 500 NHI bhejna
//     return res
//       .status(200)
//       .send("Request processed, but internal error was logged.");
//   }
// }





// jis approver ki email de, uske saare "Pending" steps wale flows de do


async function handleApprovalAction(req, res) {
  try {
    const { flowId } = req.params;
    const { step, decision, comment } = req.query;

    const stepNum = Number(step);
    const stepIndex = stepNum - 1;

    if (!["approve", "reject"].includes(decision)) {
      return res.status(400).json({ error: "Invalid decision" });
    }

    if (!stepNum || stepNum < 1) {
      return res.status(400).json({ error: "Invalid step" });
    }

    const flow = await ApprovalFlow.findById(flowId);
    if (!flow) {
      return res.status(404).json({ error: "Flow not found" });
    }

    if (flow.currentStep !== stepNum) {
      return res.status(400).json({ error: "This step is not active anymore" });
    }

    if (!flow.approvals || !flow.approvals[stepIndex]) {
      return res.status(400).json({ error: "Invalid approval step" });
    }

    flow.approvals[stepIndex].status = decision === "approve" ? "Approved" : "Rejected";
    flow.approvals[stepIndex].approvedAt = new Date();
    flow.approvals[stepIndex].comment = comment || null;

    /* ========== 1) REJECT ========== */
    if (decision === "reject") {
      flow.status = "Rejected";
      await flow.save();

      const rejectedHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td bgcolor="#31368A" style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">Al Wessil Holding</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;font-family:Arial,Helvetica,sans-serif;">HR Workflow System</div>
                </td>
                <td align="right" valign="middle">
                  <span style="background:rgba(254,202,202,0.15);color:#fca5a5;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">Request Rejected</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
            <div style="width:60px;height:60px;border-radius:50%;background:#fee2e2;display:inline-block;line-height:60px;text-align:center;font-size:26px;color:#b91c1c;">&#10005;</div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 6px;font-size:19px;font-weight:700;color:#b91c1c;">Your request was not approved</h1>
            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
              Unfortunately, your <strong>${flow.formName}</strong> request has been rejected.
              Please review the reason below and contact HR if you have questions.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;">
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px;">Request Summary</p>
            <table width="100%" cellpadding="8" cellspacing="0" border="0"
              style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;width:40%;">Form</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.formName}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;">Submitted by</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.requesterName}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;">Status</td>
                <td style="color:#b91c1c;font-weight:700;border-bottom:1px solid #e5e7eb;text-align:right;">Rejected</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;">Rejected by</td>
                <td style="color:#111827;font-weight:500;text-align:right;">${flow.approvals[stepIndex].name || "Approver"}</td>
              </tr>
            </table>
            ${comment ? `
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px;">Reason / Comment</p>
            <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;font-size:13px;color:#7f1d1d;line-height:1.6;margin-bottom:16px;">
              ${comment}
            </div>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              Automated notification from <strong style="color:#6b7280;">Al Wessil Holding</strong> HR workflow system.<br/>
              Questions? Please contact your HR department.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

      try {
        await sendEmail({
          to: flow.requesterEmail,
          subject: `Your ${flow.formName} request was rejected`,
          body: `Your ${flow.formName} request has been rejected by ${flow.approvals[stepIndex].name || "approver"}.`,
          html: rejectedHtml,
        });
      } catch (e) {
        console.error("sendEmail (reject) failed:", e);
      }

      return res.send("Request has been marked as REJECTED. ✅");
    }

    /* ========== 2) APPROVE ========== */
    const isLastStep = stepNum === flow.approvals.length;

    if (isLastStep) {
      flow.status = "Approved";
      await flow.save();

      const approvedHtml = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td bgcolor="#31368A" style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">Al Wessil Holding</div>
                  <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;font-family:Arial,Helvetica,sans-serif;">HR Workflow System</div>
                </td>
                <td align="right" valign="middle">
                  <span style="background:rgba(187,247,208,0.2);color:#86efac;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">Request Approved</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
            <div style="width:60px;height:60px;border-radius:50%;background:#dcfce7;display:inline-block;line-height:60px;text-align:center;font-size:28px;color:#15803d;">&#10003;</div>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:12px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
            <h1 style="margin:0 0 6px;font-size:19px;font-weight:700;color:#15803d;">Your request has been approved!</h1>
            <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
              Great news — your <strong>${flow.formName}</strong> has been reviewed and fully approved by all approvers.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;">
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px;">Request Summary</p>
            <table width="100%" cellpadding="8" cellspacing="0" border="0"
              style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;width:40%;">Form</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.formName}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;">Submitted by</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.requesterName}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;">Status</td>
                <td style="color:#15803d;font-weight:700;text-align:right;">Approved</td>
              </tr>
            </table>
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px;">Approvers</p>
            <table width="100%" cellpadding="8" cellspacing="0" border="0"
              style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              ${flow.approvals.map((a, i, arr) => `
              <tr>
                <td style="color:#6b7280;font-weight:500;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}width:50%;">${a.role || a.name}</td>
                <td style="color:#15803d;font-weight:700;text-align:right;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}">&#10003; Approved</td>
              </tr>`).join("")}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              Automated notification from <strong style="color:#6b7280;">Al Wessil Holding</strong> HR workflow system.<br/>
              Questions? Please contact your HR department.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

      try {
        await sendEmail({
          to: flow.requesterEmail,
          subject: `Your ${flow.formName} request is fully approved`,
          body: `Your ${flow.formName} request has been approved by all approvers.`,
          html: approvedHtml,
        });
      } catch (e) {
        console.error("sendEmail (final approve) failed:", e);
      }

      return res.send("Request is FULLY APPROVED. 🎉");
    }

    /* ========== 3) NEXT APPROVER ========== */
    const nextStep = stepNum + 1;
    flow.currentStep = nextStep;
    await flow.save();

    const nextApprover = flow.approvals[nextStep - 1];

    const approveLink = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=approve`;
    const rejectLink  = `${process.env.APP_BASE_URL}/api/approvals/${flow._id}/action?step=${nextStep}&decision=reject`;

    const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td bgcolor="#31368A" style="padding:20px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td valign="middle">
                  <div style="font-size:17px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">Al Wessil Holding</div>
                  <div style="font-size:11px;color:#c7d2fe;margin-top:3px;font-family:Arial,Helvetica,sans-serif;">HR Workflow System</div>
                </td>
                <td align="right" valign="middle">
                  <span style="background:rgba(165,180,252,0.2);color:#c7d2fe;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;letter-spacing:0.3px;">Action Required</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 24px 8px 24px;font-family:Arial,Helvetica,sans-serif;">
            <div style="display:inline-block;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;letter-spacing:0.4px;margin-bottom:12px;">
              ${flow.formName}
            </div>
            <h1 style="margin:0 0 6px;font-size:20px;color:#111827;font-weight:700;line-height:1.3;">Approval Request</h1>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">A new request has been submitted and is waiting for your review.</p>
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 8px;">Employee Details</p>
            <table width="100%" cellpadding="8" cellspacing="0" border="0"
              style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;width:40%;">Name</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.requesterName}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;border-bottom:1px solid #e5e7eb;">Email</td>
                <td style="color:#111827;font-weight:500;border-bottom:1px solid #e5e7eb;text-align:right;">${flow.requesterEmail}</td>
              </tr>
              <tr>
                <td style="color:#6b7280;font-weight:500;">Department</td>
                <td style="color:#111827;font-weight:500;text-align:right;">${flow.formDataPayload?.employee?.department || "-"}</td>
              </tr>
            </table>
            <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 8px;">Request Details</p>
            <table width="100%" cellpadding="8" cellspacing="0" border="0"
              style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              ${Object.entries(flow.formDataPayload?.answers || {})
                .map(([k, v], i, arr) => `
                <tr>
                  <td style="color:#6b7280;font-weight:500;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}width:40%;">${k}</td>
                  <td style="color:#111827;font-weight:500;text-align:right;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}">${v}</td>
                </tr>`).join("")}
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 24px 24px 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td width="48%" align="center">
                  <a href="${approveLink}" style="display:block;padding:13px 0;background:#dcfce7;color:#15803d;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;font-family:Arial,Helvetica,sans-serif;text-align:center;">&#10003; &nbsp;Approve</a>
                </td>
                <td width="4%"></td>
                <td width="48%" align="center">
                  <a href="${rejectLink}" style="display:block;padding:13px 0;background:#fee2e2;color:#b91c1c;text-decoration:none;font-size:14px;font-weight:700;border-radius:10px;font-family:Arial,Helvetica,sans-serif;text-align:center;">&#10005; &nbsp;Reject</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
              Automated notification from <strong style="color:#6b7280;">Al Wessil Holding</strong> HR workflow system.<br/>
              Received in error? Please contact your HR department.
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

    const emailBody = `
You have a pending approval for ${flow.formName}.
Requested by: ${flow.requesterName} (${flow.requesterEmail})
Details:
${Object.entries(flow.formDataPayload?.answers || {}).map(([k, v]) => `${k}: ${v}`).join("\n")}
Approve: ${approveLink}
Reject:  ${rejectLink}
`;

    try {
      await sendEmail({
        to: nextApprover.email,
        subject: `Approval required: ${flow.formName} - Step ${nextStep}`,
        body: emailBody,
        html,
      });
    } catch (e) {
      console.error("sendEmail (next approver) failed:", e);
    }

    return res.send(`Step ${stepNum} APPROVED ✅. Next approver notified.`);

  } catch (err) {
    console.error("handleApprovalAction error:", err);
    return res.status(200).send("Request processed, but internal error was logged.");
  }
}




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
        printedStatus: 1, // ✅ add
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
      printedStatus: f.printedStatus || "No",
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


/**
 * PUT /api/approvals/:flowId/printed
 * HR clicks "Yes, I printed" → update the printedStatus field
 */
async function markPrinted(req, res) {
  try {
    const { flowId } = req.params;

    const flow = await ApprovalFlow.findByIdAndUpdate(
      flowId,
      { printedStatus: "Yes" },
      { new: true }   // updated document return karega
    );

    if (!flow) {
      return res.status(404).json({ error: "Flow not found" });
    }

    return res.json({
      success: true,
      message: "Printed status updated ✅",
      printedStatus: flow.printedStatus,
    });

  } catch (err) {
    console.error("markPrinted error:", err);
    return res.status(500).json({ error: err.message });
  }
}





module.exports = {
  getMyRequests,     // 👈 naya
  getFlowStatus,
  handleApprovalAction,
  getPendingForApprover,
  getAllApprovals,
  deleteFlow,
  markPrinted, // ✅ new
};

