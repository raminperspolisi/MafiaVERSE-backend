# 🎭 بازی مافیا آنلاین

یک بازی مافیا کاملاً فارسی و آنلاین که با Node.js، MongoDB و Socket.IO ساخته شده است.

## ✨ ویژگی‌ها

- 🔐 **سیستم احراز هویت کامل** با JWT
- 🎮 **بازی real-time** با Socket.IO  
- 📊 **آمار و جدول امتیازات**
- 💬 **چت زنده** در طول بازی
- 🎭 **نقش‌های مختلف**: مافیا، دکتر، کارآگاه، شهروند
- 📱 **طراحی واکنش‌گرا** (Responsive)
- 🌙 **حالت شب** زیبا
- 🔄 **بروزرسانی real-time** وضعیت بازی

## 🛠 فناوری‌های استفاده شده

### Backend
- **Node.js** - Runtime Environment
- **Express.js** - Web Framework
- **Socket.IO** - Real-time Communication
- **MongoDB** - Database
- **Mongoose** - ODM
- **JWT** - Authentication
- **bcryptjs** - Password Hashing

### Frontend  
- **HTML5 & CSS3** - Structure & Styling
- **JavaScript (ES6+)** - Client Logic
- **Socket.IO Client** - Real-time Connection
- **Font Awesome** - Icons
- **Vazirmatn Font** - Persian Typography

## 📋 پیش‌نیازها

قبل از نصب، مطمئن شوید که موارد زیر نصب شده باشد:

