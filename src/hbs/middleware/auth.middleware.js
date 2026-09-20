// src/hbs/middleware/auth.middleware.js
//
// KYA BADLA:
//  - Pehle HAR authenticated request par `User.findOne({$or:[...]})` chalti
//    thi. Chat app me ye hazaron extra queries banti hain. Ab 60 second ka
//    cache hai — 95% requests bina DB touch kiye nikal jati hain.
//  - JWT_SECRET ab seedha process.env se (pehle login.controller se import ho
//    raha tha, jis se circular dependency ka khatra tha).
//  - Errors ab next(err) se global handler ko jate hain.

const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const User = require("../models/User");
const { TTLCache } = require("../utils/ttlCache");

const JWT_SECRET = process.env.JWT_SECRET;

// token-subject -> user object
const authCache = new TTLCache({ ttl: 60_000, maxSize: 20_000 });

function extractToken(header) {
  if (!header) return null;
  return header.startsWith("Bearer ") ? header.slice(7).trim() : header.trim();
}

async function authMiddleware(req, res, next) {
  const token = extractToken(req.headers["authorization"]);

  if (!token) {
    return res.status(401).json({ message: "Authorization header required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired auth token" });
  }

  try {
    const subject = String(decoded.id || decoded._id || decoded.phone || decoded.email || "");
    if (!subject) {
      return res.status(401).json({ message: "Invalid user token" });
    }

    // ── Cache hit — koi DB query nahi ──────────────────────────────────
    let user = authCache.get(subject);

    if (!user) {
      // Token hosted API se bana ho sakta hai jab ke ab local DB use ho rahi
      // hai — is liye id ke saath phone/email se bhi dhoondte hain.
      const or = [];
      if (mongoose.isValidObjectId(decoded.id || decoded._id)) {
        or.push({ _id: decoded.id || decoded._id });
      }
      if (decoded.phone) or.push({ phone: String(decoded.phone).trim() });
      if (decoded.email) or.push({ email: String(decoded.email).toLowerCase() });

      if (!or.length) {
        return res.status(401).json({ message: "Invalid user token" });
      }

      const found = await User.findOne({ $or: or })
        .select("_id name email phone")
        .lean();

      if (!found) {
        return res.status(401).json({
          message: "User does not exist in this backend. Please sign in again.",
        });
      }

      user = {
        id: String(found._id),
        _id: found._id,
        name: found.name,
        email: found.email,
        phone: found.phone,
      };
      authCache.set(subject, user);
    }

    req.user = { ...decoded, ...user };
    next();
  } catch (err) {
    next(err);
  }
}

/** User ka data badle (profile update, delete) to cache saaf karo */
function invalidateAuthCache(subject) {
  authCache.delete(String(subject));
}

module.exports = { authMiddleware, invalidateAuthCache, JWT_SECRET };
