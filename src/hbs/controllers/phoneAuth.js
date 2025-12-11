// const User =require("../models/User") ;
// const { twilioClient, verifyService } = require("../utils/twilioClient") 
// const  { generateToken } = require("../utils/generateToken") ;

// // 1 minute cooldown
// const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

// /**
//  * POST /auth/register
//  * body: { name, email, phone }
//  */
// exports.registerUser = async (req, res) => {
//   try {
//     const { name, email, phone } = req.body;

//     if (!name || !email || !phone) {
//       return res
//         .status(400)
//         .json({ message: "name, email, phone required hain" });
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
//  * POST /auth/login/request-otp
//  * body: { phone }
//  * -> OTP send / resend (1 minute cooldown)
//  */
// exports.requestOtp = async (req, res) => {
//   try {
//     const { phone } = req.body;

//     if (!phone) {
//       return res.status(400).json({ message: "Phone Number Require" });
//     }

//     const normalizedPhone = phone.trim();

//     const user = await User.findOne({ phone: normalizedPhone });
//     if (!user) {
//       return res
//         .status(404)
//         .json({ message: "No user found on this phone number" });
//     }

//     const now = Date.now();
//     if (user.lastOtpSentAt) {
//       const diff = now - user.lastOtpSentAt.getTime();
//       if (diff < OTP_RESEND_COOLDOWN_MS) {
//         const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - diff) / 2000);
//         return res.status(429).json({
//           message: `Please ${remaining} second wait for resend otp`,
//         });
//       }
//     }

//     // Twilio Verify se OTP bhejna
//     const verification = await twilioClient.verify.v2
//       .services(verifyService)
//       .verifications.create({
//         to: normalizedPhone,
//         channel: "sms",
//       });

//     user.lastOtpSentAt = new Date(now);
//     await user.save();

//     return res.json({
//       message: "OTP sent",
//       status: verification.status, // usually "pending"
//     });
//   } catch (err) {
//     console.error("Request OTP error:", err);
//     return res.status(500).json({ message: "Error detect while sending otp" });
//   }
// };

// /**
//  * POST /auth/login/verify-otp
//  * body: { phone, code }
//  * -> OTP check + token return
//  */
// exports.verifyOtpAndLogin = async (req, res) => {
//   try {
//     const { phone, code } = req.body;

//     if (!phone || !code) {
//       return res
//         .status(400)
//         .json({ message: "phone and code are require" });
//     }

//     const normalizedPhone = phone.trim();

//     const user = await User.findOne({ phone: normalizedPhone });
//     if (!user) {
//       return res
//         .status(404)
//         .json({ message: "No user found on this phone number" });
//     }

//     // Twilio se OTP verify
//     const check = await twilioClient.verify.v2
//       .services(verifyService)
//       .verificationChecks.create({
//         to: normalizedPhone,
//         code: code.trim(),
//       });

//     if (check.status !== "approved") {
//       return res.status(400).json({ message: "OTP wrong or expired" });
//     }

//     if (!user.isPhoneVerified) {
//       user.isPhoneVerified = true;
//       await user.save();
//     }

//     const token = generateToken(user);

//     return res.json({
//       message: "Login successful",
//       token, // yeh tumhara login token hai
//       user: {
//         id: user._id,
//         name: user.name,
//         email: user.email,
//         phone: user.phone,
//       },
//     });
//   } catch (err) {
//     console.error("Verify OTP error:", err);
//     return res.status(500).json({ message: "Verify OTP error " });
//   }
// };


// controllers/phoneAuth.js
const User = require("../models/User");
const { sendWhatsAppOtp } = require("../utils/telebu");
const { generateToken } = require("../utils/generateToken"); // 👈 YEH ADD KARNA ZARURI HAI

// 1 minute cooldown
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const OTP_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

// Helper: random 6-digit OTP
function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * POST /auth/register
 * body: { name, email, phone }
 */
exports.registerUser = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    if (!name || !email || !phone) {
      return res
        .status(400)
        .json({ message: "name, email, phone required hain" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedPhone = phone.trim();

    const existingEmail = await User.findOne({ email: normalizedEmail });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const existingPhone = await User.findOne({ phone: normalizedPhone });
    if (existingPhone) {
      return res.status(400).json({ message: "Phone already registered" });
    }

    const user = await User.create({
      name,
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
    console.error("Register error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

/**
 * POST /auth/login/request-otp
 * body: { phone }
 */
exports.requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone Number Require" });
    }

    const normalizedPhone = phone.trim();

    const user = await User.findOne({ phone: normalizedPhone });
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
        });
      }
    }

    const otp = generateOtp();
    const expiresAt = new Date(now + OTP_EXPIRY_MS);

    user.otpCode = otp;
    user.otpExpiresAt = expiresAt;
    user.lastOtpSentAt = new Date(now);
    await user.save();

    try {
      await sendWhatsAppOtp(normalizedPhone, otp);
    } catch (e) {
      console.error("Telebu OTP send failed:", e?.response?.data || e.message);
      return res
        .status(500)
        .json({ message: "Failed to send OTP via WhatsApp" });
    }

    return res.json({
      message: "OTP sent via WhatsApp",
      // debug: otp, // dev me chaho to rakh sakte ho
    });
  } catch (err) {
    console.error("Request OTP error:", err);
    return res.status(500).json({ message: "Error detect while sending otp" });
  }
};

/**
 * POST /auth/login/verify-otp
 * body: { phone, code }
 */
exports.verifyOtpAndLogin = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ message: "phone and code are required" });
    }

    const normalizedPhone = phone.trim();
    const inputOtp = String(code).trim();

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      return res
        .status(404)
        .json({ message: "No user found on this phone number" });
    }

    if (!user.otpCode || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No OTP requested" });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res
        .status(400)
        .json({ message: "OTP expired, please request again" });
    }

    if (user.otpCode !== inputOtp) {
      return res.status(400).json({ message: "OTP wrong" });
    }

    user.isPhoneVerified = true;
    user.otpCode = null;
    user.otpExpiresAt = null;
    await user.save();

    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "Verify OTP error" });
  }
};
