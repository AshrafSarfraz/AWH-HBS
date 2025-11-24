const User =require("../models/User") ;
const { twilioClient, verifyService } = require("../utils/twilioClient") 
const  { generateToken } = require("../utils/generateToken") ;

// 1 minute cooldown
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;

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
 * -> OTP send / resend (1 minute cooldown)
 */
exports.requestOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "phone required hai" });
    }

    const normalizedPhone = phone.trim();

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Is phone number se koi user nahi mila" });
    }

    const now = Date.now();
    if (user.lastOtpSentAt) {
      const diff = now - user.lastOtpSentAt.getTime();
      if (diff < OTP_RESEND_COOLDOWN_MS) {
        const remaining = Math.ceil((OTP_RESEND_COOLDOWN_MS - diff) / 1000);
        return res.status(429).json({
          message: `Please ${remaining} second wait karo phir OTP resend hoga`,
        });
      }
    }

    // Twilio Verify se OTP bhejna
    const verification = await twilioClient.verify.v2
      .services(verifyService)
      .verifications.create({
        to: normalizedPhone,
        channel: "whatsapp",
      });

    user.lastOtpSentAt = new Date(now);
    await user.save();

    return res.json({
      message: "OTP bhej diya gaya hai",
      status: verification.status, // usually "pending"
    });
  } catch (err) {
    console.error("Request OTP error:", err);
    return res.status(500).json({ message: "OTP bhejte waqt error aaya" });
  }
};

/**
 * POST /auth/login/verify-otp
 * body: { phone, code }
 * -> OTP check + token return
 */
exports.verifyOtpAndLogin = async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res
        .status(400)
        .json({ message: "phone aur code dono required hain" });
    }

    const normalizedPhone = phone.trim();

    const user = await User.findOne({ phone: normalizedPhone });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Is phone number se koi user nahi mila" });
    }

    // Twilio se OTP verify
    const check = await twilioClient.verify.v2
      .services(verifyService)
      .verificationChecks.create({
        to: normalizedPhone,
        code: code.trim(),
      });

    if (check.status !== "approved") {
      return res.status(400).json({ message: "OTP ghalat ya expire ho gaya" });
    }

    if (!user.isPhoneVerified) {
      user.isPhoneVerified = true;
      await user.save();
    }

    const token = generateToken(user);

    return res.json({
      message: "Login successful",
      token, // yeh tumhara login token hai
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
      },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    return res.status(500).json({ message: "OTP verify karte waqt error aaya" });
  }
};


