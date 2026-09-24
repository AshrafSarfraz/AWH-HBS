const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createRequire} = require('node:module');
const {cursorFilter, encodeCursor, pageLimit} = require('../chat/pagination');
const {saveMessage} = require('../chat/saveMessage');
const A = '000000000000000000000001', B = '000000000000000000000002';
const C = '000000000000000000000003', D = '000000000000000000000004';
// Only explicitly supplied module stubs may load. Shared database bootstrap is never imported.
function load(relative, stubs) {
  const filename = path.resolve(__dirname, relative);
  const module = {exports: {}};
  const localRequire = createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename, 'utf8'), {
    module, exports: module.exports, console, setImmediate,
    require: name => {
      if (Object.hasOwn(stubs, name)) return stubs[name];
      if (['mongoose', 'express', '../pagination', './saveMessage', '../utils/ttlCache'].includes(name)) return localRequire(name);
      throw Error(`Unmocked dependency: ${name}`);
    },
  }, {filename});
  return module.exports;
}
function chain(value, capture = {}) {
  const q = {};
  for (const name of ['select','populate','sort','skip','limit']) q[name] = arg => {capture[name] = arg; return q;};
  q.lean = () => Promise.resolve(value);
  q.then = (resolve, reject) => Promise.resolve(value).then(resolve, reject);
  return q;
}
function response() {
  return {statusCode: 200, status(n) {this.statusCode=n; return this;}, json(data) {this.data=data; return this;}};
}
test('cursor retains timestamp and ID tie-breaker; accepts legacy dates and rejects bad input', () => {
  const date = new Date('2026-09-22T10:00:00Z');
  const token = encodeCursor({_id:B, createdAt:date});
  assert.deepEqual(cursorFilter(token), {$or:[{createdAt:{$lt:date}}, {createdAt:date, _id:{$lt:B}}]});
  assert.deepEqual(cursorFilter(date.toISOString()), {createdAt:{$lt:date}});
  assert.throws(() => cursorFilter('invalid'), {status:400});
  assert.throws(() => cursorFilter(`${date.toISOString()}|invalid`), {status:400});
  assert.equal(pageLimit(-5,25,50),1);
  assert.equal(pageLimit(500,25,50),50);
});
test('retry returns saved message without another insert', async () => {
  let creates=0;
  const row={_id:C};
  const model={findOne:async()=>row, create:async()=>{creates++;}};
  const result=await saveMessage(model,{chat:A,sender:B,tempId:'retry'});
  assert.equal(result.created,false); assert.equal(result.message,row); assert.equal(creates,0);
});
test('concurrent duplicate-key retry resolves to original row', async () => {
  let finds=0;
  const row={_id:C};
  const model={findOne:async()=>++finds===1?null:row,create:async()=>{throw Object.assign(Error('duplicate'),{code:11000});}};
  assert.equal((await saveMessage(model,{chat:A,sender:B,tempId:'retry'})).message,row);
});
function messageController(rows, capture, allowed=true) {
  return load('../chat/controllers/messageController.js', {
    '../model/chat':{Chat:{findOne:()=>chain(allowed?{_id:C,participants:[A,B]}:null)}},
    '../model/message':{Message:{find:query=>{capture.query=query;return chain(rows,capture);},countDocuments:async()=>3}},
    '../services/messagePrivacy':{canMessageUser:async()=>({allowed:true})},
    '../../utils/mediaUpload':{uploadMediaBuffer:async()=>{throw Error('not used');}},
  });
}
test('message page returns oldest first with stable next cursor and boundary filter', async () => {
  const date=new Date('2026-09-22T10:00:00Z');
  const rows=[{_id:D,createdAt:date},{_id:C,createdAt:date},{_id:B,createdAt:date}];
  const capture={},res=response();
  await messageController(rows,capture).getMessages({user:{id:A},params:{chatId:C},query:{limit:'2',before:encodeCursor({_id:D,createdAt:date})}},res,e=>{throw e;});
  assert.deepEqual(Array.from(res.data.messages,m=>m._id),[C,D]);
  assert.equal(res.data.pagination.hasMore,true);
  assert.equal(res.data.pagination.nextCursor,encodeCursor(rows[1]));
  assert.equal(capture.query.$or[1]._id.$lt,D);
  assert.equal(capture.sort._id,-1);
  assert.equal(capture.skip,0);
});
test('nonparticipant cannot fetch messages or media', async () => {
  const controller=messageController([],{},false);
  for(const method of ['getMessages','getChatMedia']) {
    const res=response();
    await controller[method]({user:{id:A},params:{chatId:C},query:{}},res,e=>{throw e;});
    assert.equal(res.statusCode,404);
  }
});
test('media endpoint honors composite before and hasMore', async () => {
  const date=new Date('2026-09-22T10:00:00Z'),capture={},res=response();
  await messageController([{_id:C,createdAt:date},{_id:B,createdAt:date}],capture).getChatMedia({user:{id:A},params:{chatId:C},query:{limit:'1',before:encodeCursor({_id:D,createdAt:date})}},res,e=>{throw e;});
  assert.equal(res.data.hasMore,true); assert.equal(capture.query.$or[1]._id.$lt,D);
  assert.equal(res.data.nextCursor,encodeCursor(res.data.media[0]));
});
test('social pagination is opt-in, includes totals and retains legacy arrays', async () => {
  const capture={};
  const router=load('../chat/routes/userRoutes.js', {
    '../../models/User':{find:()=>chain([])}, '../services/profileAccess':{profileAccess:async()=>({canViewContent:true})}, '../model/block':{Block:{find:()=>chain([])}}, '../../mapGallery/models/photos':{}, '../../middleware/auth.middleware':{authMiddleware:()=>{}},
    '../model/follow':{Follow:{find:q=>q.$or?chain([]):chain([{_id:D,follower:{_id:B},following:{_id:B}}],capture),countDocuments:async()=>120}},
    '../services/messagePrivacy':{DEFAULT_MESSAGE_PERMISSION:'everyone'}, '../sendFCMMessage':{sendPushToUser:async()=>{}},
    '../chatSocket':{invalidateUser:()=>{}},
  });
  for(const route of ['/followers','/following','/follow-requests']) {
    const handler=router.stack.find(r=>r.route?.path===route).route.stack.at(-1).handle;
    let res=response(); await handler({user:{id:A},query:{pagination:'true',limit:'1',page:'2'}},res);
    assert.equal(res.data.total,120); assert.equal(res.data.hasMore,true); assert.equal(capture.skip,1);
    res=response(); await handler({user:{id:A},query:{}},res); assert.ok(Array.isArray(res.data));
  }
});
async function socketHarness(participants=[A,B], options={}) {
  const events=[],handlers={},queries=[],joins=[];
  let connect;
  const io={use(){},on(name,fn){if(name==='connection')connect=fn;},to(room){return {emit:(event,data)=>events.push({room,event,data})};}};
  class Server {constructor(){return io;}}
  const Chat={find:()=>chain(options.chats || []),findById:()=>chain({participants}),updateOne:async()=>{}};
  const Message={findOneAndUpdate:(query)=>{queries.push(query);return chain(null);},updateOne:async query=>{queries.push(query);},find:()=>chain(options.pending || []),updateMany:async()=>{},...options.message};
  const init=load('../chat/chatSocket.js',{
    'socket.io':{Server},'jsonwebtoken':{},'./model/chat':{Chat},'./model/message':{Message},'./model/block':{Block:{exists:async()=>false}},
    '../models/User':{find:()=>chain([{_id:A,name:'Ashraf'}])},'./services/messagePrivacy':{canMessageUser:options.permission || (async()=>({allowed:true}))},
    '../utils/socketratelimiter':{isRateLimited:()=>false},'./sendFCMMessage':{sendPushToUser:async()=>{}},
  });
  init({});
  const socket={id:'test',userId:A,join:room=>joins.push(room),leave(){},broadcast:{emit(){}},on:(name,fn)=>{handlers[name]=fn;},emit:(event,data)=>events.push({event,data}),to:room=>io.to(room)};
  const connecting = connect(socket);
  assert.equal(typeof handlers["join-chat"], "function", "join must register before async presence work");
  await connecting;
  return {handlers,events,queries,joins};
}
test('outsider cannot join, read, edit, delete, react or type in a chat',async()=>{
  const h=await socketHarness([B,D]);
  await h.handlers['join-chat'](C);
  for(const name of ['mark-read','edit-message','delete-message','react-message','typing','stop-typing']) await h.handlers[name]({chatId:C,messageId:D,newText:'edited',emoji:'👍'});
  assert.equal(h.joins.includes(`chat:${C}`),false); assert.equal(h.queries.length,0);
  assert.equal(h.events.some(e=>['typing','stop-typing'].includes(e.event)),false);
});
test('authorized message mutations constrain message ID to the supplied chat',async()=>{
  const h=await socketHarness();
  for(const name of ['mark-read','edit-message','delete-message','react-message']) await h.handlers[name]({chatId:C,messageId:D,newText:'edited',emoji:'👍'});
  assert.equal(h.queries.length,4);
  for(const q of h.queries) {assert.equal(q.chat,C);assert.equal(q._id,D);}
});

