# HackConvo - Frontend-Only Public Chat with WebRTC

A modern, **frontend-only** public chat application with integrated screen sharing, voice calls, and video chat capabilities. Built with a sleek dark theme inspired by HackForums for developers and tech enthusiasts.

> **⚠️ IMPORTANT**: This is a **client-side only** application with **NO BACKEND** included. All "real-time" features are simulated for demonstration purposes. This is perfect for prototyping, learning WebRTC, or as a starting point for building a full-stack chat application.

## Features

### 💬 **Enhanced Messaging** (Simulated)
- 🚀 **Real-time Chat** - Simulated instant messaging in one global room
- 📝 **Rich Text Formatting** - Support for **bold**, *italic*, `code`, @mentions
- 😄 **Message Reactions** - React with emojis (👍❤️😂) to messages
- 💬 **Reply System** - @mention users to reply directly
- 🎯 **Typing Indicators** - Animated typing dots (demo mode)
- 🤖 **Auto-responses** - Simulated replies from demo users

### 📊 **Professional Dashboard Header**
- 📡 **Server Status** - Live connection quality indicator with latency
- 👥 **Online Counter** - Real-time user count display (120-140 simulated)
- 💬 **Message Stats** - Daily message counter (1.2k+ format)
- 🎥 **Stream Counter** - Active streams indicator
- 🔔 **Notifications** - Interactive notification system with badges
- 🖥️ **Fullscreen Mode** - Toggle fullscreen viewing
- 👤 **User Profile Menu** - Quick access to settings and profile options

### 📺 **WebRTC Media Features** (Local Only)
- 🖥️ **Screen Sharing** - Share your screen locally (WebRTC API)
- 🎤 **Voice Calls** - Local audio capture and controls
- 📹 **Video Chat** - Local camera access and display
- 🎛️ **Media Controls** - Mute, camera toggle, call management
- 📊 **Stream Display** - Professional video grid layout
- 📡 **Active Streams** - Live list of your local streams

### 🎨 **User Experience**
- 🌙 **Dark Theme Design** - Multiple dark theme variations (Dark/Darker/Black)
- 📱 **Responsive Layout** - Works on desktop, tablet, and mobile
- ✨ **Smooth Animations** - Polished interactions and transitions
- 🔊 **Enhanced Audio** - Different sounds for various actions
- 🍞 **Toast Notifications** - Professional slide-in alerts
- 🎨 **Modern UI Components** - Professional-grade interface elements

