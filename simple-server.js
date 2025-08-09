const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// Simple in-memory storage
let users = [];
let waitingPlayers = [];
let activeGames = new Map();

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Simple API endpoints for testing
app.post('/api/auth/register', (req, res) => {
  const { firstName, lastName, username, password, phoneNumber } = req.body;
  
  // Check if user exists
  const existingUser = users.find(u => u.username === username);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'این نام کاربری قبلاً ثبت شده است'
    });
  }
  
  // Create user
  const user = {
    _id: Date.now().toString(),
    firstName,
    lastName,
    username,
    password,
    phoneNumber,
    level: 1,
    experience: 0,
    gameStats: {
      totalGames: 0,
      wins: 0,
      losses: 0
    }
  };
  
  users.push(user);
  
  // Generate simple token
  const token = `token_${user._id}`;
  
  const userResponse = { ...user };
  delete userResponse.password;
  
  res.status(201).json({
    success: true,
    message: 'حساب کاربری با موفقیت ایجاد شد',
    user: userResponse,
    token
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  const user = users.find(u => u.username === username && u.password === password);
  
  if (!user) {
    return res.status(401).json({
      success: false,
      message: 'نام کاربری یا رمز عبور نادرست است'
    });
  }
  
  const token = `token_${user._id}`;
  const userResponse = { ...user };
  delete userResponse.password;
  
  res.json({
    success: true,
    message: `خوش آمدید ${user.firstName}!`,
    user: userResponse,
    token
  });
});

app.get('/api/auth/me', (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'توکن مورد نیاز است'
    });
  }
  
  const userId = token.replace('token_', '');
  const user = users.find(u => u._id === userId);
  
  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'کاربر یافت نشد'
    });
  }
  
  const userResponse = { ...user };
  delete userResponse.password;
  
  res.json({
    success: true,
    user: userResponse
  });
});

app.get('/api/game/global-stats', (req, res) => {
  res.json({
    success: true,
    stats: {
      totalGames: 0,
      activeUsers: waitingPlayers.length,
      citizenWinRate: 65
    }
  });
});

app.get('/api/auth/leaderboard', (req, res) => {
  const sortedUsers = users
    .map(user => ({ ...user }))
    .map(user => {
      delete user.password;
      return user;
    })
    .sort((a, b) => b.experience - a.experience)
    .slice(0, 10);
    
  res.json({
    success: true,
    leaderboard: sortedUsers
  });
});

// Socket.IO handling
io.on('connection', (socket) => {
  console.log(`🔗 کاربر جدید متصل شد: ${socket.id}`);

  socket.on('join-waiting', (userData) => {
    const player = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName
    };
    
    waitingPlayers.push(player);
    socket.join('waiting-room');
    
    console.log(`👤 ${userData.username} به اتاق انتظار پیوست`);
    
    io.to('waiting-room').emit('waiting-players-updated', waitingPlayers);
    
    if (waitingPlayers.length >= 4) {
      startNewGame();
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ کاربر قطع شد: ${socket.id}`);
    waitingPlayers = waitingPlayers.filter(player => player.socketId !== socket.id);
    io.to('waiting-room').emit('waiting-players-updated', waitingPlayers);
  });
});

function startNewGame() {
  if (waitingPlayers.length < 4) return;
  
  const gameId = Math.random().toString(36).substr(2, 9);
  const players = [...waitingPlayers];
  waitingPlayers = [];
  
  // Assign roles
  const roles = assignRoles(players.length);
  const gamePlayers = players.map((player, index) => ({
    ...player,
    role: roles[index],
    isAlive: true
  }));
  
  // Move players to game room
  players.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.leave('waiting-room');
      playerSocket.join(`game-${gameId}`);
    }
  });
  
  // Send game start notification
  io.to(`game-${gameId}`).emit('game-started', {
    gameId,
    players: gamePlayers.map(p => ({
      username: p.username,
      firstName: p.firstName,
      lastName: p.lastName,
      isAlive: p.isAlive
    })),
    phase: 'night',
    day: 1
  });
  
  // Send roles privately
  gamePlayers.forEach(player => {
    const playerSocket = io.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('role-assigned', {
        role: player.role,
        roleDescription: getRoleDescription(player.role)
      });
    }
  });
  
  console.log(`🎮 بازی جدید شروع شد با شناسه: ${gameId}`);
}

function assignRoles(playerCount) {
  const roles = ['citizen'];
  const mafiaCount = Math.floor(playerCount / 3);
  const specialRoles = ['doctor', 'detective'];
  
  for (let i = 0; i < mafiaCount; i++) {
    roles.push('mafia');
  }
  
  specialRoles.forEach(role => {
    if (roles.length < playerCount) {
      roles.push(role);
    }
  });
  
  while (roles.length < playerCount) {
    roles.push('citizen');
  }
  
  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  return roles;
}

function getRoleDescription(role) {
  const descriptions = {
    'mafia': 'شما عضو مافیا هستید. هدف شما کشتن تمام شهروندان است.',
    'doctor': 'شما دکتر هستید. می‌توانید هر شب یک نفر را محافظت کنید.',
    'detective': 'شما کارآگاه هستید. می‌توانید هر شب هویت یک نفر را بررسی کنید.',
    'citizen': 'شما شهروند معمولی هستید. هدف شما پیدا کردن و حذف مافیا است.'
  };
  return descriptions[role] || '';
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 سرور ساده روی پورت ${PORT} راه‌اندازی شد`);
  console.log(`🌐 برای مشاهده بازی به http://localhost:${PORT} بروید`);
}); 