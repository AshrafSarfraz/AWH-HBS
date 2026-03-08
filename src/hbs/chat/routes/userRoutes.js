// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const { authMiddleware } = require('../../middleware/auth.middleware');

// GET /api/users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await User.find({}, '_id name'); // sirf id aur name chahiye
    // current user ko exclude karna optional hai
    const filtered = users.filter(u => u._id.toString() !== req.user.id);
    res.json(filtered);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;