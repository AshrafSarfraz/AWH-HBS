// src/hbs/routes/groupAccountRoutes.js
const express = require("express");
const router = express.Router();

const {
  createGroupAccount,
  getGroupAccounts,
  getGroupAccountById,
  updateGroupAccount,
  deleteGroupAccount,
} = require("../controllers/groupAccountController");

router.post("/", createGroupAccount);           // Create
router.get("/", getGroupAccounts);              // Get all
router.get("/:id", getGroupAccountById);        // Get one
router.put("/:id", updateGroupAccount);         // Update
router.delete("/:id", deleteGroupAccount);      // Delete

module.exports = router;
