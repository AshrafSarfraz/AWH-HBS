const mongoose = require("mongoose");
const { HBS_DB } = require("../../../database/connect");

const FollowSchema = new mongoose.Schema(
  {
    // follower follows following. A pending record is a follow request.
    follower: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    following: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["pending", "accepted"], default: "pending" },
  },
  { timestamps: true }
);

FollowSchema.index({ follower: 1, following: 1 }, { unique: true });
FollowSchema.index({ following: 1, status: 1 });

const Follow = HBS_DB.models.Follow || HBS_DB.model("Follow", FollowSchema);

module.exports = { Follow };
