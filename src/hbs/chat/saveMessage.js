// The partial unique index on (chat, sender, tempId) arbitrates concurrent retries.
async function saveMessage(Message, payload) {
  const key = payload.tempId && {chat: payload.chat, sender: payload.sender, tempId: payload.tempId};
  if (key) {
    const existing = await Message.findOne(key);
    if (existing) return {message: existing, created: false};
  }
  try {
    return {message: await Message.create(payload), created: true};
  } catch (error) {
    if (key && error.code === 11000) {
      const existing = await Message.findOne(key);
      if (existing) return {message: existing, created: false};
    }
    throw error;
  }
}
module.exports = {saveMessage};
