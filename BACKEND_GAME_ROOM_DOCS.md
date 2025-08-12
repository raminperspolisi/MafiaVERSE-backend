# Backend Game Room Documentation

## 📋 **Overview**
این مستندات تمامی قابلیت‌های backend اتاق بازی مافیا را توضیح می‌دهد. سیستم شامل مدیریت اتاق‌ها در حافظه، API های RESTful و Socket.IO برای ارتباط real-time است.

## 🏗️ **Architecture**

### File Structure
```
mafia-web-app/
├── models/
│   └── GameRoom.js              # مدل اتاق بازی
├── utils/
│   └── roomManager.js           # مدیریت اتاق‌ها در حافظه
├── routes/
│   └── gameRoom.js              # API endpoints
├── server.js                    # سرور اصلی با Socket.IO
└── test-backend-game-room.js    # فایل تست
```

## 📊 **Data Models**

### GameRoom Class
```javascript
{
  id: "room_1234567890_abc123",
  name: "اتاق بازی 1",
  maxPlayers: 8,
  currentPlayers: [
    {
      id: "user_1",
      username: "احمد",
      role: "mafia",
      isReady: true,
      joinedAt: "2024-01-01T10:00:00Z",
      socketId: "socket_123"
    }
  ],
  status: "waiting", // waiting, starting, playing, finished
  createdAt: "2024-01-01T10:00:00Z",
  gameSettings: {
    mafiaCount: 2,
    doctorCount: 1,
    detectiveCount: 1,
    sniperCount: 1,
    bodyguardCount: 1,
    citizenCount: 2
  },
  ownerId: "user_1",
  isPrivate: false,
  password: null
}
```

## 🔌 **API Endpoints**

### Room Management

#### `POST /api/game-room/create`
ایجاد اتاق جدید
```javascript
// Request Body
{
  "name": "اتاق بازی",
  "maxPlayers": 8,
  "gameSettings": {
    "mafiaCount": 2,
    "doctorCount": 1,
    "detectiveCount": 1,
    "sniperCount": 1,
    "bodyguardCount": 1,
    "citizenCount": 2
  },
  "isPrivate": false,
  "password": null,
  "ownerId": "user_1"
}

// Response
{
  "success": true,
  "message": "اتاق با موفقیت ایجاد شد",
  "room": { /* room object */ }
}
```

#### `POST /api/game-room/join/:roomId`
پیوستن به اتاق
```javascript
// Request Body
{
  "userId": "user_1",
  "username": "احمد",
  "role": "mafia",
  "password": "123456" // اگر اتاق خصوصی باشد
}

// Response
{
  "success": true,
  "message": "با موفقیت به اتاق پیوستید",
  "room": { /* room object */ },
  "player": { /* player object */ }
}
```

#### `POST /api/game-room/leave/:roomId`
ترک اتاق
```javascript
// Request Body
{
  "userId": "user_1"
}

// Response
{
  "success": true,
  "message": "با موفقیت از اتاق خارج شدید",
  "room": { /* room object */ },
  "player": { /* player object */ }
}
```

#### `POST /api/game-room/ready/:roomId`
تغییر وضعیت آماده بودن
```javascript
// Request Body
{
  "userId": "user_1"
}

// Response
{
  "success": true,
  "message": "وضعیت آماده بودن احمد تغییر کرد",
  "room": { /* room object */ },
  "player": { /* player object */ }
}
```

#### `POST /api/game-room/start/:roomId`
شروع بازی
```javascript
// Request Body
{
  "userId": "user_1" // باید صاحب اتاق باشد
}

// Response
{
  "success": true,
  "message": "بازی شروع شد",
  "room": { /* room object */ },
  "gameData": {
    "players": [ /* players array */ ],
    "settings": { /* game settings */ }
  }
}
```

### Information Endpoints

#### `GET /api/game-room/list`
دریافت لیست اتاق‌های عمومی
```javascript
// Response
{
  "success": true,
  "rooms": [
    {
      "id": "room_123",
      "name": "اتاق بازی 1",
      "maxPlayers": 8,
      "currentPlayersCount": 3,
      "status": "waiting",
      "createdAt": "2024-01-01T10:00:00Z",
      "isPrivate": false,
      "ownerId": "user_1"
    }
  ],
  "count": 1
}
```

