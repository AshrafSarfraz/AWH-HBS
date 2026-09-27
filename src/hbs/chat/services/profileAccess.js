const User = require("../../models/User");
const {Friendship, pairKey, friendshipStatus} = require("../model/friendship");
const { Block } = require("../model/block");

async function profileAccess(viewerId, profileId) {
  const user = await User.findById(profileId).select("_id name avatar bio birthday privacySettings").lean();
  if (!user) return null;
  const isSelf = String(viewerId) === String(profileId);
  const [friend, block] = isSelf ? [null, null] : await Promise.all([
    Friendship.findOne({pairKey: pairKey(viewerId, profileId)}).lean(),
    Block.exists({$or: [{blocker: viewerId, blocked: profileId}, {blocker: profileId, blocked: viewerId}]}),
  ]);
  const status = block ? "none" : friendshipStatus(friend, viewerId);
  return {user, isSelf, blocked: Boolean(block), friendshipStatus: status,
    canViewContent: isSelf || (!block && (!user.privacySettings?.isPrivate || status === "accepted"))};
}

// Shared map galleries must enforce the same privacy as a user's profile.
async function visiblePhotoAuthors(viewerId, authorIds) {
  const [friends, blocks] = await Promise.all([
    Friendship.find({members: viewerId, status: "accepted"}).select("members").lean(),
    Block.find({$or: [{blocker: viewerId}, {blocked: viewerId}]}).select("blocker blocked").lean(),
  ]);
  const blocked = new Set(blocks.map(b => String(b.blocker) === String(viewerId) ? String(b.blocked) : String(b.blocker)));
  const allowed = [viewerId, ...friends.flatMap(f => f.members)];
  const users = await User.find({_id: {$in: authorIds}, $or: [
    {"privacySettings.isPrivate": {$ne: true}}, {_id: {$in: allowed}},
  ]}).select("_id").lean();
  return users.filter(u => !blocked.has(String(u._id))).map(u => u._id);
}
module.exports = {profileAccess, visiblePhotoAuthors};
