// controllers/groupBrand.controller.js
const GroupBrand = require("../models/groupBrands");

// ✅ Create new GroupBrand
exports.createGroupBrand = async (req, res) => {
  try {
    const brand = await GroupBrand.create(req.body);
    return res.status(201).json(brand);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Get all GroupBrands
exports.getAllGroupBrands = async (req, res) => {
  try {
    const brands = await GroupBrand.find();
    return res.json(brands);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Get single GroupBrand by ID
exports.getGroupBrandById = async (req, res) => {
  try {
    const brandId = req.params.id;
    const brand = await GroupBrand.findById(brandId).populate("groupId");

    if (!brand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    return res.json(brand);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Update GroupBrand by ID
exports.updateGroupBrand = async (req, res) => {
  try {
    const brandId = req.params.id;

    const updatedBrand = await GroupBrand.findByIdAndUpdate(
      brandId,
      req.body,
      { new: true }
    );

    if (!updatedBrand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    return res.json(updatedBrand);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Delete GroupBrand by ID
exports.deleteGroupBrand = async (req, res) => {
  try {
    const brandId = req.params.id;

    const deletedBrand = await GroupBrand.findByIdAndDelete(brandId);

    if (!deletedBrand) {
      return res.status(404).json({ message: "Brand not found" });
    }

    return res.json({ message: "Brand deleted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
