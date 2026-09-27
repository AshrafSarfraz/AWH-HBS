const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {createRequire} = require('node:module');
const A='000000000000000000000001', B='000000000000000000000002';
function load(relative, stubs) {
  const filename=path.resolve(__dirname,relative), module={exports:{}};
  const localRequire=createRequire(filename);
  vm.runInNewContext(fs.readFileSync(filename,'utf8'), {module,exports:module.exports,console,
    require:n=>{if(Object.hasOwn(stubs,n))return stubs[n];if(['express','mongoose'].includes(n))return localRequire(n);throw Error(`Unmocked ${n}`);}}, {filename});
  return module.exports;
}
function chain(value,capture={}) {
  const q={then:(a,b)=>Promise.resolve(value).then(a,b),lean:()=>Promise.resolve(value)};
  for(const name of ['select','populate','sort','skip','limit'])q[name]=v=>{capture[name]=v;return q;};
  return q;
}
function response(){return {statusCode:200,status(n){this.statusCode=n;return this;},json(data){this.data=data;return this;}};}
const pairKey = (a,b) => [String(a),String(b)].sort().join(':');
const friendshipStatus = (row,viewer) => !row || row.status==='removed' ? 'none' : row.status==='accepted' ? 'accepted' : String(row.requestedBy)===String(viewer) ? 'outgoing':'incoming';
function messageService(accepted,permission='everyone',blocked=false){
  return load('../chat/services/messagePrivacy.js',{
    '../../models/User':{find:()=>chain([{_id:A},{_id:B,privacySettings:{messagePermission:permission}}])},
    '../model/block':{Block:{exists:async()=>blocked}},
    '../model/friendship':{pairKey,Friendship:{exists:async q=>{assert.equal(q.status,'accepted');return accepted;}}},
  });
}
test('all legacy messaging settings require a friendship; follows are never consulted',async()=>{
  for(const permission of ['everyone','followers','following','mutual','friends',undefined]){
    for(const accepted of [false,true]){
      assert.equal((await messageService(accepted,permission).canMessageUser(A,B)).allowed,accepted);
      assert.equal((await messageService(accepted,permission).canMessageUser(B,A)).allowed,accepted);
    }
  }
});
test('blocking, nobody and self-messaging remain denied even for friends',async()=>{
  assert.equal((await messageService(true,'nobody').canMessageUser(A,B)).code,'MESSAGES_DISABLED');
  assert.equal((await messageService(true,'friends',true).canMessageUser(A,B)).code,'BLOCKED');
  assert.equal((await messageService(true).canMessageUser(A,A)).allowed,false);
});
test('private content: pending/stranger denied, accepted friend and owner allowed; blocks override',async()=>{
  for(const status of ['removed','pending','accepted'])for(const blocked of [false,true]){
    const service=load('../chat/services/profileAccess.js',{
      '../../models/User':{findById:()=>chain({_id:B,privacySettings:{isPrivate:true}})},
      '../model/friendship':{pairKey,friendshipStatus,Friendship:{findOne:()=>chain({status,requestedBy:A})}},
      '../model/block':{Block:{exists:async()=>blocked}},
    });
    assert.equal((await service.profileAccess(A,B)).canViewContent,status==='accepted'&&!blocked);
    assert.equal((await service.profileAccess(B,B)).canViewContent,true);
  }
});
function router(access, extra={}){
  const capture={pushes:[], events:[]};
  const routes=load('../chat/routes/userRoutes.js',{
    '../../models/User':{find:()=>chain([{_id:A},{_id:B}]),...extra.User},
    './friendRoutes':require('express').Router(),
    '../model/friendship':{pairKey,friendshipStatus,Friendship:{countDocuments:async()=>7}},
    '../../middleware/auth.middleware':{authMiddleware:()=>{}},
    '../model/follow':{Follow:{find:query=>{capture.query=query;return chain([],capture);},countDocuments:async()=>7,...extra.Follow}},
    '../model/block':{Block:{find:()=>chain([]),exists:async()=>false}},
    '../services/messagePrivacy':{DEFAULT_MESSAGE_PERMISSION:'mutual',canMessageUser:async()=>({allowed:false})},
    '../services/profileAccess':{profileAccess:async()=>access},
    '../../mapGallery/models/photos':{find:()=>{capture.photosRead=true;return chain([{_id:'photo',image:'timeline.jpg'}]);},countDocuments:async()=>3,...extra.Photo},
    '../sendFCMMessage':{sendPushToUser:async data=>{capture.pushes.push(data);}},
    '../chatSocket':{invalidateUser:()=>{}},
  });
  return {capture,handler:(p,method='get')=>routes.stack.find(r=>r.route?.path===p && r.route.methods[method]).route.stack.at(-1).handle};
}
test('private profile exposes counts but lists and post endpoints return 403 without reading posts',async()=>{
  const access={user:{_id:B,name:'Ashraf',privacySettings:{isPrivate:true}},canViewContent:false,relationship:{}};
  const {handler,capture}=router(access);
  for(const endpoint of ['/:id/posts']){
    const res=response();await handler(endpoint)({user:{id:A},params:{id:B},query:{userId:B}},res,e=>{throw e;});
    assert.equal(res.statusCode,403);
  }
  assert.equal(capture.photosRead,undefined);
  const res=response();await handler('/:id')({user:{id:A},params:{id:B}},res,e=>{throw e;});
  assert.equal(res.data.friendsCount,7);assert.equal(res.data.postsCount,3);
  assert.equal(res.data.canViewContent,false);assert.equal(res.data.canMessage,false);assert.equal(res.data.posts,undefined);
});
test('public/approved profile posts are the Timeline Photo records',async()=>{
  const {handler}=router({canViewContent:true});const res=response();
  await handler('/:id/posts')({user:{id:A},params:{id:B},query:{}},res,e=>{throw e;});
  assert.equal(res.data.posts[0].image,'timeline.jpg');assert.equal(res.data.hasMore,false);
});
test('location gallery only queries photos by privacy-approved authors',async()=>{
  let query;
  const controller=load('../mapGallery/controller/location.js',{
    '../../chat/services/profileAccess':{visiblePhotoAuthors:async()=>[A]},
    dotenv:{config(){}},'../../models/venue':{},'../../models/brands':{},'../models/location':{},axios:{},
    '../models/photos':{distinct:async()=>[A,B],find:q=>{query=q;return chain([]);}},
  });
  const res=response();await controller.getLocationPhotos({params:{id:'place'},user:{id:A}},res);
  assert.deepEqual(Array.from(query.user.$in),[A]);
});


test('post delete enforces ownership atomically and rejects missing/invalid identities',async()=>{
  const stored={_id:B,user:A};let calls=0;
  const controller=load('../mapGallery/controller/location.js',{
    '../../chat/services/profileAccess':{},dotenv:{config(){}},'../../models/venue':{},'../../models/brands':{},'../models/location':{},axios:{},
    '../models/photos':{findOneAndDelete:async query=>{calls++;return query._id===stored._id&&query.user===stored.user?stored:null;}},
  });
  for(const [user,id,status] of [[undefined,B,401],[A,'bad-id',400],[B,B,404],[A,B,200]]){
    const res=response();await controller.deletePhoto({user:user?{id:user}:undefined,params:{id}},res);
    assert.equal(res.statusCode,status);
    if(status===200)assert.equal(res.data.deleted,true);
  }
  assert.equal(calls,2);
});
