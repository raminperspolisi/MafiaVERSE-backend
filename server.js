const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Waiting lobby (matchmaking)
let waitingPlayers = [];

function makeBotUser(index = 1) {
  const id = `bot_${index}_${Math.random().toString(36).substr(2, 5)}`;
  return {
    socketId: null, // no socket for server-side bots
    userId: id,
    username: `ربات_${index}`,
    firstName: 'ربات',
    lastName: String(index)
  };
}

const TestLobby = require('./models/TestLobby');

async function persistLobby() {
  try {
    await TestLobby.findOneAndUpdate(
      { lobbyId: 'default' },
      {
        $set: {
          players: waitingPlayers.map(p => ({
            userId: p.userId,
            username: p.username,
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            isBot: (p.userId || '').startsWith('bot_'),
            socketId: p.socketId || null
          })),
          updatedAt: new Date()
        }
      },
      { upsert: true, new: true }
    );
  } catch (e) {
    console.error('Persist lobby error:', e.message);
  }
}

async function restoreLobby() {
  try {
    const doc = await TestLobby.findOne({ lobbyId: 'default' });
    if (doc && Array.isArray(doc.players)) {
      waitingPlayers = doc.players.map(p => ({
        userId: p.userId,
        username: p.username,
        firstName: p.firstName,
        lastName: p.lastName,
        socketId: null // restored players are offline until they reconnect
      }));
      broadcastWaiting(io);
    }
  } catch (e) {
    console.error('Restore lobby error:', e.message);
  }
}

// Call restore on startup
restoreLobby();

function broadcastWaiting(ioInstance) {
  // Emit legacy and new formats to the waiting room
  ioInstance.to('waiting-room').emit('waiting-players-updated', waitingPlayers);
  ioInstance.to('waiting-room').emit('waiting-players-updated-obj', {
    count: waitingPlayers.length,
    players: waitingPlayers.map(p => ({ userId: p.userId, username: p.username }))
  });

  // ثبت واکنش (لایک / دیسلایک) برای گوینده فعلی (در سطح هر اتصال)
  socket.on('send-reaction', (data) => {
    try {
      const { roomId, userId, type } = data || {};
      if (!roomId || !userId || !type) return socket.emit('error', 'داده‌های ناقص');
      const room = roomManager.getRoom(roomId);
      if (!room) return socket.emit('error', 'اتاق یافت نشد');
      const targetUserId = room.currentSpeakerId;
      if (!targetUserId) return;
      if (!['like', 'dislike'].includes(type)) return socket.emit('error', 'نوع واکنش نامعتبر است');

      const counts = room.applyReaction(room.day || 1, targetUserId, userId, type);
      io.to(roomId).emit('reaction-updated', {
        roomId,
        targetUserId,
        likes: counts.likes,
        dislikes: counts.dislikes
      });
    } catch (e) {
      console.error('خطا در ثبت واکنش:', e);
      socket.emit('error', 'خطا در ثبت واکنش');
    }
  });
  // Persist after broadcasting
  persistLobby();
}

function spawnBots(ioInstance, count = 9) {
  const startIndex = waitingPlayers.filter(p => (p.userId || '').startsWith('bot_')).length + 1;
  for (let i = 0; i < count; i++) {
    const bot = makeBotUser(startIndex + i);
    if (!waitingPlayers.find(p => p.userId === bot.userId)) {
      waitingPlayers.push(bot);
    }
  }
  broadcastWaiting(ioInstance);
  if (waitingPlayers.length >= 10) {
    startWaitingGame(ioInstance);
  }
}

function clearBots(ioInstance) {
  waitingPlayers = waitingPlayers.filter(p => !(p.userId || '').startsWith('bot_'));
  broadcastWaiting(ioInstance);
}

