// /src/hbs/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { Follow } = require("../model/follow");
const { DEFAULT_MESSAGE_PERMISSION } = require("../services/messagePrivacy");
const mongoose = require("mongoose");
// Privacy / follow badalne par socket layer ka cache saaf karna zaroori hai,
// warna 60 second tak purani permission chalti rahegi.
const { invalidateUser } = require("../chatSocket");

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
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 200));
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const followers = await Follow.find({ following: userId, status: "accepted" })
      .populate("follower", "_id name avatar bio")
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const items = followers.map((item) => item.follower).filter(Boolean);
    if (req.query.pagination === "true") {
      const total = await Follow.countDocuments({ following: userId, status: "accepted" });
      return res.json({followers: items, page, limit, total, hasMore: page * limit < total});
    }
    res.json(items);
  } catch (err) {
    console.error("Fetch followers error:", err);
    res.status(500).json({ error: "Failed to fetch followers" });
  }
});

// GET /api/users/following — people the logged-in user follows
router.get("/following", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 200));
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const following = await Follow.find({ follower: userId, status: "accepted" })
      .populate("following", "_id name avatar bio")
      .sort({ updatedAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const items = following.map((item) => item.following).filter(Boolean);
    if (req.query.pagination === "true") {
      const total = await Follow.countDocuments({ follower: userId, status: "accepted" });
      return res.json({following: items, page, limit, total, hasMore: page * limit < total});
    }
    res.json(items);
  } catch (err) {
    console.error("Fetch following error:", err);
    res.status(500).json({ error: "Failed to fetch following" });
  }
});

// GET /api/users/follow-requests — pending requests for a private account
router.get("/follow-requests", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 200, 200));
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const requests = await Follow.find({ following: userId, status: "pending" })
      .populate("follower", "_id name avatar bio")
      .sort({ createdAt: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();
    const items = requests.map((item) => ({ _id: item._id, user: item.follower })).filter((item) => item.user);
    if (req.query.pagination === "true") {
      const total = await Follow.countDocuments({following: userId, status: "pending"});
      return res.json({requests: items, page, limit, total, hasMore: page * limit < total});
    }
    res.json(items);
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
    invalidateUser(follower);
    invalidateUser(following);
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
    invalidateUser(follower);
    invalidateUser(following);
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
    invalidateUser(follower);
    invalidateUser(following);
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

// ─────────────────────────────────────────────────────────────────────
// GET /api/users?search=ali&limit=30&page=1   — list + search
//
// ⚠️ SABSE BADA PERFORMANCE FIX YAHAN THA.
// Pehle: `const limit = search ? 20000 : 50000;`
// Yaani bina search ke 50,000 users memory me load hote the, phir un sab par
// `.toObject()` chalta tha, aur saath me user ke SAARE follow records bhi.
// Ek request server ki saari RAM kha jati thi.
//
// Ab:
//  - default 30, max 100 results
//  - relationship sirf UNHI users ke liye nikalta hai jo is page par hain
//    (pehle poori Follow collection scan hoti thi)
//  - prefix search `^ali` — ye `{ name: 1 }` index use karti hai.
//    Purana `{ $regex: "ali" }` index use hi nahi kar sakta tha.
// ─────────────────────────────────────────────────────────────────────
const MAX_USER_PAGE = 100;

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = currentUserId(req);
    const limit = Math.min(
      parseInt(req.query.limit, 10) || 30,
      MAX_USER_PAGE
    );
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);

    const query = { _id: { $ne: userId } };

    const search = (req.query.search || "").trim();
    if (search) {
      // Prefix match — index-friendly
      query.name = { $regex: `^${escapeRegex(search)}`, $options: "i" };
    }

    const users = await User.find(
      query,
      "_id name avatar email privacySettings.isPrivate"
    )
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit + 1)
      .lean();

    const hasMore = users.length > limit;
    const pageUsers = hasMore ? users.slice(0, limit) : users;
    const pageIds = pageUsers.map((u) => u._id);

    // Sirf is page ke users ke relationships — pehle SAB aate the
    const connections = pageIds.length
      ? await Follow.find({
          $or: [
            { follower: userId, following: { $in: pageIds } },
            { follower: { $in: pageIds }, following: userId },
          ],
        })
          .select("follower following status")
          .lean()
      : [];

    const relationshipByUser = new Map();
    for (const c of connections) {
      const otherId =
        String(c.follower) === userId ? String(c.following) : String(c.follower);
      const prev = relationshipByUser.get(otherId) || {
        followingStatus: "none",
        followedByStatus: "none",
      };
      if (String(c.follower) === userId) prev.followingStatus = c.status;
      else prev.followedByStatus = c.status;
      relationshipByUser.set(otherId, prev);
    }

    res.json({
      users: pageUsers.map((user) => ({
        ...user,
        relationship: relationshipByUser.get(String(user._id)) || {
          followingStatus: "none",
          followedByStatus: "none",
        },
      })),
      page,
      limit,
      hasMore,
    });
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
    invalidateUser(userId); // socket cache refresh
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
