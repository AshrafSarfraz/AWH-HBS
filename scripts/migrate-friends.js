require('dotenv').config();
async function main() {
  const {dbReady, closeAll} = require('../src/database/connect');
  try {
    await dbReady();
    const {Follow} = require('../src/hbs/chat/model/follow');
    const {Friendship,pairKey} = require('../src/hbs/chat/model/friendship');
    const {Block} = require('../src/hbs/chat/model/block');
    const {Chat} = require('../src/hbs/chat/model/chat');
    const User = require('../src/hbs/models/User');
    const {ensureFriendChat} = require('../src/hbs/chat/services/friendChat');
    const {migrateMutualFriends} = require('../src/hbs/chat/services/migrateFriends');
    await Friendship.createIndexes();
    await Chat.createIndexes();
    console.log('Friends migration:', await migrateMutualFriends({Follow,Friendship,Block,User,pairKey,ensureFriendChat}));
  } finally {await closeAll();}
}
main().catch(err => {console.error(err.message);process.exitCode=1;});
