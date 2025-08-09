const mongoose = require('mongoose');

const gameSchema = new mongoose.Schema({
  gameId: {
    type: String,
    required: true,
    unique: true
  },
  players: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    username: {
      type: String,
      required: true
    },
    firstName: String,
    lastName: String,
    role: {
      type: String,
      enum: ['mafia', 'doctor', 'detective', 'citizen'],
      required: true
    },
    isAlive: {
      type: Boolean,
      default: true
    },
    eliminatedDay: Number,
    eliminatedPhase: String, // 'night', 'day', 'voting'
    votes: {
      type: Number,
      default: 0
    }
  }],
  winner: {
    type: String,
    enum: ['mafia', 'citizens'],
    required: function() {
      return this.status === 'completed';
    }
  },
  status: {
    type: String,
    enum: ['waiting', 'active', 'completed', 'cancelled'],
    default: 'waiting'
  },
  currentPhase: {
    type: String,
    enum: ['night', 'day', 'voting'],
    default: 'night'
  },
  currentDay: {
    type: Number,
    default: 1
  },
  totalDays: Number,
  gameHistory: [{
    day: Number,
    phase: String, // 'night', 'day', 'voting'
    action: String, // 'kill', 'protect', 'investigate', 'vote', 'eliminate'
    actor: String, // username
    target: String, // username
    result: String, // description of what happened
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  chatMessages: [{
    username: String,
    message: String,
    type: {
      type: String,
      enum: ['public', 'mafia', 'dead', 'system'],
      default: 'public'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: Date,
  duration: Number, // in minutes
  gameMode: {
    type: String,
    enum: ['classic', 'custom'],
    default: 'classic'
  },
  settings: {
    maxPlayers: {
      type: Number,
      default: 12
    },
    minPlayers: {
      type: Number,
      default: 4
    },
    nightDuration: {
      type: Number,
      default: 30 // seconds
    },
    dayDuration: {
      type: Number,
      default: 60 // seconds
    },
    votingDuration: {
      type: Number,
      default: 45 // seconds
    },
    allowSpectators: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

// Instance method to add a player
gameSchema.methods.addPlayer = function(playerData) {
  if (this.players.length >= this.settings.maxPlayers) {
    throw new Error('بازی پر است');
  }
  
  const existingPlayer = this.players.find(p => p.userId.toString() === playerData.userId.toString());
  if (existingPlayer) {
    throw new Error('کاربر قبلاً در بازی است');
  }
  
  this.players.push(playerData);
  return this.players;
};

// Instance method to remove a player
gameSchema.methods.removePlayer = function(userId) {
  this.players = this.players.filter(p => p.userId.toString() !== userId.toString());
  return this.players;
};

// Instance method to get alive players
gameSchema.methods.getAlivePlayers = function() {
  return this.players.filter(p => p.isAlive);
};

// Instance method to get players by role
gameSchema.methods.getPlayersByRole = function(role) {
  return this.players.filter(p => p.role === role && p.isAlive);
};

// Instance method to eliminate a player
gameSchema.methods.eliminatePlayer = function(username, day, phase) {
  const player = this.players.find(p => p.username === username);
  if (player) {
    player.isAlive = false;
    player.eliminatedDay = day;
    player.eliminatedPhase = phase;
  }
  return player;
};

// Instance method to add game action to history
gameSchema.methods.addAction = function(actionData) {
  this.gameHistory.push({
    day: this.currentDay,
    phase: this.currentPhase,
    ...actionData,
    timestamp: new Date()
  });
};

// Instance method to add chat message
gameSchema.methods.addChatMessage = function(messageData) {
  this.chatMessages.push({
    ...messageData,
    timestamp: new Date()
  });
};

// Instance method to check win condition
gameSchema.methods.checkWinCondition = function() {
  const alivePlayers = this.getAlivePlayers();
  const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');
  const aliveCitizens = alivePlayers.filter(p => p.role !== 'mafia');
  
  if (aliveMafia.length === 0) {
    this.winner = 'citizens';
    this.status = 'completed';
    this.endTime = new Date();
    this.calculateDuration();
    return 'citizens';
  } else if (aliveMafia.length >= aliveCitizens.length) {
    this.winner = 'mafia';
    this.status = 'completed';
    this.endTime = new Date();
    this.calculateDuration();
    return 'mafia';
  }
  
  return null;
};

// Instance method to calculate game duration
gameSchema.methods.calculateDuration = function() {
  if (this.endTime && this.startTime) {
    this.duration = Math.round((this.endTime - this.startTime) / (1000 * 60)); // in minutes
    this.totalDays = this.currentDay;
  }
  return this.duration;
};

// Instance method to get game statistics
gameSchema.methods.getGameStats = function() {
  return {
    totalPlayers: this.players.length,
    mafiaCount: this.players.filter(p => p.role === 'mafia').length,
    citizenCount: this.players.filter(p => p.role === 'citizen').length,
    doctorCount: this.players.filter(p => p.role === 'doctor').length,
    detectiveCount: this.players.filter(p => p.role === 'detective').length,
    survivorCount: this.getAlivePlayers().length,
    totalDays: this.totalDays || this.currentDay,
    duration: this.duration,
    winner: this.winner,
    totalActions: this.gameHistory.length,
    totalMessages: this.chatMessages.length
  };
};

// Static method to get recent games
gameSchema.statics.getRecentGames = function(limit = 10) {
  return this.find({ status: 'completed' })
    .sort({ endTime: -1 })
    .limit(limit)
    .populate('players.userId', 'username firstName lastName');
};

// Static method to get user's game history
gameSchema.statics.getUserGameHistory = function(userId, limit = 10) {
  return this.find({ 
    'players.userId': userId,
    status: 'completed'
  })
    .sort({ endTime: -1 })
    .limit(limit)
    .select('gameId winner players startTime endTime duration totalDays');
};

// Static method to get game statistics
gameSchema.statics.getGameStatistics = function() {
  return this.aggregate([
    { $match: { status: 'completed' } },
    {
      $group: {
        _id: null,
        totalGames: { $sum: 1 },
        citizenWins: {
          $sum: { $cond: [{ $eq: ['$winner', 'citizens'] }, 1, 0] }
        },
        mafiaWins: {
          $sum: { $cond: [{ $eq: ['$winner', 'mafia'] }, 1, 0] }
        },
        averageDuration: { $avg: '$duration' },
        averageDays: { $avg: '$totalDays' },
        totalPlayers: { $sum: { $size: '$players' } }
      }
    }
  ]);
};

// Index for better query performance
gameSchema.index({ gameId: 1 });
gameSchema.index({ status: 1, endTime: -1 });
gameSchema.index({ 'players.userId': 1, status: 1 });

module.exports = mongoose.model('Game', gameSchema); 