// /src/hbs/Notifications/getAccessToken.js
const { GoogleAuth } = require("google-auth-library");
const { serviceAccount } = require("../../database/firebase");

// Token cache — Google token 1 ghante valid rehta hai
let _cachedToken = null;
let _tokenExpiry = 0;

async function getAccessToken() {
  const now = Date.now();

  // Agar cached token hai aur 5 minute baaki hain expiry mein — reuse karo
  if (_cachedToken && now < _tokenExpiry - 5 * 60 * 1000) {
    return _cachedToken;
  }

  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();

  _cachedToken = tokenResponse.token;
  _tokenExpiry = now + 60 * 60 * 1000; // 1 hour

  console.log("[FCM] New access token fetched and cached");
  return _cachedToken;
}

module.exports = getAccessToken;