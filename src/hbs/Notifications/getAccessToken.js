const { GoogleAuth } = require("google-auth-library");

const { serviceAccount } = require("../../database/firebase");

async function getAccessToken() {

  const auth = new GoogleAuth({

    credentials: serviceAccount,

    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],

  });

  const client = await auth.getClient();

  const token = await client.getAccessToken();

  return token.token;

}

module.exports = getAccessToken;