### ⌨️ **Keyboard Shortcuts**
- **Enter** - Send message
- **Shift+Enter** - New line
- **Escape** - Clear input
- **Ctrl+/** - Show shortcuts
- **Ctrl+Shift+M** - Toggle sound
- **Ctrl+Shift+S** - Screen share
- **Ctrl+Shift+V** - Toggle video
- **Ctrl+Shift+A** - Toggle audio

### 👥 **Social Features** (Demo/Local)
- 📊 **Online Users List** - See simulated connected participants
- 🟢 **User Status Indicators** - Animated online status dots
- 👤 **Quick Profile Edit** - Double-click avatar to change name
- ⚙️ **User Settings** - Customize experience and preferences
- 💾 **Local Storage** - Remembers your settings and preferences

## 🚨 Frontend-Only Limitations

Since this is a **client-side only** application with no backend server:

### ❌ **What DOESN'T work between users:**
- Real multi-user chat (only you see your messages)
- Actual screen sharing with other users
- Real voice/video calls with other participants
- Synchronized user lists across different browsers
- Message persistence across sessions

### ✅ **What DOES work:**
- Full UI/UX experience and interactions
- Local WebRTC features (your camera, microphone, screen capture)
- All animations, themes, and visual effects
- Local storage of preferences and settings
- Perfect for learning, prototyping, and demos
- Realistic simulation of real-time chat features

## Quick Start

1. **Download the Files**
   - `index.html` - Main application page
   - `styles.css` - Dark theme styling
   - `script.js` - Chat functionality

2. **Open in Browser**
   ```bash
   # Simply open index.html in your web browser
   # Or serve with a simple HTTP server:
   python -m http.server 8000
   # Then visit http://localhost:8000
   ```

3. **Start Exploring & Testing**
   - A random username will be generated for you
   - Type messages with rich formatting (**bold**, *italic*, `code`) - you'll see demo responses
   - Click media buttons to test screen sharing, voice, or video (local WebRTC)
   - Use keyboard shortcuts for quick access (Ctrl+/ for help)
   - Double-click your avatar to change username
   - React to demo messages with emojis
   - **Note**: All interactions are local/simulated - perfect for testing and learning!

## Deployment to hackconvo.net

### Option 1: Static Hosting (Recommended)

1. **Upload Files** to your web server:
   ```
   hackconvo.net/
   ├── index.html
   ├── styles.css
   ├── script.js
   └── README.md
   ```

2. **Configure Web Server** (nginx example):
   ```nginx
   server {
       listen 80;
       server_name hackconvo.net www.hackconvo.net;
       root /var/www/hackconvo;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
       
       # Enable gzip compression
       gzip on;
       gzip_types text/css application/javascript text/html;
   }
   ```

3. **SSL Certificate** (Let's Encrypt):
   ```bash
   certbot --nginx -d hackconvo.net -d www.hackconvo.net
   ```

### Option 2: CDN Deployment

Upload to services like:
- **Netlify**: Drag and drop the files
- **Vercel**: Connect GitHub repo
- **GitHub Pages**: Push to gh-pages branch
- **Cloudflare Pages**: Connect repository

## File Structure

```
hackconvo/
├── index.html          # Main application structure
├── styles.css          # Dark theme and responsive design
├── script.js           # Chat functionality and interactions
└── README.md           # This file
```

## Customization

### Themes
The app supports multiple dark themes:
- **Dark** (default)
- **Darker** 
- **Black**

Modify CSS variables in `styles.css`:
```css
:root {
    --bg-primary: #1a1a1a;
    --text-primary: #ffffff;
    --accent-primary: #007bff;
    /* ... */
}
```

### Demo Content
Modify demo messages and users in `script.js`:
```javascript
loadMessages() {
    const sampleMessages = [
        {
            id: this.generateId(),
            author: 'YourBot',
            text: 'Custom welcome message here!',
            // ...
        }
    ];
}
```

### Branding
Update the logo and title:
- Change "HackConvo" in `index.html`
- Modify the tagline "Public Developer Chat"
- Update favicon and meta tags

## Browser Support

- ✅ Chrome 70+
- ✅ Firefox 65+
- ✅ Safari 12+
- ✅ Edge 79+

## Performance

- **Lightweight**: ~50KB total
- **Fast Loading**: Optimized CSS and JS
- **Responsive**: Smooth on mobile devices
- **Offline Ready**: Works without internet for basic UI

## Security Features

- XSS Protection via HTML escaping
- Local storage for user preferences
- No server-side vulnerabilities
- HTTPS recommended for production

## Making it Multi-User (Adding a Backend)

This frontend-only version simulates real-time features. To make it truly multi-user, you'll need to add a backend:

### Backend Requirements:
1. **WebSocket Server**: Socket.io, native WebSockets, or WebRTC signaling server
2. **Database**: MongoDB, PostgreSQL, or Redis for message storage
3. **User Authentication**: JWT tokens, OAuth, or session management
4. **WebRTC Signaling**: Server to coordinate peer-to-peer connections
5. **API Endpoints**: REST API for user management and chat history

### Recommended Tech Stack:
- **Node.js + Socket.io** for real-time communication
- **Express.js** for API endpoints
- **MongoDB** for storing messages and users
- **Redis** for session management and caching
- **WebRTC signaling server** for peer-to-peer media connections

### Example Backend Integration:
```javascript
// Replace simulated messaging with real WebSocket
const socket = io('wss://your-backend-url');
socket.on('message', (data) => {
    this.addMessage(data.message);
});
```

This frontend is designed to be easily integrated with any backend of your choice!

## License

MIT License - feel free to modify and use for your projects.

## Support

For issues or feature requests, contact the development team or create an issue in the repository.

---

**Live Demo**: [hackconvo.net](https://hackconvo.net) _(when deployed)_

Built with ❤️ for the developer community 