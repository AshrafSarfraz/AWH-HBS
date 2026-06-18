const Vendor = require("../models/venderAccounts");

/* ===================== CREATE VENDOR ===================== */
exports.createVendor = async (req, res) => {
  try {
    const vendor = new Vendor(req.body);
    const saved = await vendor.save();

    res.status(201).json({ message: "Vendor created", data: saved });
  } catch (err) {
    console.error("CREATE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ===================== GET ALL ===================== */
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find();
    res.json(vendors);
  } catch (err) {
    console.error("GET ALL ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ===================== GET ONE ===================== */
exports.getVendor = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.id);

    if (!vendor)
      return res.status(404).json({ message: "Vendor not found" });

    res.json(vendor);
  } catch (err) {
    console.error("GET ONE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ===================== UPDATE ===================== */
exports.updateVendor = async (req, res) => {
  try {
    const updated = await Vendor.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );

    if (!updated)
      return res.status(404).json({ message: "Vendor not found" });

    res.json({ message: "Vendor updated", data: updated });
  } catch (err) {
    console.error("UPDATE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ===================== DELETE ===================== */
exports.deleteVendor = async (req, res) => {
  try {
    const deleted = await Vendor.findByIdAndDelete(req.params.id);

    if (!deleted)
      return res.status(404).json({ message: "Vendor not found" });

    res.json({ message: "Vendor deleted", data: deleted });
  } catch (err) {
    console.error("DELETE ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};

/* ===================== SIMPLE LOGIN ===================== */
exports.loginVendor = async (req, res) => {
  try {
    const { email, password } = req.body;

    const vendor = await Vendor.findOne({ email, password });

    if (!vendor)
      return res.status(400).json({ message: "Invalid email or password" });

    res.json({
      message: "Login successful",
      vendor,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({ message: "Server Error" });
  }
};
