// index.js
//
// ═══════════════════════════════════════════════════════════════════════
// KYA KYA BADLA
// ═══════════════════════════════════════════════════════════════════════
//
// 1) BOOT ORDER — pehle `server.listen()` chalta tha aur DB uske callback ke
//    ANDAR connect hota tha. Matlab server ke start hote hi requests aa sakti
//    thin jab DB ready nahi tha → wo requests 10 second hang ho kar fail hoti
//    thin. "Deploy ke baad pehle 30 second slow" wali shikayat ka yehi sabab
//    tha. Ab: pehle DB connect, phir listen.
//
// 2) DUPLICATE CONNECTION — index.js alag se `mongoose.connect(MONGO_URI_HBS)`
//    bhi karta tha jab ke connect.js pehle hi HBS connect kar raha tha.
//    2 extra pools khul rahe the. Ab sirf connect.js.
//
// 3) EMPLOYEE SYNC — har restart par poora MSSQL table delete + re-insert hota
//    tha. Render/Heroku par restarts aam hain. Ab ye sirf tab chalta hai jab
//    SYNC_ON_BOOT=true ho, warna sirf raat ka cron.
//
// 4) ERROR HANDLING — koi global error handler nahi tha aur na
//    unhandledRejection handler. Ek uncaught error poore server ko gira deta
//    tha aur saare socket connections toot jate the.
//
// 5) SECURITY — helmet, compression, aur rate limiting add ki
//    (express-rate-limit package.json me tha lekin kahin use nahi ho raha tha).
//
// 6) PAYLOAD — `express.json({ limit: "50mb" })` khatarnak tha. Ab 2mb
//    (files multipart se jati hain, JSON se nahi).
//
// 7) GRACEFUL SHUTDOWN — SIGTERM par sockets aur DB theek se band hote hain.

const path = require("path");

require("dotenv").config({
  path: path.join(__dirname, ".env"),
  override: process.env.NODE_ENV !== "production",
});

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const { dbReady, closeAll } = require("./src/database/connect");
const { protectWrites } = require("./src/hbs/middleware/protectWrites");

const app = express();
app.set("trust proxy", 1); // Render/Nginx ke peeche sahi client IP ke liye

// ─────────────────────────────────────────────────────────────────────
// ROUTES IMPORT
// ─────────────────────────────────────────────────────────────────────

// HR System
const {
  router: employeeRouter,
  startEmployeeCron,
  syncEmployees,
} = require("./src/database/hrSystem");
const adminFormRoutes = require("./src/hr-system/routes/adminFormRoutes");
const approvalPriorityRoutes = require("./src/hr-system/routes/approvalPriorityRoutes");
const publicFormRoutes = require("./src/hr-system/routes/publicFormRoutes");
const approvalRoutes = require("./src/hr-system/routes/approvalRoutes");
const managerRoutes = require("./src/hr-system/routes/managerRoutes");

// Hala B Saudi
const hbsExternalLoginApi = require("./src/hbs/routes/loginRoute");
const hbsExternalRoutes = require("./src/hbs/routes/externalApi/Brands_RedeemRoutes");
const phoneAuthRoutes = require("./src/hbs/routes/phoneAuth");
const AdminRoutes = require("./src/hbs/routes/adminRoutes");
const brandsRoutes = require("./src/hbs/routes/brandsRoutes");
const cityRoutes = require("./src/hbs/routes/cityRoutes");
const groupAccountRoutes = require("./src/hbs/routes/groupAccountRoutes");
const groupBrands = require("./src/hbs/routes/brandGroupRoute");
const halaredeem = require("./src/hbs/routes/redeem");
const venueRoutes = require("./src/hbs/routes/venueRoutes");
const vendorRoutes = require("./src/hbs/routes/venderAccountRoute");
const locationRoutes = require("./src/hbs/mapGallery/routes/location");

// Chat
const chatRoutes = require("./src/hbs/chat/routes/chatRoutes");
const messageRoutes = require("./src/hbs/chat/routes/messageRoutes");
const deviceRoutes = require("./src/hbs/chat/routes/deviceRoutes");
const blockRoutes = require("./src/hbs/chat/routes/blockRoutes");
const userRoutes = require("./src/hbs/chat/routes/userRoutes");

// Westwalk Family
const AdminsAuth = require("./src/westwalk_Family/routes/AuthRoutes");
const Complain = require("./src/westwalk_Family/routes/complaint");
const AdminsEmail = require("./src/westwalk_Family/routes/AdminEmail");
const westwalkAdminFormRoutes = require("./src/westwalk_Family/routes/adminFormRoutes");
const westwalkApprovalPriorityRoutes = require("./src/westwalk_Family/routes/approvalPriorityRoutes");
const westwalkPublicFormRoutes = require("./src/westwalk_Family/routes/publicFormRoutes");
const westwalkApprovalRoutes = require("./src/westwalk_Family/routes/approvalRoutes");

