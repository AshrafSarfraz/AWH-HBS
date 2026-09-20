// src/hbs/middleware/protectWrites.js
//
// MASLA: brand / city / venue ke POST, PUT, DELETE routes par KOI AUTH NAHI
// THI. Jis ke paas bhi URL hai wo brand bana, badal ya delete kar sakta tha.
//
// Ye middleware un routes ko protect karta hai — LEKIN by default OFF hai
// taake aapka mojooda admin panel achanak na ruk jaye.
//
// ── ON karne ka tareeqa ──────────────────────────────────────────────
//  1. Pehle yaqeeni banayein ke admin panel har write request ke saath
//     `Authorization: Bearer <token>` bhej raha hai
//  2. .env me lagayein:  PROTECT_WRITES=true
//  3. Server restart karein
//
// Jab tak OFF hai, boot par warning print hoti rahegi taake ye yaad rahe.

const jwt = require("jsonwebtoken");

const ENABLED = process.env.PROTECT_WRITES === "true";

if (!ENABLED) {
  console.warn(
    "\n⚠️  [SECURITY] Brand / City / Venue ke write routes KHULE hain.\n" +
      "   Koi bhi inhein create/update/delete kar sakta hai.\n" +
      "   Admin panel token bhejne lage to .env me PROTECT_WRITES=true karein.\n"
  );
}

/** Sirf GET requests sab ke liye khuli — baqi par token chahiye */
function protectWrites(req, res, next) {
  if (!ENABLED) return next();
  if (req.method === "GET" || req.method === "OPTIONS") return next();

  const header = req.headers["authorization"];
  if (!header) {
    return res.status(401).json({
      success: false,
      message: "Authorization required for this action",
    });
  }

  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();

  try {
    req.auth = jwt.verify(token, process.env.JWT_SECRET);
    return next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
}

module.exports = { protectWrites, WRITES_PROTECTED: ENABLED };
