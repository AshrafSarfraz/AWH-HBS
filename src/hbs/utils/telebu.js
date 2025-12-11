// utils/telebu.js
const axios = require("axios");

// Telebu config – apne credentials ke hisaab se
const TELEBU_URL =
  "https://apisocial.telebu.com/whatsapp-api/v1.0/customer/122657/bot/0b628e83bde64159/template";

const TELEBU_AUTH =
  "Basic 4c42b91f-8273-4436-9874-fadc8d7f2ba5-Ip8zMWG"; // yahi jo tumne diya

const TEMPLATE_NAME = "otpauth";
const TEMPLATE_NAMESPACE = "d4107338_d260_4b73_bb27_fb08d0a4d286";
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
