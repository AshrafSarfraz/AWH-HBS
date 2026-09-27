const {test} = require('node:test');
const assert = require('node:assert/strict');
// Supply an isolated test MongoDB URI. The suite creates/drops only a randomly
// named test database and never loads production connection settings.
test('friends lifecycle, real MongoDB indexes and HTTP routes', {skip: !process.env.FRIENDS_TEST_MONGO_URI}, async t => {
  const mongoose = require('mongoose');
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const db = await mongoose.createConnection(process.env.FRIENDS_TEST_MONGO_URI, {dbName:`friends_test_${process.pid}_${Date.now()}`}).asPromise();
  const stub = (path,exports) => {require.cache[require.resolve(path)] = {id:require.resolve(path),filename:require.resolve(path),loaded:true,exports};};
  stub('../../database/connect', {HBS_DB:db});
  const events=[], pushes=[];
  stub('../chat/chatSocket', {invalidateUser(){},invalidateBlock(){}});
  stub('../chat/sendFCMMessage', {sendPushToUser:async data=>{pushes.push(data);}});
  process.env.JWT_SECRET='isolated-friends-test-only';
  const User=require('../models/User');
  const {Friendship,pairKey}=require('../chat/model/friendship');
  const {Follow}=require('../chat/model/follow');
  const {Block}=require('../chat/model/block');
  const {Chat}=require('../chat/model/chat');
  const {Message}=require('../chat/model/message');
  const {canMessageUser}=require('../chat/services/messagePrivacy');
  const {ensureFriendChat}=require('../chat/services/friendChat');
  const {migrateMutualFriends}=require('../chat/services/migrateFriends');
  const {authMiddleware}=require('../middleware/auth.middleware');
  const controllers=require('../chat/controllers/chatController');
  const app=express();app.use(express.json());
  app.set('io',{to:room=>({emit:event=>events.push({room,event})})});
  app.use('/api/users',require('../chat/routes/userRoutes'));
  app.use('/api/block',require('../chat/routes/blockRoutes'));
  app.get('/api/chat',authMiddleware,controllers.getChats);
  app.post('/api/chat/with/:participantId',authMiddleware,controllers.getOrCreateChat);
  app.delete('/api/chat/:chatId',authMiddleware,controllers.deleteChat);
  app.use((err,req,res,next)=>{res.status(500).json({error:err.message});});
  const server=await new Promise(resolve=>{const server=app.listen(0,'127.0.0.1',()=>resolve(server));});
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await db.dropDatabase();await db.close();});
  await Promise.all([Friendship.init(),Follow.init(),Block.init(),Chat.init(),User.init(),Message.init()]);
  let number=0;
  const person=async(isPrivate=false)=>{const n=++number;return String((await User.create({name:`User ${n}`,email:`u${n}@example.test`,phone:`+100${n}`,privacySettings:{isPrivate}}))._id);};
  const call=async(user,method,path)=>{
    const res=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{Authorization:`Bearer ${jwt.sign({id:user},process.env.JWT_SECRET)}`}});
    return {status:res.status,data:await res.json()};
  };
  const request=(a,b)=>call(a,'POST',`/api/users/friend-requests/${b}`);
  const accept=(a,b)=>call(a,'POST',`/api/users/friend-requests/${b}/approve`);
  const chats=async a=>(await call(a,'GET','/api/chat')).data.chats;
  let a,b,chat;
  await t.test('public and private accounts both require explicit acceptance; retries notify once',async()=>{
    for(const privateAccount of [false,true]){
      a=await person();b=await person(privateAccount);
      const before=pushes.length;
      const responses=await Promise.all([request(a,b),request(a,b)]);
      assert.ok(responses.every(r=>r.status===202));
      assert.equal(await Friendship.countDocuments({pairKey:pairKey(a,b)}),1);
      assert.equal((await canMessageUser(a,b)).allowed,false);
      assert.equal((await canMessageUser(b,a)).allowed,false);
      assert.equal((await call(b,'GET','/api/users/friend-requests?limit=1&page=1')).data.total,1);
      assert.equal((await accept(a,b)).status,404,'sender cannot accept own request');
      assert.equal((await call(a,'POST',`/api/chat/with/${b}`)).status,403);
      await new Promise(resolve=>setTimeout(resolve,20));
      assert.equal(pushes.slice(before).filter(p=>p.data.type==='friend_request').length,1);
      assert.equal((await call(a,'GET',`/api/users/${b}`)).data.friendshipStatus,'outgoing');
      assert.equal((await call(b,'GET',`/api/users/${a}`)).data.friendshipStatus,'incoming');
      const accepted=await Promise.all([accept(b,a),accept(b,a)]);
      assert.ok(accepted.every(r=>r.status===200),JSON.stringify(accepted));
      chat=accepted[0].data.chatId;
      assert.equal(accepted[1].data.chatId,chat);
      assert.equal((await canMessageUser(a,b)).allowed,true);
      assert.equal((await canMessageUser(b,a)).allowed,true);
      assert.equal((await chats(a))[0]._id,chat);
      assert.equal((await chats(b))[0]._id,chat);
      assert.equal((await chats(a))[0].lastMessage,null);
      assert.equal(await Chat.countDocuments({pairKey:pairKey(a,b)}),1);
      assert.ok(events.some(e=>e.room===`user:${a}`&&e.event==='social-updated'));
      assert.ok(events.some(e=>e.room===`user:${b}`&&e.event==='social-updated'));
      assert.equal((await call(a,'GET','/api/users/friends?limit=1&page=1')).data.friends[0].canMessage,true);
    }
  });
  await t.test('legacy follow changes have no effect; legacy endpoints are disabled',async()=>{
    await Follow.create({follower:a,following:b,status:'accepted'});
    await Follow.deleteMany({follower:a});
    assert.equal((await canMessageUser(a,b)).allowed,true);
    assert.equal((await call(a,'POST',`/api/users/follow/${b}`)).status,410);
    assert.equal((await call(a,'GET','/api/users/followers')).status,410);
  });
  await t.test('removal stops both directions; history remains and reaccept reuses it',async()=>{
    const message=await Message.create({chat,sender:a,text:'Existing history'});
    await Chat.updateOne({_id:chat},{$set:{lastMessage:message._id}});
    assert.equal((await call(a,'DELETE',`/api/users/friends/${b}`)).status,200);
    for(const [x,y] of [[a,b],[b,a]])assert.equal((await canMessageUser(x,y)).code,'FRIENDSHIP_REQUIRED');
    assert.equal((await chats(a))[0]._id,chat);
    assert.equal(await Message.countDocuments({chat}),1);
    assert.equal((await request(a,b)).status,202);
    assert.equal((await canMessageUser(a,b)).allowed,false);
    assert.equal((await accept(b,a)).data.chatId,chat);
    assert.equal(await Message.countDocuments({chat}),1);
  });
  await t.test('delete chat hides it only for that user without ending friendship',async()=>{
    assert.equal((await call(a,'DELETE',`/api/chat/${chat}`)).status,200);
    assert.equal((await chats(a)).length,0);
    assert.equal((await chats(b)).length,1);
    assert.equal((await canMessageUser(a,b)).allowed,true);
    assert.equal((await call(a,'POST',`/api/chat/with/${b}`)).data._id,chat);
  });
  await t.test('block removes friendship; unblock does not restore it',async()=>{
    assert.equal((await call(a,'POST',`/api/block/${b}`)).status,200);
    assert.equal((await canMessageUser(a,b)).code,'BLOCKED');
    assert.equal((await request(b,a)).status,403);
    assert.equal((await accept(b,a)).status,403);
    await call(a,'DELETE',`/api/block/${b}`);
    assert.equal((await canMessageUser(a,b)).code,'FRIENDSHIP_REQUIRED');
    assert.equal((await request(b,a)).status,202);
    assert.equal((await accept(a,b)).status,200);
  });
  await t.test('cancel and decline do not create chats; crossed requests require acceptance',async()=>{
    const x=await person(),y=await person();
    await Promise.all([request(x,y),request(y,x)]);
    assert.equal(await Friendship.countDocuments({pairKey:pairKey(x,y)}),1);
    assert.equal((await canMessageUser(x,y)).allowed,false);
    await call(x,'DELETE',`/api/users/friend-requests/${y}`);
    assert.equal((await call(y,'GET','/api/users/friend-requests')).data.total,0);
    assert.equal((await accept(y,x)).status,404);
    await request(x,y);await call(y,'DELETE',`/api/users/friend-requests/${x}`);
    assert.equal((await chats(x)).length,0);
    assert.equal((await request(x,x)).status,400);
    assert.equal((await request(x,'invalid')).status,400);
    assert.equal((await request(x,'000000000000000000000099')).status,404);
  });
  await t.test('nobody privacy setting wins for either member',async()=>{
    await User.updateOne({_id:a},{$set:{'privacySettings.messagePermission':'nobody'}});
    assert.equal((await canMessageUser(a,b)).code,'MESSAGES_DISABLED');
    assert.equal((await canMessageUser(b,a)).code,'MESSAGES_DISABLED');
    await User.updateOne({_id:a},{$set:{'privacySettings.messagePermission':'friends'}});
  });
  await t.test('migration only converts mutual follows, is idempotent and never revives removed friends',async()=>{
    const x=await person(),y=await person(),z=await person(),w=await person();
    await Follow.create([{follower:x,following:y,status:'accepted'},{follower:y,following:x,status:'accepted'},
      {follower:x,following:z,status:'accepted'},{follower:z,following:x,status:'pending'},
      {follower:y,following:w,status:'accepted'},{follower:w,following:y,status:'accepted'}]);
    await Block.create({blocker:w,blocked:y});
    const deps={Follow,Friendship,Block,User,pairKey,ensureFriendChat};
    assert.equal((await migrateMutualFriends(deps)).created,1);
    assert.equal((await canMessageUser(x,y)).allowed,true);
    assert.equal((await canMessageUser(x,z)).allowed,false);
    assert.equal((await migrateMutualFriends(deps)).created,0);
    assert.equal((await chats(x)).length,1);
    await call(x,'DELETE',`/api/users/friends/${y}`);
    await migrateMutualFriends(deps);
    assert.equal((await canMessageUser(x,y)).allowed,false);
    assert.equal((await chats(x)).length,0,'removed empty chat is not shown');
  });
});
