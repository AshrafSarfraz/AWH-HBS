// utils/telebu.js
const axios = require("axios");

// Telebu config – apne credentials ke hisaab se
const TELEBU_URL =process.env.TELEBU_URL

const TELEBU_AUTH =process.env.TELEBU_AUTH

const TEMPLATE_NAME = process.env.TEMPLATE_NAME
const TEMPLATE_NAMESPACE = process.env.TEMPLATE_NAMESPACE
const TEMPLATE_LANG_CODE = "en_US";

async function sendWhatsAppOtp(phoneNumber, otpCode) {
  // phoneNumber ka format Telebu jaisa hi send karo (e.g. "97477876146")
  const payload = {
    payload: {
      name: TEMPLATE_NAME,
      components: [
        {
          type: "body",
          parameters: [
            {
              type: "text",
              text: otpCode, // body me OTP
            },
          ],
        },
        {
          type: "button",
          sub_type: "url",
          index: 0,
          parameters: [
            {
              type: "text",
              text: otpCode, // button me bhi wahi OTP
            },
          ],
        },
      ],
      language: {
        code: TEMPLATE_LANG_CODE,
        policy: "deterministic",
      },
      namespace: TEMPLATE_NAMESPACE,
    },
    phoneNumber, // e.g. "97477876146"
  };

  const headers = {
    Authorization: TELEBU_AUTH,
    "Content-Type": "application/json",
  };

  const res = await axios.post(TELEBU_URL, payload, { headers });
  return res.data;
}

module.exports = {
  sendWhatsAppOtp,
};



