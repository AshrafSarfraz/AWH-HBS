const Admin = require("../models/admin");

// CREATE ADMIN
exports.createAdmin = async (req, res) => {
  try {
    const admin = await Admin.create(req.body);
    res.status(201).json(admin);
  } catch (error) {
    res.status(400).json({ message: "Error creating admin", error: error.message });
  }
};

// POST /api/hbs/admins/login
exports.loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;

    // simple check (no hash, jaisa tum chahte ho)
    const admin = await Admin.findOne({ email, password });

    if (!admin) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    res.json({
      success: true,
      message: "Login successful",
      data: admin,
    });
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};







// GET ALL ADMINS
exports.getAdmins = async (req, res) => {
  try {
    const admins = await Admin.find();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error: error.message });
  }
};






// GET ADMIN BY ID
exports.getAdminById = async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json(admin);
  } catch (error) {
    res.status(400).json({ message: "Invalid ID", error: error.message });
  }
};








// UPDATE ADMIN
exports.updateAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json(admin);
  } catch (error) {
    res.status(400).json({ message: "Error updating admin", error: error.message });
  }
};

// DELETE ADMIN
exports.deleteAdmin = async (req, res) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);

    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json({ message: "Admin deleted successfully", admin });
  } catch (error) {
    res.status(400).json({ message: "Error deleting admin", error: error.message });
  }
};
