// authentication/login.controller.js
const jwt = require("jsonwebtoken");

// JWT secret (production me .env me rakhna)
const JWT_SECRET = process.env.JWT_SECRET; 

// yahan HARD-CODED user (DB nahi hai)
const ALLOWED_USERNAME = "HalaBSaudi";
const ALLOWED_PASSWORD = "75RfgxSX";

// Base64 JSON decode helper
function decodeBase64Json(base64String) {
  const jsonString = Buffer.from(base64String, "base64").toString("utf8");
  return JSON.parse(jsonString);
}

// POST /login
// body: { "url": "<base64-string>" }
async function login(req, res) {
  const { url } = req.body; // tum yahan apna "url" / token bhejoge

  if (!url) {
    return res.status(400).json({ message: "url (base64) required in body" });
  }

  try {
    // 1) base64 decode -> JSON
    const data = decodeBase64Json(url);
    const { Username, Password } = data;

    if (!Username || !Password) {
      return res.status(400).json({ message: "Invalid data inside url" });
    }

    // 2) hard-coded username/password check
    if (Username !== ALLOWED_USERNAME || Password !== ALLOWED_PASSWORD) {
      return res.status(401).json({ message: "Invalid username or password" });
    }

    // 3) auth key (JWT) banao
    const authKey = jwt.sign(
      { username: Username },
      JWT_SECRET,
      { expiresIn: "9999d" } // 1 ghanta valid
    );

    return res.json({
      message: "Login successful",
      authKey, // 👉 ye key tum baaki APIs me use karoge
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(400).json({ message: "Invalid base64 url format" });
  }
}

module.exports = { login, JWT_SECRET };