function assignRoles(playerCount) {
  if (playerCount !== 10) {
    throw new Error('سناریوی تفنگدار دقیقاً نیاز به 10 بازیکن دارد');
  }
  
  // Gunner scenario: 7 Citizens + 3 Mafia
  const roles = [
    // Citizens (7)
    'doctor',      // دکتر
    'bodyguard',   // نگهبان
    'detective',   // کارآگاه
    'commando',    // تکاور
    'gunner',      // تفنگدار
    'citizen-a',   // شهروند ساده اول
    'citizen-b',   // شهروند ساده دوم
    
    // Mafia (3)
    'godfather',   // پدرخوانده
    'lecter',      // دکتر لکتر
    'kidnapper'    // گروگانگیر
  ];
  
  // Shuffle roles
  for (let i = roles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [roles[i], roles[j]] = [roles[j], roles[i]];
  }
  
  return roles;
}

function startWaitingGame(ioInstance) {
  if (waitingPlayers.length < 10) return;
  const gameId = Math.random().toString(36).substr(2, 9);
  const players = waitingPlayers.slice(0, 10);
  waitingPlayers = waitingPlayers.slice(10);

  const roles = assignRoles(players.length);
  const gamePlayers = players.map((player, index) => ({
    ...player,
    role: roles[index],
    isAlive: true
  }));

  // Move players sockets to game room and notify
  gamePlayers.forEach(player => {
    const playerSocket = ioInstance.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.leave('waiting-room');
      playerSocket.join(`game-${gameId}`);
    }
  });

  // Public game started event (no roles)
  ioInstance.to(`game-${gameId}`).emit('game-started', {
    gameId,
    players: gamePlayers.map(p => ({
      userId: p.userId,
      username: p.username,
      firstName: p.firstName,
      lastName: p.lastName,
      isAlive: p.isAlive
    })),
    phase: 'introduction', // Start with introduction phase
    day: 1
  });

  // Private role assignment
  gamePlayers.forEach(player => {
    const playerSocket = ioInstance.sockets.sockets.get(player.socketId);
    if (playerSocket) {
      playerSocket.emit('role-assigned', {
        role: player.role,
        gameId: gameId
      });
    }
  });

  // Update remaining waiting lobby (legacy array + new object)
  broadcastWaiting(ioInstance);
}

// Night phase management
function startNightPhase(ioInstance, gameId, gamePlayers) {
  console.log(`🌙 شب شروع شد برای بازی ${gameId}`);
  
  // Notify all players that night has started
  ioInstance.to(`game-${gameId}`).emit('night-started', {
    gameId,
    phase: 'night',
    duration: 60 // 1 minute
  });

  // Send role-specific night information
  gamePlayers.forEach(player => {
    const playerSocket = ioInstance.sockets.sockets.get(player.socketId);
    if (!playerSocket) return;

    if (player.role === 'godfather' || player.role === 'lecter') {
      // Godfather and Lecter can see each other and communicate
      const mafiaPartners = gamePlayers.filter(p => 
        (p.role === 'godfather' || p.role === 'lecter') && p.userId !== player.userId
      );
      
      playerSocket.emit('night-role-info', {
        gameId,
        role: player.role,
        canCommunicate: true,
        visiblePlayers: mafiaPartners.map(p => ({
          userId: p.userId,
          username: p.username,
          role: p.role,
          isMafia: true,
          canTalk: true
        })),
        kidnapperVisible: gamePlayers.filter(p => p.role === 'kidnapper').map(p => ({
          userId: p.userId,
          username: p.username,
          role: p.role,
          isMafia: true,
          canTalk: false
        }))
      });
    } else if (player.role === 'kidnapper') {
      // Kidnapper can see all mafia but cannot communicate with anyone
      const allMafia = gamePlayers.filter(p => 
        p.role === 'godfather' || p.role === 'lecter' || p.role === 'kidnapper'
      );
      
      playerSocket.emit('night-role-info', {
        gameId,
        role: player.role,
        canCommunicate: false, // Kidnapper cannot communicate
        visiblePlayers: allMafia.map(p => ({
          userId: p.userId,
          username: p.username,
          role: p.role,
          isMafia: true,
          canTalk: false // Cannot talk to anyone
        }))
      });
    } else {
      // Citizens are asleep and see nothing
      playerSocket.emit('night-role-info', {
        gameId,
        role: player.role,
        canCommunicate: false,
        visiblePlayers: [],
        message: 'شما خواب هستید و چیزی نمی‌بینید'
      });
    }
  });

  // Start 1-minute night timer
  let secondsLeft = 60;
  const nightTimer = setInterval(() => {
    secondsLeft--;
    
    // Send countdown to all players
    ioInstance.to(`game-${gameId}`).emit('night-countdown', {
      gameId,
      secondsLeft,
      phase: 'night'
    });
    
    if (secondsLeft <= 0) {
      clearInterval(nightTimer);
      endNightPhase(ioInstance, gameId, gamePlayers);
    }
  }, 1000);
}

