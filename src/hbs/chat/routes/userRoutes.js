// /src/hbs/routes/userRoutes.js
const express = require("express");
const router = express.Router();
const User = require("../../models/User");
const { authMiddleware } = require("../../middleware/auth.middleware");
const { Follow } = require("../model/follow");
const { canMessageUser, DEFAULT_MESSAGE_PERMISSION } = require("../services/messagePrivacy");
const mongoose = require("mongoose");
const { profileAccess } = require("../services/profileAccess");
const { Block } = require("../model/block");
const Photo = require("../../mapGallery/models/photos");

function socialChanged(req, ...ids) {
  const io = req.app?.get("io");
  ids.forEach(id => io?.to(`user:${id}`).emit("social-updated"));
}

async function withRelationships(viewerId, items) {
  if (!items.length) return [];
  const ids = items.map(u => u._id);
  const [connections, blocks, accounts] = await Promise.all([
    Follow.find({$or: [{follower: viewerId, following: {$in: ids}}, {following: viewerId, follower: {$in: ids}}]}).select("follower following status").lean(),
    Block.find({$or: [{blocker: viewerId, blocked: {$in: ids}}, {blocked: viewerId, blocker: {$in: ids}}]}).select("blocker blocked").lean(),
    User.find({_id: {$in: [viewerId, ...ids]}}).select("_id privacySettings.messagePermission").lean(),
  ]);
  const unavailable = new Set(accounts.filter(u => u.privacySettings?.messagePermission === "nobody").map(u => String(u._id)));
  const blocked = new Set(blocks.map(b => String(b.blocker) === String(viewerId) ? String(b.blocked) : String(b.blocker)));
  return items.map(user => {
    const id = String(user._id);
    const relationship = {
      followingStatus: connections.find(c => String(c.follower) === String(viewerId) && String(c.following) === id)?.status || "none",
      followedByStatus: connections.find(c => String(c.following) === String(viewerId) && String(c.follower) === id)?.status || "none",
    };
    return {...user, relationship, canMessage: id !== String(viewerId) && !blocked.has(id)
      && !unavailable.has(String(viewerId)) && !unavailable.has(id)
      && relationship.followingStatus === "accepted" && relationship.followedByStatus === "accepted"};
  });
}
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

