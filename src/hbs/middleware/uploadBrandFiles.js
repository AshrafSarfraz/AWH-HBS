// src/hbs/middleware/uploadBrandFiles.js
//
// KYA BADLA:
//  - Pehle is multer instance par KOI SIZE LIMIT NAHI THI. Koi bhi admin
//    (ya jis ke paas token ho) 500 MB ki file bhej kar server ki RAM khatam
//    kar sakta tha, kyunki memoryStorage puri file RAM me rakhta hai.
//  - Koi fileFilter bhi nahi tha — .exe tak upload ho sakti thi.

const multer = require("multer");

const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15 MB per file
    files: 13, // img + hero + pdf + 10 gallery
  },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED.has(file.mimetype)) {
      const err = new Error(`File type not allowed: ${file.mimetype}`);
      err.code = "UNSUPPORTED_FILE_TYPE";
      err.status = 415;
      return cb(err, false);
    }
    cb(null, true);
  },
});

const uploadBrandFiles = upload.fields([
  { name: "img", maxCount: 1 },
  { name: "heroImage", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "gallery", maxCount: 10 },
]);

/** uploadBrandFiles ke FORAN BAAD route me lagayein */
function handleBrandUploadErrors(err, req, res, next) {
  if (!err) return next();
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({ success: false, message: "File 15 MB se bari hai" });
  }
  if (err.code === "LIMIT_FILE_COUNT" || err.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({ success: false, message: "Bohot zyada files" });
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ success: false, message: err.message });
  }
  return next(err);
}

module.exports = { uploadBrandFiles, handleBrandUploadErrors };
