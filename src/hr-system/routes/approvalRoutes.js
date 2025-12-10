// const express = require("express");
// const router = express.Router();

// const {
//   getFlowStatus,
//   handleApprovalAction,
//   getMyRequests,
//   getPendingForApprover,

// } = require("../controller/approvalController");

// // ✅ STATIC ROUTES FIRST
// router.get("/my-requests", getMyRequests);          // <-- pehle
// router.get("/", getPendingForApprover);             // <-- phir





// // ✅ DYNAMIC ROUTES LAST
// router.get("/:flowId/action", handleApprovalAction);
// router.get("/:flowId", getFlowStatus);

// module.exports = router;


const express = require("express");
const router = express.Router();

const {
  getFlowStatus,
  handleApprovalAction,
  getMyRequests,
  getPendingForApprover,
  getAllApprovals, 
  deleteFlow,     // 👈 import karo
} = require("../controller/approvalController");

// -----------------------------------
// STATIC ROUTES FIRST
// -----------------------------------
router.get("/my-requests", getMyRequests);
router.get("/", getPendingForApprover);

// 👇 yeh add karo — ALL APPROVALS
router.get("/all", getAllApprovals);

// -----------------------------------
// DYNAMIC ROUTES LAST
// -----------------------------------
router.get("/:flowId/action", handleApprovalAction);
router.get("/:flowId", getFlowStatus);
router.delete("/:flowId", deleteFlow);

module.exports = router;
