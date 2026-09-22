// Run manually before serving the updated HBS chat code. Connects ONLY to HBS.
require('dotenv').config();
const mongoose = require('mongoose');
async function main() {
  if (!process.env.MONGO_URI_HBS) throw new Error('MONGO_URI_HBS is required');
  const connection = mongoose.createConnection(process.env.MONGO_URI_HBS, {serverSelectionTimeoutMS: 10000});
  try {
    await connection.asPromise();
    await connection.collection('messages').createIndex(
      {chat: 1, sender: 1, tempId: 1},
      {unique: true, partialFilterExpression: {tempId: {$type: 'string'}}},
    );
    await connection.collection('messages').createIndex({chat: 1, createdAt: -1, _id: -1});
    await connection.collection('chats').createIndex({participants: 1, lastMessageAt: -1, _id: -1});
    console.log('HBS chat indexes ready');
  } finally {
    await connection.close();
  }
}
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = {main};
