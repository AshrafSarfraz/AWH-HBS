// src/hbs/controllers/venueController.js

const Venue = require("../models/venue");
const { uploadToFirebase } = require("../utils/firebaseupload"); // path: src/hbs/controllers -> src/utils

// POST /hbs/venues  -> naya venue create
// Expect: form-data (text fields + img file)
// - img: single file (handled by multer in uploadVenueFile)
exports.createVenue = async (req, res) => {
  try {
    const {
      venueNameAr,
      venueName,
      city,
      country,
      time,
      longitude,
      latitude,
    } = req.body;

    if (!venueName && !venueNameAr) {
      return res.status(400).json({
        success: false,
        message: "venueName ya venueNameAr required hai",
      });
    }

    let imgUrl = null;

    if (req.file) {
      imgUrl = await uploadToFirebase(req.file, "venues");
    }

    const venue = new Venue({
      venueNameAr,
      venueName,
      city,
      country,
      longitude: longitude ? parseFloat(longitude) : undefined,
      latitude: latitude ? parseFloat(latitude) : undefined,
      img: imgUrl,
      time: time || new Date(),
    });

    const saved = await venue.save();

    return res.status(201).json({
      success: true,
      data: saved,
    });
  } catch (err) {
    console.error("Create venue error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create venue",
      error: err.message,
    });
  }
};

// GET /hbs/venues  -> saare venues (latest first)
exports.getAllVenues = async (req, res) => {
  try {
    const venues = await Venue.find().sort({ time: -1 });

    return res.json({
      success: true,
      data: venues,
    });
  } catch (err) {
    console.error("Get all venues error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch venues",
    });
  }
};

// GET /hbs/venues/:id  -> single venue
exports.getVenueById = async (req, res) => {
  try {
    const venue = await Venue.findById(req.params.id);

    if (!venue) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    return res.json({
      success: true,
      data: venue,
    });
  } catch (err) {
    console.error("Get venue by id error:", err);
    return res.status(400).json({
      success: false,
      message: "Invalid ID",
    });
  }
};

// PUT /hbs/venues/:id  -> update venue
// Expect: form-data (text fields + optional new img)
// - agar nayi img aati hai -> Firebase pe upload karke purani replace
exports.updateVenue = async (req, res) => {
  try {
    const {
      venueNameAr,
      venueName,
      city,
      country,
      time,
      longitude,
      latitude,
    } = req.body;

    const updateData = {};

    if (venueNameAr !== undefined) updateData.venueNameAr = venueNameAr;
    if (venueName !== undefined) updateData.venueName = venueName;
    if (city !== undefined) updateData.city = city;
    if (country !== undefined) updateData.country = country;
    if (time !== undefined) updateData.time = time;

    if (longitude !== undefined)
      updateData.longitude = parseFloat(longitude);

    if (latitude !== undefined)
      updateData.latitude = parseFloat(latitude);

    if (req.file) {
      const imgUrl = await uploadToFirebase(req.file, "venues");
      updateData.img = imgUrl;
    }

    const updated = await Venue.findByIdAndUpdate(
      req.params.id,
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Update venue error:", err);
    return res.status(400).json({
      success: false,
      message: "Failed to update venue",
      error: err.message,
    });
  }
};


// DELETE /hbs/venues/:id  -> delete venue
exports.deleteVenue = async (req, res) => {
  try {
    const deleted = await Venue.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });
    }

    return res.json({
      success: true,
      message: "Venue deleted",
    });
  } catch (err) {
    console.error("Delete venue error:", err);
    return res.status(400).json({
      success: false,
      message: "Failed to delete venue",
    });
  }
};
