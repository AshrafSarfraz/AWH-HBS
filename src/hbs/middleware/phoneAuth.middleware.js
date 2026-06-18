// src/hbs/middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

const phoneAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(401).json({ message: "No token provided" });

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // req.user pe wahi fields hongi jo token mein hain
    req.user = {
      _id:   decoded.id,
      email: decoded.email,
      phone: decoded.phone,
      name:  decoded.name,
    };

    next();
  } catch (err) {
    if (err.name === "TokenExpiredError")
      return res.status(401).json({ message: "Token expired" });
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = phoneAuthMiddleware;