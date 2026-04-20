// controllers/phoneAuth.js
const crypto = require("crypto");
const path = require("path");
const User = require("../models/User");
const { sendWhatsAppOtp } = require("../utils/telebu");
const { generateToken } = require("../utils/generateToken");
const { RefreshToken } = require("../models/RefreshToken");
const { bucket } = require("../../database/firebase");

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone)
      return res.status(400).json({ message: "name, email, phone is required" });

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    if (await User.findOne({ email: normalizedEmail }))
      return res.status(400).json({ message: "Email already registered" });

    if (await User.findOne({ phone: normalizedPhone }))
      return res.status(400).json({ message: "Phone already registered" });

    const user = await User.create({
      name,
      email: normalizedEmail,
      phone: normalizedPhone,
      isPhoneVerified: false,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── REQUEST OTP ──────────────────────────────────────────────────────────────
exports.requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone Number Required" });

    const normalizedPhone = phone.trim();
    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return res.status(404).json({ message: "No user found on this phone number" });

    const now = Date.now();
    if (user.lastOtpSentAt) {
      const diff = now - user.lastOtpSentAt.getTime();
      if (diff < OTP_RESEND_COOLDOWN_MS) {
        const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - diff) / 1000);
        return res.status(429).json({
          message: `Please wait ${remaining} seconds before requesting a new OTP`,
        });
      }
    }

    const otp = generateOtp();
    user.otpCode = otp;
    user.otpExpiresAt = new Date(now + OTP_EXPIRY_MS);
    user.lastOtpSentAt = new Date(now);
    await user.save();

    try {
      await sendWhatsAppOtp(normalizedPhone, otp);
    } catch (e) {
      console.error("WhatsApp OTP send failed:", e?.response?.data || e.message);
      return res.status(500).json({ message: "Failed to send OTP via WhatsApp" });
    }

    return res.json({ message: "OTP sent via WhatsApp" });
  } catch (err) {
    console.error("Request OTP error:", err);
    return res.status(500).json({ message: "Error while sending OTP" });
  }
};

// ─── VERIFY OTP & LOGIN ───────────────────────────────────────────────────────
exports.verifyOtpAndLogin = async (req, res) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code)
      return res.status(400).json({ message: "phone and code are required" });

    const normalizedPhone = phone.trim();
    const inputOtp = String(code).trim();

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) return res.status(404).json({ message: "No user found on this phone number" });
    if (!user.otpCode || !user.otpExpiresAt)
      return res.status(400).json({ message: "No OTP requested" });
    if (user.otpExpiresAt.getTime() < Date.now())
      return res.status(400).json({ message: "OTP expired, please request again" });
    if (user.otpCode !== inputOtp)
      return res.status(400).json({ message: "OTP wrong" });

    user.isPhoneVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = generateToken(user);

    const refreshTokenValue = crypto.randomBytes(40).toString("hex");
    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return res.json({
      message: "Login successful",
      token,
      refreshToken: refreshTokenValue,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Verify OTP error" });
  }
};

// ─── GET MY PROFILE ───────────────────────────────────────────────────────────
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select(
      "name email phone avatar bio birthday lastSeen isPhoneVerified createdAt"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("[GET PROFILE]", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── GET ANY USER PROFILE ─────────────────────────────────────────────────────
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "name avatar bio birthday lastSeen"
    );

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user });
  } catch (err) {
    console.error("[GET USER PROFILE]", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, birthday } = req.body;

    const updates = {};

    if (name !== undefined) updates.name = name.trim();
    if (bio !== undefined) updates.bio = bio.trim();
    if (birthday !== undefined) updates.birthday = new Date(birthday);

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("name email phone avatar bio birthday");

    res.json({
      success: true,
      message: "Profile updated",
      user,
    });
  } catch (err) {
    console.error("[UPDATE PROFILE]", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

// ─── UPLOAD AVATAR ────────────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const fileName = `avatars/${req.user._id}_${Date.now()}${ext}`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
      public: true,
    });

    const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: avatarUrl },
      { new: true }
    ).select("name avatar bio");

    res.json({
      success: true,
      message: "Avatar updated",
      avatar: avatarUrl,
      user,
    });
  } catch (err) {
    console.error("[UPLOAD AVATAR]", err.message);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
};

// ─── REMOVE AVATAR ────────────────────────────────────────────────────────────
exports.removeAvatar = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("avatar");
    if (!user) return res.status(404).json({ message: "User not found" });

    if (user.avatar) {
      try {
        const match = user.avatar.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
        if (match) await bucket.file(decodeURIComponent(match[1])).delete();
      } catch { /* ignore */ }
    }

    await User.findByIdAndUpdate(req.user._id, { $set: { avatar: null } });
    return res.json({ message: "Avatar removed" });
  } catch (err) {
    console.error("[REMOVE AVATAR]", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};





