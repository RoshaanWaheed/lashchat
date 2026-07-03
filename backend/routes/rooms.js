import express from 'express';
import { db } from '../server/db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const allRooms = await db.getRooms();
    const visibleRooms = allRooms.filter(room => {
      if (room.type === 'channel') {
        return !room.isPrivate || room.members.includes(req.user.id);
      }
      if (room.type === 'direct') {
        return room.members.includes(req.user.id);
      }
      return false;
    });
    res.json(visibleRooms);
  } catch (err) {
    console.error('Fetch rooms error:', err);
    res.status(500).json({ error: 'Failed to load rooms' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { type, name, description, isPrivate, members } = req.body;

    if (type === 'direct') {
      if (!Array.isArray(members) || members.length !== 1) {
        return res.status(400).json({ error: 'A direct message requires exactly one other member' });
      }
      const peerId = members[0];
      if (peerId === req.user.id) {
        return res.status(400).json({ error: 'Cannot start a direct message with yourself' });
      }

      const peer = await db.getUserById(peerId);
      if (!peer) {
        return res.status(404).json({ error: 'User not found' });
      }

      const allRooms = await db.getRooms();
      const existingDM = allRooms.find(r =>
        r.type === 'direct' &&
        r.members.includes(req.user.id) &&
        r.members.includes(peerId)
      );
      if (existingDM) {
        return res.json(existingDM);
      }

      const newDM = await db.createRoom({
        name: `dm-${req.user.id}-${peerId}`,
        description: '',
        isPrivate: true,
        type: 'direct',
        members: [req.user.id, peerId],
      });
      return res.status(201).json(newDM);
    }

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const allRooms = await db.getRooms();
    const nameTaken = allRooms.some(r => r.type === 'channel' && r.name.toLowerCase() === name.trim().toLowerCase());
    if (nameTaken) {
      return res.status(409).json({ error: 'A channel with that name already exists' });
    }

    const newChannel = await db.createRoom({
      name: name.trim(),
      description: description || '',
      isPrivate: !!isPrivate,
      type: 'channel',
      members: isPrivate ? [req.user.id] : [],
    });

    res.status(201).json(newChannel);
  } catch (err) {
    console.error('Create room error:', err);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const room = await db.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.isPrivate && !room.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'You do not have access to this room' });
    }

    const messages = await db.getMessagesByRoom(req.params.id);
    res.json(messages);
  } catch (err) {
    console.error('Fetch messages error:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

router.post('/:id/invite', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: 'Username is required' });
    }

    const room = await db.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.type !== 'channel' || !room.isPrivate) {
      return res.status(400).json({ error: 'Invites only apply to private channels' });
    }
    if (!room.members.includes(req.user.id)) {
      return res.status(403).json({ error: 'You are not a member of this channel' });
    }

    const invitee = await db.getUserByUsername(username.trim());
    if (!invitee) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (room.members.includes(invitee._id)) {
      return res.status(409).json({ error: 'User is already a member of this channel' });
    }

    const updatedRoom = await db.updateRoom(req.params.id, {
      members: [...room.members, invitee._id],
    });

    res.json(updatedRoom);
  } catch (err) {
    console.error('Invite member error:', err);
    res.status(500).json({ error: 'Failed to invite member' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const room = await db.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    if (room.type !== 'channel') {
      return res.status(400).json({ error: 'Only channels can be deleted' });
    }

    await db.deleteRoom(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete room error:', err);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

export default router;