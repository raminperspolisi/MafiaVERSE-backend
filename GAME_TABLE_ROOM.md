# Game Table Room Feature

## Overview
This feature creates a game room with a circular table where all players sit around it with their avatars and numbers. When players click on avatars, their role information is displayed at the bottom right of the screen.

## Features

### 1. Circular Game Table
- **Design**: Brown gradient circular table in the center of the screen
- **Size**: 400px × 300px (responsive for mobile)
- **Positioning**: Centered with proper shadows and 3D effects
- **Text**: "میز بازی" displayed in the center

### 2. Player Avatars Around Table
- **Layout**: Players positioned in a circle around the table
- **Avatar Design**: 
  - Circular avatars with unique color gradients
  - 80px × 80px size (60px on mobile)
  - Player numbers displayed on avatars (1, 2, 3, etc.)
  - Player names displayed below avatars
- **Colors**: 10 different color gradients for variety
- **Interaction**: Clickable with hover effects

### 3. Role Information Panel
- **Location**: Bottom right of the screen
- **Animation**: Slides in from right with smooth transition
- **Content**:
  - Role emoji
  - Role name
  - Role description
  - Close button
- **Behavior**: 
  - Appears when clicking on player avatar
  - Closes when clicking close button or outside panel
  - Role-specific color gradients

### 4. Available Roles
- **🦹 مافیا**: در شب‌ها می‌تواند یک نفر را بکشد. هدف مافیا کشتن همه شهروندان است.
- **👨‍⚕️ دکتر**: در شب‌ها می‌تواند یک نفر را درمان کند و از مرگ نجات دهد.
- **🔍 کارآگاه**: در شب‌ها می‌تواند نقش یک نفر را کشف کند.
- **🎯 تیرانداز**: یک بار در طول بازی می‌تواند یک نفر را بکشد.
- **🛡️ محافظ**: در شب‌ها می‌تواند از یک نفر محافظت کند.
- **👤 شهروند**: باید با رای دادن مافیا را پیدا کند و اعدام کند.

## Technical Implementation

### File Structure
```
mafia-web-app/
├── game-table-room.html      # Main game table room page
├── server.js                 # Server with /game-table route
├── test-game-table-room.js   # Test file for functionality
└── GAME_TABLE_ROOM.md       # This documentation
```

### Server Route
```javascript
// Serve game table room
app.get('/game-table', (req, res) => {
  res.sendFile(path.join(__dirname, 'game-table-room.html'));
});
```

### Key Functions

#### Player Position Calculation
```javascript
function calculatePlayerPosition(index, totalPlayers) {
  const centerX = 200; // Table center X
  const centerY = 150; // Table center Y
  const radius = 180; // Distance from center
  
  const angle = (index * 2 * Math.PI / totalPlayers) - Math.PI / 2;
  const x = centerX + radius * Math.cos(angle);
  const y = centerY + radius * Math.sin(angle);
  
  return { x, y };
}
```

#### Role Information Display
```javascript
function showRoleInfo(player) {
  const role = roleInfo[player.role];
  document.getElementById('roleEmoji').textContent = role.emoji;
  document.getElementById('roleName').textContent = role.name;
  document.getElementById('roleDescription').textContent = role.description;
  
  const panel = document.getElementById('rolePanel');
  panel.classList.add('show');
}
```

## User Experience

### Navigation Flow
1. **Entry**: Players navigate to `/game-table`
2. **View**: See circular table with all players around it
3. **Interaction**: Click on player avatars to see role information
4. **Information**: Role panel appears at bottom right
5. **Action**: Use start game button to begin actual game

### Responsive Design
- **Desktop**: Full-size table and avatars
- **Mobile**: Scaled down table and avatars
- **Tablet**: Optimized layout for medium screens

### Visual Effects
- **Hover Effects**: Avatars scale up on hover
- **Animations**: Smooth transitions for role panel
- **Shadows**: 3D effects for depth
- **Gradients**: Beautiful color schemes throughout

## Sample Player Data
The room includes 8 sample players with different roles:
1. احمد (مافیا)
2. فاطمه (دکتر)
3. محمد (کارآگاه)
4. زهرا (شهروند)
5. علی (تیرانداز)
6. مریم (محافظ)
7. حسن (شهروند)
8. نرگس (شهروند)

## Testing
Run the test file to verify functionality:
```bash
node test-game-table-room.js
```

## Future Enhancements
- **Real-time Updates**: Socket.IO integration for live player updates
- **Custom Avatars**: User-uploaded profile pictures
- **Role-specific Themes**: Different table themes based on game roles
- **Multiplayer Support**: Real-time synchronization between players
- **Game Integration**: Direct connection to actual game mechanics
- **Sound Effects**: Audio feedback for interactions
- **Animations**: More sophisticated animations and effects

## Browser Compatibility
- **Modern Browsers**: Chrome, Firefox, Safari, Edge
- **Mobile Browsers**: iOS Safari, Chrome Mobile
- **Features Used**: CSS Grid, Flexbox, CSS Animations, ES6+

## Performance Considerations
- **Optimized Rendering**: Efficient DOM manipulation
- **Responsive Images**: Scalable vector graphics for avatars
- **Smooth Animations**: Hardware-accelerated CSS transitions
- **Memory Management**: Proper event listener cleanup 