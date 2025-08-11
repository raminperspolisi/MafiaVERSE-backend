/**
 * Game Room Routes - API های اتاق بازی
 */

const express = require('express');
const router = express.Router();
const roomManager = require('../utils/roomManager');

// Middleware برای احراز هویت (اگر نیاز باشد)
const authenticateUser = (req, res, next) => {
  // اینجا می‌توانید middleware احراز هویت اضافه کنید
  // فعلاً برای تست، همه درخواست‌ها را قبول می‌کنیم
  next();
};

// POST /api/game-room/create - ایجاد اتاق جدید
router.post('/create', authenticateUser, (req, res) => {
  try {
    const { name, maxPlayers, gameSettings, isPrivate, password, ownerId } = req.body;

    // اعتبارسنجی داده‌ها
    if (!ownerId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه صاحب اتاق الزامی است'
      });
    }

    // بررسی اینکه کاربر قبلاً در اتاقی هست یا نه
    if (roomManager.isPlayerInRoom(ownerId)) {
      return res.status(400).json({
        success: false,
        message: 'شما قبلاً در اتاقی هستید'
      });
    }

    // ایجاد اتاق
    const room = roomManager.createRoom({
      name: name || `اتاق ${Date.now()}`,
      maxPlayers: maxPlayers || 8,
      gameSettings: gameSettings || {
        mafiaCount: 2,
        doctorCount: 1,
        detectiveCount: 1,
        sniperCount: 1,
        bodyguardCount: 1,
        citizenCount: 2
      },
      isPrivate: isPrivate || false,
      password: password || null,
      ownerId: ownerId
    });

    res.json({
      success: true,
      message: 'اتاق با موفقیت ایجاد شد',
      room: room.getFullInfo()
    });

  } catch (error) {
    console.error('خطا در ایجاد اتاق:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد اتاق',
      error: error.message
    });
  }
});

