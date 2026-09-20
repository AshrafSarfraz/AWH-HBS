// src/hbs/routes/brandsRoutes.js
//
// KYA BADLA: upload errors (file bari / type allowed nahi) ab saaf JSON
// dete hain. Pehle generic 500 aata tha.
//
// ⚠️ Note: ye routes par AUTH nahi hai — koi bhi brand create/delete kar
// sakta hai. Admin middleware lagana chahiye (README me detail).

const express = require("express");
const router = express.Router();

const brandController = require("../controllers/brandController");
const {
  uploadBrandFiles,
  handleBrandUploadErrors,
} = require("../middleware/uploadBrandFiles");

// CREATE
router.post("/", uploadBrandFiles, handleBrandUploadErrors, brandController.createBrand);

// READ all — ?page=1&limit=30&fields=list&status=Active
router.get("/", brandController.getBrands);

// READ single
router.get("/:id", brandController.getBrandById);

// UPDATE
router.put("/:id", uploadBrandFiles, handleBrandUploadErrors, brandController.updateBrand);

// DELETE
router.delete("/:id", brandController.deleteBrand);

module.exports = router;
