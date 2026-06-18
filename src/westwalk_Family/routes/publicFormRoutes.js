const express = require("express");
const router = express.Router();

const {
  getForms,
  getFormDefinition,
  submitForm,
} = require("../controller/publicFormController");

router.get("/", getForms);                      // GET /api/forms
router.get("/:formKey", getFormDefinition);     // GET /api/forms/:formKey
router.post("/:formKey/submit", submitForm);    // POST /api/forms/:formKey/submit

module.exports = router;
