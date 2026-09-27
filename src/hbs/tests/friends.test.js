const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createRequire}=require('node:module');
const A='000000000000000000000001', B='000000000000000000000002';
const pairKey=(a,b)=>[String(a),String(b)].sort().join(':');
const friendshipStatus=(r,a)=>!r||r.status==='removed'?'none':r.status==='accepted'?'accepted':String(r.requestedBy)===String(a)?'outgoing':'incoming';
function load(relative,stubs){
 const filename=path.resolve(__dirname,relative),module={exports:{}};
 const local=createRequire(filename);
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module,exports:module.exports,console,require:n=>{
  if(Object.hasOwn(stubs,n))return stubs[n];if(['express','mongoose'].includes(n))return local(n);throw Error(`Unmocked ${n}`);
 }},{filename});return module.exports;
}
function chain(value){const q={then:(a,b)=>Promise.resolve(value).then(a,b),lean:()=>Promise.resolve(value)};for(const key of ['select','populate','sort','skip','limit'])q[key]=()=>q;return q;}
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}});
function harness(){
 const state={record:null,blocked:false,events:[],pushes:[],chatCalls:[]};
 const matches=q=>state.record && Object.entries(q).every(([key,value])=>String(state.record[key])===String(value));
 const Friendship={
  findOne:q=>chain(matches(q)?{...state.record}:null),
  create:async row=>{if(state.record)throw Object.assign(Error('duplicate'),{code:11000});state.record={...row,_id:'friend-id'};return {...state.record};},
  findOneAndUpdate:async(q,u)=>{if(!matches(q))return null;Object.assign(state.record,u.$set);return {...state.record};},
  updateOne:async(q,u)=>{if(matches(q))Object.assign(state.record,u.$set);},
  exists:async q=>Boolean(matches(q)),
 };
 const routes=load('../chat/routes/friendRoutes.js',{
  '../../middleware/auth.middleware':{authMiddleware:(req,res,next)=>next()},
  '../../models/User':{exists:async()=>true,findById:()=>chain({name:'Friend'})},
  '../model/friendship':{Friendship,pairKey,friendshipStatus},
  '../model/block':{Block:{exists:async()=>state.blocked}},
  '../services/profileAccess':{},
  '../services/friendChat':{ensureFriendChat:async(a,b,restore)=>{state.chatCalls.push({a,b,restore});return {_id:'chat-id'};}},
  '../chatSocket':{invalidateUser(){}},
  '../sendFCMMessage':{sendPushToUser:async data=>state.pushes.push(data)},
 });
 async function call(method,route,viewer=A,other=B){
  const layer=routes.stack.find(r=>r.route?.path===route&&r.route.methods[method]);assert.ok(layer,route);
  const res=response();await layer.route.stack.at(-1).handle({user:{id:viewer},params:{userId:other},app:{get:()=>({to:room=>({emit:event=>state.events.push({room,event})})})}},res,e=>{throw e;});
  await new Promise(resolve=>setImmediate(resolve));return res;
 }
 return {state,call};
}
test('request stays pending, retry sends one notification, crossing requests never autoaccept',async()=>{
 const {state,call}=harness();
 const results=await Promise.all([call('post','/friend-requests/:userId'),call('post','/friend-requests/:userId')]);
 assert.ok(results.every(r=>r.statusCode===202));assert.equal(state.record.status,'pending');
 assert.equal(state.pushes.length,1);assert.equal(state.pushes[0].data.type,'friend_request');assert.equal(state.pushes[0].userId,B);
 const crossed=await call('post','/friend-requests/:userId',B,A);
 assert.equal(crossed.data.friendshipStatus,'incoming');assert.equal(state.record.status,'pending');assert.equal(state.chatCalls.length,0);
});
test('only recipient can accept; acceptance restores one chat for BOTH and informs both sockets',async()=>{
 const {state,call}=harness();await call('post','/friend-requests/:userId');
 assert.equal((await call('post','/friend-requests/:userId/approve')).statusCode,404);
 const accepted=await call('post','/friend-requests/:userId/approve',B,A);
 assert.equal(accepted.data.chatId,'chat-id');assert.equal(state.record.status,'accepted');
 assert.deepEqual(Array.from(state.chatCalls[0].restore),[B,A]);
 assert.ok(state.events.some(e=>e.room===`user:${A}`));assert.ok(state.events.some(e=>e.room===`user:${B}`));
 await call('post','/friend-requests/:userId/approve',B,A);
 assert.equal(state.pushes.filter(p=>p.data.type==='friend_accepted').length,1);
});
test('remove retains tombstone; new request needs new acceptance and cannot self-approve',async()=>{
 const {state,call}=harness();await call('post','/friend-requests/:userId');await call('post','/friend-requests/:userId/approve',B,A);
 await call('delete','/friends/:userId');assert.equal(state.record.status,'removed');
 await call('post','/friend-requests/:userId',B,A);assert.equal(state.record.status,'pending');assert.equal(state.record.requestedBy,B);
 assert.equal((await call('post','/friend-requests/:userId/approve',B,A)).statusCode,404);
 assert.equal((await call('post','/friend-requests/:userId/approve')).statusCode,200);
});
test('cancel/decline removes only pending requests; blocking prevents request/accept',async()=>{
 for(const decline of [false,true]){
  const {state,call}=harness();await call('post','/friend-requests/:userId');
  await call('delete','/friend-requests/:userId',decline?B:A,decline?A:B);
  assert.equal(state.record.status,'removed');assert.equal(state.chatCalls.length,0);
  state.blocked=true;assert.equal((await call('post','/friend-requests/:userId')).statusCode,403);
  assert.equal((await call('post','/friend-requests/:userId/approve',B,A)).statusCode,403);
 }
});
test('a block racing acceptance removes the connection before a successful response',async()=>{
 const {state,call}=harness();await call('post','/friend-requests/:userId');
 // A block becomes visible after the first check, while the chat is created.
 let reads=0;Object.defineProperty(state,'blocked',{get:()=>++reads>1});
 const res=await call('post','/friend-requests/:userId/approve',B,A);
 assert.equal(res.statusCode,403);assert.equal(state.record.status,'removed');
 assert.equal(state.pushes.filter(p=>p.data.type==='friend_accepted').length,0);
});
test('friend chat resolves simultaneous duplicate key to the same existing chat',async()=>{
 const stored={_id:'one-chat'};
 const {ensureFriendChat}=load('../chat/services/friendChat.js',{
  '../model/friendship':{pairKey},
  '../model/chat':{Chat:{findOne:q=>q.pairKey?chain(++reads===1?null:stored):chain(null),
   findOneAndUpdate:async()=>{throw Object.assign(Error('duplicate'),{code:11000});},findByIdAndUpdate:async()=>stored}},
 });
 let reads=0;assert.equal((await ensureFriendChat(A,B,[A,B]))._id,'one-chat');
});
test('chat list admits empty accepted chats and keeps history; friendship deletion is not chat deletion',async()=>{
 let query,deletedMessages=false;
 const controller=load('../chat/controllers/chatController.js',{
  '../pagination':require('../chat/pagination'),
  '../model/friendship':{Friendship:{find:()=>chain([{pairKey:pairKey(A,B)}])}},
  '../services/friendChat':{},'../../models/User':{},'../services/messagePrivacy':{},
  '../model/chat':{Chat:{find:q=>{query=q;return chain([{_id:'chat',participants:[{_id:A},{_id:B}],lastMessage:null,lastMessageAt:new Date()}]);}}},
  '../model/message':{Message:{deleteMany:()=>{deletedMessages=true;}}},
 });
 const res=response();await controller.getChats({user:{id:A},query:{}},res,e=>{throw e;});
 assert.equal(res.data.chats.length,1);assert.equal(res.data.chats[0].lastMessage,null);
 assert.equal(query.$and[0].$or[1].pairKey.$in[0],pairKey(A,B));assert.equal(deletedMessages,false);
});
test('migration skips single follows/blocks and does not revive removed records',async()=>{
 const C='000000000000000000000003',D='000000000000000000000004';
 const rows=[{follower:A,following:B},{follower:A,following:C},{follower:A,following:D}];
 const records=new Map(),chats=new Set();
 const {migrateMutualFriends}=require('../chat/services/migrateFriends');
 const deps={pairKey,Follow:{find:()=>({lean:()=>({cursor:async function*(){yield*rows;}})}),exists:async q=>q.follower!==C},
  Block:{exists:async q=>q.$or[0].blocked===D},User:{countDocuments:async()=>2},
  Friendship:{findOneAndUpdate:async(q,u)=>{const existing=records.has(q.pairKey);if(!existing)records.set(q.pairKey,{...u.$setOnInsert});return {value:records.get(q.pairKey),lastErrorObject:{updatedExisting:existing}};}},
  ensureFriendChat:async(a,b)=>chats.add(pairKey(a,b))};
 assert.equal((await migrateMutualFriends(deps)).created,1);assert.equal(chats.size,1);
 assert.equal((await migrateMutualFriends(deps)).created,0);
 records.get(pairKey(A,B)).status='removed';chats.clear();
 await migrateMutualFriends(deps);assert.equal(records.get(pairKey(A,B)).status,'removed');assert.equal(chats.size,0);
});

