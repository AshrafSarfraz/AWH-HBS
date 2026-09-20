// src/hbs/utils/mediaUpload.js
//
// CHAT IMAGE KE 3 MASLE JO YAHAN FIX HUE HAIN:
//
// 1) iPhone se bheji gayi photo `image/heic` / `image/heif` hoti hai. Purana
//    fileFilter isay reject kar deta tha → "File type not allowed". Ab HEIC
//    allow hai aur sharp se JPEG me convert ho jati hai.
//
// 2) Purana code `fileRef.save(buffer, { public: true })` karta tha. Agar
//    bucket par "Uniform bucket-level access" (UBLA) on ho — Firebase ke naye
//    projects me default on hota hai — to per-object ACL set karna THROW karta
//    hai, aur upload fail ho jata tha. Ab hum Firebase download token wala URL
//    banate hain jo UBLA ke saath bhi chalta hai, aur makePublic() sirf
//    fallback ke taur par try hota hai.
//
// 3) Koi compression nahi thi — 8 MB ki photo poori upload hoti thi aur
//    receiver poori download karta tha. Ab image resize (max 1600px) + quality
//    80 JPEG hoti hai, aur alag se 320px ka thumbnail banta hai. Chat list
//    thumbnail load karti hai, full image sirf tap par.
//
// sharp OPTIONAL hai: agar install na ho to code crash nahi karega, bas
// compression skip ho jayegi. Install karne ke liye:  npm i sharp

const path = require("path");
const crypto = require("crypto");
const { bucket } = require("../../database/firebase");

// ── sharp optional load ────────────────────────────────────────────────
let sharp = null;
try {
  // eslint-disable-next-line global-require
  sharp = require("sharp");
} catch {
  console.warn(
    "[mediaUpload] sharp install nahi hai — images bina compress kiye upload hongi. `npm i sharp` chalayein."
  );
}

const MAX_IMAGE_DIMENSION = 1600; // full image ka max side
const THUMB_DIMENSION = 320; // preview ka max side
const IMAGE_QUALITY = 80;

const IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic", // iPhone
  "image/heif", // iPhone
]);

/** mimetype se humara internal media type */
function detectMediaType(mimetype = "") {
  if (IMAGE_MIMES.has(mimetype)) return "image";
  if (mimetype.startsWith("image/")) return "image";
  if (mimetype.startsWith("video/")) return "video";
  if (mimetype.startsWith("audio/")) return "audio";
  return "document";
}

function safeBaseName(originalname = "file") {
  const ext = path.extname(originalname);
  return path
    .basename(originalname, ext)
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 60);
}

/**
 * Ek buffer ko bucket par chadhao aur aisa URL wapas do jo har bucket config
 * par kaam kare.
 */
async function putObject({ objectPath, buffer, contentType }) {
  const file = bucket.file(objectPath);

  // Firebase download token — UBLA ke saath bhi chalta hai
  const downloadToken = crypto.randomUUID();

  await file.save(buffer, {
    resumable: false, // chhoti files ke liye tez
    contentType,
    metadata: {
      contentType,
      // Media immutable hai (filename me random hash hai) — 1 saal cache
      cacheControl: "public, max-age=31536000, immutable",
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    },
  });

  // Pehla option: Firebase download URL (UBLA-safe, hamesha chalta hai)
  const firebaseUrl = `https://firebasestorage.googleapis.com/v0/b/${
    bucket.name
  }/o/${encodeURIComponent(objectPath)}?alt=media&token=${downloadToken}`;

  // Doosra option: agar bucket legacy ACL allow karta hai to seedha public URL
  // (thoda tez hai kyunki Firebase proxy beech me nahi aata).
  try {
    await file.makePublic();
    return `https://storage.googleapis.com/${bucket.name}/${objectPath}`;
  } catch {
    // UBLA on hai — bilkul theek, download token wala URL use karo
    return firebaseUrl;
  }
}

/**
 * Chat / brand media upload.
 *
 * @param {object} params
 * @param {Buffer} params.buffer
 * @param {string} params.mimetype
 * @param {string} params.originalname
 * @param {string} [params.folder="chat"]
 * @param {boolean} [params.makeThumbnail=true]
 * @returns {Promise<{
 *   mediaUrl:string, thumbnailUrl:string|null, mediaType:string,
 *   mediaName:string, mediaSize:number, width:number|null, height:number|null
 * }>}
 */
async function uploadMediaBuffer({
  buffer,
  mimetype,
  originalname,
  folder = "chat",
  makeThumbnail = true,
}) {
  if (!buffer || !buffer.length) throw new Error("Empty file buffer");

  const mediaType = detectMediaType(mimetype);
  const base = safeBaseName(originalname);
  const id = crypto.randomBytes(12).toString("hex");

  let uploadBuffer = buffer;
  let uploadMime = mimetype;
  let ext = path.extname(originalname) || "";
  let width = null;
  let height = null;
  let thumbnailUrl = null;

  // ── Image ho to compress + thumbnail ─────────────────────────────────
  // GIF ko chhorte hain — resize karne se animation khatam ho jati hai.
  const shouldProcess =
    sharp && mediaType === "image" && mimetype !== "image/gif";

  if (shouldProcess) {
    try {
      const img = sharp(buffer, { failOn: "none" }).rotate(); // EXIF rotation fix
      const meta = await img.metadata();

      const processed = await img
        .resize({
          width: MAX_IMAGE_DIMENSION,
          height: MAX_IMAGE_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality: IMAGE_QUALITY, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });

      uploadBuffer = processed.data;
      uploadMime = "image/jpeg";
      ext = ".jpg";
      width = processed.info.width;
      height = processed.info.height;

      if (makeThumbnail) {
        const thumb = await sharp(buffer, { failOn: "none" })
          .rotate()
          .resize({
            width: THUMB_DIMENSION,
            height: THUMB_DIMENSION,
            fit: "inside",
            withoutEnlargement: true,
          })
          .jpeg({ quality: 70, mozjpeg: true })
          .toBuffer();

        thumbnailUrl = await putObject({
          objectPath: `${folder}/thumb/${id}-${base}.jpg`,
          buffer: thumb,
          contentType: "image/jpeg",
        });
      }

      if (!width && meta) {
        width = meta.width || null;
        height = meta.height || null;
      }
    } catch (err) {
      // Corrupt image ya unsupported HEIC build — original hi chadha do
      console.warn("[mediaUpload] image process fail, raw upload:", err.message);
      uploadBuffer = buffer;
      uploadMime = mimetype;
    }
  }

  const mediaUrl = await putObject({
    objectPath: `${folder}/${id}-${base}${ext}`,
    buffer: uploadBuffer,
    contentType: uploadMime,
  });

  return {
    mediaUrl,
    thumbnailUrl,
    mediaType,
    mediaName: originalname,
    mediaSize: uploadBuffer.length,
    width,
    height,
  };
}

module.exports = {
  uploadMediaBuffer,
  detectMediaType,
  IMAGE_MIMES,
};
