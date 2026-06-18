// services/adminEmailService.js
const AdminEmail = require("../models/AdminEmail"); // ✅ Fixed — correct model filename

/**
 * Returns array of active admin email strings from DB.
 * Used by HComplaintController to send alert emails on new complaint.
 */
async function getActiveAdminEmailList() {
  const records = await AdminEmail.find({ isActive: true }).select("email");
  return records.map((r) => r.email);
}

module.exports = { getActiveAdminEmailList };