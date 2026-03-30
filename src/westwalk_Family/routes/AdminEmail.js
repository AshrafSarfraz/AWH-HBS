// routes/HAdminEmailRoutes.js
const express = require("express");
const router  = express.Router();
const {
  addAdminEmail,
  getAdminEmails,
  updateAdminEmail,
  deleteAdminEmail,
} = require("../controller/AdminEmail");

router.post(  "/",    addAdminEmail);
router.get(   "/",    getAdminEmails);
router.put(   "/:id", updateAdminEmail);
router.delete("/:id", deleteAdminEmail);

module.exports = router;
