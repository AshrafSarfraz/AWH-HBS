const { visiblePhotoAuthors } = require("../../chat/services/profileAccess");
// /src/hbs/mapGallery/controller/location.js

require("dotenv").config();
const Venue = require("../../models/venue");
const Brand = require("../../models/brands")
const Location = require("../models/location");
const Photo = require("../models/photos");
const axios = require("axios");

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const PLACEHOLDER_NAMES = new Set(["unknown", "current location"]);

const isPlaceholderName = (name) => {
  if (!name || typeof name !== "string") return true;
  return PLACEHOLDER_NAMES.has(name.trim().toLowerCase());
};

/**
 * Find the nearest named venue/place using Google Places Nearby Search.
 * Returns the top result's name (e.g. "Starbucks", "Central Park", "Dubai Mall")
 * instead of a raw street address.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radius=100]  search radius in metres
 * @returns {Promise<string|null>}
 */
const getNearestPlaceName = async (lat, lng, radius = 100) => {
  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius,
          key: process.env.GOOGLE_API_KEY,
        },
        timeout: 5000,
      }
    );

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[getNearestPlaceName] Google error:", data.status);
      return null;
    }

    const place = data.results?.[0];
    if (!place) return null;

    const name = place.name;
    if (!name || isPlaceholderName(name)) return null;

    return name;
  } catch (err) {
    console.warn("[getNearestPlaceName error]", err.message);
    return null;
  }
};

/**
 * Fetch up to `limit` nearby places from Google Places Nearby Search.
 * Used by the suggestion endpoint so the frontend can offer the user a choice.
 *
 * @param {number} lat
 * @param {number} lng
 * @param {number} [radius=200]
 * @param {number} [limit=10]
 * @returns {Promise<Array<{placeId, name, vicinity, types, location}>>}
 */
const fetchNearbySuggestions = async (lat, lng, radius = 200, limit = 10) => {
  try {
    const { data } = await axios.get(
      "https://maps.googleapis.com/maps/api/place/nearbysearch/json",
      {
        params: {
          location: `${lat},${lng}`,
          radius,
          key: process.env.GOOGLE_API_KEY,
        },
        timeout: 5000,
      }
    );

    if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      console.warn("[fetchNearbySuggestions] Google error:", data.status);
      return [];
    }

    return (data.results || [])
      .slice(0, limit)
      .map((p) => ({
        placeId: p.place_id,
        name: p.name,
        vicinity: p.vicinity,       // short address / neighbourhood
        types: p.types,             // ["cafe", "restaurant", …]
        location: {
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng,
        },
      }));
  } catch (err) {
    console.warn("[fetchNearbySuggestions error]", err.message);
    return [];
  }
};

// ─────────────────────────────────────────────
// Controllers
// ─────────────────────────────────────────────

/**
 * POST /api/hbs/map/location
 * Create or return an existing location.
 * The stored name is now a real venue/place name, not a raw address.
 */
