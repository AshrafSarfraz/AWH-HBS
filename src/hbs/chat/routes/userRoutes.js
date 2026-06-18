// /src/hbs/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { authMiddleware } = require("../../middleware/auth.middleware");

// GET /api/users  — list + search
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    const query = { _id: { $ne: req.user.id } };
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }
    const limit = search ? 20000 : 50000;
    const users = await User.find(query, "_id name avatar email").limit(limit);
    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ✅ PRIVACY — /:id se PEHLE rakhna zaroori hai
// GET /api/users/privacy
router.get("/privacy", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("privacySettings");
    res.json({
      hideLastSeen:     user?.privacySettings?.hideLastSeen     ?? false,
      hideOnlineStatus: user?.privacySettings?.hideOnlineStatus ?? false,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// PUT /api/users/privacy
router.put("/privacy", authMiddleware, async (req, res) => {
  try {
    const { hideLastSeen, hideOnlineStatus } = req.body;
    const update = {};
    if (typeof hideLastSeen     === "boolean") update["privacySettings.hideLastSeen"]     = hideLastSeen;
    if (typeof hideOnlineStatus === "boolean") update["privacySettings.hideOnlineStatus"] = hideOnlineStatus;
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    await User.findByIdAndUpdate(req.user.id, { $set: update });
    res.json({ message: "Updated", ...req.body });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// GET /api/users/:id  — single user
// ⚠️ YEH HAMESHA LAST MEIN RAHEGA
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "_id name email phone avatar bio birthday"
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;