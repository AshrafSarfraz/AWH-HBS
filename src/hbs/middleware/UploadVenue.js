// src/hbs/middleware/uploadVenueFile.js
const multer = require("multer");

// memoryStorage kyunki Firebase pe buffer se upload kar rahe
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
});

// Venue ke liye sirf ek hi image: "img"
const uploadVenueFile = upload.single("img");

module.exports = { uploadVenueFile };
