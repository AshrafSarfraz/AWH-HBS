


const multer = require("multer");

// memoryStorage kyunki hum file ko Firebase pe direct buffer se upload kar rahe
const storage = multer.memoryStorage();

const upload = multer({ storage });

/**
 * Brand related uploads:
 * - img        -> single logo image
 * - heroImage  -> single hero image
 * - pdf        -> single menu pdf
 * - gallery    -> multiple gallery images
 */
const uploadBrandFiles = upload.fields([
  { name: "img", maxCount: 1 },
  { name: "heroImage", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "gallery", maxCount: 10 },
]);

module.exports = { uploadBrandFiles };
