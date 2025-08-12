const mongoose = require('mongoose');

const testLobbyPlayerSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  username: { type: String, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, default: '' },
  isBot: { type: Boolean, default: false },
  socketId: { type: String, default: null }
}, { _id: false });

const testLobbySchema = new mongoose.Schema({
  lobbyId: { type: String, default: 'default', unique: true, index: true },
  players: { type: [testLobbyPlayerSchema], default: [] },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('TestLobby', testLobbySchema); 