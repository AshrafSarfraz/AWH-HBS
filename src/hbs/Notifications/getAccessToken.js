
// /src/hbs/Notifications/getAccessToken.js
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
 const {serviceAccount} = require('../../database/firebase'); 

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
getAccessToken(); // call it directly for testing
module.exports = getAccessToken;
