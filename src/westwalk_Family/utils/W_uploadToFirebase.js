// utils/W_uploadToFirebase.js
const path = require("path");
const { bucket } = require("../../database/firebase"); // ✅ fixed

async function W_uploadToFirebase(file, folder = "Maintenance") {
  if (!file) return null;

  const timestamp = Date.now();
  const ext = path.extname(file.originalname);
  const cleanOriginalName = path
    .basename(file.originalname, ext)
    .replace(/\s+/g, "-");
  const fileName = `${folder}/${timestamp}-${cleanOriginalName}${ext}`;

  const fileUpload = bucket.file(fileName);

  await fileUpload.save(file.buffer, {
    metadata: {
      contentType: file.mimetype,
    },
  });

  await fileUpload.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return publicUrl;
}

module.exports = { W_uploadToFirebase };