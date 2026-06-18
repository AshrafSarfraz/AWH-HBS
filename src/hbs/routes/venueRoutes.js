// src/hbs/routes/venues.js
const express = require("express");
const router = express.Router();

const venueController = require("../controllers/venueController");
const { uploadVenueFile } = require("../middleware/UploadVenue");

// Create (with image)
router.post("/", uploadVenueFile, venueController.createVenue);

// Get all
router.get("/", venueController.getAllVenues);

// Get single
router.get("/:id", venueController.getVenueById);

// Update (optional new image)
router.put("/:id", uploadVenueFile, venueController.updateVenue);

// Delete
router.delete("/:id", venueController.deleteVenue);

module.exports = router;
