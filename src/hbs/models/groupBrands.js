const mongoose = require("mongoose");
const { HBS_DB } = require("../../database/connect");

const GroupBrandSchema = new mongoose.Schema(
  {
    brandName: { type: String, required: true },
    phoneNumber: String,
    address: String,
    discount: String,
    subscription: String,
    category: String,

    // IMPORTANT: groupId is ObjectId ref to GroupAccount
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupAccount", // 👈 ye "GroupAccount" tumhare GroupAccount model ka naam hai
      required: true
    },

    country: String,
    city: String,
    startAt: Date,
    endAt: Date,
    // img: String,
    // pdfUrl: String,
    time: { type: Date, default: Date.now }
  },
  {
    collection: "H-GroupBrands", // 👈 yahan WOH naam likho jo Mongo me actual collection ka hai
    timestamps: false
  }
);

module.exports = HBS_DB.model("GroupBrand", GroupBrandSchema);
