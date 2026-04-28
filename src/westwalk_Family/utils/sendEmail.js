// // utils/sendEmail.js
// const nodemailer = require('nodemailer');

// let transporter;

// function getTransporter() {
//   if (!transporter) {
//     transporter = nodemailer.createTransport({
//       host:   process.env.WESTWALK_EMAIL_HOST,
//       port:   Number(process.env.WESTWALK_EMAIL_PORT),
//       secure: String(process.env.WESTWALK_EMAIL_PORT) === "465",
//       auth: {
//         user: process.env.WESTWALK_EMAIL_USER,
//         pass: process.env.WESTWALK_EMAIL_PASS,
//       },
//     });
//   }
//   return transporter;
// }

// async function sendEmail({ to, subject, body, html }) {
//   try {
//     const tx   = getTransporter();
//     const info = await tx.sendMail({
//       from: process.env.WESTWALK_EMAIL_FROM,
//       to,
//       subject,
//       text: body,
//       html,
//     });
//     console.log("📧 Email sent:", info.messageId);
//     return { ok: true, messageId: info.messageId };
//   } catch (err) {
//     console.error("❌ Email send failed:", err.message);
//     return { ok: false, error: err.message };
//   }
// }

// // ─────────────────────────────────────────────
// // Template 1 — Confirmation to complainant on CREATE
// // ─────────────────────────────────────────────
// function complaintConfirmationEmail(complaint) {
//   const subject = `Request Received: ${complaint.subject}`;

//   const html = `
//     <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
//       <div style="background:#1a1a2e;padding:24px 32px;">
//         <h2 style="color:#ffffff;margin:0;">Request Received</h2>
//         <p style="color:#a0a0b0;margin:4px 0 0;">WestWalk Management</p>
//       </div>
//       <div style="padding:32px;">
//         <p style="color:#333;">Dear <strong>${complaint.name}</strong>,</p>
//         <p style="color:#555;">Your Request has been received and is currently under review.</p>
//         <table style="width:100%;border-collapse:collapse;margin:20px 0;">
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Subject</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Unit No.</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.unitno}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Building No.</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.buildingno}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;">Status</td>
//             <td style="padding:10px 14px;">
//               <span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:12px;font-size:13px;font-weight:bold;">Pending</span>
//             </td>
//           </tr>
//         </table>
//         <p style="color:#555;">We will notify you once your complaint has been reviewed.</p>
//         <p style="color:#555;margin-top:24px;">Regards,<br/><strong>WestWalk Management Team</strong></p>
//       </div>
//       <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
//         <p style="color:#999;font-size:12px;margin:0;">This is an automated message. Please do not reply.</p>
//       </div>
//     </div>
//   `;

//   const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been received and is pending review.`;
//   return { subject, html, body };
// }

// // ─────────────────────────────────────────────
// // Template 2 — Alert to admins on CREATE
// // ─────────────────────────────────────────────
// function complaintAdminAlertEmail(complaint) {
//   const subject = `[New Request] ${complaint.subject} — Unit ${complaint.unitno}`;

//   const html = `
//     <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
//       <div style="background:#c0392b;padding:24px 32px;">
//         <h2 style="color:#ffffff;margin:0;">New Request Submitted</h2>
//         <p style="color:#f5a5a0;margin:4px 0 0;">Action may be required</p>
//       </div>
//       <div style="padding:32px;">
//         <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Name</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.name}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Email</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.email}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Phone</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.phoneNumber}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Unit / Building</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.unitno} / ${complaint.buildingno}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Subject</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;">Submitted At</td>
//             <td style="padding:10px 14px;color:#555;">${new Date().toLocaleString()}</td>
//           </tr>
//         </table>
//         <p style="color:#555;">Please log in to the admin panel to review and update the status.</p>
//       </div>
//       <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
//         <p style="color:#999;font-size:12px;margin:0;">WestWalk Internal Alert System</p>
//       </div>
//     </div>
//   `;

