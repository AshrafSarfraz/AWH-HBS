// /src/hbs/mapGallery/routes/location.js

const express = require("express");
const router = express.Router();

const {
  createOrGetLocation,
  getNearbyLocations,
  getNearbySuggestions,
  updateLocationName,
  getLocationPhotos,
  addPhoto,
  getMyCheckins,
  getVenueMarkers,
} = require("../controller/location");
const { authMiddleware } = require("../../middleware/auth.middleware");

// ── Locations ─────────────────────────────────────────────────────────────────

// Create or fetch an existing location by coordinates
router.post("/location", createOrGetLocation);

// List locations stored in MongoDB near a coordinate (max 200 m)
router.get("/locations", getNearbyLocations);

// Get real Google Places venue suggestions near a coordinate
// GET /api/hbs/map/suggestions?lat=&lng=[&radius=200][&limit=10]
router.get("/suggestions", getNearbySuggestions);

// Let the user rename a location (pick a suggestion)
// PATCH /api/hbs/map/location/:id/name  { name: "Dubai Mall" }
router.patch("/location/:id/name", updateLocationName);

// ── Photos ────────────────────────────────────────────────────────────────────

// ── Photos ────────────────────────────────────────────────────────────────────

router.get("/locations/:id/photos", getLocationPhotos);

router.get("/my-checkins", authMiddleware, getMyCheckins);

router.post("/photos", authMiddleware, addPhoto);

router.get("/venue-markers", getVenueMarkers);

module.exports = router;