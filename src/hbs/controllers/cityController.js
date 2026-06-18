// src/hbs/controllers/cityController.js
const City = require("../models/city");

// CREATE
exports.createCity = async (req, res) => {
  try {
    const city = await City.create(req.body);
    res.status(201).json(city);
  } catch (err) {
    res.status(400).json({ message: "Error creating city", error: err.message });
  }
};

// GET ALL
exports.getCities = async (req, res) => {
  try {
    const cities = await City.find();
    res.json(cities);
  } catch (err) {
    res.status(500).json({ message: "Error fetching cities", error: err.message });
  }
};

// GET BY ID
exports.getCityById = async (req, res) => {
  try {
    const city = await City.findById(req.params.id);
    if (!city) return res.status(404).json({ message: "City not found" });

    res.json(city);
  } catch (err) {
    res.status(400).json({ message: "Invalid ID", error: err.message });
  }
};

// UPDATE
exports.updateCity = async (req, res) => {
  try {
    const updatedCity = await City.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!updatedCity) return res.status(404).json({ message: "City not found" });

    res.json(updatedCity);
  } catch (err) {
    res.status(400).json({ message: "Error updating city", error: err.message });
  }
};

// DELETE
exports.deleteCity = async (req, res) => {
  try {
    const deleted = await City.findByIdAndDelete(req.params.id);

    if (!deleted) return res.status(404).json({ message: "City not found" });

    res.json({ message: "City deleted successfully", deleted });
  } catch (err) {
    res.status(400).json({ message: "Error deleting city", error: err.message });
  }
};
