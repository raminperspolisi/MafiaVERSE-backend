/**
 * GameRoom Model - برای ذخیره اطلاعات اتاق بازی در حافظه
 */

class GameRoom {
  constructor(data = {}) {

    this.id = data.id || `room_${Date.now()}_${Math.random().toString(36).substr(2, 3)}`;
    this.name = data.name || 'اتاق بازی جدید';
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
    this.speakingQueue = Array.isArray(data.speakingQueue) ? data.speakingQueue : [];
    this.currentSpeakerId = data.currentSpeakerId || null;
    this.challengeRequests = [];
    this.approvedChallengeUserId = null;
    this.challengeActive = false;
    this.gamePhase = data.gamePhase || 'waiting'; // waiting, introduction, night, day
    // Day counter & reactions (in-memory)
    this.day = Number.isInteger(data.day) ? data.day : 1;
    // Structure: { [dayNumber]: { [targetUserId]: { likes: Set<userId>, dislikes: Set<userId> } } }
    this.reactions = {};
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

    // Maintain speaking queue order by join order
    if (!this.speakingQueue.includes(newPlayer.id)) {
      this.speakingQueue.push(newPlayer.id);
    }
    if (!this.currentSpeakerId) {
      this.currentSpeakerId = newPlayer.id;
    }

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

      // Remove from speaking queue and adjust current speaker
      this.speakingQueue = this.speakingQueue.filter(id => id !== playerId);
      if (this.currentSpeakerId === playerId) {
        this.currentSpeakerId = this.speakingQueue[0] || null;
      }

      // Clean any challenge state related to this player
      this.challengeRequests = this.challengeRequests.filter(r => r.userId !== playerId);
      if (this.approvedChallengeUserId === playerId) {
        this.approvedChallengeUserId = null;
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

  // Speaking helpers
  ensureSpeakingQueueInitialized() {
    if (!this.speakingQueue || this.speakingQueue.length === 0) {
      this.speakingQueue = this.currentPlayers.map(p => p.id);
    }
    if (!this.currentSpeakerId && this.speakingQueue.length > 0) {
      this.currentSpeakerId = this.speakingQueue[0];
    }
  }

  getCurrentSpeaker() {
    this.ensureSpeakingQueueInitialized();
    return this.currentPlayers.find(p => p.id === this.currentSpeakerId) || null;
  }

  moveToNextSpeaker() {
    this.ensureSpeakingQueueInitialized();
    if (this.speakingQueue.length === 0) return null;
    // Rotate queue
    const first = this.speakingQueue.shift();
    if (first) this.speakingQueue.push(first);
    this.currentSpeakerId = this.speakingQueue[0] || null;
    // Reset challenge state when moving to next speaker
    this.challengeActive = false;
    this.approvedChallengeUserId = null;
    this.challengeRequests = [];
    return this.currentSpeakerId;
  }

  setCurrentSpeaker(playerId) {
    if (!this.speakingQueue.includes(playerId)) {
      this.speakingQueue.push(playerId);
    }
    this.currentSpeakerId = playerId;
    return this.getCurrentSpeaker();
  }

  // Challenge flow
  addChallengeRequest(player) {
    if (!player || !player.id) throw new Error('بازیکن نامعتبر');
    if (player.id === this.currentSpeakerId) throw new Error('گوینده فعلی نمی‌تواند چالش بدهد');
    const exists = this.challengeRequests.find(r => r.userId === player.id);
    if (exists) return this.challengeRequests;
    this.challengeRequests.push({
      userId: player.id,
      username: player.username,
      avatar: player.avatar || '',
      timestamp: Date.now(),
      approved: false
    });
    return this.challengeRequests;
  }

  approveChallenge(targetUserId, approverUserId) {
    if (approverUserId !== this.currentSpeakerId) {
      throw new Error('فقط گوینده می‌تواند چالش را تایید کند');
    }
    const req = this.challengeRequests.find(r => r.userId === targetUserId);
    if (!req) throw new Error('درخواست چالش یافت نشد');
    this.challengeRequests = this.challengeRequests.map(r => ({
      ...r,
      approved: r.userId === targetUserId
    }));
    this.approvedChallengeUserId = targetUserId;
    return this.challengeRequests;
  }

  clearChallengeRequests() {
    this.challengeRequests = [];
    this.approvedChallengeUserId = null;
    this.challengeActive = false;
  }

  getChallengeState() {
    return {
      currentSpeakerId: this.currentSpeakerId,
      requests: this.challengeRequests,
      approvedUserId: this.approvedChallengeUserId,
      active: this.challengeActive
    };
  }

  // شروع چالش (پس از پایان صحبت گوینده)
  startChallengeIfApproved() {
    if (!this.approvedChallengeUserId) return null;
    this.challengeActive = true;
    return this.approvedChallengeUserId;
  }

  endActiveChallenge() {
    this.challengeActive = false;
    // After challenge ends, move to next speaker in queue
    return this.moveToNextSpeaker();
  }

  // --- Reactions helpers (like/dislike) ---
  initReactionsForDay(dayNumber) {
    const d = Number.isInteger(dayNumber) ? dayNumber : this.day || 1;
    if (!this.reactions[d]) this.reactions[d] = {};
    return this.reactions[d];
  }

  applyReaction(dayNumber, targetUserId, fromUserId, type /* 'like' | 'dislike' */) {
    const d = Number.isInteger(dayNumber) ? dayNumber : this.day || 1;
    const dayBucket = this.initReactionsForDay(d);
    if (!dayBucket[targetUserId]) {
      dayBucket[targetUserId] = { likes: new Set(), dislikes: new Set() };
    }
    const rec = dayBucket[targetUserId];

    // Remove previous choice (toggle behavior)
    rec.likes.delete(fromUserId);
    rec.dislikes.delete(fromUserId);

    if (type === 'like') rec.likes.add(fromUserId);
    else if (type === 'dislike') rec.dislikes.add(fromUserId);

    return {
      likes: rec.likes.size,
      dislikes: rec.dislikes.size
    };
  }

  getReactions(dayNumber, targetUserId) {
    const d = Number.isInteger(dayNumber) ? dayNumber : this.day || 1;
    const dayBucket = this.reactions[d] || {};
    const rec = dayBucket[targetUserId];
    if (!rec) return { likes: 0, dislikes: 0 };
    return {
      likes: rec.likes instanceof Set ? rec.likes.size : Array.isArray(rec.likes) ? rec.likes.length : 0,
      dislikes: rec.dislikes instanceof Set ? rec.dislikes.size : Array.isArray(rec.dislikes) ? rec.dislikes.length : 0
    };
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
      ownerId: this.ownerId,
      // Speaking snapshot (no sensitive data)
      currentSpeakerId: this.currentSpeakerId,
      hasApprovedChallenge: !!this.approvedChallengeUserId,
      challengeActive: this.challengeActive
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
      isPrivate: this.isPrivate,
      // Speaking & challenge details
      speakingQueue: this.speakingQueue,
      currentSpeakerId: this.currentSpeakerId,
      challenge: this.getChallengeState()
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