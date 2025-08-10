#!/usr/bin/env node

/**
 * Test Runner for Mafia Game
 * This script helps you run the game server in test mode
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🎭 راه‌اندازی سرور تست بازی مافیا...\n');

// Check if MongoDB is available
async function checkMongoDB() {
    return new Promise((resolve) => {
        const mongoCheck = spawn('mongod', ['--version'], { stdio: 'ignore' });
        mongoCheck.on('close', (code) => {
            if (code === 0) {
                console.log('✅ MongoDB در دسترس است');
                resolve(true);
            } else {
                console.log('⚠️  MongoDB در دسترس نیست - سرور در حالت تست بدون دیتابیس اجرا می‌شود');
                resolve(false);
            }
        });
        mongoCheck.on('error', () => {
            console.log('⚠️  MongoDB در دسترس نیست - سرور در حالت تست بدون دیتابیس اجرا می‌شود');
            resolve(false);
        });
    });
}

// Create test environment file
function createTestEnv() {
    const envContent = `# Test Environment Configuration
PORT=3000
MONGODB_URI=mongodb://localhost:27017/mafia-game-test
JWT_SECRET=test-secret-key-change-in-production
NODE_ENV=test
`;
    
    const envPath = path.join(__dirname, '.env.test');
    fs.writeFileSync(envPath, envContent);
    console.log('📝 فایل تنظیمات تست ایجاد شد');
    return envPath;
}

// Start the server
async function startServer() {
    const mongoAvailable = await checkMongoDB();
    
    if (!mongoAvailable) {
        console.log('\n💡 برای استفاده کامل از بازی، MongoDB را نصب کنید:');
        console.log('   https://docs.mongodb.com/manual/installation/');
        console.log('\n🚀 سرور در حالت تست اجرا می‌شود...\n');
    }
    
    const envPath = createTestEnv();
    
    // Start server with test environment
    const server = spawn('node', ['server.js'], {
        stdio: 'inherit',
        env: {
            ...process.env,
            NODE_ENV: 'test',
            PORT: '3000'
        }
    });
    
    server.on('error', (error) => {
        console.error('❌ خطا در اجرای سرور:', error.message);
        process.exit(1);
    });
    
    server.on('close', (code) => {
        console.log(`\n🔄 سرور با کد ${code} بسته شد`);
        process.exit(code);
    });
    
    // Handle process termination
    process.on('SIGINT', () => {
        console.log('\n🛑 در حال بستن سرور...');
        server.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 در حال بستن سرور...');
        server.kill('SIGTERM');
    });
}

// Check if dependencies are installed
function checkDependencies() {
    const packagePath = path.join(__dirname, 'package.json');
    const nodeModulesPath = path.join(__dirname, 'node_modules');
    
    if (!fs.existsSync(packagePath)) {
        console.error('❌ فایل package.json یافت نشد');
        process.exit(1);
    }
    
    if (!fs.existsSync(nodeModulesPath)) {
        console.log('📦 نصب وابستگی‌ها...');
        const install = spawn('npm', ['install'], { stdio: 'inherit' });
        install.on('close', (code) => {
            if (code === 0) {
                console.log('✅ وابستگی‌ها نصب شدند');
                startServer();
            } else {
                console.error('❌ خطا در نصب وابستگی‌ها');
                process.exit(1);
            }
        });
    } else {
        startServer();
    }
}

// Main execution
if (require.main === module) {
    checkDependencies();
}

module.exports = { startServer, checkMongoDB }; 