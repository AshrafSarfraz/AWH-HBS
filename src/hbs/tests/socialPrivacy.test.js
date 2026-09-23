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
function messageService(forward,reverse,permission='everyone',blocked=false){
  return load('../chat/services/messagePrivacy.js',{
    '../../models/User':{find:()=>chain([{_id:A},{_id:B,privacySettings:{messagePermission:permission}}])},
    '../model/block':{Block:{exists:async()=>blocked}},
    '../model/follow':{Follow:{exists:async q=>q.follower===A?forward:reverse}},
  });
}
test('all messaging settings require accepted follows in BOTH directions',async()=>{
  for(const permission of ['everyone','followers','following','mutual',undefined]){
    for(const [forward,reverse] of [[false,false],[true,false],[false,true],[true,true]]){
      const result=await messageService(forward,reverse,permission).canMessageUser(A,B);
      assert.equal(result.allowed,forward&&reverse,`${permission}: ${forward}/${reverse}`);
    }
  }
});
test('blocking, nobody and self-messaging remain denied even for mutual follows',async()=>{
  assert.equal((await messageService(true,true,'nobody').canMessageUser(A,B)).allowed,false);
  assert.equal((await messageService(true,true,'mutual',true).canMessageUser(A,B)).code,'BLOCKED');
  assert.equal((await messageService(true,true).canMessageUser(A,A)).allowed,false);
});
test('private content: pending/stranger denied, approved follower and owner allowed; blocks override',async()=>{
  for(const status of ['none','pending','accepted'])for(const blocked of [false,true]){
    const service=load('../chat/services/profileAccess.js',{
      '../../models/User':{findById:()=>chain({_id:B,privacySettings:{isPrivate:true}})},
      '../model/follow':{Follow:{findOne:q=>chain(q.follower===A?{status}:null)}},
      '../model/block':{Block:{exists:async()=>blocked}},
    });
    assert.equal((await service.profileAccess(A,B)).canViewContent,status==='accepted'&&!blocked);
    assert.equal((await service.profileAccess(B,B)).canViewContent,true);
  }
});
function router(access, extra={}){
  const capture={};
  const routes=load('../chat/routes/userRoutes.js',{
    '../../models/User':{find:()=>chain([{_id:A},{_id:B}]),...extra.User},
    '../../middleware/auth.middleware':{authMiddleware:()=>{}},
    '../model/follow':{Follow:{find:query=>{capture.query=query;return chain([],capture);},countDocuments:async()=>7,...extra.Follow}},
    '../model/block':{Block:{find:()=>chain([])}},
    '../services/messagePrivacy':{DEFAULT_MESSAGE_PERMISSION:'mutual',canMessageUser:async()=>({allowed:false})},
    '../services/profileAccess':{profileAccess:async()=>access},
    '../../mapGallery/models/photos':{find:()=>{capture.photosRead=true;return chain([{_id:'photo',image:'timeline.jpg'}]);},countDocuments:async()=>3,...extra.Photo},
    '../chatSocket':{invalidateUser:()=>{}},
  });
  return {capture,handler:(p)=>routes.stack.find(r=>r.route?.path===p).route.stack.at(-1).handle};
}
test('private profile exposes counts but lists and post endpoints return 403 without reading posts',async()=>{
  const access={user:{_id:B,name:'Ashraf',privacySettings:{isPrivate:true}},canViewContent:false,relationship:{}};
  const {handler,capture}=router(access);
  for(const endpoint of ['/followers','/following','/:id/posts']){
    const res=response();await handler(endpoint)({user:{id:A},params:{id:B},query:{userId:B}},res,e=>{throw e;});
    assert.equal(res.statusCode,403);
  }
  assert.equal(capture.photosRead,undefined);
  const res=response();await handler('/:id')({user:{id:A},params:{id:B}},res,e=>{throw e;});
  assert.equal(res.data.followersCount,7);assert.equal(res.data.followingCount,7);assert.equal(res.data.postsCount,3);
  assert.equal(res.data.canViewContent,false);assert.equal(res.data.canMessage,false);assert.equal(res.data.posts,undefined);
});
test('public/approved profile posts are the Timeline Photo records',async()=>{
  const {handler}=router({canViewContent:true});const res=response();
  await handler('/:id/posts')({user:{id:A},params:{id:B},query:{}},res,e=>{throw e;});
  assert.equal(res.data.posts[0].image,'timeline.jpg');assert.equal(res.data.hasMore,false);
});
test('connection Message flags are relative to viewer, not the profile being browsed',async()=>{
  const follows=[{follower:A,following:B,status:'accepted'},{follower:B,following:A,status:'accepted'}];
  const {handler}=router({canViewContent:true},{Follow:{find:q=>chain(q.$or?follows:[{follower:{_id:B,name:'Friend'}}])}});
  const res=response();await handler('/followers')({user:{id:A},query:{userId:B,pagination:'true'}},res,e=>{throw e;});
  assert.equal(res.data.followers[0].canMessage,true);
  follows.pop();const res2=response();await handler('/followers')({user:{id:A},query:{userId:B,pagination:'true'}},res2,e=>{throw e;});
  assert.equal(res2.data.followers[0].canMessage,false);
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
