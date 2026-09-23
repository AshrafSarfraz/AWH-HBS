const User = require("../../models/User");
const { Follow } = require("../model/follow");
const { Block } = require("../model/block");

async function profileAccess(viewerId, profileId) {
  const user = await User.findById(profileId).select("_id name avatar bio birthday privacySettings").lean();
  if (!user) return null;
  const isSelf = String(viewerId) === String(profileId);
  const [following, followedBy, block] = isSelf ? [null, null, null] : await Promise.all([
    Follow.findOne({follower: viewerId, following: profileId}).select("status"),
    Follow.findOne({follower: profileId, following: viewerId}).select("status"),
    Block.exists({$or: [{blocker: viewerId, blocked: profileId}, {blocker: profileId, blocked: viewerId}]}),
  ]);
  const relationship = {followingStatus: following?.status || "none", followedByStatus: followedBy?.status || "none"};
  return {user, isSelf, blocked: Boolean(block), relationship,
    canViewContent: isSelf || (!block && (!user.privacySettings?.isPrivate || following?.status === "accepted"))};
}

// Shared map galleries must enforce the same privacy as a user's profile.
async function visiblePhotoAuthors(viewerId, authorIds) {
  const [follows, blocks] = await Promise.all([
    Follow.find({follower: viewerId, following: {$in: authorIds}, status: "accepted"}).select("following").lean(),
    Block.find({$or: [{blocker: viewerId}, {blocked: viewerId}]}).select("blocker blocked").lean(),
  ]);
  const blocked = new Set(blocks.map(b => String(b.blocker) === String(viewerId) ? String(b.blocked) : String(b.blocker)));
  const allowed = [viewerId, ...follows.map(f => f.following)];
  const users = await User.find({_id: {$in: authorIds}, $or: [
    {"privacySettings.isPrivate": {$ne: true}}, {_id: {$in: allowed}},
  ]}).select("_id").lean();
  return users.filter(u => !blocked.has(String(u._id))).map(u => u._id);
}
module.exports = {profileAccess, visiblePhotoAuthors};