test('connect receipts are grouped by both sender and conversation', async () => {
  const h=await socketHarness([A,B],{chats:[{_id:C},{_id:D}],pending:[{_id:A,sender:B,chat:C},{_id:B,sender:B,chat:D}]});
  const receipts=h.events.filter(e=>e.event==='messages-read');
  assert.equal(receipts.length,2);
  assert.equal(receipts[0].data.chatId,C); assert.deepEqual(Array.from(receipts[0].data.messageIds),[A]);
  assert.equal(receipts[1].data.chatId,D); assert.deepEqual(Array.from(receipts[1].data.messageIds),[B]);
});
test('socket retry acknowledges saved message without rebroadcast or another insert', async () => {
  let creates=0;
  const row={_id:D,chat:C,sender:A,tempId:'retry',status:'seen'};
  const h=await socketHarness([A,B],{message:{findOne:async()=>row,findById:()=>chain(row),create:async()=>{creates++;}}});
  await h.handlers['send-message']({chatId:C,tempId:'retry',text:'hello'});
  const ack=h.events.find(e=>e.event==='message-status');
  assert.equal(ack.data.message._id,D); assert.equal(ack.data.msgStatus,'seen');
  assert.equal(creates,0); assert.equal(h.events.some(e=>e.event==='receive-message'),false);
});

test('a connected socket loses send permission immediately after unfollowing', async () => {
  let allowed=true,checks=0;
  const row={_id:D,chat:C,sender:A,tempId:'retry',status:'seen'};
  const h=await socketHarness([A,B],{permission:async()=>{checks++;return {allowed,code:allowed?null:'MUTUAL_FOLLOW_REQUIRED'};},message:{findOne:async()=>row,findById:()=>chain(row)}});
  await h.handlers['send-message']({chatId:C,tempId:'retry',text:'hello'});
  allowed=false;
  await h.handlers['send-message']({chatId:C,tempId:'second',text:'should be rejected'});
  assert.equal(checks,2);
  assert.equal(h.events.some(e=>e.event==='message-status' && e.data.tempId==='second' && e.data.reason==='message_not_allowed'),true);
});