//   const body = `New Request from ${complaint.name} (Unit ${complaint.unitno}): "${complaint.subject}"`;
//   return { subject, html, body };
// }

// // ─────────────────────────────────────────────
// // Template 3 — Status update to complainant (Resolved / Rejected)
// // ─────────────────────────────────────────────
// function complaintStatusUpdateEmail(complaint) {
//   const isResolved = complaint.status === "Resolved";

//   const statusBg   = isResolved ? "#d4edda" : "#f8d7da";
//   const statusText = isResolved ? "#155724" : "#721c24";
//   const headerBg   = isResolved ? "#1e7e34" : "#c0392b";
//   const headerSub  = isResolved ? "#a3d9a5" : "#f5a5a0";
//   const heading    = isResolved ? "Your Request Has Been Resolved" : "Request Update";

//   const subject = `Request ${complaint.status}: ${complaint.subject}`;

//   const html = `
//     <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
//       <div style="background:${headerBg};padding:24px 32px;">
//         <h2 style="color:#ffffff;margin:0;">${heading}</h2>
//         <p style="color:${headerSub};margin:4px 0 0;">WestWalk Management</p>
//       </div>
//       <div style="padding:32px;">
//         <p style="color:#333;">Dear <strong>${complaint.name}</strong>,</p>
//         <p style="color:#555;">Your Request has been updated. Please find the details below:</p>
//         <table style="width:100%;border-collapse:collapse;margin:20px 0;">
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Subject</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
//           </tr>
//           <tr>
//             <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
//             <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
//           </tr>
//           <tr style="background:#f5f5f5;">
//             <td style="padding:10px 14px;font-weight:bold;color:#333;">Status</td>
//             <td style="padding:10px 14px;">
//               <span style="background:${statusBg};color:${statusText};padding:3px 10px;border-radius:12px;font-size:13px;font-weight:bold;">${complaint.status}</span>
//             </td>
//           </tr>
//         </table>
//         ${isResolved
//           ? `<p style="color:#555;">Your complaint has been resolved. For further concerns, please submit a new Request.</p>`
//           : `<p style="color:#555;">Unfortunately your Request could not be actioned. If you believe this is an error, please resubmit with additional details.</p>`
//         }
//         <p style="color:#555;margin-top:24px;">Regards,<br/><strong>WestWalk Management Team</strong></p>
//       </div>
//       <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
//         <p style="color:#999;font-size:12px;margin:0;">This is an automated message. Please do not reply.</p>
//       </div>
//     </div>
//   `;

//   const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been ${complaint.status.toLowerCase()}.`;
//   return { subject, html, body };
// }

// module.exports = {
//   sendEmail,
//   complaintConfirmationEmail,
//   complaintAdminAlertEmail,
//   complaintStatusUpdateEmail,
// };





