import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';

import { db } from './server/db.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import roomsRoutes from './routes/rooms.js';
import { JWT_SECRET } from './middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/rooms', roomsRoutes);

app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});

const onlineUsers = new Map();
const socketUser = new Map();

function broadcastOnlineUsers() {
  io.emit('users:online', Array.from(onlineUsers.keys()));
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('auth', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socketUser.set(socket.id, decoded);

      if (!onlineUsers.has(decoded.id)) {
        onlineUsers.set(decoded.id, new Set());
      }
      onlineUsers.get(decoded.id).add(socket.id);

      broadcastOnlineUsers();
    } catch (err) {
      console.error('Socket auth failed for', socket.id, err.message);
      socket.emit('auth:error', { error: 'Invalid or expired token' });
    }
  });

  socket.on('room:join', (roomId) => {
    if (roomId) socket.join(roomId);
  });

  socket.on('room:leave', (roomId) => {
    if (roomId) socket.leave(roomId);
  });

  socket.on('message:send', async ({ roomId, content }) => {
    const user = socketUser.get(socket.id);
    if (!user || !roomId || !content || !content.trim()) return;

    try {
      const sender = await db.getUserById(user.id);
      if (!sender) return;

      const message = await db.createMessage({
        roomId,
        senderId: sender._id,
        senderName: sender.username,
        senderAvatar: sender.avatar,
        content: content.trim(),
      });

      io.to(roomId).emit('message:receive', message);
    } catch (err) {
      console.error('message:send error:', err);
    }
  });

  socket.on('typing:status', ({ roomId, isTyping }) => {
    const user = socketUser.get(socket.id);
    if (!user || !roomId) return;

    socket.to(roomId).emit('typing:receive', {
      roomId,
      userId: user.id,
      username: user.username,
      isTyping,
    });
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);

    const user = socketUser.get(socket.id);
    socketUser.delete(socket.id);

    if (user && onlineUsers.has(user.id)) {
      const sockets = onlineUsers.get(user.id);
      sockets.delete(socket.id);
      if (sockets.size === 0) {
        onlineUsers.delete(user.id);
      }
      broadcastOnlineUsers();
    }
  });
});

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});