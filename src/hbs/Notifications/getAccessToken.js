
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
 const {serviceAccount} = require('../../database/firebase'); 

async function getAccessToken() {
  const auth = new GoogleAuth({
    credentials: serviceAccount,
    scopes: 'https://www.googleapis.com/auth/firebase.messaging',
  });

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  return tokenResponse.token;
}

module.exports = getAccessToken;