// utils/sendEmail.js
const nodemailer = require("nodemailer");

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host:   process.env.WESTWALK_EMAIL_HOST,
      port:   Number(process.env.WESTWALK_EMAIL_PORT),
      secure: String(process.env.WESTWALK_EMAIL_PORT) === "465",
      auth: {
        user: process.env.WESTWALK_EMAIL_USER,
        pass: process.env.WESTWALK_EMAIL_PASS,
      },
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, body, html }) {
  try {
    const tx   = getTransporter();
    const info = await tx.sendMail({
      from: process.env.WESTWALK_EMAIL_FROM,
      to,
      subject,
      text: body,
      html,
    });
    console.log("📧 Email sent:", info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    return { ok: false, error: err.message };
  }
}

// ─────────────────────────────────────────────
// WestWalk Template 1 — Confirmation to complainant on CREATE
// ─────────────────────────────────────────────
function complaintConfirmationEmail(complaint) {
  const subject = `Request Received: ${complaint.subject}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <div style="background:#1a1a2e;padding:24px 32px;">
        <h2 style="color:#ffffff;margin:0;">Request Received</h2>
        <p style="color:#a0a0b0;margin:4px 0 0;">WestWalk Management</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#333;">Dear <strong>${complaint.name}</strong>,</p>
        <p style="color:#555;">Your Request has been received and is currently under review.</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Subject</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Unit No.</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.unitno}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Building No.</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.buildingno}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;">Status</td>
            <td style="padding:10px 14px;">
              <span style="background:#fff3cd;color:#856404;padding:3px 10px;border-radius:12px;font-size:13px;font-weight:bold;">Pending</span>
            </td>
          </tr>
        </table>
        <p style="color:#555;">We will notify you once your complaint has been reviewed.</p>
        <p style="color:#555;margin-top:24px;">Regards,<br/><strong>WestWalk Management Team</strong></p>
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
        <p style="color:#999;font-size:12px;margin:0;">This is an automated message. Please do not reply.</p>
      </div>
    </div>`;
  const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been received and is pending review.`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// WestWalk Template 2 — Alert to admins on CREATE
// ─────────────────────────────────────────────
function complaintAdminAlertEmail(complaint) {
  const subject = `[New Request] ${complaint.subject} — Unit ${complaint.unitno}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <div style="background:#c0392b;padding:24px 32px;">
        <h2 style="color:#ffffff;margin:0;">New Request Submitted</h2>
        <p style="color:#f5a5a0;margin:4px 0 0;">Action may be required</p>
      </div>
      <div style="padding:32px;">
        <table style="width:100%;border-collapse:collapse;margin:0 0 20px;">
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Name</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.name}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Email</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.email}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Phone</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.phoneNumber}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Unit / Building</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.unitno} / ${complaint.buildingno}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Subject</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;">Submitted At</td>
            <td style="padding:10px 14px;color:#555;">${new Date().toLocaleString()}</td>
          </tr>
        </table>
        <p style="color:#555;">Please log in to the admin panel to review and update the status.</p>
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
        <p style="color:#999;font-size:12px;margin:0;">WestWalk Internal Alert System</p>
      </div>
    </div>`;
  const body = `New Request from ${complaint.name} (Unit ${complaint.unitno}): "${complaint.subject}"`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// WestWalk Template 3 — Status update (Resolved / Rejected)
// ─────────────────────────────────────────────
function complaintStatusUpdateEmail(complaint) {
  const isResolved = complaint.status === "Resolved";
  const statusBg   = isResolved ? "#d4edda" : "#f8d7da";
  const statusText = isResolved ? "#155724" : "#721c24";
  const headerBg   = isResolved ? "#1e7e34" : "#c0392b";
  const headerSub  = isResolved ? "#a3d9a5" : "#f5a5a0";
  const heading    = isResolved ? "Your Request Has Been Resolved" : "Request Update";
  const subject    = `Request ${complaint.status}: ${complaint.subject}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
      <div style="background:${headerBg};padding:24px 32px;">
        <h2 style="color:#ffffff;margin:0;">${heading}</h2>
        <p style="color:${headerSub};margin:4px 0 0;">WestWalk Management</p>
      </div>
      <div style="padding:32px;">
        <p style="color:#333;">Dear <strong>${complaint.name}</strong>,</p>
        <p style="color:#555;">Your Request has been updated. Please find the details below:</p>
        <table style="width:100%;border-collapse:collapse;margin:20px 0;">
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;width:35%;border-bottom:1px solid #e0e0e0;">Subject</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.subject}</td>
          </tr>
          <tr>
            <td style="padding:10px 14px;font-weight:bold;color:#333;border-bottom:1px solid #e0e0e0;">Description</td>
            <td style="padding:10px 14px;color:#555;border-bottom:1px solid #e0e0e0;">${complaint.description}</td>
          </tr>
          <tr style="background:#f5f5f5;">
            <td style="padding:10px 14px;font-weight:bold;color:#333;">Status</td>
            <td style="padding:10px 14px;">
              <span style="background:${statusBg};color:${statusText};padding:3px 10px;border-radius:12px;font-size:13px;font-weight:bold;">${complaint.status}</span>
            </td>
          </tr>
        </table>
        ${isResolved
          ? `<p style="color:#555;">Your complaint has been resolved. For further concerns, please submit a new Request.</p>`
          : `<p style="color:#555;">Unfortunately your Request could not be actioned. If you believe this is an error, please resubmit with additional details.</p>`
        }
        <p style="color:#555;margin-top:24px;">Regards,<br/><strong>WestWalk Management Team</strong></p>
      </div>
      <div style="background:#f5f5f5;padding:16px 32px;text-align:center;">
        <p style="color:#999;font-size:12px;margin:0;">This is an automated message. Please do not reply.</p>
      </div>
    </div>`;
  const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been ${complaint.status.toLowerCase()}.`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// HR Template 1 — Notify approver (no buttons — app se approve hoga)
