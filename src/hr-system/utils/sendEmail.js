
// const nodemailer = require('nodemailer');

// let transporter;

// function getTransporter() {
//   if (!transporter) {
//     transporter = nodemailer.createTransport({
//       host: process.env.EMAIL_HOST,
//       port: Number(process.env.EMAIL_PORT),
//       secure: String(process.env.EMAIL_PORT) === "465",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//       }
//     });
//   }
//   return transporter;
// }

// async function sendEmail({ to, subject, body }) {
//   try {
//     const tx = getTransporter();

//     const info = await tx.sendMail({
//       from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
//       to,
//       subject,
//       text: body,
//     });

//     console.log("📧 Email sent:", info.messageId);
//     return { ok: true, messageId: info.messageId };
//   } catch (err) {
//     console.error("❌ Email send failed:", err.message);
//     return { ok: false, error: err.message };
//   }
// }

// module.exports = sendEmail;



const nodemailer = require('nodemailer');

let transporter;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: String(process.env.EMAIL_PORT) === "465",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });
  }
  return transporter;
}

async function sendEmail({ to, subject, body, html }) {
  try {
    const tx = getTransporter();

    const info = await tx.sendMail({
      from: process.env.EMAIL_FROM ,
      to,
      subject,
      text: body, // plain text fallback
      html,       // HTML content (optional)
    });

    console.log("📧 Email sent:", info.messageId);
    return { ok: true, messageId: info.messageId };
  } catch (err) {
    console.error("❌ Email send failed:", err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = sendEmail;
