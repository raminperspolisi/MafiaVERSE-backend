const express = require('express');
const Game = require('../models/Game');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Middleware to authenticate JWT token
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'دسترسی غیرمجاز - توکن مورد نیاز است'
    });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'توکن نامعتبر'
      });
    }
    req.user = user;
    next();
  });
}

// Get user's game history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const gameHistory = await Game.find({
      'players.userId': req.user.userId,
      status: 'completed'
    })
      .sort({ endTime: -1 })
      .skip(skip)
      .limit(limit)
      .populate('players.userId', 'username firstName lastName')
      .select('gameId winner players startTime endTime duration totalDays');

    const totalGames = await Game.countDocuments({
      'players.userId': req.user.userId,
      status: 'completed'
    });

    // Add user's role and result to each game
    const enhancedHistory = gameHistory.map(game => {
      const userPlayer = game.players.find(p => p.userId._id.toString() === req.user.userId);
      const userWon = (game.winner === 'mafia' && userPlayer.role === 'mafia') ||
                     (game.winner === 'citizens' && userPlayer.role !== 'mafia');

      return {
        ...game.toObject(),
        userRole: userPlayer.role,
        userResult: userWon ? 'win' : 'loss',
        userSurvived: userPlayer.isAlive
      };
    });

    res.json({
      success: true,
      games: enhancedHistory,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalGames / limit),
        totalGames,
        hasNext: page * limit < totalGames,
        hasPrev: page > 1
      }
    });
  } catch (error) {
    console.error('Get game history error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت تاریخچه بازی‌ها'
    });
  }
});

// Get user's game statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('gameStats level experience');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'کاربر یافت نشد'
      });
    }

    // Get detailed game statistics
    const games = await Game.find({
      'players.userId': req.user.userId,
      status: 'completed'
    });

    let roleStats = {
      mafia: { played: 0, won: 0 },
      doctor: { played: 0, won: 0 },
      detective: { played: 0, won: 0 },
      citizen: { played: 0, won: 0 }
    };

    let survivalRate = { survived: 0, total: 0 };
    let averageGameDuration = 0;
    let averageDaysPlayed = 0;

    games.forEach(game => {
      const userPlayer = game.players.find(p => p.userId.toString() === req.user.userId);
      if (userPlayer) {
        const role = userPlayer.role;
        const userWon = (game.winner === 'mafia' && role === 'mafia') ||
                       (game.winner === 'citizens' && role !== 'mafia');

        roleStats[role].played++;
        if (userWon) roleStats[role].won++;

        survivalRate.total++;
        if (userPlayer.isAlive) survivalRate.survived++;

        averageGameDuration += game.duration || 0;
        averageDaysPlayed += game.totalDays || 0;
      }
    });

    const totalGames = games.length;
    averageGameDuration = totalGames > 0 ? Math.round(averageGameDuration / totalGames) : 0;
    averageDaysPlayed = totalGames > 0 ? Math.round(averageDaysPlayed / totalGames * 10) / 10 : 0;

    const calculatedSurvivalRate = survivalRate.total > 0 
      ? Math.round((survivalRate.survived / survivalRate.total) * 100) 
      : 0;

    res.json({
      success: true,
      stats: {
        ...user.gameStats,
        level: user.level,
        experience: user.experience,
        winRate: user.winRate,
        roleStats,
        survivalRate: calculatedSurvivalRate,
        averageGameDuration,
        averageDaysPlayed,
        recentGames: totalGames
      }
    });
  } catch (error) {
    console.error('Get game stats error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار بازی'
    });
  }
});

// Get recent games (public)
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const recentGames = await Game.getRecentGames(limit);

    const formattedGames = recentGames.map(game => ({
      gameId: game.gameId,
      winner: game.winner,
      playerCount: game.players.length,
      duration: game.duration,
      totalDays: game.totalDays,
      endTime: game.endTime,
      players: game.players.map(p => ({
        username: p.userId.username,
        firstName: p.userId.firstName,
        lastName: p.userId.lastName,
        role: p.role,
        isAlive: p.isAlive
      }))
    }));

    res.json({
      success: true,
      games: formattedGames
    });
  } catch (error) {
    console.error('Get recent games error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت بازی‌های اخیر'
    });
  }
});

