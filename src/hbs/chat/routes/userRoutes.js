// /src/hbs/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { authMiddleware } = require("../../middleware/auth.middleware");

// ─────────────────────────────────────────
// GET /api/users
// ✅ NEW: Search support — ?search=ahmed
// ─────────────────────────────────────────
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;

    // Base query — apne aap ko exclude karo
    const query = { _id: { $ne: req.user.id } };

    // ✅ NEW: Search by name (case-insensitive)
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }

    // ✅ NEW: Limit lagao — bina search ke max 50, search mein max 20
    const limit = search ? 20 : 50;

    const users = await User.find(query, "_id name avatar email").limit(limit);

    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

module.exports = router;