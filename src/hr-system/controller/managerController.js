const Manager = require("../models/Managers");

// GET /api/managers
// list all active managers (for dropdown)
async function listManagers(req, res) {
  try {
    const managers = await Manager.find({ active: true }).sort({ name: 1 }).lean();
    return res.json(managers);
  } catch (err) {
    console.error("listManagers error", err);
    return res.status(500).json({ error: "Server error loading managers" });
  }
}

// POST /api/managers
// add a new manager
async function createManager(req, res) {
  try {
    const { name, department, email } = req.body;

    if (!name || !department || !email) {
      return res.status(400).json({ error: "name, department, and email are required" });
    }

    const exists = await Manager.findOne({ email });
    if (exists) {
      return res.status(400).json({ error: "Manager with this email already exists" });
    }

    const created = await Manager.create({ name, department, email });
    return res.status(201).json(created);
  } catch (err) {
    console.error("createManager error", err);
    return res.status(500).json({ error: "Could not add manager" });
  }
}

// PUT /api/managers/:id
async function updateManager(req, res) {
  try {
    const { id } = req.params;
    const { name, department, email, active } = req.body;

    const updated = await Manager.findByIdAndUpdate(
      id,
      { name, department, email, active },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ error: "Manager not found" });
    }

    return res.json(updated);
  } catch (err) {
    console.error("updateManager error", err);
    return res.status(500).json({ error: "Could not update manager" });
  }
}

// DELETE /api/managers/:id
async function deleteManager(req, res) {
  try {
    const { id } = req.params;
    await Manager.findByIdAndDelete(id);
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteManager error", err);
    return res.status(500).json({ error: "Could not delete manager" });
  }
}

module.exports = {
  listManagers,
  createManager,
  updateManager,
  deleteManager,
};
