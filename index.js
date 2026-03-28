// index.js
const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const { createServer } = require("node:http");

// ----------------- IMPORT ROUTES -----------------
const notificationRoutes = require("./src/hbs/Notifications/notificationRoutes");

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

// Chat
const chatRoutes = require("./src/hbs/chat/routes/chatRoutes");
const messageRoutes = require("./src/hbs/chat/routes/messageRoutes");



// ----------------- MIDDLEWARES -----------------
// app.use(
//   cors({
//     origin: [
//         "http://192.168.100.3:5173",
//       "http://localhost:5173",
//       "http://127.0.0.1:5173",
//       "https://al-wessilholding.com",
//       "https://halab-saudi.vercel.app",
//       "https://hala-b-saudi.onrender.com/",
      
    
//     ],
  
//     credentials: true,
//   })
// );
app.use(
  cors({
    origin: "*", // Allow all origins for testing
    credentials: true,
  })
);

app.use(express.json());

// ----------------- ROUTES -----------------
app.use("/api/notifications", notificationRoutes);

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


// test Route temporar --- remove after test
const testRoute = require("./src/hbs/Notifications/testRoute");
app.use("/api/test", testRoute);



//user routes
const userRoutes = require("./src/hbs/chat/routes/userRoutes");
app.use("/api/users", userRoutes);

// Chat
app.use("/api/chat", chatRoutes);
app.use("/api/messages", messageRoutes);

// Device routes
const deviceRoutes = require("./src/hbs/chat/routes/deviceRoutes");
app.use("/api/devices", deviceRoutes);

// ----------------- HEALTH CHECKS -----------------
app.get("/", (req, res) => res.send("AWH Backend running ✅. Try /api/health or /health"));
app.get("/health", (req, res) => res.json({ ok: true }));
app.get("/api/health", (req, res) => res.json({ ok: true }));

app.get("/api/test", (req, res) => {
  console.log("API HIT");
  res.send("working");
});

// ----------------- SERVER & SOCKET -----------------
const server = createServer(app);
const initializeSocket = require("./src/hbs/chat/chatSocket");

// initialize socket server
initializeSocket(server);

const PORT = process.env.PORT;
server.listen(PORT,'0.0.0.0', () => {
  console.log("Server running on port", PORT);
  startEmployeeCron();
// MongoDB connection
const mongoose = require("mongoose");
const MONGO_URI = process.env.MONGO_URI_HBS;

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
  mongoose.connection.on('connected', () => console.log('MongoDB connected'));
mongoose.connection.on('error', (err) => console.log('MongoDB error:', err));
});