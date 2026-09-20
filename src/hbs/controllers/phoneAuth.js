// src/hbs/controllers/phoneAuth.js
//
// SECURITY FIXES:
//  1) OTP ab plain text me store nahi hota — bcrypt hash hota hai. Agar DB
//     leak ho to bhi kisi ka OTP nahi padha ja sakta.
//  2) Max 5 ghalat koshishen. Pehle unlimited thin — 6 digit OTP ko 5 minute
//     me brute force karna bilkul mumkin tha.
//  3) OTP `Math.random()` ke bajaye `crypto.randomInt()` se banta hai
//     (Math.random cryptographically secure nahi hai).
//  4) Avatar upload ab compress hota hai aur UBLA buckets par bhi chalta hai.
//
// ⚠️ User model bhi update karna hai (otpCode → otpHash, otpAttempts add).

const crypto = require("crypto");
const bcrypt = require("bcryptjs");

const User = require("../models/User");
const { sendWhatsAppOtp } = require("../utils/telebu");
const { generateToken } = require("../utils/generateToken");
const { RefreshToken } = require("../models/RefreshToken");
const { bucket } = require("../../database/firebase");
const { uploadMediaBuffer } = require("../utils/mediaUpload");
const { invalidateAuthCache } = require("../middleware/auth.middleware");

const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function generateOtp() {
  // crypto.randomInt — predictable nahi
  return String(crypto.randomInt(100000, 1000000));
}

// ─────────────────────────────────────────────────────────────────────
// POST /api/phoneAuth/register
// ─────────────────────────────────────────────────────────────────────
exports.registerUser = async (req, res, next) => {
  try {
    const { name, email, phone } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ message: "name, email, phone is required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const normalizedPhone = String(phone).trim();

    // Pehle do alag queries thin — ab ek
    const existing = await User.findOne({
      $or: [{ email: normalizedEmail }, { phone: normalizedPhone }],
    })
      .select("email phone")
      .lean();

    if (existing) {
      return res.status(409).json({
        message:
          existing.email === normalizedEmail
            ? "Email already registered"
            : "Phone already registered",
      });
    }

    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      phone: normalizedPhone,
      isPhoneVerified: false,
    });

    return res.status(201).json({
      message: "User created successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    // Unique index race condition
    if (err.code === 11000) {
      return res.status(409).json({ message: "Email ya phone already registered" });
    }
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/phoneAuth/request-otp
// ─────────────────────────────────────────────────────────────────────
exports.requestOtp = async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ message: "Phone Number Required" });

    const normalizedPhone = String(phone).trim();
    const user = await User.findOne({ phone: normalizedPhone }).select(
      "_id lastOtpSentAt"
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found on this phone number" });
    }

    const now = Date.now();
    if (user.lastOtpSentAt) {
      const diff = now - user.lastOtpSentAt.getTime();
      if (diff < OTP_RESEND_COOLDOWN_MS) {
        const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - diff) / 1000);
        return res.status(429).json({
          message: `Please wait ${remaining} seconds before requesting a new OTP`,
          retryAfter: remaining,
        });
      }
    }

    const otp = generateOtp();
    const otpHash = await bcrypt.hash(otp, 8); // 8 rounds — OTP 5 min zinda rehta hai

    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          otpHash,
          otpExpiresAt: new Date(now + OTP_EXPIRY_MS),
          lastOtpSentAt: new Date(now),
          otpAttempts: 0, // naya OTP = fresh attempts
        },
      }
    );

    try {
      await sendWhatsAppOtp(normalizedPhone, otp);
    } catch (e) {
      console.error("WhatsApp OTP send failed:", e?.response?.data || e.message);
      return res.status(502).json({ message: "Failed to send OTP via WhatsApp" });
    }

    return res.json({ message: "OTP sent via WhatsApp" });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// POST /api/phoneAuth/verify-otp
