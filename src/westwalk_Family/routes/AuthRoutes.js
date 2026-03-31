const express = require("express");
const router = express.Router();
const authController = require("../controller/AdminAuth");
const protect = require("../middleware/Authmiddleware");


 
// Public routes
router.post("/register", authController.register);
router.post("/login", authController.login);

router.get("/admin", authController.getAllUsers);
router.patch("/AdminUser/:id", protect, authController.updateUser);
 
// Protected routes
router.get("/me", protect, authController.getMe);
router.post("/logout", protect, authController.logout);
 
module.exports = router;
 