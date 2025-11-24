// /config/db.js
const mongoose = require("mongoose");

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(uri, {
      // mongoose v8 doesn't need extra opts
    });
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ Mongo connect error:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
