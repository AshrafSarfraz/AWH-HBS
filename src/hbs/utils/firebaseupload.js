const path = require("path");

// 👇 path apne project structure ke hisaab se adjust karo
// agar firebaseAdmin.js root pe hai, aur yeh file src/utils/ me hai,
// to ../.. karke root pe aa jaaoge
const { bucket } = require("../../database/firebase");

/**
 * Upload file buffer to Firebase Storage and return public URL
 * @param {Object} file - multer file object
 * @param {String} folder - folder name in bucket
 * @returns {Promise<String|null>}
 */
async function uploadToFirebase(file, folder = "brands") {
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

  // optional: public karna hai to
  await fileUpload.makePublic();

  const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
  return publicUrl;
}

module.exports = { uploadToFirebase };
