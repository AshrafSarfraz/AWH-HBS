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
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("[GET PROFILE]", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── GET ANY USER PROFILE ─────────────────────────────────────────────────────
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select(
      "name avatar bio birthday lastSeen"
    );
    if (!user) return res.status(404).json({ message: "User not found" });
    return res.json({ user });
  } catch (err) {
    console.error("[GET USER PROFILE]", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── UPDATE PROFILE ───────────────────────────────────────────────────────────
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, birthday } = req.body;
    const updates = {};

    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty" });
      if (trimmed.length > 50) return res.status(400).json({ message: "Name max 50 characters" });
      updates.name = trimmed;
    }

    if (bio !== undefined) {
      if (bio.length > 150) return res.status(400).json({ message: "Bio max 150 characters" });
      updates.bio = bio.trim() || null;
    }

    if (birthday !== undefined) {
      const date = new Date(birthday);
      if (isNaN(date.getTime())) return res.status(400).json({ message: "Invalid birthday" });
      if (date > new Date()) return res.status(400).json({ message: "Birthday must be in the past" });
      updates.birthday = date;
    }

    if (Object.keys(updates).length === 0)
      return res.status(400).json({ message: "Nothing to update" });

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true }
    ).select("name email phone avatar bio birthday");

    return res.json({ message: "Profile updated", user });
  } catch (err) {
    console.error("[UPDATE PROFILE]", err.message);
    return res.status(500).json({ message: "Server error" });
  }
};

// ─── UPLOAD AVATAR ────────────────────────────────────────────────────────────
exports.uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image uploaded" });
    if (!req.file.mimetype.startsWith("image/"))
      return res.status(400).json({ message: "Only image files allowed" });

    // Delete old avatar from Firebase
    const existing = await User.findById(req.user._id).select("avatar");
    if (existing?.avatar) {
      try {
        const match = existing.avatar.match(/storage\.googleapis\.com\/[^/]+\/(.+)/);
        if (match) await bucket.file(decodeURIComponent(match[1])).delete();
      } catch { /* ignore */ }
    }

    const ext = path.extname(req.file.originalname) || ".jpg";
    const fileName = `avatars/${req.user._id}_${crypto.randomBytes(8).toString("hex")}${ext}`;
    const fileRef = bucket.file(fileName);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype },
      public: true,
    });

    const avatarUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: { avatar: avatarUrl } },
      { new: true }
    ).select("name avatar");

    return res.json({ message: "Avatar updated", avatar: avatarUrl, user });
  } catch (err) {
    console.error("[UPLOAD AVATAR]", err.message);
    return res.status(500).json({ message: "Upload failed" });
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








// // controllers/phoneAuth.js
// const crypto = require("crypto");
// const User = require("../models/User");
// const { sendWhatsAppOtp } = require("../utils/telebu");
// const { generateToken } = require("../utils/generateToken");
// const { RefreshToken } = require("../models/RefreshToken"); // ⚠️ path apne hisaab se adjust karo

// const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
// const OTP_EXPIRY_MS = 5 * 60 * 1000;

// function generateOtp() {
//   return String(Math.floor(100000 + Math.random() * 900000));
// }

// /**
//  * POST /api/phoneAuth/register
//  * body: { name, email, phone }
//  */
// exports.registerUser = async (req, res) => {
//   try {
//     const { name, email, phone } = req.body;

//     if (!name || !email || !phone) {
//       return res.status(400).json({ message: "name, email, phone is required" });
//     }

//     const normalizedEmail = email.toLowerCase().trim();
//     const normalizedPhone = phone.trim();

//     const existingEmail = await User.findOne({ email: normalizedEmail });
//     if (existingEmail) {
//       return res.status(400).json({ message: "Email already registered" });
//     }

//     const existingPhone = await User.findOne({ phone: normalizedPhone });
//     if (existingPhone) {
//       return res.status(400).json({ message: "Phone already registered" });
//     }

//     const user = await User.create({
//       name,
//       email: normalizedEmail,
//       phone: normalizedPhone,
//       isPhoneVerified: false,
//     });

//     return res.status(201).json({
//       message: "User created successfully",
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//       },
//     });
//   } catch (err) {
//     console.error("Register error:", err);
//     return res.status(500).json({ message: "Server error" });
//   }
// };

// /**
//  * POST /api/phoneAuth/login/request-otp
//  * body: { phone }
//  */
// exports.requestOtp = async (req, res) => {
//   try {
//     const { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({ message: "Phone Number Required" });
//     }

//     const normalizedPhone = phone.trim();

//     const user = await User.findOne({ phone: normalizedPhone });
//     if (!user) {
//       return res.status(404).json({ message: "No user found on this phone number" });
//     }

//     const now = Date.now();
//     if (user.lastOtpSentAt) {
//       const diff = now - user.lastOtpSentAt.getTime();
//       if (diff < OTP_RESEND_COOLDOWN_MS) {
//         const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - diff) / 1000);
//         return res.status(429).json({
//           message: `Please wait ${remaining} seconds before requesting a new OTP`,
//         });
//       }
//     }

//     const otp = generateOtp();
//     const expiresAt = new Date(now + OTP_EXPIRY_MS);

//     user.otpCode = otp;
//     user.otpExpiresAt = expiresAt;
//     user.lastOtpSentAt = new Date(now);
//     await user.save();

//     try {
//       await sendWhatsAppOtp(normalizedPhone, otp);
//     } catch (e) {
//       console.error("WhatsApp OTP send failed:", e?.response?.data || e.message);
//       return res.status(500).json({ message: "Failed to send OTP via WhatsApp" });
//     }

//     return res.json({ message: "OTP sent via WhatsApp" });
//   } catch (err) {
//     console.error("Request OTP error:", err);
//     return res.status(500).json({ message: "Error while sending OTP" });
//   }
// };

// /**
//  * POST /api/phoneAuth/login/verify-otp
//  * body: { phone, code }
//  */
// exports.verifyOtpAndLogin = async (req, res) => {
//   try {
//     const { phone, code } = req.body;

//     if (!phone || !code) {
//       return res.status(400).json({ message: "phone and code are required" });
//     }

//     const normalizedPhone = phone.trim();
//     const inputOtp = String(code).trim();

//     const user = await User.findOne({ phone: normalizedPhone });
//     if (!user) {
//       return res.status(404).json({ message: "No user found on this phone number" });
//     }

//     if (!user.otpCode || !user.otpExpiresAt) {
//       return res.status(400).json({ message: "No OTP requested" });
//     }

//     if (user.otpExpiresAt.getTime() < Date.now()) {
//       return res.status(400).json({ message: "OTP expired, please request again" });
//     }

//     if (user.otpCode !== inputOtp) {
//       return res.status(400).json({ message: "OTP wrong" });
//     }

//     user.isPhoneVerified = true;
//     user.otpCode = null;
//     user.otpExpiresAt = null;
//     await user.save();

//     // Access token — 7d (purana wala, kuch nahi badla)
//     const token = generateToken(user);

//     // ✅ Refresh token banao aur DB mein save karo
//     const refreshTokenValue = crypto.randomBytes(40).toString("hex");
//     await RefreshToken.create({
//       userId: user._id,
//       token: refreshTokenValue,
//       expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 din
//     });

//     return res.json({
//       message: "Login successful",
//       token,                           // purana field — existing frontend kaam karta rahega
//       refreshToken: refreshTokenValue, // naya field
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//       },
//     });
//   } catch (err) {
//     console.error("Verify OTP error:", err);
//     return res.status(500).json({ message: "Verify OTP error" });
//   }
// };