test('friend model enforces distinct members and a unique case-normalized pair key',async()=>{
 const mongoose=require('mongoose'),connection=mongoose.createConnection();
 const model=load('../chat/model/friendship.js',{'../../../database/connect':{HBS_DB:connection}});
 assert.equal(model.pairKey('ABCDEF123456ABCDEF123456',B),model.pairKey(B,'abcdef123456abcdef123456'));
 assert.ok(model.Friendship.schema.indexes().some(([keys,opts])=>keys.pairKey===1&&opts.unique));
 const invalid=new model.Friendship({pairKey:pairKey(A,A),members:[A,A],requestedBy:A,status:'accepted'});
 assert.ok(invalid.validateSync()?.errors.members);
 await connection.close();
});

test('friends/requests pagination returns totals and viewer-relative messaging permission',async()=>{
 let query,skip,selectRequests=false;
 const routes=load('../chat/routes/friendRoutes.js',{
  '../../middleware/auth.middleware':{authMiddleware(){}},
  '../../models/User':{findById:()=>chain({_id:A})},
  '../model/friendship':{pairKey,friendshipStatus,Friendship:{
   countDocuments:async()=>3,
   find:q=>{
    if(q.pairKey)return chain([{pairKey:pairKey(A,B),status:selectRequests?'pending':'accepted',requestedBy:B}]);
    query=q;const row={_id:'req',members:[{_id:A,name:'Me'},{_id:B,name:'Friend'}]};
    const result=chain([row]);result.skip=n=>{skip=n;return result;};return result;
   }}},
  '../model/block':{Block:{find:()=>chain([])}},
  '../services/profileAccess':{profileAccess:async()=>({canViewContent:true})},
  '../services/friendChat':{},'../chatSocket':{},'../sendFCMMessage':{},
 });
 const handler=routes.stack.find(r=>r.route?.methods.get).route.stack.at(-1).handle;
 for(selectRequests of [false,true]){
  const res=response();await handler({path:selectRequests?'/friend-requests':'/friends',user:{id:A},query:{page:'2',limit:'1'}},res,e=>{throw e;});
  assert.equal(res.data.total,3);assert.equal(res.data.hasMore,true);assert.equal(skip,1);
  assert.equal(query.status,selectRequests?'pending':'accepted');
  if(selectRequests){assert.equal(query.requestedBy.$ne,A);assert.equal(res.data.requests[0].user.friendshipStatus,'incoming');}
  else assert.equal(res.data.friends[0].canMessage,true);
 }
});
