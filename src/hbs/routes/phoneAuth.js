// routes/auth.routes.js
const express = require("express");
const {
  registerUser,
  requestOtp,
  verifyOtpAndLogin,
} = require("../controllers/phoneAuth");

const refreshRouter  = require('../chat/routes/refreshRoute')


const router = express.Router();

router.post("/register", registerUser);
router.post("/login/request-otp", requestOtp);
router.post("/login/verify-otp", verifyOtpAndLogin);

router.use("/", refreshRouter);

module.exports = router;
