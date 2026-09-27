const mongoose = require("mongoose");
const {HBS_DB} = require("../../../database/connect");
const schema = new mongoose.Schema({
  pairKey: {type: String, required: true, unique: true},
  members: [{type: mongoose.Schema.Types.ObjectId, ref: "User", required: true}],
  requestedBy: {type: mongoose.Schema.Types.ObjectId, ref: "User", required: true},
  // Keep removed records so rerunning the legacy migration cannot restore consent.
  status: {type: String, enum: ["pending", "accepted", "removed"], required: true},
}, {timestamps: true});
schema.path("members").validate(v => v.length === 2 && String(v[0]) !== String(v[1]), "Two distinct members required");
schema.index({members: 1, status: 1, updatedAt: -1});
const Friendship = HBS_DB.models.Friendship || HBS_DB.model("Friendship", schema);
const pairKey = (a, b) => [String(a).toLowerCase(), String(b).toLowerCase()].sort().join(":");
const friendshipStatus = (record, viewer) => !record || record.status === "removed" ? "none"
  : record.status === "accepted" ? "accepted" : String(record.requestedBy) === String(viewer) ? "outgoing" : "incoming";
module.exports = {Friendship, pairKey, friendshipStatus};