#### `GET /api/game-room/:roomId`
دریافت اطلاعات اتاق
```javascript
// Query Parameters
?userId=user_1 // برای بررسی عضویت

// Response
{
  "success": true,
  "room": { /* room object */ },
  "isMember": true
}
```

#### `GET /api/game-room/player/:userId`
دریافت اتاق بازیکن
```javascript
// Response
{
  "success": true,
  "room": { /* room object */ }
}
```

#### `GET /api/game-room/stats/overview`
دریافت آمار کلی
```javascript
// Response
{
  "success": true,
  "stats": {
    "totalRooms": 5,
    "totalPlayers": 15,
    "publicRooms": 3,
    "waitingRooms": 4,
    "playingRooms": 1
  }
}
```

### Challenge Endpoints

#### `POST /api/game-room/challenge/request/:roomId`
ثبت درخواست چالش توسط بازیکنی که گوینده نیست
```javascript
// Request Body
{
  "userId": "user_2"
}

// Response
{
  "success": true,
  "message": "درخواست چالش ثبت شد",
  "challenge": {
    "currentSpeakerId": "user_1",
    "requests": [
      { "userId": "user_2", "username": "zahra", "avatar": "", "timestamp": 1700000000, "approved": false }
    ],
    "approvedUserId": null,
    "active": false
  },
  "room": { /* full room info */ }
}
```

#### `POST /api/game-room/challenge/approve/:roomId`
تایید یکی از درخواست‌های چالش توسط گوینده فعلی
```javascript
// Request Body
{
  "approverUserId": "user_1",   // باید برابر با currentSpeakerId باشد
  "targetUserId": "user_2"
}

// Response
{
  "success": true,
  "message": "چالش تایید شد",
  "challenge": {
    "currentSpeakerId": "user_1",
    "requests": [
      { "userId": "user_2", "approved": true }
    ],
    "approvedUserId": "user_2",
    "active": false
  },
  "room": { /* full room info */ }
}
```

#### `POST /api/game-room/speech/end/:roomId`
پایان صحبت گوینده و در صورت وجود تایید، شروع چالش 40 ثانیه‌ای برای فرد تایید شده
```javascript
// Request Body
{
  "speakerUserId": "user_1"
}

// Response
{
  "success": true,
  "result": {
    // اگر چالش تایید شده باشد
    "startedChallengeFor": "user_2"
    // در غیر اینصورت
    // "nextSpeakerId": "user_3"
  },
  "challenge": {
    "currentSpeakerId": "user_1",
    "approvedUserId": "user_2",
    "active": true
  },
  "speaking": {
    "currentSpeakerId": "user_1",
    "speakingQueue": [ "user_1", "user_2", "user_3" ]
  },
  "room": { /* full room info */ }
}
```

#### `GET /api/game-room/speaking/:roomId`
دریافت وضعیت نوبت صحبت و چالش
```javascript
// Response
{
  "success": true,
  "speaking": {
    "currentSpeakerId": "user_1",
    "speakingQueue": ["user_1","user_2","user_3"],
    "challenge": {
      "currentSpeakerId": "user_1",
      "approvedUserId": null,
      "requests": [],
      "active": false
    }
  }
}
```

## 🔌 **Socket.IO Events**

### Client to Server Events

#### `join-game-room`
پیوستن به اتاق
```javascript
socket.emit('join-game-room', {
  roomId: 'room_123',
  userId: 'user_1',
  username: 'احمد',
  role: 'mafia',
  password: '123456' // اختیاری
});
```

#### `leave-game-room`
ترک اتاق
```javascript
socket.emit('leave-game-room', {
  roomId: 'room_123',
  userId: 'user_1'
});
```

#### `toggle-ready`
تغییر وضعیت آماده بودن
```javascript
socket.emit('toggle-ready', {
  roomId: 'room_123',
  userId: 'user_1'
});
```

#### `start-game`
شروع بازی
```javascript
socket.emit('start-game', {
  roomId: 'room_123',
  userId: 'user_1'
});
```

#### `get-room-info`
دریافت اطلاعات اتاق
```javascript
socket.emit('get-room-info', {
  roomId: 'room_123',
  userId: 'user_1'
});
```

#### `get-rooms-list`
دریافت لیست اتاق‌ها
```javascript
socket.emit('get-rooms-list');
```

#### `get-stats`
دریافت آمار
```javascript
socket.emit('get-stats');
```

