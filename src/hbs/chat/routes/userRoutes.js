// /src/hbs/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { Follow } = require("../model/follow");
const { DEFAULT_MESSAGE_PERMISSION } = require("../services/messagePrivacy");
const mongoose = require("mongoose");

function currentUserId(req) {
  return String(req.user?.id || req.user?._id || "");
}

function validUserId(id) {
  return mongoose.isValidObjectId(id);
}

async function followState(viewerId, profileId) {
  const [following, followedBy] = await Promise.all([
    Follow.findOne({ follower: viewerId, following: profileId }).select("status"),
    Follow.findOne({ follower: profileId, following: viewerId }).select("status"),
  ]);
  return {
    followingStatus: following?.status || "none",
    followedByStatus: followedBy?.status || "none",
  };
}

// GET /api/users/followers — people following the logged-in user
router.get("/followers", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const followers = await Follow.find({ following: userId, status: "accepted" })
      .populate("follower", "_id name avatar bio")
      .sort({ updatedAt: -1 });
    res.json(followers.map((item) => item.follower).filter(Boolean));
  } catch (err) {
    console.error("Fetch followers error:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET /api/users/following — people the logged-in user follows
router.get("/following", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const following = await Follow.find({ follower: userId, status: "accepted" })
      .populate("following", "_id name avatar bio")
      .sort({ updatedAt: -1 });
    res.json(following.map((item) => item.following).filter(Boolean));
  } catch (err) {
    console.error("Fetch following error:", err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

// GET /api/users/follow-requests — pending requests for a private account
router.get("/follow-requests", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const requests = await Follow.find({ following: userId, status: "pending" })
      .populate("follower", "_id name avatar bio")
      .sort({ createdAt: -1 });
    res.json(requests.map((item) => ({ _id: item._id, user: item.follower })).filter((item) => item.user));
  } catch (err) {
    console.error("Fetch follow requests error:", err);
    res.status(500).json({ error: "Failed to fetch follow requests" });
  }
});

// GET /api/users/follow-status/:userId
router.get("/follow-status/:userId", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const otherId = req.params.userId;
    if (!validUserId(otherId)) return res.status(400).json({ error: "Invalid user id" });
    if (userId === String(otherId)) return res.json({ followingStatus: "self", followedByStatus: "self" });
    res.json(await followState(userId, otherId));
  } catch (err) {
    console.error("Follow status error:", err);
    res.status(500).json({ error: "Failed to fetch follow status" });
  }
});

// POST /api/users/follow/:userId — follows public accounts immediately; requests private accounts
router.post("/follow/:userId", authMiddleware, async (req, res) => {
  try {
    const follower = currentUserId(req);
    const following = req.params.userId;
    if (!validUserId(following)) return res.status(400).json({ error: "Invalid user id" });
    if (follower === String(following)) return res.status(400).json({ error: "You cannot follow yourself" });

    const target = await User.findById(following).select("privacySettings.isPrivate");
    if (!target) return res.status(404).json({ error: "User not found" });

    const status = target.privacySettings?.isPrivate ? "pending" : "accepted";
    const record = await Follow.findOneAndUpdate(
      { follower, following },
      { $setOnInsert: { status } },
      { new: true, upsert: true }
    );
    res.status(record.status === "pending" ? 202 : 200).json({ status: record.status });
  } catch (err) {
    console.error("Follow user error:", err);
    res.status(500).json({ error: "Failed to follow user" });
  }
});

// DELETE /api/users/follow/:userId — unfollow or cancel a pending request
router.delete("/follow/:userId", authMiddleware, async (req, res) => {
  try {
    const follower = currentUserId(req);
    const following = req.params.userId;
    if (!validUserId(following)) return res.status(400).json({ error: "Invalid user id" });
    await Follow.findOneAndDelete({ follower, following });
    res.json({ message: "Unfollowed" });
  } catch (err) {
    console.error("Unfollow user error:", err);
    res.status(500).json({ error: "Failed to unfollow user" });
  }
});

// POST /api/users/follow-requests/:userId/approve
router.post("/follow-requests/:userId/approve", authMiddleware, async (req, res) => {
  try {
    const following = currentUserId(req);
    const follower = req.params.userId;
    if (!validUserId(follower)) return res.status(400).json({ error: "Invalid user id" });
    const request = await Follow.findOneAndUpdate(
      { follower, following, status: "pending" },
      { $set: { status: "accepted" } },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: "Follow request not found" });
    res.json({ status: "accepted" });
  } catch (err) {
    console.error("Approve follow request error:", err);
    res.status(500).json({ error: "Failed to approve follow request" });
  }
});

