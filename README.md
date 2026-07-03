# LashChat

A modern real-time chat application with public channels, private messaging, and direct messages. Built with React, Express, MongoDB, and Socket.io.

## Features

### Authentication & User Management
- User registration with username, password, avatar, and bio
- JWT-based authentication system
- Profile editing (update bio and avatar)
- Secure password hashing with bcrypt

### Chat Rooms & Channels
- Create public channels (accessible to all users)
- Create private channels (invite-only)
- View all accessible rooms
- Delete channels
- Invite users to private channels by username

### Direct Messaging
- Start 1-on-1 direct message threads
- Automatic reuse of existing DM threads
- Private DM history

### Real-time Features
- Real-time message sending and receiving via Socket.io
- Typing indicators
- Online user status tracking
- Real-time room updates

### User Discovery
- View all registered users
- Online/offline status indicators
- User profiles with avatars and bios

### UI/UX
- Modern glassmorphism design
- Responsive sidebar with channels and DMs tabs
- Mobile-friendly with collapsible sidebar
- Emoji picker for messages
- Message timestamps and sender avatars
- Smooth animations

## Tech Stack

### Frontend
- React 18
- Vite
- Tailwind CSS
- Socket.io Client
- Lucide React (icons)
- Framer Motion (animations)

### Backend
- Express.js
- MongoDB with Mongoose
- Socket.io
- JWT (jsonwebtoken)
- bcrypt (password hashing)
- CORS


## Installation

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local instance or MongoDB Atlas account)

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the backend directory with the following variables:
```env
# MONGODB_URI=
PORT=5000
JWT_SECRET=
```

4. Start the backend server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the frontend development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173`

## Usage

1. Open your browser and navigate to `http://localhost:5173`
2. Click "Create account" to register a new user
3. Enter a username (min 3 characters), password (min 6 characters), select an avatar, and add a bio
4. After registration, you'll be logged in automatically
5. Create channels or start direct messages with other users
6. Start chatting in real-time!

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login with username and password
- `GET /api/auth/me` - Get current user profile
- `POST /api/auth/profile` - Update user profile

### Rooms
- `GET /api/rooms` - Get all accessible rooms
- `POST /api/rooms` - Create a new room/channel
- `GET /api/rooms/:id/messages` - Get message history for a room
- `POST /api/rooms/:id/invite` - Invite user to private channel
- `DELETE /api/rooms/:id` - Delete a channel

### Users
- `GET /api/users` - Get all users

## Socket.io Events

### Client → Server
- `auth` - Send JWT token for authentication
- `room:join` - Join a room
- `room:leave` - Leave a room
- `message:send` - Send a message
- `typing:status` - Send typing status

### Server → Client
- `users:online` - Broadcast online user IDs
- `message:receive` - Receive a new message
- `typing:receive` - Receive typing status
- `room:created` - Room created event
- `room:updated` - Room updated event
- `room:deleted` - Room deleted event

## Environment Variables

### Backend (.env)
- `MONGODB_URI` - MongoDB connection string
- `PORT` - Server port (default: 5000)
- `JWT_SECRET` -

## Development

### Backend
```bash
cd backend
npm run dev  # Start with hot reload
```

### Frontend
```bash
cd frontend
npm run dev  # Start with hot reload
```

## Production Deployment

For production deployment:
1. Set strong JWT_SECRET in environment variables
2. Use a production MongoDB instance
3. Build the frontend: `cd frontend && npm run build`
4. Serve the frontend static files from the backend or use a separate web server
5. Use environment variables for all sensitive configuration
6. Enable HTTPS/WSS for secure connections

## License

ISC
