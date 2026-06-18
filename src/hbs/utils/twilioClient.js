const twilio = require("twilio");

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const verifyServiceSid = process.env.TWILIO_VERIFY_SERVICE_SID;

if (!accountSid || !authToken || !verifyServiceSid) {
  console.warn("⚠️ Twilio env vars missing. .env check karo");
}

const twilioClient = twilio(accountSid, authToken);
const verifyService = verifyServiceSid;

module.exports = {
  twilioClient,
  verifyService,
};