// DELETE /api/users/follow-requests/:userId — reject a pending request
router.delete("/follow-requests/:userId", authMiddleware, async (req, res) => {
  try {
    const following = currentUserId(req);
    const follower = req.params.userId;
    if (!validUserId(follower)) return res.status(400).json({ error: "Invalid user id" });
    const request = await Follow.findOneAndDelete({ follower, following, status: "pending" });
    if (!request) return res.status(404).json({ error: "Follow request not found" });
    res.json({ message: "Follow request rejected" });
  } catch (err) {
    console.error("Reject follow request error:", err);
    res.status(500).json({ error: "Failed to reject follow request" });
  }
});

// GET /api/users  — list + search
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search } = req.query;
    const query = { _id: { $ne: currentUserId(req) } };
    if (search && search.trim()) {
      query.name = { $regex: search.trim(), $options: "i" };
    }
    const limit = search ? 20000 : 50000;
    const users = await User.find(query, "_id name avatar email privacySettings.isPrivate").limit(limit);
    const userId = currentUserId(req);
    const connections = await Follow.find({
      $or: [{ follower: userId }, { following: userId }],
    }).select("follower following status");
    const relationshipByUser = new Map();
    connections.forEach((connection) => {
      const otherId = String(connection.follower) === userId
        ? String(connection.following)
        : String(connection.follower);
      const previous = relationshipByUser.get(otherId) || {
        followingStatus: "none",
        followedByStatus: "none",
      };
      if (String(connection.follower) === userId) previous.followingStatus = connection.status;
      else previous.followedByStatus = connection.status;
      relationshipByUser.set(otherId, previous);
    });
    res.json(users.map((user) => ({
      ...user.toObject(),
      relationship: relationshipByUser.get(String(user._id)) || {
        followingStatus: "none",
        followedByStatus: "none",
      },
    })));
  } catch (err) {
    console.error("Fetch users error:", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// ✅ PRIVACY — /:id se PEHLE rakhna zaroori hai
// GET /api/users/privacy
router.get("/privacy", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!validUserId(userId)) return res.status(401).json({ error: "Invalid access token" });
    const user = await User.findById(userId).select("privacySettings");
    if (!user) return res.status(404).json({ error: "User not found. Please sign in again." });
    res.json({
      hideLastSeen:     user?.privacySettings?.hideLastSeen     ?? false,
      hideOnlineStatus: user?.privacySettings?.hideOnlineStatus ?? false,
      isPrivate:        user?.privacySettings?.isPrivate        ?? false,
      messagePermission: user?.privacySettings?.messagePermission || DEFAULT_MESSAGE_PERMISSION,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed" });
  }
});

// PUT /api/users/privacy
router.put("/privacy", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    if (!validUserId(userId)) return res.status(401).json({ error: "Invalid access token" });
    const { hideLastSeen, hideOnlineStatus, isPrivate, messagePermission } = req.body;
    const update = {};
    if (typeof hideLastSeen     === "boolean") update["privacySettings.hideLastSeen"]     = hideLastSeen;
    if (typeof hideOnlineStatus === "boolean") update["privacySettings.hideOnlineStatus"] = hideOnlineStatus;
    if (typeof isPrivate === "boolean") update["privacySettings.isPrivate"] = isPrivate;
    if (["everyone", "followers", "following", "mutual", "nobody"].includes(messagePermission)) {
      update["privacySettings.messagePermission"] = messagePermission;
    } else if (messagePermission !== undefined) {
      return res.status(400).json({ error: "Invalid messagePermission" });
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ error: "Nothing to update" });
    }
    const user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true })
      .select("privacySettings");
    if (!user) return res.status(404).json({ error: "User not found. Please sign in again." });
    res.json({
      message: "Updated",
      hideLastSeen: user.privacySettings.hideLastSeen,
      hideOnlineStatus: user.privacySettings.hideOnlineStatus,
      isPrivate: user.privacySettings.isPrivate,
      messagePermission: user.privacySettings.messagePermission || DEFAULT_MESSAGE_PERMISSION,
    });
  } catch (err) {
    console.error("Update privacy error:", err);
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

// GET /api/users/:id  — single user
// ⚠️ YEH HAMESHA LAST MEIN RAHEGA
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!validUserId(req.params.id)) return res.status(400).json({ error: "Invalid user id" });
    const user = await User.findById(req.params.id).select("_id name email phone avatar bio birthday privacySettings.isPrivate");
    if (!user) return res.status(404).json({ error: "User not found" });
    const [followersCount, followingCount, relationship] = await Promise.all([
      Follow.countDocuments({ following: user._id, status: "accepted" }),
      Follow.countDocuments({ follower: user._id, status: "accepted" }),
      currentUserId(req) === String(user._id) ? Promise.resolve(null) : followState(currentUserId(req), user._id),
    ]);
    res.json({ ...user.toObject(), followersCount, followingCount, relationship });
  } catch (err) {
    console.error("Fetch user error:", err);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

module.exports = router;
