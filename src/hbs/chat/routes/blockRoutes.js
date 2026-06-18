// /src/hbs/chat/routes/blockRoutes.js
const express = require('express');
const router = express.Router();
const { Block } = require('../model/block');
const { authMiddleware } = require('../../middleware/auth.middleware');

// ✅ FIX: Static routes pehle, dynamic (:userId) baad mein
// Warna Express /blocked-list ko /:userId se match kar leta

// ─────────────────────────────────────────
// GET /api/block/blocked-list
// ─────────────────────────────────────────
router.get('/blocked-list', authMiddleware, async (req, res) => {
  try {
    const list = await Block.find({ blocker: req.user.id })
      .populate('blocked', 'name email');
    res.json(list);
  } catch (err) {
    console.error('Blocked list error:', err);
    res.status(500).json({ error: 'Failed to fetch blocked list' });
  }
});

// ─────────────────────────────────────────
// GET /api/block/status/:userId
// ─────────────────────────────────────────
router.get('/status/:userId', authMiddleware, async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;

    const iBlockedThem = await Block.exists({
      blocker: myId,
      blocked: otherId,
    });

    const theyBlockedMe = await Block.exists({
      blocker: otherId,
      blocked: myId,
    });

    res.json({
      iBlockedThem: !!iBlockedThem,
      theyBlockedMe: !!theyBlockedMe,
    });
  } catch (err) {
    console.error('Block status error:', err);
    res.status(500).json({ error: 'Failed to fetch block status' });
  }
});

// ─────────────────────────────────────────
// POST /api/block/:userId — Block user
// ─────────────────────────────────────────
router.post('/:userId', authMiddleware, async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;

    if (blockerId === blockedId) {
      return res.status(400).json({ error: 'Khud ko block nahi kar sakte' });
    }

    await Block.create({ blocker: blockerId, blocked: blockedId });
    res.json({ message: 'User blocked' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'Already blocked' });
    }
    console.error('Block error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// ─────────────────────────────────────────
// DELETE /api/block/:userId — Unblock user
// ─────────────────────────────────────────
router.delete('/:userId', authMiddleware, async (req, res) => {
  try {
    const blockerId = req.user.id;
    const blockedId = req.params.userId;

    await Block.findOneAndDelete({ blocker: blockerId, blocked: blockedId });
    res.json({ message: 'User unblocked' });
  } catch (err) {
    console.error('Unblock error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

module.exports = router;



// const express = require('express');
// const router = express.Router();
// const { Block } = require('../model/block');
// const { authMiddleware } = require('../../middleware/auth.middleware');

// // ✅ GET FIRST (IMPORTANT — warna conflict hoga)
// router.get('/status/:userId', authMiddleware, async (req, res) => {
//   try {
//     const myId = req.user.id;
//     const otherId = req.params.userId;

//     const iBlockedThem = await Block.exists({
//       blocker: myId,
//       blocked: otherId,
//     });

//     const theyBlockedMe = await Block.exists({
//       blocker: otherId,
//       blocked: myId,
//     });

//     res.json({
//       iBlockedThem: !!iBlockedThem,
//       theyBlockedMe: !!theyBlockedMe,
//     });
//   } catch (err) {
//     console.error('Block status error:', err);
//     res.status(500).json({ error: 'Failed to fetch block status' });
//   }
// });

// // ✅ BLOCK USER
// router.post('/:userId', authMiddleware, async (req, res) => {
//   try {
//     const blockerId = req.user.id;
//     const blockedId = req.params.userId;

//     if (blockerId === blockedId) {
//       return res.status(400).json({
//         error: 'Khud ko block nahi kar sakte',
//       });
//     }

//     await Block.create({ blocker: blockerId, blocked: blockedId });

//     res.json({ message: 'User blocked' });
//   } catch (err) {
//     if (err.code === 11000) {
//       return res.status(400).json({ error: 'Already blocked' });
//     }

//     console.error('Block error:', err);
//     res.status(500).json({ error: 'Failed to block user' });
//   }
// });

// // ✅ UNBLOCK USER
// router.delete('/:userId', authMiddleware, async (req, res) => {
//   try {
//     const blockerId = req.user.id;
//     const blockedId = req.params.userId;

//     await Block.findOneAndDelete({
//       blocker: blockerId,
//       blocked: blockedId,
//     });

//     res.json({ message: 'User unblocked' });
//   } catch (err) {
//     console.error('Unblock error:', err);
//     res.status(500).json({ error: 'Failed to unblock user' });
//   }
// });
// // Blocked users list with populated names
// router.get('/blocked-list', authMiddleware, async (req, res) => {
//   try {
//     const list = await Block.find({ blocker: req.user.id })
//       .populate('blocked', 'name email');  // ← name aur email lao
//     res.json(list);
//   } catch (err) {
//     res.status(500).json({ error: 'Failed to fetch blocked list' });
//   }
// });

// module.exports = router;