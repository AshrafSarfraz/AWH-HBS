const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/venderAccountController");

// CRUD Routes
router.post("/", vendorController.createVendor);
router.get("/", vendorController.getAllVendors);
router.get("/:id", vendorController.getVendor);
router.put("/:id", vendorController.updateVendor);
router.delete("/:id", vendorController.deleteVendor);

// Login Route
router.post("/login", vendorController.loginVendor);

module.exports = router;
