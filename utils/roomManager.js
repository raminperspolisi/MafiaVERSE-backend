/**
 * Room Manager - مدیریت اتاق‌های بازی در حافظه
 */

const GameRoom = require('../models/GameRoom');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // ذخیره اتاق‌ها در Map
    this.playerRooms = new Map(); // نگهداری اتاق هر بازیکن
    this.cleanupInterval = null;
    
    // شروع cleanup خودکار
    this.startCleanup();
  }

  // ایجاد اتاق جدید
  createRoom(data) {
    const room = new GameRoom(data);
    this.rooms.set(room.id, room);
    
    // اگر صاحب اتاق مشخص شده، او را اضافه کن
    if (data.ownerId) {
      room.ownerId = data.ownerId;
    }
    
    console.log(`✅ اتاق جدید ایجاد شد: ${room.id}`);
    return room;
  }

  // دریافت اتاق با ID
  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  // دریافت لیست همه اتاق‌ها
  getAllRooms() {
    return Array.from(this.rooms.values()).map(room => room.getPublicInfo());
  }

  // دریافت اتاق‌های عمومی (غیر خصوصی)
  getPublicRooms() {
    return Array.from(this.rooms.values())
      .filter(room => !room.isPrivate && room.status === 'waiting')
      .map(room => room.getPublicInfo());
  }

  // پیوستن بازیکن به اتاق
  joinRoom(roomId, player, password = null) {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error('اتاق یافت نشد');
    }

    // بررسی دسترسی
    const accessCheck = room.canJoin(player.id, password);
    if (!accessCheck.canJoin) {
      throw new Error(accessCheck.reason);
    }

    // اضافه کردن بازیکن به اتاق
    const addedPlayer = room.addPlayer(player);
    
    // ثبت اتاق بازیکن
    this.playerRooms.set(player.id, roomId);
    
    console.log(`👤 ${player.username} به اتاق ${roomId} پیوست`);
    return { room, player: addedPlayer };
  }

  // Challenge APIs
  requestChallenge(roomId, challengerId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    const player = room.currentPlayers.find(p => p.id === challengerId);
    if (!player) throw new Error('بازیکن یافت نشد');
    const requests = room.addChallengeRequest(player);
    return { room, requests };
  }

  approveChallenge(roomId, approverId, targetUserId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    const requests = room.approveChallenge(targetUserId, approverId);
    return { room, requests };
  }

  startApprovedChallenge(roomId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    const targetUserId = room.startChallengeIfApproved();
    return { room, targetUserId };
  }

  endChallengeAndProceed(roomId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    const nextSpeakerId = room.endActiveChallenge();
    return { room, nextSpeakerId };
  }

  endSpeakerAndMaybeStartChallenge(roomId, speakerId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    if (room.currentSpeakerId !== speakerId) {
      throw new Error('نوبت این بازیکن نیست');
    }
    // If challenge approved, start it, else move to next speaker
    const targetUserId = room.startChallengeIfApproved();
    if (targetUserId) {
      // Do not rotate queue now; challenge will run and then proceed
      return { room, startedChallengeFor: targetUserId };
    }
    const nextSpeakerId = room.moveToNextSpeaker();
    return { room, nextSpeakerId };
  }

  // Speaking helpers
  forceNextSpeaker(roomId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    const nextSpeakerId = room.moveToNextSpeaker();
    return { room, nextSpeakerId };
  }

  getSpeakingState(roomId) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error('اتاق یافت نشد');
    return {
      currentSpeakerId: room.currentSpeakerId,
      speakingQueue: room.speakingQueue,
      challenge: room.getChallengeState()
    };
  }

  // ترک اتاق توسط بازیکن
  leaveRoom(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error('اتاق یافت نشد');
    }

    const removedPlayer = room.removePlayer(playerId);
    if (!removedPlayer) {
      throw new Error('بازیکن در اتاق یافت نشد');
    }

    // حذف از ثبت اتاق بازیکن
    this.playerRooms.delete(playerId);

    // اگر اتاق خالی شد، آن را حذف کن
    if (room.currentPlayers.length === 0) {
      this.deleteRoom(roomId);
      console.log(`🗑️ اتاق ${roomId} حذف شد (خالی)`);
    } else {
      console.log(`👋 ${removedPlayer.username} از اتاق ${roomId} خارج شد`);
    }

    return { room, player: removedPlayer };
  }

  // تغییر وضعیت آماده بودن بازیکن
  togglePlayerReady(roomId, playerId) {
    const room = this.getRoom(roomId);
    if (!room) {
      throw new Error('اتاق یافت نشد');
    }

    const player = room.togglePlayerReady(playerId);
    if (!player) {
      throw new Error('بازیکن یافت نشد');
    }

    console.log(`✅ ${player.username} وضعیت آماده بودن را تغییر داد: ${player.isReady}`);
    return { room, player };
  }

  // شروع بازی
  startGame(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('اتاق یافت نشد');
    }

    if (room.status !== 'waiting') {
      throw new Error('بازی قبلاً شروع شده است');
    }

    // Check if all players are ready
    const readyPlayers = room.currentPlayers.filter(p => p.isReady);
    if (readyPlayers.length < room.maxPlayers) {
      throw new Error('همه بازیکنان آماده نیستند');
    }

    // Start game
    room.status = 'playing';
    room.gamePhase = 'introduction'; // Start with introduction phase
    
    // Initialize speaking queue for introduction
    room.speakingQueue = room.currentPlayers.map(p => p.id);
    room.currentSpeakerId = room.speakingQueue[0];

    // Assign roles if not already assigned
    if (!room.currentPlayers.some(p => p.role)) {
      const roles = this.assignRoles(room.currentPlayers.length);
      room.currentPlayers.forEach((player, index) => {
        player.role = roles[index];
      });
    }

    const gameData = {
      players: room.currentPlayers.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role,
        isAlive: p.isAlive
      })),
      settings: room.gameSettings,
      phase: room.gamePhase
    };

    return { room, gameData };
  }

  // حذف اتاق
  deleteRoom(roomId) {
    const room = this.getRoom(roomId);
    if (room) {
      // حذف همه بازیکنان از ثبت
      room.currentPlayers.forEach(player => {
        this.playerRooms.delete(player.id);
      });
      
      this.rooms.delete(roomId);
      console.log(`🗑️ اتاق ${roomId} حذف شد`);
    }
  }

  // دریافت اتاق بازیکن
  getPlayerRoom(playerId) {
    const roomId = this.playerRooms.get(playerId);
    return roomId ? this.getRoom(roomId) : null;
  }

  // بررسی اینکه بازیکن در اتاقی هست یا نه
  isPlayerInRoom(playerId) {
    return this.playerRooms.has(playerId);
  }

  // دریافت تعداد اتاق‌ها
  getRoomCount() {
    return this.rooms.size;
  }

  // دریافت تعداد بازیکنان کل
  getTotalPlayerCount() {
    let total = 0;
    this.rooms.forEach(room => {
      total += room.currentPlayers.length;
    });
    return total;
  }

  // Cleanup خودکار اتاق‌های قدیمی
  startCleanup() {
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldRooms();
    }, 5 * 60 * 1000); // هر 5 دقیقه
  }

  cleanupOldRooms() {
    const now = new Date();
    const maxAge = 30 * 60 * 1000; // 30 دقیقه

    for (const [roomId, room] of this.rooms) {
      const roomAge = now - room.createdAt;
      
      // اگر اتاق قدیمی و خالی است، حذف کن
      if (roomAge > maxAge && room.currentPlayers.length === 0) {
        this.deleteRoom(roomId);
        console.log(`🧹 اتاق قدیمی ${roomId} پاک شد`);
      }
    }
  }

  // توقف cleanup
  stopCleanup() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  // دریافت آمار
  getStats() {
    return {
      totalRooms: this.getRoomCount(),
      totalPlayers: this.getTotalPlayerCount(),
      publicRooms: this.getPublicRooms().length,
      waitingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'waiting').length,
      playingRooms: Array.from(this.rooms.values()).filter(r => r.status === 'playing').length
    };
  }

  // پاک کردن همه اتاق‌ها (برای تست)
  clearAll() {
    this.rooms.clear();
    this.playerRooms.clear();
    console.log('🧹 همه اتاق‌ها پاک شدند');
  }
}

// ایجاد instance واحد
const roomManager = new RoomManager();

module.exports = roomManager; 