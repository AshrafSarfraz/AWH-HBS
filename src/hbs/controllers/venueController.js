const Venue = require("../models/venue");
const { uploadToFirebase } = require("../utils/firebaseupload");


exports.createVenue = async (req, res) => {
  try {
    const {
      venueNameAr,
      venueName,
      city,
      country,
      longitude,
      latitude,
      time,
    } = req.body;

    if (!venueName) {
      return res.status(400).json({
        success: false,
        message: "venueName required",
      });
    }

    if (longitude == null || latitude == null) {
      return res.status(400).json({
        success: false,
        message: "longitude and latitude required",
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
      longitude: parseFloat(longitude),
      latitude: parseFloat(latitude),
      img: imgUrl,
      time: time || new Date(),
    });

    const saved = await venue.save();

    res.status(201).json({
      success: true,
      data: saved,
    });

  } catch (err) {

    console.error(err);

    res.status(500).json({
      success: false,
      error: err.message,
    });

  }
};



exports.getAllVenues = async (req, res) => {

  try {

    const venues = await Venue.find().sort({ time: -1 });

    res.json({
      success: true,
      data: venues,
    });

  } catch (err) {

    res.status(500).json({
      success: false,
      error: err.message,
    });

  }

};



exports.getVenueById = async (req, res) => {

  try {

    const venue = await Venue.findById(req.params.id);

    if (!venue) {

      return res.status(404).json({
        success: false,
        message: "Venue not found",
      });

    }

    res.json({
      success: true,
      data: venue,
    });

  } catch (err) {

    res.status(400).json({
      success: false,
      error: err.message,
    });

  }

};



exports.updateVenue = async (req, res) => {

  try {

    const updateData = { ...req.body };

    if (updateData.longitude)
      updateData.longitude = parseFloat(updateData.longitude);

    if (updateData.latitude)
      updateData.latitude = parseFloat(updateData.latitude);


    if (req.file) {

      const imgUrl = await uploadToFirebase(req.file, "venues");

      updateData.img = imgUrl;

    }


    const updated = await Venue.findByIdAndUpdate(

      req.params.id,

      updateData,

      { new: true }

    );


    res.json({
      success: true,
      data: updated,
    });

  } catch (err) {

    res.status(400).json({
      success: false,
      error: err.message,
    });

  }

};



exports.deleteVenue = async (req, res) => {

  try {

    await Venue.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Venue deleted",
    });

  } catch (err) {

    res.status(400).json({
      success: false,
      error: err.message,
    });

  }

};
