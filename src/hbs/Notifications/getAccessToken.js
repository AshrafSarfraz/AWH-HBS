const path = require('path');
const { GoogleAuth } = require('google-auth-library');

const SERVICE_ACCOUNT_PATH = path.join(__dirname, './serviceAccountKey.json');

async function getAccessToken() {
  const auth = new GoogleAuth({
    keyFile: SERVICE_ACCOUNT_PATH,
    scopes: 'https://www.googleapis.com/auth/firebase.messaging',
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

module.exports = getAccessToken;