// Optional userId selects another profile; the same access check protects both lists.
for (const mode of ["followers", "following"]) {
  router.get(`/${mode}`, authMiddleware, async (req, res, next) => {
    try {
      const viewerId = currentUserId(req), userId = req.query.userId || viewerId;
      if (!validUserId(userId)) return res.status(400).json({error: "Invalid user id"});
      const access = await profileAccess(viewerId, userId);
      if (!access) return res.status(404).json({error: "User not found"});
      if (!access.canViewContent) return res.status(403).json({error: "This account is private", code: "PRIVATE_ACCOUNT"});
      const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 200));
      const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
      const field = mode === "followers" ? "follower" : "following";
      const query = {[mode === "followers" ? "following" : "follower"]: userId, status: "accepted"};
      const [rows, total] = await Promise.all([
        Follow.find(query).populate(field, "_id name avatar bio").sort({updatedAt: -1, _id: -1}).skip((page - 1) * limit).limit(limit).lean(),
        Follow.countDocuments(query),
      ]);
      const items = await withRelationships(viewerId, rows.map(row => row[field]).filter(Boolean));
      if (req.query.pagination === "true") return res.json({[mode]: items, page, limit, total, hasMore: page * limit < total});
      res.json(items);
    } catch (err) { next(err); }
  });
}

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
    const people = await withRelationships(userId, requests.map(item => item.follower).filter(Boolean));
    const byId = new Map(people.map(user => [String(user._id), user]));
    const items = requests.filter(item => item.follower).map(item => ({_id: item._id, user: byId.get(String(item.follower._id))}));
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

    const blocked = await Block.exists({$or: [{blocker: follower, blocked: following}, {blocker: following, blocked: follower}]});
    if (blocked) return res.status(403).json({error: "Cannot follow this user"});
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
    socialChanged(req, follower, following);
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
    socialChanged(req, follower, following);
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
    if (await Block.exists({$or: [{blocker: follower, blocked: following}, {blocker: following, blocked: follower}]})) {
      return res.status(403).json({error: "Cannot approve this request"});
    }
    const request = await Follow.findOneAndUpdate(
      { follower, following, status: "pending" },
      { $set: { status: "accepted" } },
      { new: true }
    );
    if (!request) return res.status(404).json({ error: "Follow request not found" });
    invalidateUser(follower);
    invalidateUser(following);
    socialChanged(req, follower, following);
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
    socialChanged(req, follower, following);
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
      "_id name avatar bio privacySettings.isPrivate"
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
      messagePermission: user?.privacySettings?.messagePermission === "nobody" ? "nobody" : DEFAULT_MESSAGE_PERMISSION,
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
    if (["mutual", "nobody"].includes(messagePermission)) {
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
    invalidateUser(userId);
    socialChanged(req, userId);
    res.json({
      message: "Updated",
      hideLastSeen: user.privacySettings.hideLastSeen,
      hideOnlineStatus: user.privacySettings.hideOnlineStatus,
      isPrivate: user.privacySettings.isPrivate,
      messagePermission: user.privacySettings.messagePermission === "nobody" ? "nobody" : DEFAULT_MESSAGE_PERMISSION,
    });
  } catch (err) {
    console.error("Update privacy error:", err);
    res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

router.get("/:id/message-permission", authMiddleware, async (req, res, next) => {
  try {
    if (!validUserId(req.params.id)) return res.status(400).json({error: "Invalid user id"});
    res.json(await canMessageUser(currentUserId(req), req.params.id));
  } catch (err) { next(err); }
});

router.get("/:id/posts", authMiddleware, async (req, res, next) => {
  try {
    if (!validUserId(req.params.id)) return res.status(400).json({error: "Invalid user id"});
    const access = await profileAccess(currentUserId(req), req.params.id);
    if (!access) return res.status(404).json({error: "User not found"});
    if (!access.canViewContent) return res.status(403).json({error: "This account is private", code: "PRIVATE_ACCOUNT"});
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(60, parseInt(req.query.limit, 10) || 30));
    const rows = await Photo.find({user: req.params.id}).select("image caption location createdAt")
      .populate("location", "name").sort({createdAt: -1, _id: -1}).skip((page - 1) * limit).limit(limit + 1).lean();
    res.json({posts: rows.slice(0, limit), page, limit, hasMore: rows.length > limit});
  } catch (err) { next(err); }
});

// Keep the profile header and counts visible, but do not leak private content.
router.get("/:id", authMiddleware, async (req, res, next) => {
  try {
    if (!validUserId(req.params.id)) return res.status(400).json({error: "Invalid user id"});
    const viewerId = currentUserId(req);
    const access = await profileAccess(viewerId, req.params.id);
    if (!access) return res.status(404).json({error: "User not found"});
    const {user, relationship, canViewContent, isSelf, blocked} = access;
    const [followersCount, followingCount, postsCount, permission] = await Promise.all([
      Follow.countDocuments({following: user._id, status: "accepted"}),
      Follow.countDocuments({follower: user._id, status: "accepted"}),
      Photo.countDocuments({user: user._id}),
      isSelf ? {allowed: false} : canMessageUser(viewerId, user._id),
    ]);
    res.json({_id: user._id, name: user.name, avatar: user.avatar, bio: user.bio,
      privacySettings: {isPrivate: Boolean(user.privacySettings?.isPrivate)},
      followersCount, followingCount, postsCount, relationship, canViewContent, isSelf, blocked,
      canMessage: permission.allowed});
  } catch (err) { next(err); }
});
module.exports = router;