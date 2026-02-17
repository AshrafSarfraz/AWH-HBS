const fetch = require('node-fetch');
const path = require('path');
const getAccessToken = require('./getAccessToken'); // Import the helper


const PROJECT_ID = process.env.FIREBASE_PROJECT_ID // Use environment variable for project ID

async function sendNotificationREST(token, title, body) {
  const accessToken = await getAccessToken(); // Call the token helper

  // In delayNotification.js
const message = {
  message: {
    token: token,
    notification: { 
      title: title, 
      body: body 
    },
    data: { 
      screen: 'Home', // Ensure this matches a screen name in your AppStack
      title: title,  // Included in data for foreground handling
      body: body 
    },
  },

  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    }
  );

  const result = await response.json();
  console.log('Notification sent:', result);
}

function sendDelayedNotification(token, title, body, delayHours = 0.001) {
  const delayMs = delayHours * 60 * 60 * 1000; // convert hours to milliseconds
  console.log(`Scheduled notification for ${delayHours} hours later`);

  setTimeout(async () => {
    try {
      await sendNotificationREST(token, title, body);
    } catch (err) {
      console.error('Failed to send delayed notification:', err.message);
    }
  }, delayMs);
}

module.exports = sendDelayedNotification;
