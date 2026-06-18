const jwt = require("jsonwebtoken");
const User = require("../models/AdminAuth");
 
const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_change_in_production";
 
const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;
 
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "No token provided" });
  }
 
  const token = authHeader.split(" ")[1];
 
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = await User.findById(decoded.id).select("-password");
    if (!req.user) return res.status(401).json({ message: "User not found" });
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
 
module.exports = protect;
 