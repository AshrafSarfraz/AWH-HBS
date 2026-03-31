const express = require("express");
const router = express.Router();
const authController = require("../controller/AdminAuth");
const protect = require("../middleware/Authmiddleware");

// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

// Protected routes
router.get("/users", protect, authController.getAllUsers);       // all users
router.get("/users/:id", protect, authController.getUser);       // single user
router.patch("/users/:id", protect, authController.updateUser);  // update user
router.delete("/users/:id", protect, authController.deleteUser); // delete user

router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);

module.exports = router;