#### Waiting Lobby (Matchmaking)
- `start-matchmaking` پیوستن به صف انتظار شروع بازی
```javascript
socket.emit('start-matchmaking', {
  userId: 'u1',
  username: 'user1',
  firstName: 'نام',
  lastName: 'نام‌خانوادگی'
});
```

- `leave-waiting` خروج از صف انتظار
```javascript
socket.emit('leave-waiting');
```

- سازگاری قدیمی: `join-waiting` (ترجیحاً استفاده نشود)

### Server to Client Events

#### `player-joined`
اطلاع‌رسانی ورود بازیکن
```javascript
socket.on('player-joined', (data) => {
  console.log('بازیکن جدید:', data.player);
  console.log('اطلاعات اتاق:', data.room);
});
```

#### `player-left`
اطلاع‌رسانی خروج بازیکن
```javascript
socket.on('player-left', (data) => {
  console.log('بازیکن خارج شد:', data.playerId);
  console.log('اطلاعات اتاق:', data.room);
});
```

#### `player-ready-changed`
تغییر وضعیت آماده بودن
```javascript
socket.on('player-ready-changed', (data) => {
  console.log('وضعیت تغییر کرد:', data.player);
  console.log('اطلاعات اتاق:', data.room);
});
```

#### `game-starting`
شروع بازی
```javascript
socket.on('game-starting', (data) => {
  console.log('بازی شروع می‌شود:', data.countdown);
  console.log('اطلاعات بازی:', data.gameData);
});
```

#### `game-countdown`
شمارش معکوس
```javascript
socket.on('game-countdown', (data) => {
  console.log('شمارش معکوس:', data.countdown);
});
```

#### `game-started`
بازی شروع شد
```javascript
socket.on('game-started', (data) => {
  console.log('بازی شروع شد!');
  console.log('اطلاعات بازی:', data.gameData);
});
```

#### `room-joined`
پیوستن موفق به اتاق
```javascript
socket.on('room-joined', (data) => {
  console.log('به اتاق پیوستید:', data.room);
  console.log('اطلاعات شما:', data.player);
});
```

#### `room-left`
ترک موفق اتاق
```javascript
socket.on('room-left', (data) => {
  console.log('پیام:', data.message);
});
```

#### `room-info`
اطلاعات اتاق
```javascript
socket.on('room-info', (data) => {
  console.log('اطلاعات اتاق:', data.room);
  console.log('عضو هستید:', data.isMember);
});
```

#### `rooms-list`
لیست اتاق‌ها
```javascript
socket.on('rooms-list', (data) => {
  console.log('اتاق‌ها:', data.rooms);
  console.log('تعداد:', data.count);
});
```

#### `stats`
آمار
```javascript
socket.on('stats', (data) => {
  console.log('آمار:', data.stats);
});
```

#### `error`
خطا
```javascript
socket.on('error', (message) => {
  console.error('خطا:', message);
});
```

#### Waiting Lobby Events
- `waiting-players-updated` بروزرسانی شمارنده و لیست منتظران
```javascript
socket.on('waiting-players-updated', ({ count, players }) => {
  // count: عدد افراد منتظر (هدف: 10)
});
```

- وقتی تعداد به 10 رسید:
  - `game-started` برای اتاق بازی جدید (عمومی)
  - `role-assigned` فقط برای هر بازیکن به صورت خصوصی

#### Challenge Events
- `challenge-requests-updated` بروزرسانی لیست درخواست‌های چالش و وضعیت تایید
- `challenge-started` شروع چالش 40 ثانیه‌ای برای فرد تایید شده
- `challenge-tick` ثانیه‌شمار چالش
- `challenge-ended` پایان چالش
- `speaking-updated` بروزرسانی گوینده فعلی و صف صحبت

## 🧠 **Memory Management**

### Features
- **In-Memory Storage**: تمامی اتاق‌ها در Map ذخیره می‌شوند
- **Automatic Cleanup**: اتاق‌های خالی و قدیمی خودکار حذف می‌شوند
- **Player Tracking**: هر بازیکن فقط در یک اتاق می‌تواند باشد
- **Graceful Shutdown**: هنگام خاموش شدن سرور، همه داده‌ها پاک می‌شوند

