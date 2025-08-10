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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} اجرا می‌شود`);
  console.log(`📊 آمار اولیه: ${JSON.stringify(roomManager.getStats())}`);
}); 