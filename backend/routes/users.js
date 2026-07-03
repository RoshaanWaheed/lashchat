import express from 'express';
import { db } from '../server/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const users = await db.getUsers();
    const safeUsers = users
      .filter(u => u._id !== req.user.id)
      .map(({ passwordHash, ...rest }) => rest);
    res.json(safeUsers);
  } catch (err) {
    console.error('Fetch users error:', err);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

export default router;