### Cleanup Process
- هر 5 دقیقه اتاق‌های قدیمی بررسی می‌شوند
- اتاق‌های خالی که بیش از 30 دقیقه عمر دارند حذف می‌شوند
- هنگام قطع اتصال کاربر، او از اتاق خارج می‌شود

## 🔒 **Security & Validation**

### Input Validation
- بررسی وجود فیلدهای اجباری
- اعتبارسنجی تعداد بازیکنان
- بررسی دسترسی به اتاق‌های خصوصی
- جلوگیری از پیوستن مجدد به اتاق

### Error Handling
- خطاهای اعتبارسنجی با پیام‌های فارسی
- مدیریت خطاهای Socket.IO
- Logging کامل تمام عملیات

## 📈 **Monitoring & Statistics**

### Available Stats
- تعداد کل اتاق‌ها
- تعداد کل بازیکنان
- تعداد اتاق‌های عمومی
- تعداد اتاق‌های در انتظار
- تعداد اتاق‌های در حال بازی

### Logging
- ورود و خروج بازیکنان
- تغییر وضعیت آماده بودن
- شروع بازی
- خطاها و استثناها

## 🚀 **Usage Examples**

### Frontend Integration

#### Connecting to Socket.IO
```javascript
const socket = io('http://localhost:3000');

socket.on('connect', () => {
  console.log('متصل شدید:', socket.id);
});
```

#### Creating a Room
```javascript
// API Call
const response = await fetch('/api/game-room/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'اتاق من',
    maxPlayers: 8,
    ownerId: 'user_1'
  })
});

const data = await response.json();
console.log('اتاق ایجاد شد:', data.room);
```

#### Joining a Room
```javascript
// Socket.IO
socket.emit('join-game-room', {
  roomId: 'room_123',
  userId: 'user_1',
  username: 'احمد',
  role: 'mafia'
});

socket.on('room-joined', (data) => {
  console.log('به اتاق پیوستید:', data.room);
});
```

#### Starting a Game
```javascript
socket.emit('start-game', {
  roomId: 'room_123',
  userId: 'user_1'
});

socket.on('game-starting', (data) => {
  console.log('بازی شروع می‌شود در:', data.countdown);
});

socket.on('game-started', (data) => {
  console.log('بازی شروع شد!');
  // Navigate to game screen
});
```

## 🧪 **Testing**

### Running Tests
```bash
node test-backend-game-room.js
```

### Test Coverage
- ایجاد و مدیریت اتاق‌ها
- پیوستن و ترک بازیکنان
- تغییر وضعیت آماده بودن
- شروع بازی
- مدیریت حافظه
- آمار و monitoring

## 🔮 **Future Enhancements**

### Planned Features
- **Database Integration**: ذخیره اتاق‌ها در دیتابیس
- **Authentication**: سیستم احراز هویت کامل
- **Room Persistence**: ذخیره اتاق‌ها بین restart ها
- **Advanced Statistics**: آمار پیشرفته‌تر
- **Room Templates**: قالب‌های از پیش تعریف شده
- **Moderation Tools**: ابزارهای مدیریتی

### Performance Optimizations
- **Redis Integration**: برای scalability بهتر
- **Load Balancing**: توزیع بار
- **Caching**: کش کردن داده‌های پرتکرار
- **Compression**: فشرده‌سازی داده‌ها

## 🧪 Testing Utilities (Waiting Lobby)

### `POST /api/waiting/spawn-bots`
افزودن کاربران تست به صف انتظار تا همه در لابی مشاهده کنند. در صورت رسیدن تعداد به 10، بازی خودکار شروع می‌شود.

```bash
curl -X POST http://localhost:3000/api/waiting/spawn-bots -H "Content-Type: application/json" -d "{\"count\":9}"
```

- Body:
```json
{
  "count": 9
}
```
- Response نمونه:
```json
{
  "success": true,
  "count": 10
}
```

### `POST /api/waiting/clear-bots`
حذف همه ربات‌ها از صف انتظار.

```bash
curl -X POST http://localhost:3000/api/waiting/clear-bots
```

- Response نمونه:
```json
{
  "success": true,
  "count": 1
}
```

---

**این مستندات تمامی قابلیت‌های backend اتاق بازی را پوشش می‌دهد. برای سوالات بیشتر یا درخواست ویژگی‌های جدید، لطفاً با تیم توسعه تماس بگیرید.** 