// ─────────────────────────────────────────────────────────────────────
// CORE MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5173",
  "https://al-wessilholding.com",
  "https://halab-saudi.vercel.app",
  "https://hala-b-saudi.onrender.com",
  "https://maintenance.westwalk.qa",
  ...(process.env.EXTRA_ORIGINS || "").split(",").filter(Boolean),
];

app.use(
  helmet({
    // Backend API hai, koi HTML serve nahi karta
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

// ✅ NEW: gzip — JSON responses 60-80% chhote ho jate hain
app.use(compression());

app.use(
  cors({
    origin: (origin, cb) => {
      // Mobile app / Postman me origin nahi hota
      if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
  })
);

// ⚠️ 50mb se 2mb — files multipart (multer) se jati hain, JSON se nahi
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ limit: "2mb", extended: true }));

// Purana global `Cache-Control: no-store` hata diya — brand images/list
// bhi cache nahi ho pa rahi thin. Ab sirf auth routes par.
const noStore = (req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
};

// ─────────────────────────────────────────────────────────────────────
// RATE LIMITING  (express-rate-limit install tha lekin use nahi ho raha tha)
// ─────────────────────────────────────────────────────────────────────

const generalLimiter = rateLimit({
  windowMs: 60_000,
  max: 300, // per IP per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bohot zyada requests. Thora rukein." },
});

// OTP endpoints par sakht limit — brute force rokne ke liye
const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Bohot zyada OTP requests. 15 minute baad koshish karein." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api", generalLimiter);

// ─────────────────────────────────────────────────────────────────────
// HEALTH
// ─────────────────────────────────────────────────────────────────────
app.get("/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/api/health", (req, res) => res.json({ ok: true, uptime: process.uptime() }));
app.get("/", (req, res) => res.send("AWH Backend running ✅"));

// ─────────────────────────────────────────────────────────────────────
// ROUTES
// ─────────────────────────────────────────────────────────────────────