function endNightPhase(ioInstance, gameId, gamePlayers) {
  console.log(`🌅 شب پایان یافت، روز شروع شد برای بازی ${gameId}`);
  
  // Notify all players that night has ended
  ioInstance.to(`game-${gameId}`).emit('night-ended', {
    gameId,
    phase: 'day',
    day: 1
  });
  // انتشار شمارنده روز برای UI کلاینت‌ها
  ioInstance.to(`game-${gameId}`).emit('game-day-updated', { roomId: gameId, day: 1 });
  
  // Start day phase with speaking queue
  const speakingQueue = gamePlayers.map(p => p.userId);
  const currentSpeakerId = speakingQueue[0];
  
  ioInstance.to(`game-${gameId}`).emit('speaking-updated', {
    roomId: gameId,
    currentSpeakerId: currentSpeakerId,
    speakingQueue: speakingQueue,
    challenge: {
      currentSpeakerId: currentSpeakerId,
      approvedUserId: null,
      requests: [],
      active: false
    }
  });

  // Start timed speaking for day phase
  startSpeakingTurn(gameId, 60);
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'client')));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/mafia-game';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ اتصال به MongoDB برقرار شد');
})
.catch((error) => {
  console.error('❌ خطا در اتصال به MongoDB:', error);
});

// Import models and utilities
const User = require('./models/User');
const Game = require('./models/Game');
const roomManager = require('./utils/roomManager');

// Keep timers per room for challenge countdowns
const roomTimers = new Map();

// Speaking timer per room: starts a 60s turn for current speaker and auto-advances
function startSpeakingTurn(roomId, durationSec = 60) {
  try {
    const room = roomManager.getRoom(roomId);
    if (!room) return;

    const currentSpeakerId = room.currentSpeakerId;
    if (!currentSpeakerId) return;

    // Clear any previous timer for this room
    const prev = roomTimers.get(roomId);
    if (prev) clearInterval(prev);

    let secondsLeft = durationSec;
    io.to(roomId).emit('speaking-started', {
      roomId,
      currentSpeakerId,
      duration: durationSec
    });

    // Initialize reaction counters for the current speaker
    try {
      const counts = room.getReactions(room.day || 1, currentSpeakerId);
      io.to(roomId).emit('reaction-updated', {
        roomId,
        targetUserId: currentSpeakerId,
        likes: counts.likes,
        dislikes: counts.dislikes
      });
    } catch (e) {
      // ignore if room does not support reactions yet
    }

    const interval = setInterval(() => {
      secondsLeft -= 1;
      io.to(roomId).emit('speaking-tick', { roomId, currentSpeakerId, secondsLeft });
      if (secondsLeft <= 0) {
        clearInterval(interval);
        roomTimers.delete(roomId);

        // Auto-end current speaker and move forward (respecting challenge rules)
        try {
          const result = roomManager.endSpeakerAndMaybeStartChallenge(roomId, currentSpeakerId);
          const updatedRoom = roomManager.getRoom(roomId);

          io.to(roomId).emit('speaking-ended', { roomId, speakerUserId: currentSpeakerId });

          if (result && result.startedChallengeFor) {
            // A challenge has been approved; do not start speaking timer. Front-end handles challenge flow.
            io.to(roomId).emit('challenge-requests-updated', {
              roomId,
              challenge: updatedRoom.getChallengeState()
            });
            return;
          }

          // Proceed to next speaker
          io.to(roomId).emit('speaking-updated', {
            roomId,
            currentSpeakerId: result.nextSpeakerId,
            speakingQueue: updatedRoom.speakingQueue,
            challenge: updatedRoom.getChallengeState()
          });

          // If we still have a speaker, start the next turn automatically
          if (result.nextSpeakerId) {
            startSpeakingTurn(roomId, durationSec);
          } else {
            io.to(roomId).emit('speaking-all-done', { roomId });
          }
        } catch (e) {
          console.error('Auto advance speaking error:', e.message);
        }
      }
    }, 1000);

    roomTimers.set(roomId, interval);
  } catch (e) {
    console.error('Start speaking timer error:', e.message);
  }
}

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));
app.use('/api/game-room', require('./routes/gameRoom'));

