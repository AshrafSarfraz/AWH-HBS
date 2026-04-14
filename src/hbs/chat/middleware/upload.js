// /src/hbs/middleware/uploadMiddleware.js
const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");

// Upload folder banao agar exist nahi karta
const uploadDir = path.join(process.cwd(), "uploads", "chat");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueName = crypto.randomBytes(16).toString("hex");
    cb(null, `${uniqueName}${ext}`);
  },
});

// Allowed file types
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "video/mp4",
    "video/quicktime",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("File type not allowed. Only images, videos, and documents."), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

module.exports = upload;

// ─────────────────────────────────────────
// ⚠️ IMPORTANT: Apne main app.js mein yeh add karo:
// ─────────────────────────────────────────
// const path = require("path");
// app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));