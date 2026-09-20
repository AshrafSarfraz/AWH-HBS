// /src/hbs/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../controllers/externalApi/login.controller");
const mongoose = require("mongoose");
const User = require("../models/User");

async function authMiddleware(req, res, next) {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    return res.status(401).json({ message: "Authorization header required" });
  }

  // const [type, token] = authHeader.split(" ");

  // if (type !== "Bearer" || !token) {
  //   return res.status(401).json({ message: "Invalid Authorization format" });
  // }

  let token = null;

  if (authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1]; // Bearer token
  } else {
    token = authHeader; // raw token (no Bearer prefix)
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // A token can have been issued by the hosted API while the app is now
    // pointed at local MongoDB. Resolve its local User record by the token ID
    // first, then by the signed phone/email as a safe migration fallback.
    const candidates = [];
    if (mongoose.isValidObjectId(decoded.id || decoded._id)) {
      candidates.push({ _id: decoded.id || decoded._id });
    }
    if (decoded.phone) candidates.push({ phone: decoded.phone });
    if (decoded.email) candidates.push({ email: String(decoded.email).toLowerCase() });

    if (!candidates.length) {
      return res.status(401).json({ message: "Invalid user token" });
    }

    const user = await User.findOne({ $or: candidates }).select("_id name email phone");
    if (!user) {
      return res.status(401).json({
        message: "User does not exist in this backend. Please sign in again.",
      });
    }

    req.user = {
      ...decoded,
      id: String(user._id),
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
    };
    next();
  } catch (err) {
    console.error("auth error:", err);
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired auth token" });
    }
    return res.status(500).json({ message: "Unable to authenticate user" });
  }
}

module.exports = { authMiddleware };
