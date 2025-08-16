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
  password: null,
  gamePhase: "waiting" // waiting, introduction, night, day
}
```

## 🎭 **Gunner Scenario Roles**

### **سناریوی تفنگدار (10 بازیکن)**

#### **شهروندان (7 نفر):**
1. **دکتر** - می‌تواند هر شب یک نفر را محافظت کند
2. **نگهبان** - مهارت‌های محافظتی دارد
3. **کارآگاه** - می‌تواند هر شب هویت یک نفر را بررسی کند
4. **تکاور** - مهارت‌های ویژه نظامی
5. **تفنگدار** - می‌تواند هر شب یک نفر را بکشید
6. **شهروند ساده اول** - شهروند معمولی
7. **شهروند ساده دوم** - شهروند معمولی

#### **مافیا (3 نفر):**
1. **پدرخوانده** - رهبر مافیا، می‌تواند با دکتر لکتر در شب صحبت کند
2. **دکتر لکتر** - عضو مافیا، می‌تواند با پدرخوانده در شب صحبت کند
3. **گروگانگیر** - عضو مافیا، همه مافیا را می‌بیند اما با هیچ‌کس نمی‌تواند صحبت کند

### **فازهای بازی:**
1. **فاز معرفی** - همه بازیکنان صحبت می‌کنند
2. **شب معارفه** - 1 دقیقه، ماسک‌ها برداشته می‌شود
3. **روز اول** - شروع بازی اصلی

### **قوانین شب معارفه:**
- **مدت زمان**: دقیقاً 1 دقیقه (60 ثانیه)
- **ماسک‌ها**: همه آواتارها ماسک دار (🎭)
- **پدرخوانده + دکتر لکتر**: می‌توانند همدیگر را ببینند و صحبت کنند
- **گروگانگیر**: همه مافیا را می‌بیند اما نمی‌تواند صحبت کند
- **شهروندان**: خواب هستند، چیزی نمی‌بینند

## 🗣️ نوبت‌های صحبت ۶۰ ثانیه‌ای

برای فاز معرفی و روز، سیستم نوبت صحبت زمان‌دار پیاده‌سازی شده است تا هر بازیکن به مدت ۶۰ ثانیه صحبت کند. با اتمام زمان، نوبت به صورت خودکار به نفر بعد منتقل می‌شود. در صورت وجود چالش تایید‌شده، ابتدا چالش اجرا و سپس نوبت بعدی شروع می‌شود.

### جریان اجرا (Flow)
- **شروع بازی**: پس از `game-started` در فاز معرفی، نوبت نفر اول با ۶۰ ثانیه آغاز می‌شود.
- **پایان شب → شروع روز**: بعد از `night-ended` و انتشار `speaking-updated`، نوبت ۶۰ ثانیه‌ای نفر اول روز شروع می‌شود.
- **پایان صحبت دستی گوینده (`end-speech`)**:
  - اگر چالش تایید شده باشد: چالش ۴۰ ثانیه اجرا می‌شود؛ پس از `challenge-ended` نوبت ۶۰ ثانیه‌ای نفر بعد آغاز می‌شود.
  - اگر چالش نباشد: بلافاصله نوبت ۶۰ ثانیه‌ای نفر بعد شروع می‌شود.

### رویدادهای Socket.IO (Server → Client)
- `speaking-started`:
  - Payload: `{ roomId, currentSpeakerId, duration }`
  - معنی: شروع نوبت صحبت گوینده فعلی با مدت مشخص (پیش‌فرض ۶۰).
- `speaking-tick`:
  - Payload: `{ roomId, currentSpeakerId, secondsLeft }`
  - معنی: شمارش معکوس هر ثانیه.
- `speaking-ended`:
  - Payload: `{ roomId, speakerUserId }`
  - معنی: اتمام نوبت صحبت گوینده.
- `speaking-updated`:
  - Payload: `{ roomId, currentSpeakerId, speakingQueue, challenge }`
  - معنی: اعلام گوینده جدید و وضعیت صف/چالش.
- `speaking-all-done`:
  - Payload: `{ roomId }`
  - معنی: همه افراد در این فاز صحبت کرده‌اند.

### وظایف سمت کلاینت
- روی `speaking-started`: میکروفن گوینده فعلی را باز و میکروفن سایرین را ببندید؛ تایمر UI را شروع کنید.
- روی `speaking-tick`: تایمر UI را به‌روزرسانی کنید.
- روی `speaking-ended`: میکروفن گوینده را ببندید.
- روی `speaking-updated`: گوینده جدید را هایلایت و اگر خود کاربر است، میکروفن را باز کنید.
- روی `speaking-all-done`: پیام اتمام نوبت‌ها/مرحله را نمایش دهید.

### تغییرات سمت سرور (server.js)
- افزودن تابع `startSpeakingTurn(roomId, durationSec = 60)` برای مدیریت نوبت صحبت و ارسال رویدادهای مرتبط.
- شروع خودکار نوبت صحبت:
  - بعد از `game-started` در هندلر `start-game`.
  - بعد از `night-ended` در `endNightPhase()`.
  - بعد از پایان چالش یا انتقال به نفر بعدی در هندلر `end-speech`.
- استفاده از `roomTimers` برای پاک‌سازی تایمر قبلی هر اتاق.

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

#### Night Phase Events
- `night-started` شروع فاز شب معارفه
```javascript
socket.on('night-started', (data) => {
  console.log('شب شروع شد:', data.gameId);
  console.log('مدت زمان:', data.duration); // 60 ثانیه
});
```

- `night-role-info` اطلاعات نقش‌های خاص در شب
```javascript
socket.on('night-role-info', (data) => {
  console.log('نقش شما:', data.role);
  console.log('می‌توانید ارتباط برقرار کنید:', data.canCommunicate);
  console.log('بازیکنان قابل مشاهده:', data.visiblePlayers);
});
```

- `night-countdown` شمارش معکوس شب
```javascript
socket.on('night-countdown', (data) => {
  console.log('زمان باقی‌مانده:', data.secondsLeft);
});
```

- `night-ended` پایان فاز شب
```javascript
socket.on('night-ended', (data) => {
  console.log('شب پایان یافت، روز شروع شد');
  console.log('روز:', data.day);
});
```

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

### `POST /api/waiting/add-one-bot`
افزودن یک ربات تستی در هر درخواست (برای کنترل بهتر تعداد).

```bash
curl -X POST http://localhost:3000/api/waiting/add-one-bot
```

- Response نمونه:
```json
{
  "success": true,
  "count": 3,
  "addedBot": {
    "userId": "bot_1_abc12",
    "username": "ربات_1",
    "firstName": "ربات",
    "lastName": "1"
  }
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

### `GET /api/waiting/lobby`
مشاهده لابی ذخیره‌شده در دیتابیس (شامل همه کاربران منتظر).

```bash
curl -s http://localhost:3000/api/waiting/lobby
```

- Response نمونه:
```json
{
  "success": true,
  "lobby": {
    "lobbyId": "default",
    "players": [
      {
        "userId": "u1",
        "username": "user1",
        "firstName": "نام",
        "lastName": "نام‌خانوادگی",
        "isBot": false,
        "socketId": null
      },
      {
        "userId": "bot_1_abc12",
        "username": "ربات_1",
        "firstName": "ربات",
        "lastName": "1",
        "isBot": true,
        "socketId": null
      }
    ],
    "updatedAt": "2024-01-01T10:00:00.000Z"
  }
}
```

### `POST /api/waiting/lobby/save`
ذخیره دستی لیست کاربران در لابی (برای تست با کاربران دلخواه).

```bash
curl -X POST http://localhost:3000/api/waiting/lobby/save -H "Content-Type: application/json" -d "{\"players\":[{\"userId\":\"u1\",\"username\":\"user1\"},{\"userId\":\"u2\",\"username\":\"user2\"},{\"userId\":\"u3\",\"username\":\"user3\"},{\"userId\":\"u4\",\"username\":\"user4\"},{\"userId\":\"u5\",\"username\":\"user5\"},{\"userId\":\"u6\",\"username\":\"user6\"},{\"userId\":\"u7\",\"username\":\"user7\"},{\"userId\":\"u8\",\"username\":\"user8\"},{\"userId\":\"u9\",\"username\":\"user9\"},{\"userId\":\"u10\",\"username\":\"user10\"}]}"
```

- Body:
```json
{
  "players": [
    {
      "userId": "u1",
      "username": "user1",
      "firstName": "نام",
      "lastName": "نام‌خانوادگی"
    },
    {
      "userId": "u2", 
      "username": "user2",
      "firstName": "نام",
      "lastName": "نام‌خانوادگی"
    }
  ]
}
```

- Response نمونه:
```json
{
  "success": true,
  "count": 2
}
```

## 💾 **Data Persistence (TestLobby)**

### TestLobby Model
مدل MongoDB برای ذخیره‌سازی لابی انتظار تستی:

```javascript
const testLobbySchema = new mongoose.Schema({
  lobbyId: { type: String, default: 'default', unique: true, index: true },
  players: [{
    userId: { type: String, required: true },
    username: { type: String, required: true },
    firstName: { type: String, default: '' },
    lastName: { type: String, default: '' },
    isBot: { type: Boolean, default: false },
    socketId: { type: String, default: null }
  }],
  updatedAt: { type: Date, default: Date.now }
});
```

### Persistence Features
- **Auto-save**: هر بار که `broadcastWaiting` فراخوانی می‌شود، لابی در MongoDB ذخیره می‌شود
- **Auto-restore**: هنگام استارت سرور، لابی از MongoDB بازیابی می‌شود
- **Bot Detection**: ربات‌ها با `userId` شروع شونده با `bot_` شناسایی می‌شوند
- **Offline Players**: کاربران بازیابی شده با `socketId: null` علامت‌گذاری می‌شوند

### Usage Flow
1. **Startup**: `restoreLobby()` لابی را از دیتابیس بازیابی می‌کند
2. **Player Join**: کاربر به `waitingPlayers` اضافه می‌شود
3. **Broadcast**: `broadcastWaiting()` به همه کلاینت‌ها اطلاع می‌دهد
4. **Persist**: `persistLobby()` لابی را در MongoDB ذخیره می‌کند
5. **Auto-start**: اگر تعداد به 10 رسید، `startWaitingGame()` فراخوانی می‌شود

### Error Handling
- در صورت عدم دسترسی به MongoDB، لابی فقط در حافظه نگهداری می‌شود
- خطاهای ذخیره‌سازی در console ثبت می‌شوند اما عملکرد سرور متوقف نمی‌شود
- کاربران بازیابی شده می‌توانند مجدداً به لابی بپیوندند

---

**این مستندات تمامی قابلیت‌های backend اتاق بازی را پوشش می‌دهد. برای سوالات بیشتر یا درخواست ویژگی‌های جدید، لطفاً با تیم توسعه تماس بگیرید.** 

## 🔌 **Endpoint های جدید:**

### 1️⃣ **`POST /api/waiting/add-one-bot`**
- **هدف**: اضافه کردن یک ربات در هر درخواست
- **استفاده**: `curl -X POST http://localhost:3000/api/waiting/add-one-bot`
- **مزیت**: کنترل دقیق تعداد ربات‌ها

### 2️⃣ **`POST /api/waiting/spawn-bots`** 
- **هدف**: اضافه کردن چندین ربات یکجا
- **استفاده**: `curl -X POST http://localhost:3000/api/waiting/spawn-bots -H "Content-Type: application/json" -d "{\"count\":5}"`

### 3️⃣ **`POST /api/waiting/clear-bots`**
- **هدف**: پاک‌سازی همه ربات‌ها
- **استفاده**: `curl -X POST http://localhost:3000/api/waiting/clear-bots`

### 4️⃣ **`GET /api/waiting/lobby`**
- **هدف**: مشاهده لابی ذخیره‌شده
- **استفاده**: `curl -s http://localhost:3000/api/waiting/lobby`

### 5️⃣ **`POST /api/waiting/lobby/save`**
- **هدف**: ذخیره دستی لابی
- **استفاده**: با JSON body شامل لیست players

## 🎯 **نحوه استفاده:**

```bash
<code_block_to_apply_changes_from>
```

حالا هم از طریق UI (دکمه +1) و هم از طریق API می‌توانید ربات‌ها را کنترل کنید!
