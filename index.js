const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const path = require("path");

// Fetch Data From Dolphin
const { router: employeeRouter, startEmployeeCron } = require("./src/database/hrSystem");

// HR Approval System
const adminFormRoutes = require("./src/hr-system/routes/adminFormRoutes");
const approvalPriorityRoutes = require("./src/hr-system/routes/approvalPriorityRoutes");
const publicFormRoutes = require("./src/hr-system/routes/publicFormRoutes");
const approvalRoutes = require("./src/hr-system/routes/approvalRoutes");
const managerRoutes = require("./src/hr-system/routes/managerRoutes");

// Hala B Saudi (external API / redeem)
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
// Westwalk Family


// ----------------- MIDDLEWARES -----------------
app.use(
  cors({
    origin: [ "http://localhost:5173",  "http://127.0.0.1:5173", "https://al-wessilholding.com", "https://halab-saudi.vercel.app", "https://hala-b-saudi.onrender.com/" ],
    credentials: true,
  })
);

app.use(express.json());

// ----------------- HEALTH CHECKS -----------------
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.get("/", (req, res) => {
  res.send("AWH Backend running ✅. Try /api/health or /health");
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});


// ----------------- ROUTES -----------------

// HR
app.use("/hr", employeeRouter);
app.use("/api/admin/forms", adminFormRoutes);
app.use("/api/managers", managerRoutes);
app.use("/api/approvalPriority", approvalPriorityRoutes);
app.use("/api/forms", publicFormRoutes);
app.use("/api/approvals", approvalRoutes);

// Hala B Saudi
// same external routes ko /auth aur /api/hbs dono base paths par mount kiya hua hai
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

// Westwalk Family
// yahan future routes add kar sakte ho


// ----------------- SERVER START -----------------
const PORT = process.env.PORT || 3000; // Render supplies PORT
app.listen(PORT, () => {
  console.log("Server running on port", PORT);
  startEmployeeCron();
});


