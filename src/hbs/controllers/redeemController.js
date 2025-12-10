// controllers/couponController.js
const Coupon = require("../models/redeem");

// CREATE – POST /api/coupons
exports.createCoupon = async (req, res) => {
  try {
    const coupon = new Coupon(req.body);
    const saved = await coupon.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error("Create coupon error:", err);
    res.status(400).json({
      success: false,
      message: "Failed to create coupon",
      error: err.message,
    });
  }
};

// READ ALL – GET /api/coupons
exports.getAllCoupons = async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.json({
      success: true,
      data: coupons,
    });
  } catch (err) {
    console.error("Get all coupons error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch coupons",
    });
  }
};

// READ ONE – GET /api/coupons/:id
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }
    res.json({
      success: true,
      data: coupon,
    });
  } catch (err) {
    console.error("Get coupon by id error:", err);
    res.status(400).json({
      success: false,
      message: "Invalid ID",
    });
  }
};

// UPDATE – PUT /api/coupons/:id
exports.updateCoupon = async (req, res) => {
  try {
    const updated = await Coupon.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }

    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    console.error("Update coupon error:", err);
    res.status(400).json({
      success: false,
      message: "Failed to update coupon",
      error: err.message,
    });
  }
};

// DELETE – DELETE /api/coupons/:id
exports.deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Coupon not found",
      });
    }
    res.json({
      success: true,
      message: "Coupon deleted",
    });
  } catch (err) {
    console.error("Delete coupon error:", err);
    res.status(400).json({
      success: false,
      message: "Failed to delete coupon",
    });
  }
};
