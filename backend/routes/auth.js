import express from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../server/db.js';
import { requireAuth, signToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { username, password, avatar, bio } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    if (username.trim().length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.getUserByUsername(username.trim());
    if (existing) {
      return res.status(409).json({ error: 'Username is already taken' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const newUser = await db.createUser({
      username: username.trim(),
      passwordHash,
      avatar: avatar || '',
      bio: bio || '',
    });

    const token = signToken(newUser);
    const { passwordHash: _omit, ...safeUser } = newUser;

    res.status(201).json({ token, user: safeUser });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Failed to register. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await db.getUserByUsername(username.trim());
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const token = signToken(user);
    const { passwordHash: _omit, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash: _omit, ...safeUser } = user;
    res.json(safeUser);
  } catch (err) {
    console.error('Fetch profile error:', err);
    res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.post('/profile', requireAuth, async (req, res) => {
  try {
    const { bio, avatar } = req.body;
    const updates = {};
    if (bio !== undefined) updates.bio = bio;
    if (avatar !== undefined) updates.avatar = avatar;

    const updated = await db.updateUser(req.user.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'User not found' });
    }
    const { passwordHash: _omit, ...safeUser } = updated;
    res.json(safeUser);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

export default router;