// /src/hbs/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../controllers/externalApi/login.controller");

function authMiddleware(req, res, next) {
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
    req.user = decoded; // req.user.username available
    next();
  } catch (err) {
    console.error("auth error:", err);
    return res.status(401).json({ message: "Invalid or expired authKey" });
  }
}

module.exports = { authMiddleware };
