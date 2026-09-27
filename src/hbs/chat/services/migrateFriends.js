// Run with follow writes disabled (maintenance window). Never overwrite an
// existing friendship, including removed/declined records, when rerun.
async function migrateMutualFriends({Follow, Friendship, Block, User, pairKey, ensureFriendChat}) {
  const result = {created: 0, existing: 0, skipped: 0};
  for await (const forward of Follow.find({status: 'accepted'}).lean().cursor()) {
    const a = String(forward.follower), b = String(forward.following);
    if (a >= b) continue; // exactly one visit per unordered pair
    const [reverse, block, users] = await Promise.all([
      Follow.exists({follower: b, following: a, status: 'accepted'}),
      Block.exists({$or: [{blocker:a,blocked:b},{blocker:b,blocked:a}]}),
      User.countDocuments({_id: {$in:[a,b]}}),
    ]);
    if (!reverse || block || users !== 2) {result.skipped++; continue;}
    const key = pairKey(a,b);
    const saved = await Friendship.findOneAndUpdate({pairKey:key},
      {$setOnInsert:{members:[a,b],requestedBy:a,status:'accepted'}},
      {upsert:true,new:true,includeResultMetadata:true});
    if (saved.lastErrorObject?.updatedExisting) result.existing++;
    else result.created++;
    // On retry after a failure, repair the missing chat but never restore a
    // deleted conversation or a removed friendship.
    if (saved.value.status === 'accepted') await ensureFriendChat(a,b);
  }
  return result;
}
module.exports = {migrateMutualFriends};
