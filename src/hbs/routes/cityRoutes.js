// src/hbs/routes/cityRoutes.js
const express = require("express");
const router = express.Router();

const {
  createCity,
  getCities,
  getCityById,
  updateCity,
  deleteCity
} = require("../controllers/cityController");

router.post("/", createCity);        // Create City
router.get("/", getCities);          // Get All Cities
router.get("/:id", getCityById);     // Get Single City
router.put("/:id", updateCity);      // Update City
router.delete("/:id", deleteCity);   // Delete City

module.exports = router;
