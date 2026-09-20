// src/hbs/controllers/externalApi/login.controller.js
//
// ═══════════════════════════════════════════════════════════════════════
// SECURITY FIXES
// ═══════════════════════════════════════════════════════════════════════
//
// 1) HARD-CODED PASSWORD — pehle yahan seedha likha tha:
//        const ALLOWED_USERNAME = "HalaBSaudi";
//        const ALLOWED_PASSWORD = "75RfgxSX";
//    Ye git history me hamesha ke liye mojood hai. Ab .env se aata hai.
//
//    ⚠️ AAP KO KARNA HAI: ye password CHANGE karein aur naya .env me
//       EXTERNAL_API_USER / EXTERNAL_API_PASS me rakhein. Purana password
//       ab bhi repo ki history me padha ja sakta hai.
//
// 2) TOKEN KABHI EXPIRE NAHI HOTA THA — `expiresIn: "9999d"` (comment me
//    likha tha "1 ghanta", asal me ~27 saal). Agar wo token kahin leak ho
//    jaye to hamesha ke liye valid tha. Ab default 7 din.
//
// 3) TIMING-SAFE COMPARE — normal `!==` comparison se attacker response time
//    dekh kar password guess kar sakta hai. Ab crypto.timingSafeEqual.

const jwt = require("jsonwebtoken");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET;

// ✅ .env se — hard-coded nahi
const ALLOWED_USERNAME = process.env.EXTERNAL_API_USER;
const ALLOWED_PASSWORD = process.env.EXTERNAL_API_PASS;

// ✅ 9999d se 7d
const TOKEN_TTL = process.env.EXTERNAL_API_TOKEN_TTL || "7d";

function decodeBase64Json(base64String) {
  const jsonString = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(jsonString);
}

/** Length-independent, timing-safe string compare */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a ?? ""));
  const bufB = Buffer.from(String(b ?? ""));
  if (bufA.length !== bufB.length) {
    // Phir bhi ek compare chalao taake timing leak na ho
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// POST /auth/login
// body: { "url": "<base64 of {Username, Password}>" }
async function login(req, res, next) {
  try {
    if (!ALLOWED_USERNAME || !ALLOWED_PASSWORD) {
      console.error(
        "[login] EXTERNAL_API_USER / EXTERNAL_API_PASS .env me set nahi hain"
      );
      return res.status(500).json({ message: "Server auth not configured" });
    }

    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ message: "url (base64) required in body" });
    }

    let data;
    try {
      data = decodeBase64Json(url);
    } catch {
      return res.status(400).json({ message: "Invalid base64 url format" });
    }

    const { Username, Password } = data || {};
    if (!Username || !Password) {
      return res.status(400).json({ message: "Invalid data inside url" });
    }

    const userOk = safeEqual(Username, ALLOWED_USERNAME);
    const passOk = safeEqual(Password, ALLOWED_PASSWORD);

    if (!userOk || !passOk) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    const authKey = jwt.sign({ username: Username, scope: "external" }, JWT_SECRET, {
      expiresIn: TOKEN_TTL,
    });

    return res.json({
      message: "Login successful",
      authKey,
      expiresIn: TOKEN_TTL,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { login, JWT_SECRET };
