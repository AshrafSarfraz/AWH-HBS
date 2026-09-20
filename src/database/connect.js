// // /src/database/connect.js
// const mongoose = require("mongoose");

// // 1st DB Connection (HR)
// const HR_DB = mongoose.createConnection(process.env.MONGO_URI, {

// });

// // 2nd DB Connection (HBS)
// const HBS_DB = mongoose.createConnection(process.env.MONGO_URI_HBS, {

// });

// const WESTWALK_DB = mongoose.createConnection(process.env.MONGO_URI_WESTWALK, {

// });


// module.exports = { HR_DB, HBS_DB, WESTWALK_DB };





const mongoose = require("mongoose");

mongoose.set("strictQuery", true);

const baseOptions = {
  maxPoolSize: Number(process.env.MONGO_MAX_POOL || 20),
  minPoolSize: Number(process.env.MONGO_MIN_POOL || 2),
  serverSelectionTimeoutMS: 10_000,
  socketTimeoutMS: 45_000,
  // Query ko queue me rakhne ke bajaye foran error do agar DB connected nahi
  bufferCommands: false,
  // Compression — network par kam data
  compressors: ["zlib"],
};

function makeConnection(label, uri) {
  if (!uri) {
    throw new Error(
      `[DB] ${label} ki connection string missing hai. .env me set karein.`
    );
  }

  const conn = mongoose.createConnection(uri, baseOptions);

  conn.on("connected", () =>
    console.log(`[DB] ${label} connected → ${conn.name}`)
  );
  conn.on("disconnected", () => console.warn(`[DB] ${label} disconnected`));
  conn.on("reconnected", () => console.log(`[DB] ${label} reconnected`));
  conn.on("error", (err) => console.error(`[DB] ${label} error:`, err.message));

  return conn;
}

const HR_DB = makeConnection("HR", process.env.MONGO_URI);
const HBS_DB = makeConnection("HBS", process.env.MONGO_URI_HBS);
const WESTWALK_DB = makeConnection("WESTWALK", process.env.MONGO_URI_WESTWALK);


async function dbReady() {
  await Promise.all([HR_DB.asPromise(), HBS_DB.asPromise(), WESTWALK_DB.asPromise()]);
  console.log("[DB] Sab databases ready ✅");
}

async function closeAll() {
  await Promise.allSettled([HR_DB.close(), HBS_DB.close(), WESTWALK_DB.close()]);
  console.log("[DB] Sab connections band ✅");
}

module.exports = { HR_DB, HBS_DB, WESTWALK_DB, dbReady, closeAll };