// HR
app.use("/hr", employeeRouter);
app.use("/api/admin/forms", adminFormRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/approvalPriority", approvalPriorityRoutes);
app.use("/api/forms", publicFormRoutes);
app.use("/api/approvals", approvalRoutes);

// Hala B Saudi
app.use("/auth", authLimiter, noStore, hbsExternalLoginApi);
app.use("/api/hbs", hbsExternalRoutes);
app.use("/api/phoneAuth", otpLimiter, noStore, phoneAuthRoutes);
app.use("/api/hbs/admins", noStore, AdminRoutes);
app.use("/api/hbs/brands", protectWrites, brandsRoutes);
app.use("/api/hbs/cities", protectWrites, cityRoutes);
app.use("/api/hbs/groupAccount", groupAccountRoutes);
app.use("/api/hbs/groupBrands", groupBrands);
app.use("/api/hbs/redeem", halaredeem);
app.use("/api/hbs/venues", protectWrites, venueRoutes);
app.use("/api/hbs/venderAccount", vendorRoutes);

// ✅ FIX: pehle yeh do baar mount tha (mapRoutes aur locationRoutes — same file)
app.use("/api/hbs/map", locationRoutes);

// Chat
app.use("/api/users", userRoutes);
app.use("/api/block", blockRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/messages", uploadLimiter, messageRoutes);
app.use("/api/devices", deviceRoutes);

// Westwalk Family
app.use("/api/westwalk", AdminsAuth);
app.use("/api/westwalk/maintainceRequest", Complain);
app.use("/api/westwalk/admin-emails", AdminsEmail);
app.use("/api/westwalk/admin-forms", westwalkAdminFormRoutes);
app.use("/api/westwalk/approvalPriority", westwalkApprovalPriorityRoutes);
app.use("/api/westwalk/public-forms", westwalkPublicFormRoutes);
app.use("/api/westwalk/approvals", westwalkApprovalRoutes);

// ─────────────────────────────────────────────────────────────────────
// 404 + GLOBAL ERROR HANDLER  (pehle dono nahi the)
// ─────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: "Route not found", path: req.originalUrl });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;

  if (status >= 500) {
    console.error(`[ERROR] ${req.method} ${req.originalUrl}`, err);
  }

  // Mongo duplicate key
  if (err.code === 11000) {
    return res.status(409).json({
      error: "Ye record pehle se mojood hai",
      fields: Object.keys(err.keyPattern || {}),
    });
  }
  // Mongoose validation
  if (err.name === "ValidationError") {
    return res.status(400).json({
      error: "Validation failed",
      details: Object.values(err.errors).map((e) => e.message),
    });
  }
  if (err.name === "CastError") {
    return res.status(400).json({ error: `Invalid ${err.path}` });
  }

  res.status(status).json({
    error: status >= 500 ? "Internal server error" : err.message,
    // Stack sirf development me
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// ─────────────────────────────────────────────────────────────────────
// SERVER + SOCKET
// ─────────────────────────────────────────────────────────────────────

const server = require("http").createServer(app);
const initializeSocket = require("./src/hbs/chat/chatSocket");
const io = initializeSocket(server, { allowedOrigins: ALLOWED_ORIGINS });
app.set("io", io);

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    // ✅ PEHLE database, PHIR listen
    await dbReady();

    server.listen(PORT, "0.0.0.0", () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // ⚠️ Employee sync ab har restart par NAHI chalti.
    // Manually chalana ho to: SYNC_ON_BOOT=true npm start
    // Ya API se: POST /hr/employees/sync
    if (process.env.SYNC_ON_BOOT === "true") {
      syncEmployees()
        .then(() => console.log("Initial employee sync done ✅"))
        .catch((e) => console.error("Initial sync failed:", e.message));
    }

    startEmployeeCron();
  } catch (err) {
    console.error("❌ Startup failed:", err);
    process.exit(1);
  }
}

start();

// ─────────────────────────────────────────────────────────────────────
// SAFETY NETS  (pehle koi nahi the — ek error se poora server girta tha)
// ─────────────────────────────────────────────────────────────────────

process.on("unhandledRejection", (reason) => {
  console.error("[UNHANDLED REJECTION]", reason);
});

process.on("uncaughtException", (err) => {
  console.error("[UNCAUGHT EXCEPTION]", err);
  // Process ko controlled tareeqe se band karo — corrupted state me mat chalao
  shutdown("uncaughtException", 1);
});

let shuttingDown = false;
async function shutdown(signal, code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n[${signal}] Shutting down...`);

  const force = setTimeout(() => process.exit(code || 1), 15_000);
  force.unref();

  try {
    io.close();
    await new Promise((resolve) => server.close(resolve));
    await closeAll();
  } catch (e) {
    console.error("Shutdown error:", e.message);
  }
  process.exit(code);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

module.exports = { app, server, io };
















// // index.js
// const express = require("express");
// const app = express();
// const cors = require("cors");
// const path = require("path");
// require("dotenv").config({
//   path: path.join(__dirname, ".env"),
//   // Local shells can have stale Mongo variables exported. In development, the
//   // project .env must be authoritative so HBS_DB does not fall back to `test`.
//   override: process.env.NODE_ENV !== "production",
// });


// // ----------------- IMPORT ROUTES -----------------


// // HR System
// const {router: employeeRouter, startEmployeeCron, syncEmployees} = require("./src/database/hrSystem");
// const adminFormRoutes = require("./src/hr-system/routes/adminFormRoutes");
// const approvalPriorityRoutes = require("./src/hr-system/routes/approvalPriorityRoutes");
// const publicFormRoutes = require("./src/hr-system/routes/publicFormRoutes");
// const approvalRoutes = require("./src/hr-system/routes/approvalRoutes");
// const managerRoutes = require("./src/hr-system/routes/managerRoutes");


// // Hala B Saudi
// const hbsExternalLoginApi = require("./src/hbs/routes/loginRoute");
// const hbsExternalRoutes = require("./src/hbs/routes/externalApi/Brands_RedeemRoutes");
// const phoneAuthRoutes = require("./src/hbs/routes/phoneAuth");
// const AdminRoutes = require("./src/hbs/routes/adminRoutes");
// const brandsRoutes = require("./src/hbs/routes/brandsRoutes");
// const cityRoutes = require("./src/hbs/routes/cityRoutes");
// const groupAccountRoutes = require("./src/hbs/routes/groupAccountRoutes");
// const groupBrands = require("./src/hbs/routes/brandGroupRoute");
// const halaredeem = require("./src/hbs/routes/redeem");
// const venueRoutes = require("./src/hbs/routes/venueRoutes");
// const mapRoutes = require("./src/hbs/mapGallery/routes/location");
// const vendorRoutes = require("./src/hbs/routes/venderAccountRoute");
// const chatRoutes = require("./src/hbs/chat/routes/chatRoutes");
// const messageRoutes = require("./src/hbs/chat/routes/messageRoutes");
// const deviceRoutes = require("./src/hbs/chat/routes/deviceRoutes");
// const blockRoutes = require('./src/hbs/chat/routes/blockRoutes');
// const userRoutes = require("./src/hbs/chat/routes/userRoutes");


// // Westwalk Family
// const AdminsAuth = require("./src/westwalk_Family/routes/AuthRoutes");
// const Complain = require("./src/westwalk_Family/routes/complaint");
// const AdminsEmail = require("./src/westwalk_Family/routes/AdminEmail");


// const westwalkAdminFormRoutes = require("./src/westwalk_Family/routes/adminFormRoutes");
// const westwalkApprovalPriorityRoutes = require("./src/westwalk_Family/routes/approvalPriorityRoutes");
// const westwalkPublicFormRoutes = require("./src/westwalk_Family/routes/publicFormRoutes");
// const westwalkApprovalRoutes = require("./src/westwalk_Family/routes/approvalRoutes");
// // Map Gallery
// const locationRoutes       = require("./src/hbs/mapGallery/routes/location");


// app.use((req, res, next) => {
//   res.set("Cache-Control", "no-store");
//   next();
// });
// app.use(
//   cors({
//     origin: [
//       "http://localhost:3000",
//       "http://127.0.0.1:3000",
//       "http://localhost:5173",
//       "http://localhost:5174",
//       "http://127.0.0.1:5173",
//       "https://al-wessilholding.com",
//       "https://halab-saudi.vercel.app",
//       "https://hala-b-saudi.onrender.com",
//       "https://maintenance.westwalk.qa",
//     ],
//     credentials: true,
//   })
// );

// app.use(express.json({ limit: "50mb" }));
// app.use(express.urlencoded({ limit: "50mb", extended: true }));

// // ----------------- HEALTH CHECKS -----------------
// app.get("/health", (req, res) => res.json({ ok: true }));
// app.get("/", (req, res) => res.send("AWH Backend running ✅"));
// app.get("/api/health", (req, res) => res.json({ ok: true }));
// app.get("/api/test", (req, res) => { console.log("API HIT"); res.send("working"); });

// // ----------------- ROUTES -----------------

// // HR
// app.use("/hr", employeeRouter);
// app.use("/api/admin/forms", adminFormRoutes);
// app.use("/api/managers", managerRoutes);
// app.use("/api/approvalPriority", approvalPriorityRoutes);
// app.use("/api/forms", publicFormRoutes);
// app.use("/api/approvals", approvalRoutes);

// // Hala B Saudi
// app.use("/auth", hbsExternalLoginApi);
// app.use("/api/hbs", hbsExternalRoutes);
// app.use("/api/phoneAuth", phoneAuthRoutes);
// app.use("/api/hbs/admins", AdminRoutes);
// app.use("/api/hbs/brands", brandsRoutes);
// app.use("/api/hbs/cities", cityRoutes);
// app.use("/api/hbs/groupAccount", groupAccountRoutes);
// app.use("/api/hbs/groupBrands", groupBrands);
// app.use("/api/hbs/redeem", halaredeem);
// app.use("/api/hbs/venues", venueRoutes);
// app.use("/api/hbs/map", mapRoutes);
// app.use("/api/hbs/venderAccount", vendorRoutes);
// app.use("/api/users", userRoutes);
// app.use('/api/block', blockRoutes);
// app.use("/api/chat", chatRoutes);
// app.use("/api/messages", messageRoutes);
// app.use("/api/devices", deviceRoutes);


// // Map Gallery
// app.use("/api/hbs/map", locationRoutes);


// // Westwalk Family
// app.use("/api/westwalk", AdminsAuth);
// app.use("/api/westwalk/maintainceRequest", Complain);
// app.use("/api/westwalk/admin-emails", AdminsEmail);

// app.use("/api/westwalk/admin-forms", westwalkAdminFormRoutes);
// app.use("/api/westwalk/approvalPriority", westwalkApprovalPriorityRoutes);
// app.use("/api/westwalk/public-forms", westwalkPublicFormRoutes);
// app.use("/api/westwalk/approvals", westwalkApprovalRoutes);





// // ----------------- SERVER & SOCKET -----------------
// const server = require("http").createServer(app);
// const initializeSocket = require("./src/hbs/chat/chatSocket");
// const io = initializeSocket(server);
// app.set("io", io);

// const PORT = process.env.PORT;



// server.listen(PORT, '0.0.0.0', async () => {
//   console.log("Server running on port", PORT);

//   const mongoose = require("mongoose");

//   await mongoose.connect(process.env.MONGO_URI_HBS, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   });

//   console.log(`MongoDB connected (${mongoose.connection.name})`);

//   // 🔥 ALWAYS fresh data on restart
//   await syncEmployees();
//   console.log("Initial sync done ✅");

//   startEmployeeCron();
// });