- [Node.js](https://nodejs.org/) (نسخه 14 یا بالاتر)
- [MongoDB](https://www.mongodb.com/) (نسخه 4.4 یا بالاتر)
- [npm](https://www.npmjs.com/) یا [yarn](https://yarnpkg.com/)

## 🚀 نصب و راه‌اندازی

### 1. کلون کردن پروژه

```bash
git clone https://github.com/yourusername/mafia-web-app.git
cd mafia-web-app
```

### 2. نصب Dependencies

```bash
npm install
```

### 3. تنظیم متغیرهای محیطی

فایل `.env` ایجاد کنید و متغیرهای زیر را تنظیم کنید:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# MongoDB Configuration
MONGODB_URI=mongodb://localhost:27017/mafia-game

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Game Configuration
MIN_PLAYERS=4
MAX_PLAYERS=12
NIGHT_DURATION=30
DAY_DURATION=60
VOTING_DURATION=45

# Client Configuration
CLIENT_URL=http://localhost:3000
```

### 4. راه‌اندازی MongoDB

مطمئن شوید که MongoDB در حال اجرا است:

```bash
# در Windows
net start MongoDB

# در macOS/Linux
sudo systemctl start mongod
```

### 5. اجرای برنامه

#### حالت Development:
```bash
npm run dev
```

#### حالت Production:
```bash
npm start
```

سرور روی `http://localhost:3000` راه‌اندازی خواهد شد.

## 🎮 نحوه بازی

### مراحل بازی:

1. **ثبت نام/ورود**: ابتدا حساب کاربری ایجاد کنید
2. **اتاق انتظار**: برای پیوستن به بازی کلیک کنید
3. **شروع بازی**: وقتی حداقل 4 نفر جمع شوند، بازی شروع می‌شود
4. **دریافت نقش**: نقش خود را دریافت کنید
5. **بازی**: بر اساس نقش‌تان عمل کنید

### نقش‌ها:

- **🔪 مافیا**: هر شب یک نفر را حذف کنید
- **👨‍⚕️ دکتر**: هر شب یک نفر را محافظت کنید  
- **🕵️ کارآگاه**: هر شب هویت یک نفر را بررسی کنید
- **👤 شهروند**: مافیا را پیدا کنید و حذف کنید

### مراحل هر روز:

1. **🌙 شب**: مافیا و نقش‌های ویژه عمل می‌کنند
2. **☀️ روز**: همه در مورد مافیا بحث می‌کنند
3. **🗳 رای‌گیری**: برای حذف یک نفر رای می‌دهند

## 🏗 ساختار پروژه

```
mafia-web-app/
├── server.js              # فایل اصلی سرور
├── package.json           # Dependencies و Scripts
├── README.md              # مستندات
├── .env.example           # نمونه متغیرهای محیطی
├── models/                # مدل‌های MongoDB
│   ├── User.js           # مدل کاربر
│   └── Game.js           # مدل بازی
├── routes/                # API Routes
│   ├── auth.js           # احراز هویت
│   └── game.js           # بازی
└── client/                # فایل‌های Frontend
    ├── index.html        # صفحه اصلی
    ├── css/
    │   └── style.css     # استایل‌ها
    └── js/
        └── app.js        # منطق Client
```

## 🔌 API Endpoints

### Authentication
- `POST /api/auth/register` - ثبت نام
- `POST /api/auth/login` - ورود
- `POST /api/auth/logout` - خروج
- `GET /api/auth/me` - اطلاعات کاربر
- `PUT /api/auth/profile` - بروزرسانی پروفایل
- `GET /api/auth/leaderboard` - جدول امتیازات

### Game
- `GET /api/game/history` - تاریخچه بازی‌ها
- `GET /api/game/stats` - آمار بازی کاربر
- `GET /api/game/recent` - بازی‌های اخیر
- `GET /api/game/global-stats` - آمار کلی
- `GET /api/game/:gameId` - جزئیات بازی

## 🎯 Socket.IO Events

### Client to Server:
- `join-waiting` - پیوستن به اتاق انتظار
- `start-game` - شروع دستی بازی
- `vote` - رای دادن
- `mafia-action` - عمل مافیا
- `doctor-action` - عمل دکتر
- `detective-action` - عمل کارآگاه
- `send-message` - ارسال پیام

### Server to Client:
- `waiting-players-updated` - بروزرسانی لیست انتظار
- `game-started` - شروع بازی
- `role-assigned` - تعیین نقش
- `phase-changed` - تغییر مرحله
- `night-results` - نتایج شب
- `player-eliminated` - حذف بازیکن
- `game-ended` - پایان بازی
- `new-message` - پیام جدید

## 🔒 امنیت

- رمزعبورها با bcryptjs هش می‌شوند
- JWT برای احراز هویت استفاده می‌شود
- Validation در سمت سرور و کلاینت
- Rate limiting برای API calls
- CORS تنظیم شده

## 🐛 رفع اشکال

### مشکلات رایج:

1. **MongoDB اتصال برقرار نمی‌کند**:
   - مطمئن شوید MongoDB در حال اجرا است
   - Connection string را بررسی کنید

2. **Socket.IO کار نمی‌کند**:
   - CORS settings را بررسی کنید
   - Firewall را چک کنید

3. **JWT Token نامعتبر**:
   - JWT_SECRET را تنظیم کنید
   - Token expiry را بررسی کنید

## 🤝 مشارکت

برای مشارکت در پروژه:

1. Fork کنید
2. Branch جدید ایجاد کنید (`git checkout -b feature/amazing-feature`)
3. تغییرات را commit کنید (`git commit -m 'Add amazing feature'`)
4. Branch را push کنید (`git push origin feature/amazing-feature`)
5. Pull Request ایجاد کنید

## 📄 مجوز

این پروژه تحت مجوز MIT منتشر شده است. فایل [LICENSE](LICENSE) را برای جزئیات بیشتر مطالعه کنید.

## 📞 پشتیبانی

در صورت وجود مشکل یا سوال:

- Issue جدید در GitHub ایجاد کنید
- ایمیل بزنید: support@mafiagame.com
- تلگرام: @MafiaGameSupport

## 🙏 تشکر

از تمام کسانی که در توسعه این پروژه مشارکت داشتند، تشکر می‌کنیم.

---

**🎭 لذت ببرید و مافیاها را پیدا کنید! 🕵️** 