exports.createOrGetLocation = async (req, res) => {
  try {
    const { lat, lng } = req.body;

    if (lat == null || lng == null) {
      return res.status(400).json({ error: "lat and lng required" });
    }

    const parsedLat = parseFloat(lat);
    const parsedLng = parseFloat(lng);

    if (isNaN(parsedLat) || isNaN(parsedLng)) {
      return res.status(400).json({ error: "Invalid coordinates" });
    }

    // 1. Check for an existing location within 100 m
    let location = await Location.findOne({
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parsedLng, parsedLat],
          },
          $maxDistance: 100,
        },
      },
    });

    // 2. Found → fix placeholder name if needed
    if (location) {
      if (isPlaceholderName(location.name)) {
        const placeName = await getNearestPlaceName(parsedLat, parsedLng);
        location.name = placeName || "Current Location";
        await location.save();
      }
      return res.json({ data: location });
    }

    // 3. Create a new location with a real venue name
    const name =
      (await getNearestPlaceName(parsedLat, parsedLng)) || "Current Location";

    location = await Location.create({
      name,
      location: {
        type: "Point",
        coordinates: [parsedLng, parsedLat],
      },
    });

    return res.status(201).json({ data: location });
  } catch (err) {
    console.error("[createOrGetLocation]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/hbs/map/locations?lat=&lng=
 * Return locations stored in MongoDB that are within 200 m.
 */
exports.getNearbyLocations = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat/lng required" });
    }

    const locations = await Location.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [lng, lat],
          },
          distanceField: "distance",
          maxDistance: 200,
          spherical: true,
          key: "location",
        },
      },
      {
        $project: { name: 1, location: 1, distance: 1 },
      },
      { $sort: { distance: 1 } },
    ]);

    return res.json({ data: locations });
  } catch (err) {
    console.error("[getNearbyLocations]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/hbs/map/suggestions?lat=&lng=[&radius=200][&limit=10]
 *
 * Returns up to `limit` real venues/places near the coordinates straight from
 * Google Places API. The frontend uses this list to let the user pick a
 * different location name before posting their photo.
 *
 * Response:
 * {
 *   data: [
 *     {
 *       placeId: "ChIJ…",
 *       name: "Dubai Mall",
 *       vicinity: "Financial Centre Road, Dubai",
 *       types: ["shopping_mall", "point_of_interest", …],
 *       location: { lat: 25.19, lng: 55.27 }
 *     },
 *     …
 *   ]
 * }
 */
exports.getNearbySuggestions = async (req, res) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseInt(req.query.radius, 10) || 200;
    const limit = Math.min(parseInt(req.query.limit, 10) || 10, 20); // hard-cap at 20

    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: "lat/lng required" });
    }

    const suggestions = await fetchNearbySuggestions(lat, lng, radius, limit);
    return res.json({ data: suggestions });
  } catch (err) {
    console.error("[getNearbySuggestions]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * PATCH /api/hbs/map/location/:id/name
 *
 * Let the user override the location name with their chosen suggestion.
 * Body: { name: string }
 */
exports.updateLocationName = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required" });
    }

    const location = await Location.findByIdAndUpdate(
      id,
      { name: name.trim() },
      { new: true }
    );

    if (!location) {
      return res.status(404).json({ error: "Location not found" });
    }

    return res.json({ data: location });
  } catch (err) {
    console.error("[updateLocationName]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * GET /api/hbs/map/locations/:id/photos
 */
exports.getLocationPhotos = async (req, res) => {
  try {
    const { id } = req.params;

    const authorIds = await Photo.distinct("user", {location: id});
    const visible = await visiblePhotoAuthors(req.user?.id || req.user?._id, authorIds);
    const photos = await Photo.find({ location: id, user: {$in: visible} })
      .populate("user", "name avatar")
      .sort({ createdAt: -1 });

    return res.json({ data: photos });
  } catch (err) {
    console.error("[getLocationPhotos]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

/**
 * POST /api/hbs/map/photos
 */
exports.addPhoto = async (req, res) => {
  try {
    const { locationId, image, caption } = req.body;

    if (!locationId) {
      return res.status(400).json({ error: "locationId required" });
    }

    if (!image || typeof image !== "string" || !image.trim()) {
      return res.status(400).json({ error: "Valid image required" });
    }

    const exists = await Location.exists({ _id: locationId });
    if (!exists) {
      return res.status(404).json({ error: "Location not found" });
    }

    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const count = await Photo.countDocuments({
      location: locationId,
      user: userId,
    });

    if (count >= 2) {
      return res
        .status(400)
        .json({ error: "Max 2 photos allowed per location" });
    }

    const photo = await Photo.create({
      location: locationId,
      image: image.trim(),
      caption: caption?.trim() || "",
      user: userId,
    });

    return res.status(201).json({ data: photo });
  } catch (err) {
    console.error("[addPhoto]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};


/**
 * GET /api/hbs/map/my-checkins
 * Logged in user's posts/check-ins
 */
exports.getMyCheckins = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const photos = await Photo.find({ user: userId })
      .populate("location", "name location")
      .populate("user", "name profilePhoto")
      .sort({ createdAt: -1 });

    return res.json({ data: photos });
  } catch (err) {
    console.error("[getMyCheckins]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};

exports.getVenueMarkers = async (req, res) => {
  try {
    const venues = await Venue.find({}).lean();
    const brands = await Brand.find({
      latitude: { $exists: true },
      longitude: { $exists: true },
    }).lean();

    const isValidCoord = (lat, lng) =>
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      Math.abs(lat) <= 90 &&
      Math.abs(lng) <= 180 &&
      !(lat === 0 && lng === 0);

    const venueMarkers = venues
      .map((v) => ({
        _id: v._id,
        type: "venue",
        name: v.venueName,
        latitude: Number(v.latitude),
        longitude: Number(v.longitude),
        image: v.img || null,
        address: `${v.city || ""} ${v.country || ""}`.trim(),
      }))
      .filter((m) => isValidCoord(m.latitude, m.longitude));

    const brandMarkers = brands
      .map((b) => ({
        _id: b._id,
        type: "brand",
        name: b.nameEng,
        latitude: parseFloat(b.latitude),
        longitude: parseFloat(b.longitude),
        image: b.img,
        address: b.address,
        discount: b.discounts?.[0]?.value || null,
      }))
      .filter((m) => isValidCoord(m.latitude, m.longitude));

    return res.json({
      data: [...venueMarkers, ...brandMarkers],
    });

  } catch (err) {
    console.log("[venue-markers]", err.message);
    return res.status(500).json({ error: "Server error" });
  }
};