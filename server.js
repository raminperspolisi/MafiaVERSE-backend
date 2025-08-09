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

// Models
const User = require('./models/User');
const Game = require('./models/Game');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/game', require('./routes/game'));

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// Game state management
let activeGames = new Map();
let waitingPlayers = [];

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔗 کاربر جدید متصل شد: ${socket.id}`);

  // Join waiting room
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
    
    // Send updated waiting list to all players
    io.to('waiting-room').emit('waiting-players-updated', waitingPlayers);
    
    // Auto-start game if we have enough players (minimum 4)
    if (waitingPlayers.length >= 4) {
      startNewGame();
    }
  });

  // Start game manually
  socket.on('start-game', () => {
    if (waitingPlayers.length >= 4) {
      startNewGame();
    } else {
      socket.emit('error', 'حداقل 4 بازیکن برای شروع بازی نیاز است');
    }
  });

  // Game actions
  socket.on('vote', (data) => {
    handleVote(socket, data);
  });

  socket.on('mafia-action', (data) => {
    handleMafiaAction(socket, data);
  });

  socket.on('doctor-action', (data) => {
    handleDoctorAction(socket, data);
  });

  socket.on('detective-action', (data) => {
    handleDetectiveAction(socket, data);
  });

  // Chat messages
  socket.on('send-message', (data) => {
    const game = findPlayerGame(socket.id);
    if (game) {
      io.to(`game-${game.id}`).emit('new-message', {
        username: data.username,
        message: data.message,
        timestamp: new Date(),
        type: data.type || 'public'
      });
    }
  });

  // Disconnect handling
  socket.on('disconnect', () => {
    console.log(`❌ کاربر قطع شد: ${socket.id}`);
    
    // Remove from waiting players
    waitingPlayers = waitingPlayers.filter(player => player.socketId !== socket.id);
    io.to('waiting-room').emit('waiting-players-updated', waitingPlayers);
    
    // Handle disconnect in active games
    handlePlayerDisconnect(socket.id);
  });
});

// Game logic functions
function startNewGame() {
  if (waitingPlayers.length < 4) return;
  
  const gameId = generateGameId();
  const players = [...waitingPlayers];
  waitingPlayers = [];
  
  // Assign roles
  const roles = assignRoles(players.length);
  const gamePlayers = players.map((player, index) => ({
    ...player,
    role: roles[index],
    isAlive: true,
    votes: 0,
    isProtected: false
  }));
  
  const game = {
    id: gameId,
    players: gamePlayers,
    phase: 'night', // night, day, voting
    day: 1,
    isActive: true,
    votes: new Map(),
    nightActions: new Map()
  };
  
  activeGames.set(gameId, game);
  
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
    phase: game.phase,
    day: game.day
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
  
  // Start night phase
  startNightPhase(gameId);
}

function assignRoles(playerCount) {
  const roles = ['citizen']; // Default role
  
  // Calculate role distribution
  const mafiaCount = Math.floor(playerCount / 3);
  const specialRoles = ['doctor', 'detective'];
  
  // Add mafia members
  for (let i = 0; i < mafiaCount; i++) {
    roles.push('mafia');
  }
  
  // Add special roles
  specialRoles.forEach(role => {
    if (roles.length < playerCount) {
      roles.push(role);
    }
  });
  
  // Fill remaining with citizens
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

function startNightPhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  game.phase = 'night';
  game.nightActions.clear();
  
  io.to(`game-${gameId}`).emit('phase-changed', {
    phase: 'night',
    day: game.day,
    message: `شب ${game.day} شروع شد. مافیا و نقش‌های ویژه اقدام کنند.`
  });
  
  // Set timer for night phase (30 seconds)
  setTimeout(() => {
    processNightActions(gameId);
  }, 30000);
}

function startDayPhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  game.phase = 'day';
  
  io.to(`game-${gameId}`).emit('phase-changed', {
    phase: 'day',
    day: game.day,
    message: `روز ${game.day} شروع شد. بازیکنان در مورد مافیا بحث کنند.`
  });
  
  // Set timer for day phase (60 seconds)
  setTimeout(() => {
    startVotingPhase(gameId);
  }, 60000);
}

function startVotingPhase(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  game.phase = 'voting';
  game.votes.clear();
  
  const alivePlayers = game.players.filter(p => p.isAlive);
  
  io.to(`game-${gameId}`).emit('phase-changed', {
    phase: 'voting',
    day: game.day,
    message: 'زمان رای‌گیری! برای حذف یک بازیکن رای دهید.',
    players: alivePlayers.map(p => ({
      username: p.username,
      firstName: p.firstName,
      lastName: p.lastName
    }))
  });
  
  // Set timer for voting phase (45 seconds)
  setTimeout(() => {
    processVotes(gameId);
  }, 45000);
}

function processNightActions(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  let killedPlayer = null;
  let protectedPlayer = null;
  let investigationResult = null;
  
  // Process mafia action
  const mafiaAction = game.nightActions.get('mafia');
  if (mafiaAction) {
    killedPlayer = game.players.find(p => p.username === mafiaAction.target);
  }
  
  // Process doctor action
  const doctorAction = game.nightActions.get('doctor');
  if (doctorAction) {
    protectedPlayer = game.players.find(p => p.username === doctorAction.target);
    if (protectedPlayer) {
      protectedPlayer.isProtected = true;
    }
  }
  
  // Process detective action
  const detectiveAction = game.nightActions.get('detective');
  if (detectiveAction) {
    const investigatedPlayer = game.players.find(p => p.username === detectiveAction.target);
    if (investigatedPlayer) {
      investigationResult = {
        player: investigatedPlayer.username,
        isMafia: investigatedPlayer.role === 'mafia'
      };
      
      // Send result to detective
      const detective = game.players.find(p => p.role === 'detective');
      if (detective) {
        const detectiveSocket = io.sockets.sockets.get(detective.socketId);
        if (detectiveSocket) {
          detectiveSocket.emit('investigation-result', investigationResult);
        }
      }
    }
  }
  
  // Apply death if not protected
  if (killedPlayer && !killedPlayer.isProtected) {
    killedPlayer.isAlive = false;
  }
  
  // Reset protection
  game.players.forEach(p => p.isProtected = false);
  
  // Check win condition
  if (checkWinCondition(gameId)) {
    return;
  }
  
  // Announce results
  let message = `شب ${game.day} به پایان رسید.`;
  if (killedPlayer && !killedPlayer.isProtected) {
    message += ` ${killedPlayer.firstName} ${killedPlayer.lastName} کشته شد.`;
  } else if (killedPlayer && killedPlayer.isProtected) {
    message += ' امشب کسی کشته نشد.';
  }
  
  io.to(`game-${gameId}`).emit('night-results', {
    message,
    killedPlayer: killedPlayer && !killedPlayer.isProtected ? killedPlayer.username : null,
    players: game.players.filter(p => p.isAlive).map(p => ({
      username: p.username,
      firstName: p.firstName,
      lastName: p.lastName,
      isAlive: p.isAlive
    }))
  });
  
  // Start day phase
  setTimeout(() => {
    startDayPhase(gameId);
  }, 3000);
}

function processVotes(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return;
  
  // Count votes
  const voteCount = new Map();
  game.votes.forEach(vote => {
    voteCount.set(vote.target, (voteCount.get(vote.target) || 0) + 1);
  });
  
  // Find player with most votes
  let maxVotes = 0;
  let eliminatedPlayer = null;
  
  voteCount.forEach((votes, playerUsername) => {
    if (votes > maxVotes) {
      maxVotes = votes;
      eliminatedPlayer = game.players.find(p => p.username === playerUsername);
    }
  });
  
  if (eliminatedPlayer && maxVotes > 0) {
    eliminatedPlayer.isAlive = false;
    
    io.to(`game-${gameId}`).emit('player-eliminated', {
      player: eliminatedPlayer.username,
      firstName: eliminatedPlayer.firstName,
      lastName: eliminatedPlayer.lastName,
      role: eliminatedPlayer.role,
      votes: maxVotes
    });
  } else {
    io.to(`game-${gameId}`).emit('no-elimination', {
      message: 'هیچ‌کس حذف نشد.'
    });
  }
  
  // Check win condition
  if (checkWinCondition(gameId)) {
    return;
  }
  
  // Move to next day
  game.day++;
  setTimeout(() => {
    startNightPhase(gameId);
  }, 5000);
}

function checkWinCondition(gameId) {
  const game = activeGames.get(gameId);
  if (!game) return false;
  
  const alivePlayers = game.players.filter(p => p.isAlive);
  const aliveMafia = alivePlayers.filter(p => p.role === 'mafia');
  const aliveCitizens = alivePlayers.filter(p => p.role !== 'mafia');
  
  let winner = null;
  
  if (aliveMafia.length === 0) {
    winner = 'citizens';
  } else if (aliveMafia.length >= aliveCitizens.length) {
    winner = 'mafia';
  }
  
  if (winner) {
    game.isActive = false;
    
    io.to(`game-${gameId}`).emit('game-ended', {
      winner,
      message: winner === 'citizens' ? 'شهروندان برنده شدند!' : 'مافیا برنده شد!',
      players: game.players.map(p => ({
        username: p.username,
        firstName: p.firstName,
        lastName: p.lastName,
        role: p.role,
        isAlive: p.isAlive
      }))
    });
    
    // Clean up
    setTimeout(() => {
      activeGames.delete(gameId);
    }, 30000);
    
    return true;
  }
  
  return false;
}

// Helper functions
function findPlayerGame(socketId) {
  for (let [gameId, game] of activeGames) {
    if (game.players.some(p => p.socketId === socketId)) {
      return game;
    }
  }
  return null;
}

function handlePlayerDisconnect(socketId) {
  for (let [gameId, game] of activeGames) {
    const playerIndex = game.players.findIndex(p => p.socketId === socketId);
    if (playerIndex !== -1) {
      game.players[playerIndex].isAlive = false;
      io.to(`game-${gameId}`).emit('player-disconnected', {
        username: game.players[playerIndex].username,
        message: `${game.players[playerIndex].firstName} بازی را ترک کرد.`
      });
      
      checkWinCondition(gameId);
      break;
    }
  }
}

function handleVote(socket, data) {
  const game = findPlayerGame(socket.id);
  if (!game || game.phase !== 'voting') return;
  
  const voter = game.players.find(p => p.socketId === socket.id);
  if (!voter || !voter.isAlive) return;
  
  game.votes.set(voter.username, {
    voter: voter.username,
    target: data.target
  });
  
  io.to(`game-${game.id}`).emit('vote-cast', {
    voter: voter.username,
    message: `${voter.firstName} رای خود را ثبت کرد.`
  });
}

function handleMafiaAction(socket, data) {
  const game = findPlayerGame(socket.id);
  if (!game || game.phase !== 'night') return;
  
  const player = game.players.find(p => p.socketId === socket.id);
  if (!player || player.role !== 'mafia' || !player.isAlive) return;
  
  game.nightActions.set('mafia', {
    actor: player.username,
    target: data.target
  });
  
  socket.emit('action-confirmed', {
    message: `هدف شما برای امشب: ${data.target}`
  });
}

function handleDoctorAction(socket, data) {
  const game = findPlayerGame(socket.id);
  if (!game || game.phase !== 'night') return;
  
  const player = game.players.find(p => p.socketId === socket.id);
  if (!player || player.role !== 'doctor' || !player.isAlive) return;
  
  game.nightActions.set('doctor', {
    actor: player.username,
    target: data.target
  });
  
  socket.emit('action-confirmed', {
    message: `${data.target} را محافظت کردید.`
  });
}

function handleDetectiveAction(socket, data) {
  const game = findPlayerGame(socket.id);
  if (!game || game.phase !== 'night') return;
  
  const player = game.players.find(p => p.socketId === socket.id);
  if (!player || player.role !== 'detective' || !player.isAlive) return;
  
  game.nightActions.set('detective', {
    actor: player.username,
    target: data.target
  });
  
  socket.emit('action-confirmed', {
    message: `${data.target} را بررسی کردید.`
  });
}

function generateGameId() {
  return Math.random().toString(36).substr(2, 9);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 سرور روی پورت ${PORT} راه‌اندازی شد`);
}); 