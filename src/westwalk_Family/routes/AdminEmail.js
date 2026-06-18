// routes/HAdminEmailRoutes.js
const express = require("express");
const router  = express.Router();
const {
  addAdminEmail,
  getAdminEmails,
  updateAdminEmail,
  deleteAdminEmail,
} = require("../controller/AdminEmail");
const protect = require("../middleware/Authmiddleware");

router.post(  "/",   protect,  addAdminEmail);
router.get(   "/",   protect,  getAdminEmails);
router.put(   "/:id", protect, updateAdminEmail);
router.delete("/:id",  protect, deleteAdminEmail);

module.exports = router;
