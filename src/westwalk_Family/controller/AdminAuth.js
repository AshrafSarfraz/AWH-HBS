const jwt  = require("jsonwebtoken");
const User = require("../models/AdminAuth");

const JWT_SECRET     = process.env.JWT_SECRET     || "your_jwt_secret_change_in_production";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

const signToken = (userId) =>
  jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// safe user shape (never send password)
const safeUser = (u) => ({
  id:        u._id,
  name:      u.name,
  email:     u.email,
  role:      u.role,        // ← included
  createdAt: u.createdAt,
});

// ─── Middleware: restrict to certain roles ────────────────────────────────────
// Usage in routes:  router.delete("/:id", protect, restrictTo("admin"), deleteUser)
exports.restrictTo = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      message: `Access denied. Required role: ${roles.join(" or ")}`,
    });
  }
  next();
};

// ------------------ REGISTER ------------------
exports.register = async (req, res) => {
  // Only allow role to be set if the caller is already an admin.
  // If no authenticated user (public signup), role is always "user".
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "name, email and password are required" });
  }

  // Determine role:
  //  - If request comes from an authenticated admin → allow any valid role
  //  - Otherwise → always "user"
  const assignedRole =
    req.user?.role === "admin" && ["admin", "user"].includes(role)
      ? role
      : "user";

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already in use" });
    }

    const user  = await User.create({ name, email, password, role: assignedRole });
    const token = signToken(user._id);

    res.status(201).json({
      message: "User registered successfully",
      token,
      user: safeUser(user),
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ LOGIN ------------------
exports.login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "email and password are required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const token = signToken(user._id);

    res.json({
      message: "Login successful",
      token,
      user: safeUser(user),   // role included so frontend can route accordingly
    });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ GET ALL USERS ------------------
// Admin only
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json({ count: users.length, users });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ GET SINGLE USER ------------------
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ UPDATE USER ------------------
exports.updateUser = async (req, res) => {
  // Only admins can change role
  const ALLOWED_FIELDS = ["name", "email", "password"];
  if (req.user?.role === "admin") ALLOWED_FIELDS.push("role");

  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => ALLOWED_FIELDS.includes(key))
  );

  // Validate role value if provided
  if (updates.role && !["admin", "user"].includes(updates.role)) {
    return res.status(400).json({ message: "role must be 'admin' or 'user'" });
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ message: "No valid fields provided for update" });
  }

  try {
    if (updates.password) {
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      Object.assign(user, updates);
      await user.save();
      return res.json({ message: "User updated successfully", user: safeUser(user) });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User updated successfully", user: safeUser(user) });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ DELETE USER ------------------
// Admin only
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted successfully", userId: req.params.id });
  } catch (err) {
    res.status(500).json({ message: "Server error", error: err.message });
  }
};

// ------------------ GET ME ------------------
exports.getMe = (req, res) => {
  res.json({ user: safeUser(req.user) });
};

// ------------------ LOGOUT ------------------
exports.logout = (_req, res) => {
  res.json({ message: "Logged out successfully. Please discard your token." });
};





// const jwt = require("jsonwebtoken");
// const User = require("../models/AdminAuth");

// const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_change_in_production";
// const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// const signToken = (userId) =>
//   jwt.sign({ id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

// // ------------------ REGISTER ------------------
// exports.register = async (req, res) => {
//   const { name, email, password } = req.body;

//   if (!name || !email || !password) {
//     return res.status(400).json({ message: "name, email and password are required" });
//   }

//   try {
//     const existing = await User.findOne({ email });
//     if (existing) {
//       return res.status(409).json({ message: "Email already in use" });
//     }

//     const user = await User.create({ name, email, password });
//     const token = signToken(user._id);

//     res.status(201).json({
//       message: "User registered successfully",
//       token,
//       user: { id: user._id, name: user.name, email: user.email },
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ LOGIN ------------------
// exports.login = async (req, res) => {
//   const { email, password } = req.body;

//   if (!email || !password) {
//     return res.status(400).json({ message: "email and password are required" });
//   }

//   try {
//     const user = await User.findOne({ email });
//     if (!user || !(await user.comparePassword(password))) {
//       return res.status(401).json({ message: "Invalid email or password" });
//     }

//     const token = signToken(user._id);

//     res.json({
//       message: "Login successful",
//       token,
//       user: { id: user._id, name: user.name, email: user.email },
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ GET ALL USERS ------------------
// exports.getAllUsers = async (req, res) => {
//   try {
//     const users = await User.find().select("-password");
//     res.json({
//       count: users.length,
//       users,
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ GET SINGLE USER ------------------
// exports.getUser = async (req, res) => {
//   try {
//     const user = await User.findById(req.params.id).select("-password");
//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json({ user });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ UPDATE USER ------------------
// exports.updateUser = async (req, res) => {
//   const ALLOWED_FIELDS = ["name", "email", "password"];
//   const updates = Object.fromEntries(
//     Object.entries(req.body).filter(([key]) => ALLOWED_FIELDS.includes(key))
//   );

//   if (Object.keys(updates).length === 0) {
//     return res.status(400).json({ message: "No valid fields provided for update" });
//   }

//   try {
//     if (updates.password) {
//       const user = await User.findById(req.params.id);
//       if (!user) return res.status(404).json({ message: "User not found" });

//       Object.assign(user, updates);
//       await user.save(); // bcrypt pre-save hook

//       const { _id, name, email, createdAt } = user;
//       return res.json({
//         message: "User updated successfully",
//         user: { id: _id, name, email, createdAt },
//       });
//     }

//     const user = await User.findByIdAndUpdate(
//       req.params.id,
//       { $set: updates },
//       { new: true, runValidators: true }
//     ).select("-password");

//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json({
//       message: "User updated successfully",
//       user: { id: user._id, name: user.name, email: user.email, createdAt: user.createdAt },
//     });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ DELETE USER ------------------
// exports.deleteUser = async (req, res) => {
//   try {
//     const user = await User.findByIdAndDelete(req.params.id);
//     if (!user) return res.status(404).json({ message: "User not found" });

//     res.json({ message: "User deleted successfully", userId: req.params.id });
//   } catch (err) {
//     res.status(500).json({ message: "Server error", error: err.message });
//   }
// };

// // ------------------ GET ME ------------------
// exports.getMe = (req, res) => {
//   const { _id, name, email, createdAt } = req.user;
//   res.json({ user: { id: _id, name, email, createdAt } });
// };

// // ------------------ LOGOUT ------------------
// exports.logout = (_req, res) => {
//   res.json({ message: "Logged out successfully. Please discard your token." });
// };