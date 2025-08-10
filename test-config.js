// Test Configuration for Mafia Game
// This file helps set up a test environment

const testConfig = {
    // Server settings
    port: process.env.PORT || 3000,
    
    // MongoDB connection (use local MongoDB or MongoDB Atlas)
    mongodb: {
        uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/mafia-game-test',
        options: {
            useNewUrlParser: true,
            useUnifiedTopology: true
        }
    },
    
    // JWT secret for testing
    jwt: {
        secret: process.env.JWT_SECRET || 'test-secret-key-change-in-production'
    },
    
    // Game settings
    game: {
        minPlayers: 4,
        maxPlayers: 8,
        nightPhaseDuration: 30000, // 30 seconds
        dayPhaseDuration: 60000,   // 1 minute
        votingPhaseDuration: 45000 // 45 seconds
    },
    
    // Test users
    testUsers: [
        {
            username: 'test-user-1',
            firstName: 'علی',
            lastName: 'احمدی',
            email: 'ali@test.com',
            password: 'test123'
        },
        {
            username: 'test-user-2',
            firstName: 'فاطمه',
            lastName: 'محمدی',
            email: 'fateme@test.com',
            password: 'test123'
        },
        {
            username: 'test-user-3',
            firstName: 'محمد',
            lastName: 'رضایی',
            email: 'mohammad@test.com',
            password: 'test123'
        },
        {
            username: 'test-user-4',
            firstName: 'زهرا',
            lastName: 'حسینی',
            email: 'zahra@test.com',
            password: 'test123'
        }
    ]
};

module.exports = testConfig; 