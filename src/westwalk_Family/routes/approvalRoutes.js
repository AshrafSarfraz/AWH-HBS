

const express = require("express");
const router = express.Router();

const {
  getFlowStatus,
  handleApprovalAction,
  getMyRequests,
  getPendingForApprover,
  getAllApprovals, 
  deleteFlow,  
  markPrinted,
  sendPdfByEmail,   // 👈 import karo
} = require("../controller/approvalController");

// -----------------------------------
// STATIC ROUTES FIRST
// -----------------------------------
// approvals route file
router.get("/my-requests", getMyRequests);
router.get("/all", getAllApprovals);        // ✅ / se pehle
router.get("/", getPendingForApprover);
router.put("/:flowId/printed", markPrinted);
router.post("/:flowId/action", handleApprovalAction);  // ✅ GET → POST
router.get("/:flowId", getFlowStatus);
router.delete("/:flowId", deleteFlow);
router.post("/:flowId/send-pdf", sendPdfByEmail);

module.exports = router;
