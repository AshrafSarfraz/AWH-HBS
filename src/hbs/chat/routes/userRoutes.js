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
    const limit = search ? 20000 : 50000;

    const users = await User.find(query, "_id name avatar email").limit(limit);

    res.json(users);
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});


router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId).select(
      "_id name email phone avatar bio birthday"
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

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

router.put("/privacy", authMiddleware, async (req, res) => {
  try {
    const { hideLastSeen, hideOnlineStatus } = req.body;
    const update = {};
    if (typeof hideLastSeen    === "boolean") update["privacySettings.hideLastSeen"]    = hideLastSeen;
    if (typeof hideOnlineStatus === "boolean") update["privacySettings.hideOnlineStatus"] = hideOnlineStatus;
    await User.findByIdAndUpdate(req.user.id, { $set: update });
    res.json({ message: "Updated", ...req.body });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

module.exports = router;