

const express = require("express");
const router = express.Router();

const {
  getFlowStatus,
  handleApprovalAction,
  getMyRequests,
  getPendingForApprover,
  getAllApprovals, 
  deleteFlow,  
  markPrinted,   // 👈 import karo
} = require("../controller/approvalController");

// -----------------------------------
// STATIC ROUTES FIRST
// -----------------------------------
router.get("/my-requests", getMyRequests);
router.get("/", getPendingForApprover);

// 👇 yeh add karo — ALL APPROVALS
router.get("/all", getAllApprovals);
router.get("/markPrinted", markPrinted);
// -----------------------------------
// DYNAMIC ROUTES LAST
// -----------------------------------
router.get("/:flowId/action", handleApprovalAction);
router.get("/:flowId", getFlowStatus);
router.delete("/:flowId", deleteFlow);

module.exports = router;
