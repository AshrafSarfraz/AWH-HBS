// routes/groupBrand.routes.js
const express = require("express");
const router = express.Router();

const {
  createGroupBrand,
  getAllGroupBrands,
  getGroupBrandById,
  updateGroupBrand,
  deleteGroupBrand
} = require("../controllers/groupBrandsController");

// POST /api/group-brands
router.post("/", createGroupBrand);

// GET /api/group-brands
router.get("/", getAllGroupBrands);

// GET /api/group-brands/:id
router.get("/:id", getGroupBrandById);

// PUT /api/group-brands/:id
router.put("/:id", updateGroupBrand);

// DELETE /api/group-brands/:id
router.delete("/:id", deleteGroupBrand);

module.exports = router;