// ─────────────────────────────────────────────
function hrApprovalNotificationEmail(flow, nextStep) {
  const subject = `Approval required: ${flow.formName} - Step ${nextStep}`;
  const answers = flow.formDataPayload?.answers || {};
 
  const answerRows = Object.entries(answers)
    .map(([k, v], i, arr) => `
      <tr>
        <td style="color:#6b7280;font-weight:500;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}width:40%;padding:8px;">${k}</td>
        <td style="color:#111827;font-weight:500;text-align:right;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}padding:8px;">${v}</td>
      </tr>`)
    .join("");
 
  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
 
      <!-- Header -->
      <tr>
        <td bgcolor="#31368A" style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle">
              <div style="font-size:17px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">WestWalk Management</div>
              <div style="font-size:11px;color:#c7d2fe;margin-top:3px;font-family:Arial,Helvetica,sans-serif;">Request Workflow System</div>
            </td>
            <td align="right" valign="middle">
              <span style="background:rgba(165,180,252,0.2);color:#c7d2fe;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">Action Required</span>
            </td>
          </tr></table>
        </td>
      </tr>
 
      <!-- Body -->
      <tr><td style="padding:24px;font-family:Arial,Helvetica,sans-serif;">
        <div style="display:inline-block;background:#eef2ff;color:#4338ca;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;margin-bottom:12px;">${flow.formName}</div>
        <h1 style="margin:0 0 6px;font-size:20px;color:#111827;font-weight:700;">New Approval Request</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#6b7280;line-height:1.6;">A new request requires your review. Please open the <strong>WestWalk app</strong> to approve or reject.</p>
 
        <!-- Request Details -->
        <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:0.8px;margin:0 0 8px;">Request Details</p>
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
          style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
          ${answerRows}
        </table>
 
        <div style="background:#eef2ff;border-radius:10px;padding:14px 16px;text-align:center;">
          <p style="margin:0;font-size:13px;color:#4338ca;font-weight:600;">Please open the WestWalk app to take action on this request.</p>
        </div>
      </td></tr>
 
      <!-- Footer -->
      <tr><td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          Automated notification from <strong style="color:#6b7280;">WestWalk Management</strong>.<br/>
          Received in error? Please contact the admin.
        </p>
      </td></tr>
 
    </table>
  </td></tr>
</table>`;
 
  const body = `You have a pending approval for ${flow.formName}.\n\nPlease open the WestWalk app to approve or reject.`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// HR Template 2 — Fully Approved (requester ko)
// ─────────────────────────────────────────────
function hrApprovedEmail(flow) {
  const subject = `Your ${flow.formName} request is fully approved`;

  const approverRows = flow.approvals
    .map((a, i, arr) => `
      <tr>
        <td style="color:#6b7280;font-weight:500;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}width:50%;">${a.role || a.name}</td>
        <td style="color:#15803d;font-weight:700;text-align:right;${i < arr.length - 1 ? "border-bottom:1px solid #e5e7eb;" : ""}">&#10003; Approved</td>
      </tr>`)
    .join("");

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td bgcolor="#31368A" style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle">
              <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">WestWalk Management</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;font-family:Arial,Helvetica,sans-serif;">Approval Workflow System</div>
            </td>
            <td align="right" valign="middle">
              <span style="background:rgba(187,247,208,0.2);color:#86efac;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">Request Approved</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td align="center" style="padding:24px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
        <div style="width:60px;height:60px;border-radius:50%;background:#dcfce7;display:inline-block;line-height:60px;text-align:center;font-size:28px;color:#15803d;">&#10003;</div>
      </td></tr>
      <tr><td align="center" style="padding:12px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
        <h1 style="margin:0 0 6px;font-size:19px;font-weight:700;color:#15803d;">Your request has been approved!</h1>
        <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
          Great news — your <strong>${flow.formName}</strong> has been reviewed and fully approved by all approvers.
        </p>
      </td></tr>
      <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;">
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
          style="background:#f9fafb;border-radius:10px;border-collapse:collapse;font-size:13px;">
          ${approverRows}
        </table>
      </td></tr>
      <tr><td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          Automated notification from <strong style="color:#6b7280;">WestWalk Management</strong> Approval workflow system.<br/>
          Questions? Please contact Our department.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const body = `Your ${flow.formName} request has been approved by all approvers.`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// HR Template 3 — Rejected (requester ko)
// ─────────────────────────────────────────────
function hrRejectedEmail(flow, stepIndex, comment) {
  const subject    = `Your ${flow.formName} request was rejected`;
  const rejectedBy = flow.approvals[stepIndex]?.name || "Approver";

  const html = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f3f4f6" style="margin:0;padding:0;">
  <tr><td align="center" style="padding:24px 12px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
      style="max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">
      <tr>
        <td bgcolor="#31368A" style="padding:20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
            <td valign="middle">
              <div style="font-size:16px;font-weight:700;color:#ffffff;font-family:Arial,Helvetica,sans-serif;">WestWalk Management</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.6);margin-top:2px;font-family:Arial,Helvetica,sans-serif;">Approval Workflow System</div>
            </td>
            <td align="right" valign="middle">
              <span style="background:rgba(254,202,202,0.15);color:#fca5a5;font-size:11px;font-weight:600;padding:4px 12px;border-radius:20px;font-family:Arial,Helvetica,sans-serif;">Request Rejected</span>
            </td>
          </tr></table>
        </td>
      </tr>
      <tr><td align="center" style="padding:24px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
        <div style="width:60px;height:60px;border-radius:50%;background:#fee2e2;display:inline-block;line-height:60px;text-align:center;font-size:26px;color:#b91c1c;">&#10005;</div>
      </td></tr>
      <tr><td align="center" style="padding:12px 24px 4px;font-family:Arial,Helvetica,sans-serif;">
        <h1 style="margin:0 0 6px;font-size:19px;font-weight:700;color:#b91c1c;">Your request was not approved</h1>
        <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">
          Unfortunately, your <strong>${flow.formName}</strong> request has been rejected.
          Please review the reason below and contact department if you have questions.
        </p>
      </td></tr>
      <tr><td style="padding:0 24px 20px;font-family:Arial,Helvetica,sans-serif;">
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
            <td style="color:#111827;font-weight:500;text-align:right;">${rejectedBy}</td>
          </tr>
        </table>
        ${comment ? `
        <p style="font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;letter-spacing:.8px;margin:0 0 8px;">Reason / Comment</p>
        <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:12px 14px;font-size:13px;color:#7f1d1d;line-height:1.6;">${comment}</div>
        ` : ""}
      </td></tr>
      <tr><td style="padding:14px 24px 16px;border-top:1px solid #e5e7eb;font-family:Arial,Helvetica,sans-serif;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6;">
          Automated notification from <strong style="color:#6b7280;">WestWalk Management</strong> Approval workflow system.<br/>
          Questions? Please contact our department.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;

  const body = `Your ${flow.formName} request has been rejected by ${rejectedBy}.`;
  return { subject, html, body };
}

module.exports = {
  sendEmail,
  // WestWalk templates
  complaintConfirmationEmail,
  complaintAdminAlertEmail,
  complaintStatusUpdateEmail,
  // HR Approval templates
  hrApprovalNotificationEmail,
  hrApprovedEmail,
  hrRejectedEmail,
};