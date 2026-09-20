// src/hbs/chat/middleware/upload.js
//
// KYA BADLA:
//  - HEIC / HEIF allow (iPhone photos pehle reject ho rahi thin — yehi wajah
//    thi ke "image nahi ja rahi").
//  - Audio (voice note) aur zyada document types allow.
//  - Video ke liye 50 MB, baaki ke liye 15 MB — pehle sab par 10 MB tha.
//  - Multer errors ab saaf JSON message dete hain. Pehle file bari hone par
//    generic 500 aata tha aur app ko pata hi nahi chalta tha kya hua.

const multer = require("multer");

const ALLOWED_MIMES = new Set([
  // images
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic", // ✅ NEW — iPhone
  "image/heif", // ✅ NEW — iPhone
  // video
  "video/mp4",
  "video/quicktime",
  "video/x-matroska",
  "video/webm",
  // audio (voice notes)
  "audio/mpeg",
  "audio/mp4",
  "audio/aac",
  "audio/ogg",
  "audio/webm",
  "audio/wav",
  "audio/x-m4a",
  // documents
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
]);

const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
const MAX_OTHER_BYTES = 15 * 1024 * 1024; // 15 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIMES.has(file.mimetype)) {
      const err = new Error(`File type not allowed: ${file.mimetype}`);
      err.code = "UNSUPPORTED_FILE_TYPE";
      return cb(err, false);
    }
    cb(null, true);
  },
});

/**
 * Multer ke errors ko saaf JSON me badalta hai.
 * Route me `upload.single("file")` ke FORAN BAAD lagayein.
 */
function handleUploadErrors(err, req, res, next) {
  if (!err) return next();

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File bohot bari hai",
      maxVideoMB: MAX_VIDEO_BYTES / (1024 * 1024),
      maxOtherMB: MAX_OTHER_BYTES / (1024 * 1024),
    });
  }
  if (err.code === "UNSUPPORTED_FILE_TYPE") {
    return res.status(415).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  return next(err);
}

/** Non-video files par chhoti limit lagati hai (multer ke baad chalti hai). */
function enforcePerTypeSize(req, res, next) {
  if (!req.file) return next();
  const isVideo = req.file.mimetype.startsWith("video/");
  const limit = isVideo ? MAX_VIDEO_BYTES : MAX_OTHER_BYTES;
  if (req.file.size > limit) {
    return res.status(413).json({
      error: `Ye file ${Math.round(limit / (1024 * 1024))} MB se bari nahi honi chahiye`,
    });
  }
  next();
}

module.exports = upload;
module.exports.upload = upload;
module.exports.handleUploadErrors = handleUploadErrors;
module.exports.enforcePerTypeSize = enforcePerTypeSize;
module.exports.ALLOWED_MIMES = ALLOWED_MIMES;
