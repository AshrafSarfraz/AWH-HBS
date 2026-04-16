// src/utils/uploadAvatarFile.js
const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB for avatars
});

const uploadAvatarFile = upload.single("file");
module.exports = { uploadAvatarFile };