// Serve static files
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

app.get('/game-table', (req, res) => {
  res.sendFile(path.join(__dirname, 'game-table-room.html'));
});

app.get('/test-game-room', (req, res) => {
  res.sendFile(path.join(__dirname, 'test-game-room.html'));
});

// REST endpoint to spawn bots globally (for testing)
app.post('/api/waiting/spawn-bots', (req, res) => {
  try {
    const count = Math.min(parseInt(req.body?.count) || 9, 50);
    spawnBots(io, count);
    return res.json({ success: true, count: waitingPlayers.length });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/waiting/add-one-bot', (req, res) => {
  try {
    const startIndex = waitingPlayers.filter(p => (p.userId || '').startsWith('bot_')).length + 1;
    const bot = makeBotUser(startIndex);
    waitingPlayers.push(bot);
    broadcastWaiting(io);
    
    // Check if we should start the game
    if (waitingPlayers.length >= 10) {
      startWaitingGame(io);
    }
    
    return res.json({ 
      success: true, 
      count: waitingPlayers.length,
      addedBot: {
        userId: bot.userId,
        username: bot.username,
        firstName: bot.firstName,
        lastName: bot.lastName
      }
    });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/waiting/clear-bots', (req, res) => {
  try {
    clearBots(io);
    return res.json({ success: true, count: waitingPlayers.length });
  } catch (e) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// REST endpoints to get/save lobby
app.get('/api/waiting/lobby', async (req, res) => {
  try {
    const doc = await TestLobby.findOne({ lobbyId: 'default' });
    res.json({ success: true, lobby: doc || { lobbyId: 'default', players: [] } });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

app.post('/api/waiting/lobby/save', async (req, res) => {
  try {
    const players = Array.isArray(req.body?.players) ? req.body.players : [];
    waitingPlayers = players.map(p => ({
      userId: p.userId,
      username: p.username,
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      socketId: null
    }));
    broadcastWaiting(io);
    res.json({ success: true, count: waitingPlayers.length });
  } catch (e) {
    res.status(500).json({ success: false, message: e.message });
  }
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔗 کاربر جدید متصل شد: ${socket.id}`);

  // ذخیره اطلاعات کاربر در socket
  socket.userData = {
      socketId: socket.id,
    userId: null,
    username: null,
    currentRoom: null
  };

  // پیوستن به اتاق بازی
  socket.on('join-game-room', async (data) => {
    try {
      const { roomId, userId, username, role, password } = data;

      // اعتبارسنجی داده‌ها
      if (!roomId || !userId || !username || !role) {
        socket.emit('error', 'داده‌های ناقص');
        return;
      }

      // بررسی اینکه کاربر قبلاً در اتاقی هست یا نه
      if (roomManager.isPlayerInRoom(userId)) {
        socket.emit('error', 'شما قبلاً در اتاقی هستید');
        return;
      }

      // پیوستن به اتاق
      const { room, player } = roomManager.joinRoom(roomId, {
        id: userId,
        username: username,
        role: role,
        socketId: socket.id
      }, password);

      // به‌روزرسانی اطلاعات socket
      socket.userData.userId = userId;
      socket.userData.username = username;
      socket.userData.currentRoom = roomId;

      // پیوستن به room socket
      socket.join(roomId);

      // اطلاع‌رسانی به همه اعضای اتاق
      io.to(roomId).emit('player-joined', {
        player: player,
        room: room.getFullInfo()
      });

      // ارسال اطلاعات کامل اتاق به کاربر جدید
      socket.emit('room-joined', {
        room: room.getFullInfo(),
        player: player
      });

      // ارسال نقش به صورت خصوصی برای نمایش در UI پایین سمت راست
      socket.emit('your-role', { role: player.role });
      // ارسال شمارنده روز فعلی برای مقداردهی اولیه UI
      socket.emit('game-day-updated', { roomId, day: room.day || 1 });

      console.log(`👤 ${username} به اتاق ${roomId} پیوست`);

    } catch (error) {
      console.error('خطا در پیوستن به اتاق:', error);
      socket.emit('error', error.message);
    }
  });

  // ترک اتاق بازی
  socket.on('leave-game-room', async (data) => {
    try {
      const { roomId, userId } = data;

      if (!roomId || !userId) {
        socket.emit('error', 'داده‌های ناقص');
        return;
      }

      // ترک اتاق
      const { room, player } = roomManager.leaveRoom(roomId, userId);

      // به‌روزرسانی اطلاعات socket
      socket.userData.currentRoom = null;

      // خروج از room socket
      socket.leave(roomId);

      // اطلاع‌رسانی به بقیه اعضای اتاق
      if (room) {
        io.to(roomId).emit('player-left', {
          playerId: userId,
          room: room.getFullInfo()
        });
      }

      // اطلاع‌رسانی به کاربر
      socket.emit('room-left', {
        message: 'با موفقیت از اتاق خارج شدید'
      });

      console.log(`👋 ${socket.userData.username} از اتاق ${roomId} خارج شد`);

    } catch (error) {
      console.error('خطا در ترک اتاق:', error);
      socket.emit('error', error.message);
    }
  });

  // تغییر وضعیت آماده بودن
  socket.on('toggle-ready', async (data) => {
    try {
      const { roomId, userId } = data;

      if (!roomId || !userId) {
        socket.emit('error', 'داده‌های ناقص');
        return;
      }

      // تغییر وضعیت
      const { room, player } = roomManager.togglePlayerReady(roomId, userId);

      // اطلاع‌رسانی به همه اعضای اتاق
      io.to(roomId).emit('player-ready-changed', {
        player: player,
        room: room.getFullInfo()
      });

      console.log(`✅ ${player.username} وضعیت آماده بودن را تغییر داد: ${player.isReady}`);

    } catch (error) {
      console.error('خطا در تغییر وضعیت آماده بودن:', error);
      socket.emit('error', error.message);
    }
  });

  // شروع بازی
  socket.on('start-game', async (data) => {
    try {
      const { roomId, userId } = data;

      if (!roomId || !userId) {
        socket.emit('error', 'داده‌های ناقص');
        return;
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', 'اتاق یافت نشد');
        return;
      }

      // بررسی اینکه کاربر صاحب اتاق است
      if (room.ownerId !== userId) {
        socket.emit('error', 'فقط صاحب اتاق می‌تواند بازی را شروع کند');
    return;
  }
  
      // شروع بازی
      const { room: updatedRoom, gameData } = roomManager.startGame(roomId);

      // اطلاع‌رسانی به همه اعضای اتاق
      io.to(roomId).emit('game-starting', {
        room: updatedRoom.getFullInfo(),
        gameData: gameData,
        countdown: 5
      });

      // شروع countdown
      let countdown = 5;
      const countdownInterval = setInterval(() => {
        countdown--;
        io.to(roomId).emit('game-countdown', { countdown });
        
        if (countdown <= 0) {
          clearInterval(countdownInterval);
          io.to(roomId).emit('game-started', {
            room: updatedRoom.getFullInfo(),
            gameData: gameData
          });
          // انتشار شمارنده روز برای UI
          io.to(roomId).emit('game-day-updated', { roomId, day: updatedRoom.day || 1 });
          // Start first speaker's timed turn after game starts (introduction)
          startSpeakingTurn(roomId, 60);
        }
      }, 1000);

      console.log(`🎮 بازی در اتاق ${roomId} شروع شد`);

    } catch (error) {
      console.error('خطا در شروع بازی:', error);
      socket.emit('error', error.message);
    }
  });

  // درخواست اطلاعات اتاق
  socket.on('get-room-info', async (data) => {
    try {
      const { roomId, userId } = data;

      if (!roomId) {
        socket.emit('error', 'شناسه اتاق الزامی است');
        return;
      }

      const room = roomManager.getRoom(roomId);
      if (!room) {
        socket.emit('error', 'اتاق یافت نشد');
    return;
  }
  
      // اگر کاربر در اتاق است، اطلاعات کامل را بده
      const isMember = room.currentPlayers.find(p => p.id === userId);
      const roomInfo = isMember ? room.getFullInfo() : room.getPublicInfo();

      socket.emit('room-info', {
        room: roomInfo,
        isMember: !!isMember
      });

    } catch (error) {
      console.error('خطا در دریافت اطلاعات اتاق:', error);
      socket.emit('error', error.message);
    }
  });

  // درخواست لیست اتاق‌ها
  socket.on('get-rooms-list', async () => {
    try {
      const rooms = roomManager.getPublicRooms();
      
      socket.emit('rooms-list', {
        rooms: rooms,
        count: rooms.length
      });

    } catch (error) {
      console.error('خطا در دریافت لیست اتاق‌ها:', error);
      socket.emit('error', error.message);
    }
  });

  // درخواست آمار
  socket.on('get-stats', async () => {
    try {
      const stats = roomManager.getStats();
      
      socket.emit('stats', {
        stats: stats
      });

    } catch (error) {
      console.error('خطا در دریافت آمار:', error);
      socket.emit('error', error.message);
    }
  });

  // Request a challenge (by non-speaking players) -> shows avatar badge next to requesting player
  socket.on('request-challenge', async (data) => {
    try {
      const { roomId, userId } = data;
      if (!roomId || !userId) return socket.emit('error', 'داده‌های ناقص');
      const { room, requests } = roomManager.requestChallenge(roomId, userId);
      io.to(roomId).emit('challenge-requests-updated', {
        roomId,
        challenge: room.getChallengeState()
      });
    } catch (error) {
      console.error('خطا در ثبت درخواست چالش:', error);
      socket.emit('error', error.message);
    }
  });

  // Speaker approves one challenge request; approved user turns green on UI
  socket.on('approve-challenge', async (data) => {
    try {
      const { roomId, approverUserId, targetUserId } = data;
      if (!roomId || !approverUserId || !targetUserId) return socket.emit('error', 'داده‌های ناقص');
      const { room } = roomManager.approveChallenge(roomId, approverUserId, targetUserId);
      io.to(roomId).emit('challenge-requests-updated', {
        roomId,
        challenge: room.getChallengeState()
      });
    } catch (error) {
      console.error('خطا در تایید چالش:', error);
      socket.emit('error', error.message);
    }
  });

  // Speaker ends their talk; if a challenge is approved, start 40s challenge for the approved user
  socket.on('end-speech', async (data) => {
    try {
      const { roomId, speakerUserId } = data;
      if (!roomId || !speakerUserId) return socket.emit('error', 'شناسه اتاق الزامی است');

      // Check if this is introduction phase and last speaker
      const room = roomManager.getRoom(roomId);
      if (!room) return socket.emit('error', 'اتاق یافت نشد');

      // If this is introduction phase and last speaker, start night
      if (room.gamePhase === 'introduction') {
        const currentSpeakerIndex = room.speakingQueue.indexOf(speakerUserId);
        if (currentSpeakerIndex === room.speakingQueue.length - 1) {
          // Last speaker finished, start night phase
          const gamePlayers = room.currentPlayers.map(p => ({
            userId: p.id,
            username: p.username,
            role: p.role,
            isAlive: p.isAlive,
            socketId: p.socketId
          }));
          
          startNightPhase(io, roomId, gamePlayers);
          return;
        }
      }

      // Try to start approved challenge, otherwise go to next speaker
      const result = roomManager.endSpeakerAndMaybeStartChallenge(roomId, speakerUserId);
      const updatedRoom = roomManager.getRoom(roomId);

      if (result.startedChallengeFor) {
        const challengeUserId = result.startedChallengeFor;
        const CHALLENGE_SECONDS = 40;
        let secondsLeft = CHALLENGE_SECONDS;
        io.to(roomId).emit('challenge-started', {
          roomId,
          userId: challengeUserId,
          duration: CHALLENGE_SECONDS
        });

        // Clear previous timer if exists
        const prev = roomTimers.get(roomId);
        if (prev) clearInterval(prev);

        const interval = setInterval(() => {
          secondsLeft -= 1;
          io.to(roomId).emit('challenge-tick', { roomId, userId: challengeUserId, secondsLeft });
          if (secondsLeft <= 0) {
            clearInterval(interval);
            roomTimers.delete(roomId);
            const { nextSpeakerId } = roomManager.endChallengeAndProceed(roomId);
            io.to(roomId).emit('challenge-ended', {
              roomId,
              userId: challengeUserId
            });
            io.to(roomId).emit('speaking-updated', {
              roomId,
              currentSpeakerId: nextSpeakerId,
              speakingQueue: updatedRoom.speakingQueue,
              challenge: updatedRoom.getChallengeState()
            });
            // انتشار شمارنده واکنش‌های گوینده جدید
            if (nextSpeakerId) {
              const counts = updatedRoom.getReactions(updatedRoom.day || 1, nextSpeakerId);
              io.to(roomId).emit('reaction-updated', {
                roomId,
                targetUserId: nextSpeakerId,
                likes: counts.likes,
                dislikes: counts.dislikes
              });
            }
            // Begin next speaker's timed turn
            if (nextSpeakerId) startSpeakingTurn(roomId, 60);
          }
        }, 1000);
        roomTimers.set(roomId, interval);

      } else {
        // No challenge; speaker moved to next
        io.to(roomId).emit('speaking-updated', {
          roomId,
          currentSpeakerId: result.nextSpeakerId,
          speakingQueue: updatedRoom.speakingQueue,
          challenge: updatedRoom.getChallengeState()
        });
        // انتشار شمارنده واکنش‌های گوینده جدید
        if (result.nextSpeakerId) {
          const counts = updatedRoom.getReactions(updatedRoom.day || 1, result.nextSpeakerId);
          io.to(roomId).emit('reaction-updated', {
            roomId,
            targetUserId: result.nextSpeakerId,
            likes: counts.likes,
            dislikes: counts.dislikes
          });
        }
        // Begin next speaker's timed turn
        if (result.nextSpeakerId) startSpeakingTurn(roomId, 60);
      }

    } catch (error) {
      console.error('خطا در پایان صحبت:', error);
      socket.emit('error', error.message);
    }
  });

  // Optional: allow force next speaker (e.g., host/admin control)
  socket.on('force-next-speaker', async (data) => {
    try {
      const { roomId } = data;
      if (!roomId) return socket.emit('error', 'شناسه اتاق الزامی است');
      const { room, nextSpeakerId } = roomManager.forceNextSpeaker(roomId);
      io.to(roomId).emit('speaking-updated', {
        roomId,
        currentSpeakerId: nextSpeakerId,
        speakingQueue: room.speakingQueue,
        challenge: room.getChallengeState()
      });
    } catch (error) {
      console.error('خطا در تغییر گوینده:', error);
      socket.emit('error', error.message);
    }
  });

  // Join waiting lobby (matchmaking)
  socket.on('start-matchmaking', (userData) => {
    const player = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName
    };

    // Prevent duplicates
    if (!waitingPlayers.find(p => p.userId === player.userId)) {
      waitingPlayers.push(player);
    }
    socket.join('waiting-room');

    // Emit legacy and new formats
    broadcastWaiting(io);

    // Auto-start when we have 10 or more
    if (waitingPlayers.length >= 10) {
      startWaitingGame(io);
    }
  });

  // Backward-compatible alias
  socket.on('join-waiting', (userData) => {
    socket.emit('deprecated', { message: 'Use start-matchmaking instead' });
    socket.emit('info', { message: 'Joining waiting lobby...' });
    socket.emit('start-matchmaking-proxy-ack');
    // Reuse behavior (do not emit back, just add directly)
    const player = {
      socketId: socket.id,
      userId: userData.userId,
      username: userData.username,
      firstName: userData.firstName,
      lastName: userData.lastName
    };
    if (!waitingPlayers.find(p => p.userId === player.userId)) {
      waitingPlayers.push(player);
    }
    socket.join('waiting-room');
    // Emit legacy and new formats
    broadcastWaiting(io);
    if (waitingPlayers.length >= 10) {
      startWaitingGame(io);
    }
  });

  socket.on('leave-waiting', () => {
    const before = waitingPlayers.length;
    waitingPlayers = waitingPlayers.filter(p => p.socketId !== socket.id);
    socket.leave('waiting-room');
    if (before !== waitingPlayers.length) {
      broadcastWaiting(io);
    }
  });

  // Spawn bots via Socket.IO (test-only)
  socket.on('spawn-bots', (data) => {
    const count = Math.min(parseInt(data?.count) || 9, 50);
    spawnBots(io, count);
  });

  // قطع اتصال
  socket.on('disconnect', () => {
    console.log(`🔌 کاربر قطع اتصال کرد: ${socket.id}`);

    // اگر کاربر در اتاقی بود، او را خارج کن
    if (socket.userData.currentRoom && socket.userData.userId) {
      try {
        const { room, player } = roomManager.leaveRoom(
          socket.userData.currentRoom, 
          socket.userData.userId
        );

        if (room) {
          io.to(socket.userData.currentRoom).emit('player-left', {
            playerId: socket.userData.userId,
            room: room.getFullInfo()
          });
        }

        console.log(`👋 ${socket.userData.username} به دلیل قطع اتصال از اتاق خارج شد`);
      } catch (error) {
        console.error('خطا در خارج کردن کاربر از اتاق:', error);
      }
    }
    // Remove from waiting lobby if present
    const before = waitingPlayers.length;
    waitingPlayers = waitingPlayers.filter(p => p.socketId !== socket.id);
    if (before !== waitingPlayers.length) {
      broadcastWaiting(io);
    }
  });
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('🛑 در حال خاموش کردن سرور...');
  roomManager.stopCleanup();
  server.close(() => {
    console.log('✅ سرور با موفقیت خاموش شد');
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} اجرا می‌شود`);
  console.log(`📊 آمار اولیه: ${JSON.stringify(roomManager.getStats())}`);
}); 