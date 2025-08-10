/**
 * GameRoom Model - برای ذخیره اطلاعات اتاق بازی در حافظه
 */

class GameRoom {
  constructor(data = {}) {
    this.id = data.id || this.generateId();
    this.name = data.name || `اتاق بازی ${this.id.slice(-4)}`;
    this.maxPlayers = data.maxPlayers || 8;
    this.currentPlayers = data.currentPlayers || [];
    this.status = data.status || 'waiting'; // waiting, starting, playing, finished
    this.createdAt = data.createdAt || new Date();
    this.gameSettings = data.gameSettings || {
      mafiaCount: 2,
      doctorCount: 1,
      detectiveCount: 1,
      sniperCount: 1,
      bodyguardCount: 1,
      citizenCount: 2
    };
    this.ownerId = data.ownerId || null;
    this.isPrivate = data.isPrivate || false;
    this.password = data.password || null;
  }

  generateId() {
    return 'room_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // اضافه کردن بازیکن به اتاق
  addPlayer(player) {
    if (this.currentPlayers.length >= this.maxPlayers) {
      throw new Error('اتاق پر است');
    }

    if (this.currentPlayers.find(p => p.id === player.id)) {
      throw new Error('بازیکن قبلاً در اتاق است');
    }

    const newPlayer = {
      id: player.id,
      username: player.username,
      role: player.role,
      isReady: false,
      joinedAt: new Date(),
      socketId: player.socketId
    };

    this.currentPlayers.push(newPlayer);
    return newPlayer;
  }

  // حذف بازیکن از اتاق
  removePlayer(playerId) {
    const index = this.currentPlayers.findIndex(p => p.id === playerId);
    if (index !== -1) {
      const removedPlayer = this.currentPlayers.splice(index, 1)[0];
      
      // اگر صاحب اتاق خارج شد، صاحب جدید انتخاب کن
      if (this.ownerId === playerId && this.currentPlayers.length > 0) {
        this.ownerId = this.currentPlayers[0].id;
      }
      
      return removedPlayer;
    }
    return null;
  }

  // تغییر وضعیت آماده بودن بازیکن
  togglePlayerReady(playerId) {
    const player = this.currentPlayers.find(p => p.id === playerId);
    if (player) {
      player.isReady = !player.isReady;
      return player;
    }
    return null;
  }

  // بررسی آماده بودن همه بازیکنان
  areAllPlayersReady() {
    return this.currentPlayers.length >= 4 && 
           this.currentPlayers.every(p => p.isReady);
  }

  // شروع بازی
  startGame() {
    if (!this.areAllPlayersReady()) {
      throw new Error('همه بازیکنان آماده نیستند');
    }
    
    this.status = 'starting';
    return {
      players: this.currentPlayers.map(p => ({
        id: p.id,
        username: p.username,
        role: p.role
      })),
      settings: this.gameSettings
    };
  }

  // دریافت اطلاعات عمومی اتاق (بدون اطلاعات حساس)
  getPublicInfo() {
    return {
      id: this.id,
      name: this.name,
      maxPlayers: this.maxPlayers,
      currentPlayersCount: this.currentPlayers.length,
      status: this.status,
      createdAt: this.createdAt,
      isPrivate: this.isPrivate,
      ownerId: this.ownerId
    };
  }

  // دریافت اطلاعات کامل اتاق (برای اعضای اتاق)
  getFullInfo() {
    return {
      id: this.id,
      name: this.name,
      maxPlayers: this.maxPlayers,
      currentPlayers: this.currentPlayers,
      status: this.status,
      createdAt: this.createdAt,
      gameSettings: this.gameSettings,
      ownerId: this.ownerId,
      isPrivate: this.isPrivate
    };
  }

  // بررسی دسترسی به اتاق
  canJoin(playerId, password = null) {
    if (this.currentPlayers.length >= this.maxPlayers) {
      return { canJoin: false, reason: 'اتاق پر است' };
    }

    if (this.isPrivate && this.password !== password) {
      return { canJoin: false, reason: 'رمز عبور اشتباه است' };
    }

    if (this.currentPlayers.find(p => p.id === playerId)) {
      return { canJoin: false, reason: 'قبلاً در اتاق هستید' };
    }

    return { canJoin: true };
  }
}

module.exports = GameRoom; 