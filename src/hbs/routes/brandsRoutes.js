const express = require("express");
const router = express.Router();

const brandController = require("../controllers/brandController");
const { uploadBrandFiles } = require("../middleware/uploadBrandFiles");

// CREATE
router.post(
  "/",
  uploadBrandFiles,
  brandController.createBrand
);

// READ all
router.get("/", brandController.getBrands);

// READ single
router.get("/:id", brandController.getBrandById);

// UPDATE
router.put(
  "/:id",
  uploadBrandFiles,
  brandController.updateBrand
);

// DELETE
router.delete("/:id", brandController.deleteBrand);

module.exports = router;
