const express = require("express");
const router = express.Router();

const {
  createAdmin,
  getAdmins,
  getAdminById,
  updateAdmin,
  deleteAdmin,
  loginAdmin,
} = require("../controllers/adminController");


router.post("/", createAdmin);          // Create
router.post("/login",loginAdmin);
router.get("/", getAdmins);             // Get All
router.get("/:id", getAdminById);       // Get One
router.put("/:id", updateAdmin);        // Update
router.delete("/:id", deleteAdmin);     // Delete

module.exports = router;
