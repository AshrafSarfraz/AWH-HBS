// controllers/HComplaintController.js
const Complaint = require("../models/complaint"); // ✅ Fixed — correct model filename
const { uploadToFirebase } = require("../../database/firebase");
const {
  sendEmail,
  complaintConfirmationEmail,
  complaintAdminAlertEmail,
  complaintStatusUpdateEmail,
} = require("../utils/sendEmail");
const { getActiveAdminEmailList } = require("../utils/AdminEmailService"); // ✅ Fixed — correct service path

// ─────────────────────────────────────────────
// CREATE Complaint
// POST /api/complaints
// ─────────────────────────────────────────────
exports.createComplaint = async (req, res) => {
  try {
    const body  = req.body;
    const files = req.files || {};

    // 1) Upload image to Firebase (if provided)
    const imageUrl = files.image
      ? await uploadToFirebase(files.image[0], "complaints/images")
      : null;

    // 2) Save complaint
    const complaint = new Complaint({
      name:        body.name,
      unitno:      body.unitno,
      buildingno:  body.buildingno,
      phoneNumber: body.phoneNumber,
      email:       body.email,
      subject:     body.subject,
      description: body.description,
      image:       imageUrl,
    });

    const saved = await complaint.save();

    // 3) Confirmation email → complainant
    const confirmTpl = complaintConfirmationEmail(saved);
    sendEmail({ to: saved.email, ...confirmTpl }); // fire-and-forget

    // 4) Alert email → all active admin emails from DB
    const adminEmails = await getActiveAdminEmailList();
    if (adminEmails.length > 0) {
      const adminTpl = complaintAdminAlertEmail(saved);
      sendEmail({ to: adminEmails.join(","), ...adminTpl }); // fire-and-forget
    }

    return res.status(201).json({ success: true, data: saved });
  } catch (err) {
    console.error("createComplaint error:", err);
    return res.status(500).json({
      success: false,
      message: "Error creating complaint",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET all Complaints
// GET /api/complaints
// ─────────────────────────────────────────────
exports.getComplaints = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const complaints = await Complaint.find(filter).sort({ createdAt: -1 });
    return res.json({ success: true, data: complaints });
  } catch (err) {
    console.error("getComplaints error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching complaints",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// GET single Complaint by ID
// GET /api/complaints/:id
// ─────────────────────────────────────────────
exports.getComplaintById = async (req, res) => {
  try {
    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    return res.json({ success: true, data: complaint });
  } catch (err) {
    console.error("getComplaintById error:", err);
    return res.status(500).json({
      success: false,
      message: "Error fetching complaint",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// UPDATE Complaint
// PUT /api/complaints/:id
// ─────────────────────────────────────────────
exports.updateComplaint = async (req, res) => {
  try {
    const body  = req.body;
    const files = req.files || {};

    const complaint = await Complaint.findById(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }

    // Detect status change to Resolved / Rejected
    const previousStatus  = complaint.status;
    const incomingStatus  = body.status;
    const triggerStatuses = ["Resolved", "Rejected"];
    const shouldNotifyUser =
      incomingStatus &&
      incomingStatus !== previousStatus &&
      triggerStatuses.includes(incomingStatus);

    // Apply updatable fields
    const updatableFields = [
      "name", "unitno", "buildingno",
      "phoneNumber", "email",
      "subject", "description", "status",
    ];
    updatableFields.forEach((field) => {
      if (body[field] !== undefined) complaint[field] = body[field];
    });

    // Update image if new one uploaded
    if (files.image && files.image[0]) {
      complaint.image = await uploadToFirebase(files.image[0], "complaints/images");
    }

    const updated = await complaint.save();

    // Status update email → complainant (only on Resolved or Rejected)
    if (shouldNotifyUser) {
      const statusTpl = complaintStatusUpdateEmail(updated);
      sendEmail({ to: updated.email, ...statusTpl }); // fire-and-forget
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateComplaint error:", err);
    return res.status(500).json({
      success: false,
      message: "Error updating complaint",
      error: err.message,
    });
  }
};

// ─────────────────────────────────────────────
// DELETE Complaint
// DELETE /api/complaints/:id
// ─────────────────────────────────────────────
exports.deleteComplaint = async (req, res) => {
  try {
    const complaint = await Complaint.findByIdAndDelete(req.params.id);
    if (!complaint) {
      return res.status(404).json({ success: false, message: "Complaint not found" });
    }
    return res.json({ success: true, message: "Complaint deleted successfully" });
  } catch (err) {
    console.error("deleteComplaint error:", err);
    return res.status(500).json({
      success: false,
      message: "Error deleting complaint",
      error: err.message,
    });
  }
};