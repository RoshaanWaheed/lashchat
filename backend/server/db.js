import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  username: { type: String, required: true, index: true },
  passwordHash: { type: String, required: true },
  avatar: { type: String, default: '' },
  bio: { type: String, default: '' },
}, { timestamps: { createdAt: true, updatedAt: false }, _id: false });

const RoomSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  isPrivate: { type: Boolean, default: false },
  type: { type: String, enum: ['channel', 'direct'], default: 'channel' },
  members: [{ type: String }],
}, { timestamps: { createdAt: true, updatedAt: false }, _id: false });

const MessageSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  roomId: { type: String, required: true, index: true },
  senderId: { type: String, required: true },
  senderName: { type: String, required: true },
  senderAvatar: { type: String, default: '' },
  content: { type: String, required: true },
}, { timestamps: { createdAt: true, updatedAt: false }, _id: false });

const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);
const MongoRoom = mongoose.models.Room || mongoose.model('Room', RoomSchema);
const MongoMessage = mongoose.models.Message || mongoose.model('Message', MessageSchema);

const mongoUri = process.env.MONGODB_URI;

if (!mongoUri) {
  throw new Error('MONGODB_URI environment variable is required. Please set it in your .env file.');
}

mongoose.connect(mongoUri)
  .then(() => {
    console.log('Successfully connected to MongoDB ✅.');
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  });

function mapMongoUser(doc) {
  return {
    _id: doc._id,
    username: doc.username,
    passwordHash: doc.passwordHash,
    avatar: doc.avatar,
    bio: doc.bio,
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
  };
}

function mapMongoRoom(doc) {
  return {
    _id: doc._id,
    name: doc.name,
    description: doc.description,
    isPrivate: doc.isPrivate,
    type: doc.type,
    members: doc.members || [],
    createdAt: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
  };
}

function mapMongoMessage(doc) {
  return {
    _id: doc._id,
    roomId: doc.roomId,
    senderId: doc.senderId,
    senderName: doc.senderName,
    senderAvatar: doc.senderAvatar,
    content: doc.content,
    timestamp: doc.createdAt ? doc.createdAt.toISOString() : new Date().toISOString()
  };
}

class Database {
  async getUsers() {
    const users = await MongoUser.find({});
    return users.map(mapMongoUser);
  }

  async getUserById(id) {
    const user = await MongoUser.findById(id);
    return user ? mapMongoUser(user) : undefined;
  }

  async getUserByUsername(username) {
    const user = await MongoUser.findOne({ username: new RegExp('^' + username + '$', 'i') });
    return user ? mapMongoUser(user) : undefined;
  }

  async createUser(user) {
    const id = 'u_' + Math.random().toString(36).substring(2, 11);
    const newUser = await MongoUser.create({
      _id: id,
      ...user
    });
    return mapMongoUser(newUser);
  }

  async updateUser(id, updates) {
    const updated = await MongoUser.findByIdAndUpdate(id, { $set: updates }, { new: true });
    return updated ? mapMongoUser(updated) : undefined;
  }

  async getRooms() {
    const rooms = await MongoRoom.find({});
    return rooms.map(mapMongoRoom);
  }

  async getRoomById(id) {
    const room = await MongoRoom.findById(id);
    return room ? mapMongoRoom(room) : undefined;
  }

  async createRoom(room) {
    const id = 'r_' + Math.random().toString(36).substring(2, 11);
    const newRoom = await MongoRoom.create({
      _id: id,
      ...room
    });
    return mapMongoRoom(newRoom);
  }

  async updateRoom(id, updates) {
    const updated = await MongoRoom.findByIdAndUpdate(id, { $set: updates }, { new: true });
    return updated ? mapMongoRoom(updated) : undefined;
  }

  async deleteRoom(id) {
    const result = await MongoRoom.findByIdAndDelete(id);
    await MongoMessage.deleteMany({ roomId: id });
    return !!result;
  }

  async getMessagesByRoom(roomId, limit = 100) {
    const messages = await MongoMessage.find({ roomId })
      .sort({ createdAt: 1 })
      .limit(limit);
    return messages.map(mapMongoMessage);
  }

  async createMessage(msg) {
    const id = 'msg_' + Math.random().toString(36).substring(2, 11);
    const newMessage = await MongoMessage.create({
      _id: id,
      ...msg
    });
    return mapMongoMessage(newMessage);
  }
}

export const db = new Database();
