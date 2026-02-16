// async function sendNotification(token, title, body, data = {}) {
//   const message = {
//     to: token,
//     data: {
//       title: String(title),
//       body: String(body),
//       ...Object.keys(data).reduce((acc, key) => {
//         acc[key] = String(data[key]);
//         return acc;
//       }, {}),
//     },
//     priority: "high",
//   };

//   const response = await fetch("https://fcm.googleapis.com/fcm/send", {
//     method: "POST",
//     headers: {
//       Authorization: `key=${FCM_SERVER_KEY}`,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify(message),
//   });

//   const resData = await response.json();
//   console.log("FCM Response:", resData);
//   return resData;
// }
