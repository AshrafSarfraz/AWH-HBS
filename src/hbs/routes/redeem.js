// routes/couponRoutes.js
const express = require("express");
const router = express.Router();
const couponController = require("../controllers/redeemController");

// Base path: /api/coupons

router.post("/", couponController.createCoupon);       // Create coupon
router.get("/", couponController.getAllCoupons);       // Get all coupons
router.get("/:id", couponController.getCouponById);    // Get single coupon
router.put("/:id", couponController.updateCoupon);     // Update coupon
router.delete("/:id", couponController.deleteCoupon);  // Delete coupon

module.exports = router;