// ─────────────────────────────────────────────────────────────────────
exports.verifyOtpAndLogin = async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!phone || !code) {
      return res.status(400).json({ message: "phone and code are required" });
    }

    const normalizedPhone = String(phone).trim();
    const inputOtp = String(code).trim();

    // otpHash `select: false` hai — explicitly mangna parega
    const user = await User.findOne({ phone: normalizedPhone }).select(
      "+otpHash otpExpiresAt otpAttempts name email phone avatar bio birthday"
    );

    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found on this phone number" });
    }
    if (!user.otpHash || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No OTP requested" });
    }
    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired, please request again" });
    }

    // ✅ Brute force protection — pehle bilkul nahi thi
    if ((user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      await User.updateOne(
        { _id: user._id },
        { $set: { otpHash: null, otpExpiresAt: null } }
      );
      return res.status(429).json({
        message: "Bohot zyada ghalat koshishen. Naya OTP mangwayein.",
      });
    }

    const ok = await bcrypt.compare(inputOtp, user.otpHash);
    if (!ok) {
      await User.updateOne({ _id: user._id }, { $inc: { otpAttempts: 1 } });
      const left = MAX_OTP_ATTEMPTS - (user.otpAttempts || 0) - 1;
      return res.status(400).json({
        message: "OTP wrong",
        attemptsLeft: Math.max(left, 0),
      });
    }

    // Sahi OTP — foran invalidate karo (replay attack rokne ke liye)
    await User.updateOne(
      { _id: user._id },
      {
        $set: {
          isPhoneVerified: true,
          otpHash: null,
          otpExpiresAt: null,
          otpAttempts: 0,
        },
      }
    );

    const token = generateToken(user);
    const refreshTokenValue = crypto.randomBytes(40).toString("hex");

    await RefreshToken.create({
      userId: user._id,
      token: refreshTokenValue,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return res.json({
      message: "Login successful",
      token,
      refreshToken: refreshTokenValue,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        avatar: user.avatar || null,
        bio: user.bio || null,
        birthday: user.birthday || null,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Profile
// ─────────────────────────────────────────────────────────────────────
exports.getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("name email phone avatar bio birthday lastSeen isPhoneVerified createdAt")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId)
      .select("name avatar bio birthday lastSeen privacySettings")
      .lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({
      success: true,
      user: {
        _id: user._id,
        name: user.name,
        avatar: user.avatar,
        bio: user.bio,
        birthday: user.birthday,
        lastSeen: user.privacySettings?.hideLastSeen ? null : user.lastSeen,
      },
    });
  } catch (err) {
    next(err);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { name, bio, birthday } = req.body;
    const updates = {};

    if (name !== undefined) updates.name = String(name).trim();
    if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 150);
    if (birthday !== undefined) {
      const d = new Date(birthday);
      if (!Number.isNaN(d.getTime())) updates.birthday = d;
    }

    if (!Object.keys(updates).length) {
      return res.status(400).json({ success: false, message: "Nothing to update" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    )
      .select("name email phone avatar bio birthday")
      .lean();

    invalidateAuthCache(String(req.user._id)); // cached naam purana na rahe

    res.json({ success: true, message: "Profile updated", user });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Avatar — ab compress hota hai aur UBLA bucket par bhi chalta hai
// ─────────────────────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No image uploaded" });
    }

    const { mediaUrl, thumbnailUrl } = await uploadMediaBuffer({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      folder: `avatars/${req.user._id}`,
    });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: thumbnailUrl || mediaUrl } },
      { new: true }
    )
      .select("name avatar bio")
      .lean();

    invalidateAuthCache(String(req.user._id));

    res.json({
      success: true,
      message: "Avatar updated",
      avatar: user.avatar,
      avatarFull: mediaUrl,
      user,
    });
  } catch (err) {
    next(err);
  }
};

exports.removeAvatar = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("avatar").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    await User.updateOne({ _id: req.user._id }, { $set: { avatar: null } });
    invalidateAuthCache(String(req.user._id));

    // File delete background me — response ka intezaar na kare
    if (user.avatar) {
      setImmediate(async () => {
        try {
          const m =
            user.avatar.match(/storage\.googleapis\.com\/[^/]+\/(.+)/) ||
            user.avatar.match(/\/o\/([^?]+)/);
          if (m) await bucket.file(decodeURIComponent(m[1])).delete();
        } catch {
          /* file pehle se nahi hai — koi baat nahi */
        }
      });
    }

    return res.json({ message: "Avatar removed" });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────
// Privacy
// ─────────────────────────────────────────────────────────────────────
exports.getPrivacy = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select("privacySettings lastSeen")
      .lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      success: true,
      privacySettings: user.privacySettings,
      lastSeen: user.lastSeen,
    });
  } catch (err) {
    next(err);
  }
};

exports.updatePrivacy = async (req, res, next) => {
  try {
    const { hideOnlineStatus, hideLastSeen } = req.body;
    const update = {};

    if (typeof hideOnlineStatus === "boolean")
      update["privacySettings.hideOnlineStatus"] = hideOnlineStatus;
    if (typeof hideLastSeen === "boolean")
      update["privacySettings.hideLastSeen"] = hideLastSeen;

    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "Kuch bhi update nahi kiya" });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: update },
      { new: true }
    )
      .select("privacySettings")
      .lean();

    // Socket layer ka presence cache refresh
    try {
      require("../chat/chatSocket").invalidateUser(String(req.user._id));
    } catch {
      /* socket abhi load nahi hua */
    }

    res.json({
      success: true,
      message: "Privacy updated",
      privacySettings: user.privacySettings,
    });
  } catch (err) {
    next(err);
  }
};
