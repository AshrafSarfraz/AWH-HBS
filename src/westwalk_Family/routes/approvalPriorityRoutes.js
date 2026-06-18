const express = require("express");
const router = express.Router();

const {
  getApprovalPriority,
  upsertApprovalPriority,
} = require("../controller/formAdmincontroller");

// load approval chain
router.get("/:formKey", getApprovalPriority);

// create / update approval chain
router.put("/:formKey", upsertApprovalPriority);

module.exports = router;
