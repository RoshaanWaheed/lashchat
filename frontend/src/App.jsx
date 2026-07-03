import React, { useState, useEffect, useRef } from 'react';
import { 
  Hash, Send, LogOut, MessageSquare, Users, Plus, User, Smile, Settings, X, Check, Compass, Globe, BookOpen, ChevronRight, Sparkles, Paperclip, Menu, MessageCircle, Eye, EyeOff, Trash2, UserPlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';

const AVATAR_SEEDS = ['star', 'comet', 'quantum', 'pulse', 'nebula', 'matrix', 'cyber', 'aurora', 'nexus', 'prism'];

export default function App() {
  const [token, setToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLogin, setIsLogin] = useState(true);
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [bio, setBio] = useState('');
  const [avatarSeed, setAvatarSeed] = useState(AVATAR_SEEDS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('general');
  const [messages, setMessages] = useState([]);
  const [newMessageContent, setNewMessageContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [usersList, setUsersList] = useState([]);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [typingUsers, setTypingUsers] = useState({});

  const [showNewChannelModal, setShowNewChannelModal] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelDesc, setNewChannelDesc] = useState('');
  const [newChannelPrivate, setNewChannelPrivate] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editBio, setEditBio] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');
  const [activeTab, setActiveTab] = useState('channels');

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [inviteUsername, setInviteUsername] = useState('');

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  };

  const fetchCurrentUser = async (jwtToken) => {
    try {
      const res = await fetch('/api/auth/me', { headers: { 'Authorization': `Bearer ${jwtToken}` } });
      if (res.ok) {
        const user = await res.json();
        setCurrentUser(user);
        setEditBio(user.bio);
        const seedMatch = user.avatar.match(/seed\/([^/]+)/);
        setEditAvatarSeed(seedMatch ? seedMatch[1] : user.username);
      } else {
        handleLogout();
      }
    } catch (e) {
      console.error('Failed to load profile', e);
    }
  };

  const fetchRooms = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
        if (data.length > 0 && !data.some((r) => r._id === selectedRoomId)) {
          setSelectedRoomId(data[0]._id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch rooms', e);
    }
  };

  const fetchUsers = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/users', { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setUsersList(await res.json());
      }
    } catch (e) {
      console.error('Failed to fetch users', e);
    }
  };

  const fetchMessagesForRoom = async (roomId) => {
    if (!token || !roomId) return;
    try {
      const res = await fetch(`/api/rooms/${roomId}/messages`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) {
        setMessages(await res.json());
        scrollToBottom();
      }
    } catch (e) {
      console.error('Failed to load message history', e);
    }
  };

  useEffect(() => {
    const storedToken = localStorage.getItem('chat_token');
    if (storedToken) {
      setToken(storedToken);
      fetchCurrentUser(storedToken);
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchRooms();
      fetchUsers();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const socket = io(import.meta.env.VITE_API_URL);
    socketRef.current = socket;
    socket.emit('auth', token);
    fetchMessagesForRoom(selectedRoomId);

    socket.on('users:online', (userIds) => setOnlineUserIds(userIds));
    socket.on('message:receive', (msg) => {
      if (msg.roomId === selectedRoomId) {
        setMessages(prev => prev.some(m => m._id === msg._id) ? prev : [...prev, msg]);
        scrollToBottom();
      }
    });
    socket.on('typing:receive', (data) => {
      if (data.roomId === selectedRoomId) {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (data.isTyping) next[data.userId] = data.username;
          else delete next[data.userId];
          return next;
        });
      }
    });
    socket.on('room:created', (newRoom) => {
      setRooms(prev => {
        if (prev.some(r => r._id === newRoom._id)) return prev;
        if (newRoom.type === 'channel') {
          if (!newRoom.isPrivate || (newRoom.members && currentUser && newRoom.members.includes(currentUser._id))) return [...prev, newRoom];
        } else if (newRoom.type === 'direct') {
          if (newRoom.members && currentUser && newRoom.members.includes(currentUser._id)) return [...prev, newRoom];
        }
        return prev;
      });
    });
    socket.on('room:updated', (updatedRoom) => setRooms(prev => prev.map(r => r._id === updatedRoom._id ? updatedRoom : r)));
    socket.on('room:deleted', (deletedRoomId) => {
      setRooms(prev => prev.filter(r => r._id !== deletedRoomId));
      setSelectedRoomId(prev => prev === deletedRoomId ? 'general' : prev);
    });
    socket.emit('room:join', selectedRoomId);

    return () => {
      socket.emit('room:leave', selectedRoomId);
      socket.disconnect();
    };
  }, [token, selectedRoomId]);

  useEffect(() => {
    setTypingUsers({});
    if (token && selectedRoomId) fetchMessagesForRoom(selectedRoomId);
  }, [selectedRoomId]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    const payload = isLogin ? { username, password } : { username, password, avatar: `https://picsum.photos/seed/${avatarSeed}/96`, bio };
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed. Please check inputs.');
      } else {
        localStorage.setItem('chat_token', data.token);
        setToken(data.token);
        setCurrentUser(data.user);
        setEditBio(data.user.bio);
        setEditAvatarSeed(avatarSeed);
        setUsername('');
        setPassword('');
        setBio('');
      }
    } catch (err) {
      setAuthError('Connection failed. Please ensure backend is running.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_token');
    setToken(null);
    setCurrentUser(null);
    setRooms([]);
    setMessages([]);
    setUsersList([]);
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch('/api/auth/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ bio: editBio, avatar: `https://picsum.photos/seed/${editAvatarSeed}/96` })
      });
      if (res.ok) {
        const updated = await res.json();
        setCurrentUser(prev => prev ? { ...prev, bio: updated.bio, avatar: updated.avatar } : null);
        setShowEditProfile(false);
      }
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    if (!newChannelName.trim() || !token) return;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name: newChannelName.trim(), description: newChannelDesc, isPrivate: newChannelPrivate, type: 'channel' })
      });
      if (res.ok) {
        const createdRoom = await res.json();
        setRooms(prev => prev.some(r => r._id === createdRoom._id) ? prev : [...prev, createdRoom]);
        setSelectedRoomId(createdRoom._id);
        setNewChannelName('');
        setNewChannelDesc('');
        setNewChannelPrivate(false);
        setShowNewChannelModal(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to create channel');
      }
    } catch (e) {
      console.error('Channel creation error', e);
    }
  };

  const handleStartDM = async (peerId) => {
    if (!token) return;
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'direct', members: [peerId] })
      });
      if (res.ok) {
        const room = await res.json();
        setRooms(prev => prev.some(r => r._id === room._id) ? prev : [...prev, room]);
        setSelectedRoomId(room._id);
        setActiveTab('messages');
      }
    } catch (err) {
      console.error('DM thread error', err);
    }
  };

  const handleInviteMembers = async (e) => {
    e.preventDefault();
    if (!token || !activeRoom || !inviteUsername.trim()) return;
    try {
      const res = await fetch(`/api/rooms/${activeRoom._id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ username: inviteUsername.trim() })
      });
      if (res.ok) {
        const updatedRoom = await res.json();
        setRooms(prev => prev.map(r => r._id === updatedRoom._id ? updatedRoom : r));
        setShowInviteModal(false);
        setInviteUsername('');
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to invite member');
      }
    } catch (err) {
      console.error('Failed to invite member', err);
    }
  };

  const handleDeleteChannel = async () => {
    if (!token || !activeRoom) return;
    try {
      const res = await fetch(`/api/rooms/${activeRoom._id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setRooms(prev => prev.filter(r => r._id !== activeRoom._id));
        setSelectedRoomId('general');
        setShowDeleteConfirmModal(false);
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete channel');
      }
    } catch (err) {
      console.error('Failed to delete channel', err);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessageContent.trim() || !selectedRoomId || !socketRef.current) return;
    socketRef.current.emit('message:send', { roomId: selectedRoomId, content: newMessageContent.trim() });
    setNewMessageContent('');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketRef.current.emit('typing:status', { roomId: selectedRoomId, isTyping: false });
  };

  const handleInputChange = (e) => {
    setNewMessageContent(e.target.value);
    if (!socketRef.current) return;
    socketRef.current.emit('typing:status', { roomId: selectedRoomId, isTyping: true });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current.emit('typing:status', { roomId: selectedRoomId, isTyping: false });
    }, 2000);
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessageContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const activeRoom = rooms.find(r => r._id === selectedRoomId);
  const getCleanRoomName = (room) => {
    if (room.type === 'direct') {
      if (currentUser && room.members) {
        const otherId = room.members.find(mId => mId !== currentUser._id);
        const otherUser = usersList.find(u => u._id === otherId);
        return otherUser ? `${otherUser.username}` : 'Direct Chat';
      }
      return 'Direct Chat';
    }
    return `#${room.name}`;
  };

  const getCleanRoomDescription = (room) => {
    if (room.type === 'direct') {
      if (currentUser && room.members) {
        const otherId = room.members.find(mId => mId !== currentUser._id);
        const otherUser = usersList.find(u => u._id === otherId);
        return otherUser ? otherUser.bio : 'Encrypted private message';
      }
      return 'Encrypted private message';
    }
    return room.description || 'No topic set for this room';
  };

  const getCleanRoomAvatar = (room) => {
    if (room.type === 'direct') {
      if (currentUser && room.members) {
        const otherId = room.members.find(mId => mId !== currentUser._id);
        const otherUser = usersList.find(u => u._id === otherId);
        return otherUser ? otherUser.avatar : 'https://picsum.photos/seed/default/96';
      }
    }
    return `https://picsum.photos/seed/${room.name}/96`;
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-[#0c0c14] text-white flex items-center justify-center p-4 relative overflow-hidden font-sans">
        <div className="absolute inset-0 pointer-events-none opacity-50 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600 rounded-full blur-[150px]" />
          <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-pink-500 rounded-full blur-[100px]" />
        </div>
        <div className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl p-8 shadow-2xl relative z-10 text-white">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 text-indigo-300 rounded-xl mb-4 border border-white/10 shadow-inner">
              <Sparkles className="w-8 h-8 animate-lash" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight font-sans text-white">LashChat</h1>
            <p className="text-sm text-white/40 mt-2">Real-time chat platform</p>
          </div>
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authError && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-350 text-xs rounded-lg flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping shrink-0" />
                <span>{authError}</span>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Username</label>
              <input type="text" required placeholder="Enter unique username" value={username} onChange={e => setUsername(e.target.value.replace(/\s+/g, ''))} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm font-medium" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Password</label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} required placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm pr-10 font-mono" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            {!isLogin && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">Select Avatar Seed</label>
                  <div className="grid grid-cols-5 gap-2">
                    {AVATAR_SEEDS.map((seed) => (
                      <button key={seed} type="button" onClick={() => setAvatarSeed(seed)} className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all p-0.5 ${avatarSeed === seed ? 'border-indigo-400' : 'border-white/10 opacity-60 hover:opacity-100'}`}>
                        <img src={`https://picsum.photos/seed/${seed}/96`} alt={seed} className="w-full h-full object-cover rounded-lg" />
                        {avatarSeed === seed && <div className="absolute inset-0 bg-indigo-500/25 flex items-center justify-center text-indigo-200"><Check className="w-4 h-4 stroke-[3]" /></div>}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Short Bio</label>
                  <input type="text" placeholder="Tell us about yourself..." value={bio} onChange={e => setBio(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm" />
                </div>
              </div>
            )}
            <button type="submit" disabled={authLoading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2 mt-4 cursor-pointer disabled:opacity-50">
              {authLoading ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Processing...</> : isLogin ? 'Login' : 'Create Account'}
            </button>
          </form>
          <div className="text-center mt-6">
            <button onClick={() => { setIsLogin(!isLogin); setAuthError(''); }} className="text-xs text-white/40 hover:text-indigo-300 transition underline underline-offset-4">
              {isLogin ? "Don't have an account? Create account here" : "Already have an account? Login here"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-[#0c0c14] text-white font-sans overflow-hidden relative">
      <div className="absolute inset-0 pointer-events-none opacity-50 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600 rounded-full blur-[150px]" />
        <div className="absolute top-[20%] right-[10%] w-[300px] h-[300px] bg-pink-500 rounded-full blur-[100px]" />
      </div>
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-white/5 backdrop-blur-3xl border-r border-white/10 flex flex-col transition-transform duration-300 md:static md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-0'}`}>
        <div className="h-16 border-b border-white/10 px-5 flex items-center justify-between bg-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 border border-white/20 flex items-center justify-center font-bold text-white">
              <Sparkles className="w-4.5 h-4.5" />
            </div>
            <span className="font-semibold text-white tracking-tight text-base font-sans">LashChat Room</span>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="p-1 text-white/50 hover:text-white md:hidden transition"><X className="w-5 h-5" /></button>
        </div>
        {currentUser && (
          <div className="p-4 border-b border-white/10 bg-white/5 backdrop-blur-md flex items-center justify-between group">
            <div className="flex items-center gap-3">
              <button onClick={() => setShowEditProfile(true)} className="relative w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 cursor-pointer hover:border-indigo-400 transition">
                <img src={currentUser.avatar} alt={currentUser.username} className="w-full h-full object-cover" />
              </button>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5 leading-tight">{currentUser.username}<span className="w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.8)]" /></p>
                <p className="text-[10px] text-indigo-300 font-medium tracking-wider uppercase truncate max-w-[130px]">{currentUser.bio || 'Developer'}</p>
              </div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => setShowEditProfile(true)} className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition"><Settings className="w-4 h-4" /></button>
              <button onClick={handleLogout} className="p-1.5 text-white/50 hover:text-red-400 hover:bg-white/10 rounded-lg transition"><LogOut className="w-4 h-4" /></button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 border-b border-white/10 bg-white/5 px-2 pt-2">
          <button onClick={() => setActiveTab('channels')} className={`py-2 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-2 ${activeTab === 'channels' ? 'border-indigo-400 text-indigo-300 font-bold bg-white/5 rounded-t-xl' : 'border-transparent text-white/40 hover:text-white'}`}>
            <Hash className="w-3.5 h-3.5" />Channels
          </button>
          <button onClick={() => setActiveTab('messages')} className={`py-2 text-xs font-semibold border-b-2 transition flex items-center justify-center gap-2 ${activeTab === 'messages' ? 'border-indigo-400 text-indigo-300 font-bold bg-white/5 rounded-t-xl' : 'border-transparent text-white/40 hover:text-white'}`}>
            <MessageSquare className="w-3.5 h-3.5" />Direct Messages
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
          {activeTab === 'channels' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between px-3 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Public Channels</span>
                <button onClick={() => setShowNewChannelModal(true)} className="p-1 text-white/40 hover:text-indigo-300 hover:bg-white/5 rounded-lg transition"><Plus className="w-4 h-4" /></button>
              </div>
              {rooms.filter(r => r.type === 'channel').length === 0 ? <p className="text-xs text-white/30 px-3 py-2 italic text-center">No channels found</p> : rooms.filter(r => r.type === 'channel').map((channel) => (
                <button key={channel._id} onClick={() => { setSelectedRoomId(channel._id); setSidebarOpen(false); }} className={`w-full px-3 py-2.5 rounded-r-xl rounded-l-none flex items-center justify-between group transition duration-150 ${selectedRoomId === channel._id ? 'bg-white/10 border-l-4 border-indigo-400 text-white font-semibold' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Hash className={`w-4 h-4 shrink-0 transition-colors ${selectedRoomId === channel._id ? 'text-indigo-300' : 'text-white/30'}`} />
                    <span className="truncate text-sm">{channel.name}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center px-3 mb-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">Direct Messages</span>
              </div>
              {(() => {
                const hasPublicChannels = rooms.some(r => r.type === 'channel' && !r.isPrivate);
                if (!hasPublicChannels) return <p className="text-xs text-white/30 px-3 py-2 italic text-center">No public channels</p>;
                if (usersList.length === 0) return <p className="text-xs text-white/30 px-3 py-2 italic text-center">No other members signed up yet</p>;
                return usersList.map((user) => {
                  const isOnline = onlineUserIds.includes(user._id);
                  const dmRoomFound = rooms.find(r => r.type === 'direct' && r.members?.includes(user._id) && r.members?.includes(currentUser?._id || ''));
                  const isSelected = dmRoomFound && selectedRoomId === dmRoomFound._id;
                  const hasDM = !!dmRoomFound;
                  return (
                    <button key={user._id} onClick={() => { handleStartDM(user._id); setSidebarOpen(false); }} className={`w-full px-3 py-2.5 rounded-r-xl rounded-l-none flex items-center justify-between group transition duration-150 ${isSelected ? 'bg-white/10 border-l-4 border-indigo-400 text-white font-semibold' : 'text-white/60 hover:bg-white/5 hover:text-white'}`}>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative w-6 h-6 rounded-lg shrink-0 overflow-hidden border border-white/10">
                          <img src={user.avatar} alt={user.username} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-sm">{user.username}</span>
                          {hasDM && <span className="text-[10px] text-white/40 truncate">Direct message</span>}
                        </div>
                      </div>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${isOnline ? 'bg-indigo-400 shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'bg-white/20'}`} title={isOnline ? 'Online' : 'Offline'} />
                    </button>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col min-w-0 bg-transparent z-10">
        {activeRoom ? (
          <>
            <div className="h-20 bg-white/5 backdrop-blur-2xl border-b border-white/10 flex items-center justify-between px-8 shrink-0 z-20">
              <div className="flex items-center gap-3.5 min-w-0">
                <button onClick={() => setSidebarOpen(true)} className="p-1 text-white/55 hover:text-white md:hidden transition"><Menu className="w-5.5 h-5.5" /></button>
                <div className="relative w-10 h-10 rounded-2xl overflow-hidden shrink-0 border border-indigo-400/30 bg-indigo-500/10">
                  <img src={getCleanRoomAvatar(activeRoom)} alt="Avatar" className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-white truncate pr-4">{getCleanRoomName(activeRoom)}</h2>
                  <p className="text-[10px] text-indigo-300 flex items-center gap-1.5 truncate max-w-sm md:max-w-xl">
                    <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.8)] shrink-0"></span>
                    {getCleanRoomDescription(activeRoom)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {activeRoom.type === 'channel' && activeRoom.isPrivate && (
                  <button onClick={() => { setInviteUsername(''); setShowInviteModal(true); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/25 hover:bg-indigo-600/40 border border-indigo-500/20 rounded-xl text-xs font-semibold text-indigo-200 transition cursor-pointer"><UserPlus className="w-3.5 h-3.5" /><span>Invite</span></button>
                )}
                {activeRoom.type === 'channel' && (
                  <button onClick={() => setShowDeleteConfirmModal(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl text-xs font-semibold text-rose-300 transition cursor-pointer"><Trash2 className="w-3.5 h-3.5" /><span>Delete</span></button>
                )}
                {activeRoom.type === 'channel' ? (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white/60"><Compass className="w-3.5 h-3.5 text-indigo-300" /><span>{activeRoom.isPrivate ? 'Private Channel' : 'Public Environment'}</span></div>
                ) : (
                  <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-[10px] text-white/60"><Users className="w-3.5 h-3.5 text-indigo-300" /><span>Secure Encrypted Thread</span></div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-transparent">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-white/40 py-10">
                  <div className="p-4 bg-white/5 backdrop-blur-md border border-white/10 text-indigo-300 rounded-2xl mb-3 shadow-sm"><MessageCircle className="w-8 h-8 opacity-75" /></div>
                  <p className="text-sm font-semibold text-white">No messages in {getCleanRoomName(activeRoom)} yet</p>
                  <p className="text-xs text-white/40 mt-1">Be the first to say hello!</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map((msg, index) => {
                    const isOwnMessage = currentUser && msg.senderId === currentUser._id;
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId && (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() < 120000);
                    return (
                      <motion.div key={msg._id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.15 }} className={`flex items-start gap-3 max-w-[85%] md:max-w-[70%] ${isOwnMessage ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}>
                        {!isConsecutive ? (
                          <div className="w-8.5 h-8.5 rounded-lg overflow-hidden border border-white/20 shrink-0 select-none bg-white/5">
                            <img src={msg.senderAvatar} alt={msg.senderName} className="w-full h-full object-cover" />
                          </div>
                        ) : <div className="w-8.5 shrink-0" />}
                        <div className="space-y-0.5">
                          {!isConsecutive && (
                            <div className={`flex items-center gap-2 mb-1 text-xs select-none ${isOwnMessage ? 'justify-end' : ''}`}>
                              <span className="font-semibold text-indigo-300">{msg.senderName}</span>
                              <span className="text-[10px] text-white/40 font-medium">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          )}
                          <div className={`px-4 py-2 text-sm rounded-2xl whitespace-pre-wrap leading-relaxed shadow-sm transition-all focus:outline-none ${isOwnMessage ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-tr-none' : 'bg-white/5 backdrop-blur-md text-white/85 border border-white/10 rounded-tl-none'} ${msg._id.startsWith('temp_') ? 'opacity-65' : ''}`}>
                            {msg.content}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
            <div className="p-4 border-t border-white/10 shrink-0 bg-white/5 backdrop-blur-3xl">
              <AnimatePresence>
                {Object.keys(typingUsers).length > 0 && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-[11px] text-indigo-300 font-medium pb-2 px-1 flex items-center gap-1.5 select-none">
                    <span className="flex gap-1 items-center bg-white/5 px-2 py-0.5 rounded-md border border-white/10 shadow-sm">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]" />
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]" />
                    </span>
                    <span>{Object.values(typingUsers).join(', ')} {Object.keys(typingUsers).length === 1 ? 'is' : 'are'} typing...</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <form onSubmit={handleSendMessage} className="flex gap-2.5 items-end">
                <div className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-1 flex items-center gap-2 focus-within:border-white/20 transition duration-150 relative">
                  <input type="text" placeholder={`Message ${getCleanRoomName(activeRoom)}`} value={newMessageContent} onChange={handleInputChange} className="w-full bg-transparent text-white outline-none placeholder:text-white/30 py-2.5 text-sm" />
                  <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="text-white/40 hover:text-white transition shrink-0"><Smile className="w-5 h-5" /></button>
                  {showEmojiPicker && (
                    <div className="absolute bottom-full left-0 mb-2 bg-white/10 backdrop-blur-xl border border-white/10 rounded-xl p-3 shadow-xl z-50">
                      <div className="grid grid-cols-8 gap-1">
                        {['😀', '😂', '😍', '🥰', '😎', '🤔', '😢', '😡', '👍', '👎', '❤️', '🔥', '✨', '🎉', '💯', '🙌', '👋', '🤝', '💪', '🎯', '🚀', '💡', '🌟', '⭐'].map((emoji) => (
                          <button key={emoji} type="button" onClick={() => handleEmojiSelect(emoji)} className="text-2xl hover:bg-white/10 rounded p-1 transition">{emoji}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <button type="submit" disabled={!newMessageContent.trim()} className="p-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition duration-150 shadow-md shadow-indigo-950/30 flex items-center justify-center shrink-0 cursor-pointer disabled:opacity-40"><Send className="w-4 h-4" /></button>
              </form>
            </div>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-white/35 py-10">
            <Compass className="w-10 h-10 mb-4 opacity-40 text-indigo-300 animate-lash" />
            <p className="text-sm font-semibold">Select a room to begin chatting</p>
            <p className="text-xs text-white/40 mt-1">DMs or public channels in the left column</p>
          </div>
        )}
      </div>
      <AnimatePresence>
        {showNewChannelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c0c14]/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white">
              <button onClick={() => setShowNewChannelModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2"><Hash className="w-5 h-5 text-indigo-300" />Create Public Channel</h2>
              <p className="text-xs text-white/40 mb-5">Channels are where members communicate. They are open to all workspace users.</p>
              <form onSubmit={handleCreateChannel} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Channel Name</label>
                  <input type="text" required placeholder="e.g. design-assets" value={newChannelName} onChange={e => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Description (Optional)</label>
                  <input type="text" placeholder="Brief objective of this channel" value={newChannelDesc} onChange={e => setNewChannelDesc(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm" />
                </div>
                <div className="flex items-center justify-between py-2 border-t border-white/10 border-b bg-white/5 px-4 rounded-xl">
                  <div>
                    <span className="block text-xs font-semibold text-white/80">Private Channel</span>
                    <span className="text-[10px] text-white/35">Can only be accessible via invite links.</span>
                  </div>
                  <input type="checkbox" checked={newChannelPrivate} onChange={e => setNewChannelPrivate(e.target.checked)} className="w-4 h-4 text-indigo-505 bg-white/5 border-white/10 rounded focus:ring-indigo-500 focus:ring-offset-[#0c0c14] focus:ring-2 cursor-pointer" />
                </div>
                <button type="submit" className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-550 text-white font-semibold rounded-xl text-sm transition shadow-lg flex items-center justify-center cursor-pointer">Create Channel</button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showEditProfile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c0c14]/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white">
              <button onClick={() => setShowEditProfile(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-white mb-1 flex items-center gap-2"><Settings className="w-5 h-5 text-indigo-300" />Profile Customization</h2>
              <p className="text-xs text-white/40 mb-5">Configure your virtual card identity and presence tags.</p>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-2">Avatar Seed Name</label>
                  <div className="flex gap-2">
                    <input type="text" value={editAvatarSeed} onChange={e => setEditAvatarSeed(e.target.value.toLowerCase().replace(/\s+/g, ''))} className="flex-1 px-4 py-2 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm font-medium" />
                    <div className="w-10 h-10 rounded-xl overflow-hidden border-2 border-white/20 scale-100 shrink-0 select-none bg-white/5">
                      <img src={`https://picsum.photos/seed/${editAvatarSeed || 'default'}/96`} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-indigo-300 mb-1.5">Short Bio</label>
                  <textarea rows={3} placeholder="Describe yourself..." value={editBio} onChange={e => setEditBio(e.target.value)} className="w-full px-4 py-2.5 bg-white/5 border border-white/10 focus:border-white/20 focus:ring-1 focus:ring-white/20 rounded-xl outline-none text-white placeholder:text-white/30 transition text-sm resize-none" />
                </div>
                <div className="flex gap-2 mt-4">
                  <button type="button" onClick={() => setShowEditProfile(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/15 text-white/80 border border-white/10 font-semibold rounded-xl text-xs transition">Cancel</button>
                  <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-lg cursor-pointer">Save Changes</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showInviteModal && activeRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c0c14]/60 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-md bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white">
              <button onClick={() => setShowInviteModal(false)} className="absolute top-4 right-4 text-white/40 hover:text-white transition"><X className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-white mb-1.5 flex items-center gap-2"><UserPlus className="w-5 h-5 text-indigo-300" />Invite Member</h2>
              <p className="text-xs text-white/40 mb-5">Enter username to add to the private channel {getCleanRoomName(activeRoom)}.</p>
              <form onSubmit={handleInviteMembers} className="space-y-4">
                <div>
                  <input type="text" value={inviteUsername} onChange={(e) => setInviteUsername(e.target.value)} placeholder="Enter username" className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-white/30 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => setShowInviteModal(false)} className="flex-1 py-2 bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 font-semibold rounded-xl text-xs transition">Cancel</button>
                  <button type="submit" disabled={!inviteUsername.trim()} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-xs transition shadow-lg cursor-pointer disabled:opacity-40">Invite</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDeleteConfirmModal && activeRoom && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0c0c14]/70 backdrop-blur-md">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="w-full max-w-sm bg-white/5 backdrop-blur-3xl border border-white/10 rounded-2xl p-6 shadow-2xl relative text-white">
              <h2 className="text-lg font-bold text-rose-400 mb-2 flex items-center gap-2"><Trash2 className="w-5 h-5" />Delete Channel</h2>
              <p className="text-xs text-white/70 mb-4 leading-relaxed">Are you absolutely sure you want to delete <span className="font-semibold text-white">{getCleanRoomName(activeRoom)}</span>? This action is irreversible and will delete all associated chat history for all team members.</p>
              <div className="flex gap-2.5 mt-5">
                <button onClick={() => setShowDeleteConfirmModal(false)} className="flex-1 py-2.5 bg-white/10 hover:bg-white/15 border border-white/10 text-white/80 font-semibold rounded-xl text-xs transition cursor-pointer">Cancel</button>
                <button onClick={handleDeleteChannel} className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition shadow-lg cursor-pointer">Delete Channel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