// Get global game statistics
router.get('/global-stats', async (req, res) => {
  try {
    const globalStats = await Game.getGameStatistics();
    
    const stats = globalStats[0] || {
      totalGames: 0,
      citizenWins: 0,
      mafiaWins: 0,
      averageDuration: 0,
      averageDays: 0,
      totalPlayers: 0
    };

    // Calculate win rates
    const citizenWinRate = stats.totalGames > 0 
      ? Math.round((stats.citizenWins / stats.totalGames) * 100) 
      : 0;
    
    const mafiaWinRate = stats.totalGames > 0 
      ? Math.round((stats.mafiaWins / stats.totalGames) * 100) 
      : 0;

    const averagePlayersPerGame = stats.totalGames > 0 
      ? Math.round(stats.totalPlayers / stats.totalGames) 
      : 0;

    // Get additional statistics
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isOnline: true });
    const experiencedUsers = await User.countDocuments({ 'gameStats.totalGames': { $gte: 5 } });

    res.json({
      success: true,
      stats: {
        ...stats,
        citizenWinRate,
        mafiaWinRate,
        averagePlayersPerGame: averagePlayersPerGame,
        averageDuration: Math.round(stats.averageDuration || 0),
        averageDays: Math.round((stats.averageDays || 0) * 10) / 10,
        totalUsers,
        activeUsers,
        experiencedUsers
      }
    });
  } catch (error) {
    console.error('Get global stats error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت آمار کلی'
    });
  }
});

// Get specific game details
router.get('/:gameId', async (req, res) => {
  try {
    const { gameId } = req.params;
    
    const game = await Game.findOne({ gameId })
      .populate('players.userId', 'username firstName lastName level');

    if (!game) {
      return res.status(404).json({
        success: false,
        message: 'بازی یافت نشد'
      });
    }

    // Format game data for response
    const formattedGame = {
      gameId: game.gameId,
      winner: game.winner,
      status: game.status,
      currentPhase: game.currentPhase,
      currentDay: game.currentDay,
      totalDays: game.totalDays,
      duration: game.duration,
      startTime: game.startTime,
      endTime: game.endTime,
      gameMode: game.gameMode,
      settings: game.settings,
      players: game.players.map(p => ({
        username: p.username,
        firstName: p.firstName || p.userId?.firstName,
        lastName: p.lastName || p.userId?.lastName,
        level: p.userId?.level || 1,
        role: p.role,
        isAlive: p.isAlive,
        eliminatedDay: p.eliminatedDay,
        eliminatedPhase: p.eliminatedPhase,
        votes: p.votes
      })),
      gameHistory: game.gameHistory,
      chatMessages: game.chatMessages.map(msg => ({
        username: msg.username,
        message: msg.message,
        type: msg.type,
        timestamp: msg.timestamp
      })),
      stats: game.getGameStats()
    };

    res.json({
      success: true,
      game: formattedGame
    });
  } catch (error) {
    console.error('Get game details error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در دریافت جزئیات بازی'
    });
  }
});

// Create a new game (for testing purposes)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { gameMode = 'classic', settings = {} } = req.body;
    
    const gameId = Math.random().toString(36).substr(2, 9);
    
    const game = new Game({
      gameId,
      gameMode,
      settings: {
        maxPlayers: settings.maxPlayers || 12,
        minPlayers: settings.minPlayers || 4,
        nightDuration: settings.nightDuration || 30,
        dayDuration: settings.dayDuration || 60,
        votingDuration: settings.votingDuration || 45,
        allowSpectators: settings.allowSpectators !== false
      },
      status: 'waiting'
    });

    await game.save();

    res.status(201).json({
      success: true,
      message: 'بازی جدید ایجاد شد',
      game: {
        gameId: game.gameId,
        gameMode: game.gameMode,
        settings: game.settings,
        status: game.status
      }
    });
  } catch (error) {
    console.error('Create game error:', error);
    res.status(500).json({
      success: false,
      message: 'خطا در ایجاد بازی جدید'
    });
  }
});

module.exports = router; 