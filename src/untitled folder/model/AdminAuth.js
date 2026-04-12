const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { WESTWALK_DB } = require("../../database/connect");

const AdminAuthSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: true, minlength: 6 },

    // ✅ Role field add kiya
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
  },
  { timestamps: true }
);

// Hash password before saving
AdminAuthSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password helper
AdminAuthSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = WESTWALK_DB.model("AdminAuth", AdminAuthSchema);