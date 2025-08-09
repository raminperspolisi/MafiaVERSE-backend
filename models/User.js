const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'نام الزامی است'],
    trim: true,
    maxLength: [50, 'نام نباید بیشتر از 50 کاراکتر باشد']
  },
  lastName: {
    type: String,
    required: [true, 'نام خانوادگی الزامی است'],
    trim: true,
    maxLength: [50, 'نام خانوادگی نباید بیشتر از 50 کاراکتر باشد']
  },
  username: {
    type: String,
    required: [true, 'نام کاربری الزامی است'],
    unique: true,
    trim: true,
    lowercase: true,
    minLength: [3, 'نام کاربری باید حداقل 3 کاراکتر باشد'],
    maxLength: [30, 'نام کاربری نباید بیشتر از 30 کاراکتر باشد'],
    match: [/^[a-zA-Z0-9_]+$/, 'نام کاربری فقط می‌تواند شامل حروف، اعداد و آندرلاین باشد']
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'ایمیل نامعتبر است']
  },
  password: {
    type: String,
    required: [true, 'رمز عبور الزامی است'],
    minLength: [6, 'رمز عبور باید حداقل 6 کاراکتر باشد']
  },
  phoneNumber: {
    type: String,
    required: [true, 'شماره تلفن الزامی است'],
    match: [/^09\d{9}$/, 'شماره تلفن نامعتبر است']
  },
  referralCode: {
    type: String,
    trim: true,
    uppercase: true
  },
  avatar: {
    type: String,
    default: ''
  },
  gameStats: {
    totalGames: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    citizenWins: { type: Number, default: 0 },
    mafiaWins: { type: Number, default: 0 },
    specialRoleWins: { type: Number, default: 0 }
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
  },
  level: {
    type: Number,
    default: 1
  },
  experience: {
    type: Number,
    default: 0
  },
  achievements: [{
    name: String,
    description: String,
    unlockedAt: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash the password if it has been modified (or is new)
  if (!this.isModified('password')) return next();
  
  try {
    // Hash password with cost of 12
    const hashedPassword = await bcrypt.hash(this.password, 12);
    this.password = hashedPassword;
    next();
  } catch (error) {
    next(error);
  }
});

// Instance method to check password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Instance method to calculate level based on experience
userSchema.methods.calculateLevel = function() {
  this.level = Math.floor(this.experience / 100) + 1;
  return this.level;
};

// Instance method to add experience
userSchema.methods.addExperience = function(amount) {
  this.experience += amount;
  this.calculateLevel();
  return this.experience;
};

// Instance method to update game stats
userSchema.methods.updateGameStats = function(result, role) {
  this.gameStats.totalGames += 1;
  
  if (result === 'win') {
    this.gameStats.wins += 1;
    this.addExperience(50); // Win bonus
    
    if (role === 'mafia') {
      this.gameStats.mafiaWins += 1;
    } else if (role === 'doctor' || role === 'detective') {
      this.gameStats.specialRoleWins += 1;
    } else {
      this.gameStats.citizenWins += 1;
    }
  } else {
    this.gameStats.losses += 1;
    this.addExperience(10); // Participation bonus
  }
  
  return this.gameStats;
};

// Static method to find online users
userSchema.statics.findOnlineUsers = function() {
  return this.find({ isOnline: true });
};

// Static method to get leaderboard
userSchema.statics.getLeaderboard = function(limit = 10) {
  return this.find()
    .sort({ experience: -1, level: -1 })
    .limit(limit)
    .select('firstName lastName username level experience gameStats');
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Virtual for win rate
userSchema.virtual('winRate').get(function() {
  if (this.gameStats.totalGames === 0) return 0;
  return ((this.gameStats.wins / this.gameStats.totalGames) * 100).toFixed(1);
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema); 