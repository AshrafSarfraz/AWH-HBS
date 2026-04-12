// routes/HComplaintRoutes.js
const express = require("express");
const router = express.Router();
const multer = require("multer");
const {
  createComplaint,
  getComplaints,
  getComplaintById,
  updateComplaint,
  deleteComplaint,
  getComplaintsByQID,
} = require("../controller/complaint");

// Multer — memory storage (same pattern as your brands)
const upload = multer({ storage: multer.memoryStorage() });
router.get("/my", getComplaintsByQID);


router.post(  "/",    upload.fields([{ name: "image", maxCount: 3 }]), createComplaint);
router.get(   "/",    getComplaints);
router.get(   "/:id", getComplaintById);
router.put(   "/:id", upload.fields([{ name: "image", maxCount: 3 }]), updateComplaint);
router.delete("/:id", deleteComplaint);

module.exports = router;