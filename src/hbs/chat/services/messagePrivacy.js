const { Block } = require("../model/block");
const { Follow } = require("../model/follow");
const User = require("../../models/User");

const DEFAULT_MESSAGE_PERMISSION = "followers";

async function canMessageUser(senderId, recipientId) {
  const sender = String(senderId);
  const recipient = String(recipientId);

  if (sender === recipient) return { allowed: false, code: "INVALID_RECIPIENT" };

  const [recipientUser, block, followsRecipient, followsSender] = await Promise.all([
    User.findById(recipient).select("privacySettings.messagePermission"),
    Block.exists({
      $or: [
        { blocker: sender, blocked: recipient },
        { blocker: recipient, blocked: sender },
      ],
    }),
    Follow.exists({ follower: sender, following: recipient, status: "accepted" }),
    Follow.exists({ follower: recipient, following: sender, status: "accepted" }),
  ]);

  if (!recipientUser) return { allowed: false, code: "USER_NOT_FOUND" };
  if (block) return { allowed: false, code: "BLOCKED" };

  const permission = recipientUser.privacySettings?.messagePermission || DEFAULT_MESSAGE_PERMISSION;
  const senderFollowsRecipient = Boolean(followsRecipient);
  const recipientFollowsSender = Boolean(followsSender);
  const allowed =
    permission === "everyone" ||
    (permission === "followers" && senderFollowsRecipient) ||
    (permission === "following" && recipientFollowsSender) ||
    (permission === "mutual" && senderFollowsRecipient && recipientFollowsSender);

  return { allowed, code: allowed ? null : "MESSAGE_NOT_ALLOWED" };
}

module.exports = { canMessageUser, DEFAULT_MESSAGE_PERMISSION };
