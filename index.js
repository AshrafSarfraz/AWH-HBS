// index.js
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const path = require("path");


// ----------------- IMPORT ROUTES -----------------


// HR System
const { router: employeeRouter, startEmployeeCron } = require("./src/database/hrSystem");
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
const chatRoutes = require("./src/hbs/chat/routes/chatRoutes");
const messageRoutes = require("./src/hbs/chat/routes/messageRoutes");
const deviceRoutes = require("./src/hbs/chat/routes/deviceRoutes");
const blockRoutes = require('./src/hbs/chat/routes/blockRoutes');
const userRoutes = require("./src/hbs/chat/routes/userRoutes");


// Westwalk Family
const AdminsAuth = require("./src/westwalk_Family/routes/AuthRoutes");
const Complain = require("./src/westwalk_Family/routes/complaint");
const AdminsEmail = require("./src/westwalk_Family/routes/AdminEmail");

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://al-wessilholding.com",
      "https://halab-saudi.vercel.app",
      "https://hala-b-saudi.onrender.com",
      "https://maintenance.westwalk.qa",
    ],
    credentials: true,
  })
);

app.use(express.json());

// ----------------- HEALTH CHECKS -----------------
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/", (req, res) => res.send("AWH Backend running ✅"));
app.get("/api/health", (req, res) => res.json({ ok: true }));
app.get("/api/test", (req, res) => { console.log("API HIT"); res.send("working"); });

// ----------------- ROUTES -----------------

// HR
app.use("/hr", employeeRouter);
app.use("/api/admin/forms", adminFormRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/approvalPriority", approvalPriorityRoutes);
app.use("/api/forms", publicFormRoutes);
app.use("/api/approvals", approvalRoutes);

// Hala B Saudi
app.use("/auth", hbsExternalLoginApi);
app.use("/api/hbs", hbsExternalRoutes);
app.use("/api/phoneAuth", phoneAuthRoutes);
app.use("/api/hbs/admins", AdminRoutes);
app.use("/api/hbs/brands", brandsRoutes);
app.use("/api/hbs/cities", cityRoutes);
app.use("/api/hbs/groupAccount", groupAccountRoutes);
app.use("/api/hbs/groupBrands", groupBrands);
app.use("/api/hbs/redeem", halaredeem);
app.use("/api/hbs/venues", venueRoutes);
app.use("/api/hbs/venderAccount", vendorRoutes);
app.use("/api/users", userRoutes);
app.use('/api/block', blockRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/devices", deviceRoutes);





// Westwalk Family
app.use("/api/westwalk", AdminsAuth);
app.use("/api/westwalk/maintainceRequest", Complain);
app.use("/api/westwalk/admin-emails", AdminsEmail);






// ----------------- SERVER & SOCKET -----------------
const server = require("http").createServer(app);
const initializeSocket = require("./src/hbs/chat/chatSocket");
const io = initializeSocket(server);
app.set("io", io);

const PORT = process.env.PORT;
server.listen(PORT, '0.0.0.0', () => {
  console.log("Server running on port", PORT);
  startEmployeeCron();

  const mongoose = require("mongoose");
  const MONGO_URI = process.env.MONGO_URI_HBS;
  mongoose.connect(MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
  mongoose.connection.on('error', (err) => console.log('MongoDB error:', err));
});