const { Block } = require("../model/block");
const { Follow } = require("../model/follow");
const User = require("../../models/User");
const DEFAULT_MESSAGE_PERMISSION = "mutual";

async function canMessageUser(senderId, recipientId) {
  const sender = String(senderId), recipient = String(recipientId);
  if (sender === recipient) return {allowed: false, code: "INVALID_RECIPIENT"};
  const [users, block, forward, reverse] = await Promise.all([
    User.find({_id: {$in: [sender, recipient]}}).select("_id privacySettings.messagePermission").lean(),
    Block.exists({$or: [{blocker: sender, blocked: recipient}, {blocker: recipient, blocked: sender}]}),
    Follow.exists({follower: sender, following: recipient, status: "accepted"}),
    Follow.exists({follower: recipient, following: sender, status: "accepted"}),
  ]);
  if (users.length !== 2) return {allowed: false, code: "USER_NOT_FOUND"};
  if (block) return {allowed: false, code: "BLOCKED"};
  // Legacy everyone/followers/following settings never bypass mutual following.
  const allowed = Boolean(forward && reverse) && !users.some(u => u.privacySettings?.messagePermission === "nobody");
  return {allowed, code: allowed ? null : "MUTUAL_FOLLOW_REQUIRED"};
}
module.exports = {canMessageUser, DEFAULT_MESSAGE_PERMISSION};