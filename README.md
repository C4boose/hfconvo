# HackConvo - Real-time Public Chat

A modern, real-time chat application for developers and tech enthusiasts.

## Features

- Real-time messaging between multiple devices
- User typing indicators
- Online user tracking
- Modern UI with dark themes
- Sound notifications
- Screen sharing and video chat capabilities
- Responsive design

## Setup Instructions

### Current Demo Mode

The chat application is currently running in **demo mode** with simulated real-time features:

- ✅ **Simulated online users** - Shows fake users in the sidebar
- ✅ **Simulated responses** - Bot users respond to your messages
- ✅ **Typing indicators** - Shows when simulated users are typing
- ✅ **Connection status** - Shows connection to echo server
- ❌ **Real multi-device chat** - Messages only appear on the sending device

### For Real Multi-Device Chat

To enable messages to appear on other devices, you have several options:

#### Option 1: Use Ably (Recommended)
1. **Get a free Ably API key:**
   - Go to [https://ably.com/](https://ably.com/)
   - Sign up for a free account
   - Create a new app
   - Copy your API key

2. **Update the code:**
   - Replace the WebSocket connection with Ably
   - See `deploy.md` for detailed instructions

#### Option 2: Use Firebase Realtime Database
- See `deploy.md` for Firebase setup instructions

#### Option 3: Build Your Own WebSocket Server
- See `deploy.md` for Node.js + Socket.io setup

## How It Works

- **Real-time Messaging**: Uses Ably's pub/sub system to broadcast messages to all connected clients
- **User Management**: Tracks online users and their status
- **Typing Indicators**: Shows when users are typing
- **Fallback Mode**: If connection fails, falls back to simulated responses

## File Structure

- `index.html` - Main HTML structure
- `script.js` - JavaScript application logic
- `styles.css` - CSS styling
- `README.md` - This file

## Browser Compatibility

Works in all modern browsers that support:
- WebSocket connections
- Web Audio API
- MediaDevices API (for video/audio features)

## Troubleshooting

### Messages not appearing on other devices?

1. Check that you've added your Ably API key
2. Ensure both devices are connected to the internet
3. Check browser console for connection errors
4. Verify that the Ably service is working

### Connection issues?

The app will automatically fall back to simulated mode if the real-time connection fails. You'll see simulated responses from fake users.

## License

This is a demo project. Feel free to use and modify as needed. 