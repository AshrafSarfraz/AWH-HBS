// src/hbs/controllers/groupAccountController.js
const GroupAccount = require("../models/groupAccount");

// CREATE
exports.createGroupAccount = async (req, res) => {
  try {
    const groupAccount = await GroupAccount.create(req.body);
    res.status(201).json(groupAccount);
  } catch (err) {
    res.status(400).json({
      message: "Error creating group account",
      error: err.message,
    });
  }
};

// GET ALL
exports.getGroupAccounts = async (req, res) => {
  try {
    const accounts = await GroupAccount.find();
    res.json(accounts);
  } catch (err) {
    res.status(500).json({
      message: "Error fetching group accounts",
      error: err.message,
    });
  }
};

// GET BY ID
exports.getGroupAccountById = async (req, res) => {
  try {
    const account = await GroupAccount.findById(req.params.id);
    if (!account) {
      return res.status(404).json({ message: "Group account not found" });
    }
    res.json(account);
  } catch (err) {
    res.status(400).json({
      message: "Invalid ID",
      error: err.message,
    });
  }
};

// UPDATE
exports.updateGroupAccount = async (req, res) => {
  try {
    const updated = await GroupAccount.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Group account not found" });
    }

    res.json(updated);
  } catch (err) {
    res.status(400).json({
      message: "Error updating group account",
      error: err.message,
    });
  }
};

// DELETE
exports.deleteGroupAccount = async (req, res) => {
  try {
    const deleted = await GroupAccount.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: "Group account not found" });
    }

    res.json({ message: "Group account deleted successfully", deleted });
  } catch (err) {
    res.status(400).json({
      message: "Error deleting group account",
      error: err.message,
    });
  }
};
