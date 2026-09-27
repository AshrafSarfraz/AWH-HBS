const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const {authMiddleware} = require("../../middleware/auth.middleware");
const User = require("../../models/User");
const {Friendship, pairKey, friendshipStatus} = require("../model/friendship");
const {Block} = require("../model/block");
const {profileAccess} = require("../services/profileAccess");
const {ensureFriendChat} = require("../services/friendChat");
const {invalidateUser} = require("../chatSocket");
const {sendPushToUser} = require("../sendFCMMessage");
const me = req => String(req.user.id || req.user._id);
const blocked = (a,b) => Block.exists({$or: [{blocker:a,blocked:b},{blocker:b,blocked:a}]});
function changed(req,a,b) {
  for (const id of [a,b]) {
    invalidateUser(id);
    req.app?.get("io")?.to(`user:${id}`).emit("social-updated");
  }
}
async function notify(userId, senderId, type, chatId) {
  try {
    const user = await User.findById(senderId).select("name").lean();
    await sendPushToUser({userId, title: type === "friend_request" ? "New friend request" : "Friend request accepted",
      body: type === "friend_request" ? `${user?.name || "Someone"} sent you a friend request. Tap to accept or decline.`
        : `${user?.name || "Someone"} accepted your friend request. You can now chat.`,
      data: {type, senderId, recipientId: userId, ...(chatId ? {chatId: String(chatId)} : {})}});
  } catch (err) {console.error("[Friend notification]", err.message);}
}
router.use(authMiddleware);
router.param("userId", (req,res,next,id) => {
  if (!mongoose.isValidObjectId(id) || String(id).toLowerCase() === me(req).toLowerCase()) return res.status(400).json({error:"Invalid friend"});
  req.params.userId = String(id).toLowerCase();
  next();
});

router.get(["/friends", "/friend-requests"], async (req,res,next) => {
  try {
    const viewer = me(req), requests = req.path.replace(/\/+$/, "") === "/friend-requests";
    const owner = requests ? viewer : String(req.query.userId || viewer).toLowerCase();
    if (!mongoose.isValidObjectId(owner)) return res.status(400).json({error:"Invalid user id"});
    const access = await profileAccess(viewer, owner);
    if (!access) return res.status(404).json({error:"User not found"});
    if (!access.canViewContent) return res.status(403).json({error:"This account is private"});
    const blocks = await Block.find({$or:[{blocker:viewer},{blocked:viewer}]}).lean();
    const excluded = blocks.map(b => String(b.blocker) === viewer ? b.blocked : b.blocker);
    const query = {members: {$all:[owner], $nin:excluded}, status: requests ? "pending" : "accepted",
      ...(requests ? {requestedBy: {$ne: viewer}} : {})};
    const page = Math.max(1,parseInt(req.query.page,10)||1), limit = Math.max(1,Math.min(200,parseInt(req.query.limit,10)||100));
    const [records,total] = await Promise.all([
      Friendship.find(query).sort({updatedAt:-1,_id:-1}).skip((page-1)*limit).limit(limit)
        .populate("members","name avatar bio privacySettings.messagePermission").lean(),
      Friendship.countDocuments(query),
    ]);
    const people = records.map(r => ({record:r,user:r.members.find(u => u && String(u._id) !== owner)})).filter(x => x.user);
    const relations = await Friendship.find({pairKey: {$in: people.map(x => pairKey(viewer, x.user._id))}}).lean();
    const viewerUser = await User.findById(viewer).select("privacySettings.messagePermission").lean();
    const items = people.map(({record,user}) => {
      const relation = relations.find(r=>r.pairKey===pairKey(viewer,user._id));
      const status = friendshipStatus(relation,viewer);
      const person = {_id:user._id,name:user.name,avatar:user.avatar,bio:user.bio,friendshipStatus:status,
        canMessage:status==="accepted" && viewerUser?.privacySettings?.messagePermission!=="nobody" && user.privacySettings?.messagePermission!=="nobody"};
      return requests ? {_id:record._id,user:person} : person;
    });
    const key=requests?"requests":"friends";
    res.json({[key]:items,total,page,limit,hasMore:page*limit<total});
  } catch(err) {next(err);}
});

router.post("/friend-requests/:userId", async (req,res,next) => {
  try {
    const a=me(req), b=req.params.userId, key=pairKey(a,b);
    if (await blocked(a,b)) return res.status(403).json({error:"Cannot send this request",code:"BLOCKED"});
    if (!await User.exists({_id:b})) return res.status(404).json({error:"User not found"});
    let record=await Friendship.findOne({pairKey:key});
    let created=false;
    if (!record) {
      try {record=await Friendship.create({pairKey:key,members:[a,b],requestedBy:a,status:"pending"}); created=true;}
      catch(err) {if(err.code!==11000)throw err;record=await Friendship.findOne({pairKey:key});}
    } else if(record.status==="removed") {
      const updated=await Friendship.findOneAndUpdate({_id:record._id,status:"removed"},{$set:{requestedBy:a,status:"pending"}},{new:true});
      created=!!updated; record=updated || await Friendship.findOne({pairKey:key});
    }
    // Handles a block racing a request. Never restore a friendship while blocked.
    if(await blocked(a,b)) {await Friendship.updateOne({pairKey:key},{$set:{status:"removed"}});changed(req,a,b);return res.status(403).json({error:"Cannot send this request",code:"BLOCKED"});}
    changed(req,a,b);
    if(created) void notify(b,a,"friend_request");
    res.status(record.status==="pending"?202:200).json({friendshipStatus:friendshipStatus(record,a)});
  } catch(err) {next(err);}
});

router.post("/friend-requests/:userId/approve", async (req,res,next) => {
  try {
    const a=me(req),b=req.params.userId,key=pairKey(a,b);
    if(await blocked(a,b)) return res.status(403).json({error:"Cannot accept this request",code:"BLOCKED"});
    const accepted=await Friendship.findOneAndUpdate({pairKey:key,status:"pending",requestedBy:b},{$set:{status:"accepted"}},{new:true});
    const record=accepted || await Friendship.findOne({pairKey:key,status:"accepted"});
    if(!record) return res.status(404).json({error:"Friend request not found"});
    const chat=await ensureFriendChat(a,b,[a,b]);
    if(await blocked(a,b)) {await Friendship.updateOne({pairKey:key},{$set:{status:"removed"}});changed(req,a,b);return res.status(403).json({error:"Cannot accept this request",code:"BLOCKED"});}
    if(!await Friendship.exists({pairKey:key,status:"accepted"})) return res.status(409).json({error:"Friendship was removed"});
    changed(req,a,b);
    if(accepted) void notify(b,a,"friend_accepted",chat._id);
    res.json({friendshipStatus:"accepted",chatId:chat._id});
  } catch(err) {next(err);}
});

// Either member can cancel/decline a pending request. Accepted friendships
// require the explicit remove-friend endpoint.
router.delete("/friend-requests/:userId", async(req,res,next)=>{
  try {
    const a=me(req),b=req.params.userId;
    await Friendship.updateOne({pairKey:pairKey(a,b),status:"pending"},{$set:{status:"removed"}});
    changed(req,a,b);res.json({message:"Request removed"});
  } catch(err){next(err);}
});
router.delete("/friends/:userId", async(req,res,next)=>{
  try {
    const a=me(req),b=req.params.userId;
    await Friendship.updateOne({pairKey:pairKey(a,b),status:"accepted"},{$set:{status:"removed"}});
    changed(req,a,b);res.json({message:"Friend removed"});
  } catch(err){next(err);}
});
module.exports=router;
