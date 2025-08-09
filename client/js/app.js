// Main Application Class
class MafiaGameApp {
    constructor() {
        this.socket = null;
        this.currentUser = null;
        this.currentSection = 'login';
        this.gameState = {
            isInGame: false,
            isInWaiting: false,
            gameId: null,
            role: null,
            phase: null,
            day: 1,
            timer: 0
        };
        
        this.init();
    }

    init() {
        this.showLoadingScreen();
        this.bindEvents();
        this.checkAuthStatus();
        
        // Hide loading screen after initialization
        setTimeout(() => {
            this.hideLoadingScreen();
        }, 2000);
    }

    showLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.display = 'flex';
        }
    }

    hideLoadingScreen() {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                loadingScreen.style.display = 'none';
            }, 500);
        }
    }

    bindEvents() {
        // Form submissions
        document.getElementById('login-form').addEventListener('submit', this.handleLogin.bind(this));
        document.getElementById('register-form').addEventListener('submit', this.handleRegister.bind(this));
        
        // Chat input
        const chatInput = document.getElementById('chat-input');
        if (chatInput) {
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendMessage();
                }
            });
        }

        // Window events
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
    }

    checkAuthStatus() {
        const token = localStorage.getItem('token');
        if (token) {
            this.validateToken(token);
        } else {
            this.showSection('login');
        }
    }

    async validateToken(token) {
        try {
            const response = await fetch('/api/auth/me', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.currentUser = data.user;
                this.initializeSocket();
                this.showSection('home');
                this.updateNavbar();
                this.loadGlobalStats();
            } else {
                localStorage.removeItem('token');
                this.showSection('login');
            }
        } catch (error) {
            console.error('Token validation error:', error);
            localStorage.removeItem('token');
            this.showSection('login');
        }
    }

    initializeSocket() {
        if (this.socket) {
            this.socket.disconnect();
        }

        this.socket = io({
            auth: {
                token: localStorage.getItem('token')
            }
        });

        this.bindSocketEvents();
    }

    bindSocketEvents() {
        // Connection events
        this.socket.on('connect', () => {
            console.log('Connected to server');
            this.updateGameStatus('متصل به سرور', '✅');
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from server');
            this.updateGameStatus('قطع اتصال از سرور', '❌');
        });

        // Waiting room events
        this.socket.on('waiting-players-updated', (players) => {
            this.updateWaitingPlayers(players);
        });

        // Game events
        this.socket.on('game-started', (gameData) => {
            this.handleGameStart(gameData);
        });

        this.socket.on('role-assigned', (roleData) => {
            this.handleRoleAssignment(roleData);
        });

        this.socket.on('phase-changed', (phaseData) => {
            this.handlePhaseChange(phaseData);
        });

        this.socket.on('night-results', (results) => {
            this.handleNightResults(results);
        });

        this.socket.on('player-eliminated', (data) => {
            this.handlePlayerElimination(data);
        });

        this.socket.on('game-ended', (endData) => {
            this.handleGameEnd(endData);
        });

        this.socket.on('vote-cast', (voteData) => {
            this.handleVoteCast(voteData);
        });

        this.socket.on('action-confirmed', (data) => {
            this.showToast(data.message, 'success');
        });

        this.socket.on('investigation-result', (result) => {
            this.handleInvestigationResult(result);
        });

        // Chat events
        this.socket.on('new-message', (messageData) => {
            this.addChatMessage(messageData);
        });

        // Error events
        this.socket.on('error', (errorMessage) => {
            this.showToast(errorMessage, 'error');
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        const loginData = {
            username: formData.get('username'),
            password: formData.get('password')
        };

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                this.currentUser = data.user;
                this.showToast(data.message, 'success');
                this.initializeSocket();
                this.showSection('home');
                this.updateNavbar();
                this.loadGlobalStats();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('خطا در ورود به سیستم', 'error');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const formData = new FormData(e.target);
        
        // Validate password confirmation
        const password = formData.get('password');
        const confirmPassword = formData.get('confirmPassword');
        
        if (password !== confirmPassword) {
            this.showToast('رمز عبور و تکرار آن یکسان نیستند', 'error');
            return;
        }

        const registerData = {
            firstName: formData.get('firstName'),
            lastName: formData.get('lastName'),
            username: formData.get('username'),
            email: formData.get('email'),
            password: password,
            phoneNumber: formData.get('phoneNumber'),
            referralCode: formData.get('referralCode')
        };

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('token', data.token);
                this.currentUser = data.user;
                this.showToast(data.message, 'success');
                this.initializeSocket();
                this.showSection('home');
                this.updateNavbar();
                this.loadGlobalStats();
            } else {
                this.showToast(data.message, 'error');
            }
        } catch (error) {
            console.error('Register error:', error);
            this.showToast('خطا در ثبت نام', 'error');
        }
    }

    showSection(sectionName) {
        // Hide all sections
        document.querySelectorAll('.auth-section, .main-section').forEach(section => {
            section.classList.remove('active');
        });

        // Show target section
        const targetSection = document.getElementById(`${sectionName}-section`);
        if (targetSection) {
            targetSection.classList.add('active');
            targetSection.classList.add('fade-in');
        }

        // Show/hide navbar
        const navbar = document.getElementById('navbar');
        if (sectionName === 'login' || sectionName === 'register') {
            navbar.classList.add('hidden');
        } else {
            navbar.classList.remove('hidden');
        }

        this.currentSection = sectionName;

        // Load section-specific data
        switch (sectionName) {
            case 'profile':
                this.loadProfile();
                break;
            case 'leaderboard':
                this.loadLeaderboard();
                break;
        }
    }

    updateNavbar() {
        if (!this.currentUser) return;

        const navUser = document.getElementById('nav-user');
        navUser.innerHTML = `
            <div class="user-info">
                <span class="user-name">${this.currentUser.firstName} ${this.currentUser.lastName}</span>
                <span class="user-level">سطح ${this.currentUser.level}</span>
            </div>
            <div class="user-avatar">
                ${this.currentUser.firstName.charAt(0)}${this.currentUser.lastName.charAt(0)}
            </div>
        `;
    }

    updateGameStatus(message, icon = '⏳') {
        const statusCard = document.querySelector('.status-card');
        if (statusCard) {
            statusCard.querySelector('.status-icon').textContent = icon;
            statusCard.querySelector('.status-text').textContent = message;
        }
    }

    async loadGlobalStats() {
        try {
            const response = await fetch('/api/game/global-stats');
            const data = await response.json();

            if (data.success) {
                document.getElementById('online-users').textContent = data.stats.activeUsers;
                document.getElementById('total-games').textContent = data.stats.totalGames;
                document.getElementById('citizen-win-rate').textContent = `${data.stats.citizenWinRate}%`;
            }
        } catch (error) {
            console.error('Error loading global stats:', error);
        }
    }

    joinWaitingRoom() {
        if (!this.socket || !this.currentUser) return;

        this.socket.emit('join-waiting', {
            userId: this.currentUser._id,
            username: this.currentUser.username,
            firstName: this.currentUser.firstName,
            lastName: this.currentUser.lastName
        });

        this.gameState.isInWaiting = true;
        this.showSection('waiting');
        this.updateGameStatus('در اتاق انتظار', '⏳');
    }

    leaveWaitingRoom() {
        this.gameState.isInWaiting = false;
        this.showSection('home');
        this.updateGameStatus('متصل به سرور', '✅');
    }

    updateWaitingPlayers(players) {
        const waitingPlayers = document.getElementById('waiting-players');
        const waitingCount = document.getElementById('waiting-count');
        
        waitingCount.textContent = players.length;
        
        waitingPlayers.innerHTML = players.map(player => `
            <div class="player-item">
                <div class="player-avatar">
                    ${player.firstName.charAt(0)}${player.lastName.charAt(0)}
                </div>
                <div class="player-name">
                    ${player.firstName} ${player.lastName}
                </div>
            </div>
        `).join('');
    }

    handleGameStart(gameData) {
        this.gameState.isInGame = true;
        this.gameState.isInWaiting = false;
        this.gameState.gameId = gameData.gameId;
        this.showSection('game');
        this.updateGamePlayers(gameData.players);
        this.showToast('بازی شروع شد!', 'success');
    }

    handleRoleAssignment(roleData) {
        this.gameState.role = roleData.role;
        this.updateRoleInfo(roleData);
    }

    updateRoleInfo(roleData) {
        const roleInfo = document.getElementById('role-info');
        const roleNames = {
            'mafia': '🔪 مافیا',
            'doctor': '👨‍⚕️ دکتر',
            'detective': '🕵️ کارآگاه',
            'citizen': '👤 شهروند'
        };

        roleInfo.innerHTML = `
            <div class="role-title">${roleNames[roleData.role]}</div>
            <div class="role-description">${roleData.roleDescription}</div>
        `;
    }

    handlePhaseChange(phaseData) {
        this.gameState.phase = phaseData.phase;
        this.gameState.day = phaseData.day;
        
        document.getElementById('game-phase').textContent = 
            `${phaseData.phase === 'night' ? 'شب' : phaseData.phase === 'day' ? 'روز' : 'رای‌گیری'} ${phaseData.day}`;
        
        this.addChatMessage({
            username: 'سیستم',
            message: phaseData.message,
            type: 'system',
            timestamp: new Date()
        });

        this.updateGameActions();
    }

    updateGamePlayers(players) {
        const playersGrid = document.getElementById('players-grid');
        
        playersGrid.innerHTML = players.map(player => `
            <div class="player-card ${player.isAlive ? '' : 'dead'}" data-username="${player.username}">
                <div class="player-card-avatar">
                    ${player.firstName.charAt(0)}${player.lastName.charAt(0)}
                </div>
                <div class="player-card-name">${player.firstName} ${player.lastName}</div>
                <div class="player-card-status">${player.isAlive ? 'زنده' : 'مرده'}</div>
            </div>
        `).join('');
    }

    updateGameActions() {
        const gameActions = document.getElementById('game-actions');
        const { phase, role } = this.gameState;
        
        if (phase === 'night') {
            if (role === 'mafia') {
                gameActions.innerHTML = `
                    <h3>انتخاب هدف برای کشتن</h3>
                    <p>روی یک بازیکن کلیک کنید</p>
                `;
                this.makePlayersSelectable('mafia-action');
            } else if (role === 'doctor') {
                gameActions.innerHTML = `
                    <h3>انتخاب فرد برای محافظت</h3>
                    <p>روی یک بازیکن کلیک کنید</p>
                `;
                this.makePlayersSelectable('doctor-action');
            } else if (role === 'detective') {
                gameActions.innerHTML = `
                    <h3>انتخاب فرد برای بررسی</h3>
                    <p>روی یک بازیکن کلیک کنید</p>
                `;
                this.makePlayersSelectable('detective-action');
            } else {
                gameActions.innerHTML = `
                    <h3>در انتظار...</h3>
                    <p>سایر بازیکنان در حال اقدام هستند</p>
                `;
            }
        } else if (phase === 'voting') {
            gameActions.innerHTML = `
                <h3>رای‌گیری برای حذف</h3>
                <p>روی یک بازیکن کلیک کنید</p>
            `;
            this.makePlayersSelectable('vote');
        } else {
            gameActions.innerHTML = `
                <h3>بحث و گفتگو</h3>
                <p>در مورد هویت مافیا بحث کنید</p>
            `;
        }
    }

    makePlayersSelectable(actionType) {
        const playerCards = document.querySelectorAll('.player-card:not(.dead)');
        
        playerCards.forEach(card => {
            card.classList.add('selectable');
            card.onclick = () => {
                // Remove previous selection
                document.querySelectorAll('.player-card.selected').forEach(c => c.classList.remove('selected'));
                
                // Select current card
                card.classList.add('selected');
                
                const username = card.dataset.username;
                this.socket.emit(actionType, { target: username });
            };
        });
    }

    sendMessage() {
        const chatInput = document.getElementById('chat-input');
        const message = chatInput.value.trim();
        
        if (message && this.socket) {
            this.socket.emit('send-message', {
                username: this.currentUser.username,
                message: message
            });
            chatInput.value = '';
        }
    }

    addChatMessage(messageData) {
        const chatMessages = document.getElementById('chat-messages');
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${messageData.type || ''}`;
        
        const timestamp = new Date(messageData.timestamp).toLocaleTimeString('fa-IR');
        
        messageElement.innerHTML = `
            ${messageData.type !== 'system' ? `<div class="chat-username">${messageData.username}</div>` : ''}
            <div class="chat-text">${messageData.message}</div>
            <div class="chat-timestamp">${timestamp}</div>
        `;
        
        chatMessages.appendChild(messageElement);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toast-container');
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        
        toastContainer.appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);
    }

    async loadProfile() {
        try {
            const [statsResponse, historyResponse] = await Promise.all([
                fetch('/api/game/stats', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                }),
                fetch('/api/game/history?limit=5', {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
                })
            ]);

            const statsData = await statsResponse.json();
            const historyData = await historyResponse.json();

            if (statsData.success) {
                this.updateProfileStats(statsData.stats);
            }

            if (historyData.success) {
                this.updateGameHistory(historyData.games);
            }
        } catch (error) {
            console.error('Error loading profile:', error);
        }
    }

    updateProfileStats(stats) {
        const profileInfo = document.getElementById('profile-info');
        const profileStats = document.getElementById('profile-stats');

        profileInfo.innerHTML = `
            <div class="profile-stat">
                <div class="profile-stat-value">${stats.level}</div>
                <div class="profile-stat-label">سطح</div>
            </div>
            <div class="profile-stat">
                <div class="profile-stat-value">${stats.experience}</div>
                <div class="profile-stat-label">امتیاز</div>
            </div>
            <div class="profile-stat">
                <div class="profile-stat-value">${stats.totalGames}</div>
                <div class="profile-stat-label">کل بازی‌ها</div>
            </div>
            <div class="profile-stat">
                <div class="profile-stat-value">${stats.winRate}%</div>
                <div class="profile-stat-label">درصد برد</div>
            </div>
        `;

        profileStats.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">🏆</div>
                <div class="stat-value">${stats.wins}</div>
                <div class="stat-label">برد</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">💀</div>
                <div class="stat-value">${stats.losses}</div>
                <div class="stat-label">باخت</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">❤️</div>
                <div class="stat-value">${stats.survivalRate}%</div>
                <div class="stat-label">بقا</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">⏱️</div>
                <div class="stat-value">${stats.averageGameDuration}</div>
                <div class="stat-label">متوسط مدت (دقیقه)</div>
            </div>
        `;
    }

    updateGameHistory(games) {
        const gameHistory = document.getElementById('game-history');
        
        gameHistory.innerHTML = games.map(game => `
            <div class="history-item">
                <div class="history-game">
                    <div class="history-result ${game.userResult}">
                        ${game.userResult === 'win' ? '🏆 برد' : '💀 باخت'}
                    </div>
                    <div class="history-info">
                        <div>${game.userRole === 'mafia' ? '🔪 مافیا' : 
                              game.userRole === 'doctor' ? '👨‍⚕️ دکتر' :
                              game.userRole === 'detective' ? '🕵️ کارآگاه' : '👤 شهروند'}</div>
                        <div class="history-date">${new Date(game.endTime).toLocaleDateString('fa-IR')}</div>
                    </div>
                </div>
            </div>
        `).join('');
    }

    async loadLeaderboard() {
        try {
            const response = await fetch('/api/auth/leaderboard');
            const data = await response.json();

            if (data.success) {
                this.updateLeaderboard(data.leaderboard);
            }
        } catch (error) {
            console.error('Error loading leaderboard:', error);
        }
    }

    updateLeaderboard(leaderboard) {
        const leaderboardContent = document.getElementById('leaderboard-content');
        
        leaderboardContent.innerHTML = leaderboard.map((user, index) => {
            const rankClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : '';
            
            return `
                <div class="leaderboard-item">
                    <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                    <div class="leaderboard-avatar">
                        ${user.firstName.charAt(0)}${user.lastName.charAt(0)}
                    </div>
                    <div class="leaderboard-info">
                        <div class="leaderboard-name">${user.firstName} ${user.lastName}</div>
                        <div class="leaderboard-stats">
                            ${user.gameStats.totalGames} بازی • ${user.winRate}% برد
                        </div>
                    </div>
                    <div class="leaderboard-level">سطح ${user.level}</div>
                </div>
            `;
        }).join('');
    }

    logout() {
        localStorage.removeItem('token');
        if (this.socket) {
            this.socket.disconnect();
        }
        this.currentUser = null;
        this.gameState = {
            isInGame: false,
            isInWaiting: false,
            gameId: null,
            role: null,
            phase: null,
            day: 1,
            timer: 0
        };
        this.showSection('login');
    }

    handleBeforeUnload() {
        if (this.socket) {
            this.socket.disconnect();
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.mafiaApp = new MafiaGameApp();
});

// Global functions for UI interaction
function showSection(sectionName) {
    if (window.mafiaApp) {
        window.mafiaApp.showSection(sectionName);
    }
}

function joinWaitingRoom() {
    if (window.mafiaApp) {
        window.mafiaApp.joinWaitingRoom();
    }
}

function leaveWaitingRoom() {
    if (window.mafiaApp) {
        window.mafiaApp.leaveWaitingRoom();
    }
}

function sendMessage() {
    if (window.mafiaApp) {
        window.mafiaApp.sendMessage();
    }
}

function logout() {
    if (window.mafiaApp) {
        window.mafiaApp.logout();
    }
} 