// POST /api/game-room/join/:roomId - پیوستن به اتاق
router.post('/join/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId, username, role, password } = req.body;

    // اعتبارسنجی داده‌ها
    if (!userId || !username || !role) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر، نام کاربری و نقش الزامی است'
      });
    }

    // بررسی اینکه کاربر قبلاً در اتاقی هست یا نه
    if (roomManager.isPlayerInRoom(userId)) {
      return res.status(400).json({
        success: false,
        message: 'شما قبلاً در اتاقی هستید'
      });
    }

    // پیوستن به اتاق
    const { room, player } = roomManager.joinRoom(roomId, {
      id: userId,
      username: username,
      role: role,
      socketId: req.body.socketId || null
    }, password);

    res.json({
      success: true,
      message: 'با موفقیت به اتاق پیوستید',
      room: room.getFullInfo(),
      player: player
    });

  } catch (error) {
    console.error('خطا در پیوستن به اتاق:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/game-room/leave/:roomId - ترک اتاق
router.post('/leave/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر الزامی است'
      });
    }

    const { room, player } = roomManager.leaveRoom(roomId, userId);

    res.json({
      success: true,
      message: 'با موفقیت از اتاق خارج شدید',
      room: room ? room.getFullInfo() : null,
      player: player
    });

  } catch (error) {
    console.error('خطا در ترک اتاق:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/game-room/ready/:roomId - تغییر وضعیت آماده بودن
router.post('/ready/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر الزامی است'
      });
    }

    const { room, player } = roomManager.togglePlayerReady(roomId, userId);

    res.json({
      success: true,
      message: `وضعیت آماده بودن ${player.username} تغییر کرد`,
      room: room.getFullInfo(),
      player: player
    });

  } catch (error) {
    console.error('خطا در تغییر وضعیت آماده بودن:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/game-room/start/:roomId - شروع بازی
router.post('/start/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر الزامی است'
      });
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'اتاق یافت نشد'
      });
    }

    // بررسی اینکه کاربر صاحب اتاق است
    if (room.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'فقط صاحب اتاق می‌تواند بازی را شروع کند'
      });
    }

    const { room: updatedRoom, gameData } = roomManager.startGame(roomId);

    res.json({
      success: true,
      message: 'بازی شروع شد',
      room: updatedRoom.getFullInfo(),
      gameData: gameData
    });

  } catch (error) {
    console.error('خطا در شروع بازی:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// POST /api/game-room/challenge/request/:roomId - ثبت درخواست چالش
router.post('/challenge/request/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'شناسه کاربر الزامی است' });
    }
    const { room, requests } = roomManager.requestChallenge(roomId, userId);
    res.json({
      success: true,
      message: 'درخواست چالش ثبت شد',
      challenge: room.getChallengeState(),
      room: room.getFullInfo()
    });
  } catch (error) {
    console.error('خطا در ثبت درخواست چالش:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/game-room/challenge/approve/:roomId - تایید چالش توسط گوینده
router.post('/challenge/approve/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { approverUserId, targetUserId } = req.body;
    if (!approverUserId || !targetUserId) {
      return res.status(400).json({ success: false, message: 'داده‌های ناقص' });
    }
    const { room } = roomManager.approveChallenge(roomId, approverUserId, targetUserId);
    res.json({
      success: true,
      message: 'چالش تایید شد',
      challenge: room.getChallengeState(),
      room: room.getFullInfo()
    });
  } catch (error) {
    console.error('خطا در تایید چالش:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/game-room/speech/end/:roomId - پایان صحبت گوینده و شروع چالش (در صورت تایید)
router.post('/speech/end/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { speakerUserId } = req.body;
    if (!speakerUserId) {
      return res.status(400).json({ success: false, message: 'شناسه گوینده الزامی است' });
    }
    const result = roomManager.endSpeakerAndMaybeStartChallenge(roomId, speakerUserId);
    const room = roomManager.getRoom(roomId);

    res.json({
      success: true,
      result,
      challenge: room.getChallengeState(),
      speaking: {
        currentSpeakerId: room.currentSpeakerId,
        speakingQueue: room.speakingQueue
      },
      room: room.getFullInfo()
    });
  } catch (error) {
    console.error('خطا در پایان صحبت:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/game-room/speaking/:roomId - وضعیت نوبت صحبت و چالش
router.get('/speaking/:roomId', (req, res) => {
  try {
    const { roomId } = req.params;
    const state = roomManager.getSpeakingState(roomId);
    res.json({ success: true, speaking: state });
  } catch (error) {
    console.error('خطا در دریافت وضعیت صحبت:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/game-room/list - دریافت لیست اتاق‌های عمومی
router.get('/list', (req, res) => {
  try {
    const rooms = roomManager.getPublicRooms();
    
    res.json({
      success: true,
      rooms: rooms,
      count: rooms.length
    });

  } catch (error) {
    console.error('خطا در دریافت لیست اتاق‌ها:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت لیست اتاق‌ها',
      error: error.message
    });
  }
});

// GET /api/game-room/:roomId - دریافت اطلاعات اتاق
router.get('/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.query;

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'اتاق یافت نشد'
      });
    }

    // اگر کاربر در اتاق است، اطلاعات کامل را بده
    const isMember = room.currentPlayers.find(p => p.id === userId);
    const roomInfo = isMember ? room.getFullInfo() : room.getPublicInfo();

    res.json({
      success: true,
      room: roomInfo,
      isMember: !!isMember
    });

  } catch (error) {
    console.error('خطا در دریافت اطلاعات اتاق:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اطلاعات اتاق',
      error: error.message
    });
  }
});

// GET /api/game-room/player/:userId - دریافت اتاق بازیکن
router.get('/player/:userId', authenticateUser, (req, res) => {
  try {
    const { userId } = req.params;

    const room = roomManager.getPlayerRoom(userId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'بازیکن در اتاقی نیست'
      });
    }

    res.json({
      success: true,
      room: room.getFullInfo()
    });

  } catch (error) {
    console.error('خطا در دریافت اتاق بازیکن:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت اتاق بازیکن',
      error: error.message
    });
  }
});

// GET /api/game-room/stats - دریافت آمار
router.get('/stats/overview', (req, res) => {
  try {
    const stats = roomManager.getStats();
    
    res.json({
      success: true,
      stats: stats
    });

  } catch (error) {
    console.error('خطا در دریافت آمار:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار',
      error: error.message
    });
  }
});

// DELETE /api/game-room/:roomId - حذف اتاق (فقط صاحب اتاق)
router.delete('/:roomId', authenticateUser, (req, res) => {
  try {
    const { roomId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'شناسه کاربر الزامی است'
      });
    }

    const room = roomManager.getRoom(roomId);
    if (!room) {
      return res.status(404).json({
        success: false,
        message: 'اتاق یافت نشد'
      });
    }

    // بررسی اینکه کاربر صاحب اتاق است
    if (room.ownerId !== userId) {
      return res.status(403).json({
        success: false,
        message: 'فقط صاحب اتاق می‌تواند آن را حذف کند'
      });
    }

    roomManager.deleteRoom(roomId);

    res.json({
      success: true,
      message: 'اتاق با موفقیت حذف شد'
    });

  } catch (error) {
    console.error('خطا در حذف اتاق:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در حذف اتاق',
      error: error.message
    });
  }
});

module.exports = router; 