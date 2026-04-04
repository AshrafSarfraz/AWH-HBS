// utils/sendEmail.js
const nodemailer = require('nodemailer');

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
// Template 1 — Confirmation to complainant on CREATE
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
    </div>
  `;

  const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been received and is pending review.`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// Template 2 — Alert to admins on CREATE
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
    </div>
  `;

  const body = `New Request from ${complaint.name} (Unit ${complaint.unitno}): "${complaint.subject}"`;
  return { subject, html, body };
}

// ─────────────────────────────────────────────
// Template 3 — Status update to complainant (Resolved / Rejected)
// ─────────────────────────────────────────────
function complaintStatusUpdateEmail(complaint) {
  const isResolved = complaint.status === "Resolved";

  const statusBg   = isResolved ? "#d4edda" : "#f8d7da";
  const statusText = isResolved ? "#155724" : "#721c24";
  const headerBg   = isResolved ? "#1e7e34" : "#c0392b";
  const headerSub  = isResolved ? "#a3d9a5" : "#f5a5a0";
  const heading    = isResolved ? "Your Request Has Been Resolved" : "Request Update";

  const subject = `Request ${complaint.status}: ${complaint.subject}`;

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
    </div>
  `;

  const body = `Dear ${complaint.name}, your Request "${complaint.subject}" has been ${complaint.status.toLowerCase()}.`;
  return { subject, html, body };
}

module.exports = {
  sendEmail,
  complaintConfirmationEmail,
  complaintAdminAlertEmail,
  complaintStatusUpdateEmail,
};