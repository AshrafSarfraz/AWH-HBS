const express = require("express");
const router = express.Router();

const {
  listForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm, // ✅ NEW
} = require("../controller/formAdmincontroller");

router.get("/", listForms);
router.get("/:id", getFormById);
router.post("/", createForm);
router.put("/:id", updateForm);
router.delete("/:id", deleteForm); // ✅ NEW

module.exports = router;
