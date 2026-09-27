const {Block} = require("../model/block");
const {Friendship, pairKey} = require("../model/friendship");
const User = require("../../models/User");
const DEFAULT_MESSAGE_PERMISSION = "friends";

async function canMessageUser(senderId, recipientId) {
  const sender = String(senderId).toLowerCase(), recipient = String(recipientId).toLowerCase();
  if (sender === recipient) return {allowed: false, code: "INVALID_RECIPIENT"};
  const [users, block, friendship] = await Promise.all([
    User.find({_id: {$in: [sender, recipient]}}).select("_id privacySettings.messagePermission").lean(),
    Block.exists({$or: [{blocker: sender, blocked: recipient}, {blocker: recipient, blocked: sender}]}),
    Friendship.exists({pairKey: pairKey(sender, recipient), status: "accepted"}),
  ]);
  if (users.length !== 2) return {allowed: false, code: "USER_NOT_FOUND"};
  if (block) return {allowed: false, code: "BLOCKED"};
  if (!friendship) return {allowed: false, code: "FRIENDSHIP_REQUIRED"};
  if (users.some(u => u.privacySettings?.messagePermission === "nobody")) return {allowed: false, code: "MESSAGES_DISABLED"};
  return {allowed: true, code: null};
}
module.exports = {canMessageUser, DEFAULT_MESSAGE_PERMISSION};
