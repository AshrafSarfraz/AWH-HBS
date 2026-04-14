// controllers/HComplaintController.js
const Complaint = require("../models/complaint");

const {
  sendEmail,
  complaintConfirmationEmail,
  complaintAdminAlertEmail,
  complaintStatusUpdateEmail,
} = require("../utils/sendEmail");
const { getActiveAdminEmailList } = require("../utils/AdminEmailService");
const { W_uploadToFirebase } = require("../utils/W_uploadToFirebase");



// ─────────────────────────────────────────────
// HELPER — upload multiple images
// ─────────────────────────────────────────────
const uploadImages = async (files) => {
  if (!files || files.length === 0) return [];
  const uploadPromises = files.map((file) =>
    W_uploadToFirebase(file, "complaints/images")
  );
  return Promise.all(uploadPromises);
};

// ─────────────────────────────────────────────
// CREATE Complaint
// POST /api/complaints
// ─────────────────────────────────────────────
exports.createComplaint = async (req, res) => {
  try {
    const body  = req.body;
    const files = req.files || {};

    // ✅ Upload all images (up to 3)
    const imageUrls = await uploadImages(files.image);

    const complaint = new Complaint({
      name:        body.name,
      unitno:      body.unitno,
      qid:         body.qid,
      buildingno:  body.buildingno,
      phoneNumber: body.phoneNumber,
      email:       body.email,
      subject:     body.subject,
      description: body.description,
      images:      imageUrls,        // ✅ array of URLs
    });

    const saved = await complaint.save();

    // Confirmation email → complainant
    const confirmTpl = complaintConfirmationEmail(saved);
    sendEmail({ to: saved.email, ...confirmTpl });

    // Alert email → all active admins
    const adminEmails = await getActiveAdminEmailList();
    if (adminEmails.length > 0) {
      const adminTpl = complaintAdminAlertEmail(saved);
      sendEmail({ to: adminEmails.join(","), ...adminTpl });
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

    // Detect status change
    const previousStatus  = complaint.status;
    const incomingStatus  = body.status;
    const triggerStatuses = ["Resolved", "Rejected"];
    const shouldNotifyUser =
      incomingStatus &&
      incomingStatus !== previousStatus &&
      triggerStatuses.includes(incomingStatus);

    // Update text fields
    const updatableFields = [
      "name", "unitno", "buildingno",
      "phoneNumber", "email",
      "subject", "description", "status","qid"
    ];
    updatableFields.forEach((field) => {
      if (body[field] !== undefined) complaint[field] = body[field];
    });

    // ✅ Upload new images if provided and merge with existing
    if (files.image && files.image.length > 0) {
      const newUrls = await uploadImages(files.image);
      const existing = complaint.images || [];
      // Keep existing + add new, cap at 3
      complaint.images = [...existing, ...newUrls].slice(0, 3);
    }

    const updated = await complaint.save();

    if (shouldNotifyUser) {
      const statusTpl = complaintStatusUpdateEmail(updated);
      sendEmail({ to: updated.email, ...statusTpl });
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


