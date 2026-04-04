// controllers/HAdminEmailController.js
const AdminEmail = require("../models/AdminEmail"); // ✅ Fixed — correct model filename

// ─────────────────────────────────────────────
// ADD admin email
// POST /api/admin-emails
// Body: { email, label? }
// ─────────────────────────────────────────────
exports.addAdminEmail = async (req, res) => {
  try {
    const { email, label } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: "Email is required" });
    }

    const existing = await AdminEmail.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already exists" });
    }

    const record = await AdminEmail.create({ email, label });
    return res.status(201).json({ success: true, data: record });
  } catch (err) {
    console.error("addAdminEmail error:", err);
    return res.status(500).json({ success: false, message: "Error adding email", error: err.message });
  }
};

// ─────────────────────────────────────────────
// GET all admin emails
// GET /api/admin-emails
// ─────────────────────────────────────────────
exports.getAdminEmails = async (req, res) => {
  try {
    const records = await AdminEmail.find().sort({ createdAt: -1 });
    return res.json({ success: true, data: records });
  } catch (err) {
    console.error("getAdminEmails error:", err);
    return res.status(500).json({ success: false, message: "Error fetching emails", error: err.message });
  }
};

// ─────────────────────────────────────────────
// UPDATE admin email (label or isActive toggle)
// PUT /api/admin-emails/:id
// Body: { label?, isActive? }
// ─────────────────────────────────────────────
exports.updateAdminEmail = async (req, res) => {
  try {
    const { label, isActive } = req.body;

    const record = await AdminEmail.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }

    if (label    !== undefined) record.label    = label;
    if (isActive !== undefined) record.isActive = isActive;

    const updated = await record.save();
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateAdminEmail error:", err);
    return res.status(500).json({ success: false, message: "Error updating email", error: err.message });
  }
};

// ─────────────────────────────────────────────
// DELETE admin email
// DELETE /api/admin-emails/:id
// ─────────────────────────────────────────────
exports.deleteAdminEmail = async (req, res) => {
  try {
    const record = await AdminEmail.findByIdAndDelete(req.params.id);
    if (!record) {
      return res.status(404).json({ success: false, message: "Record not found" });
    }
    return res.json({ success: true, message: "Email removed successfully" });
  } catch (err) {
    console.error("deleteAdminEmail error:", err);
    return res.status(500).json({ success: false, message: "Error deleting email", error: err.message });
  }
};