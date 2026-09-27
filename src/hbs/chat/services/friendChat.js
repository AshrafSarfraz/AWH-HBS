const {Chat} = require("../model/chat");
const {pairKey} = require("../model/friendship");

// Reuse existing history; a unique key prevents two simultaneous accepts/opens
// from creating separate conversations for the same pair.
async function ensureFriendChat(a, b, restoreFor = []) {
  const key = pairKey(a, b);
  let chat = await Chat.findOne({pairKey: key});
  if (!chat) {
    const old = await Chat.findOne({participants: {$all: [a, b], $size: 2}}).sort({createdAt: 1, _id: 1});
    try {
      chat = old ? await Chat.findByIdAndUpdate(old._id, {$set: {pairKey: key}}, {new: true})
        : await Chat.findOneAndUpdate({pairKey: key}, {$setOnInsert: {participants: [a, b]}}, {upsert: true, new: true, setDefaultsOnInsert: true});
    } catch (error) {
      if (error.code !== 11000) throw error;
      chat = await Chat.findOne({pairKey: key});
    }
  }
  if (restoreFor.length) chat = await Chat.findByIdAndUpdate(chat._id,
    {$pull: {deletedFor: {$in: restoreFor}}}, {new: true});
  return chat;
}
module.exports = {ensureFriendChat};
