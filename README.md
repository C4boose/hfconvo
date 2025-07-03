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

## Setup Instructionsds

### Current Status

The chat application is now set up for **real-time cross-network messaging** using Firebase:

- ✅ **Real-time messaging** - Messages appear instantly across all devices and networks
- ✅ **Live user tracking** - See real users who are online
- ✅ **Typing indicators** - Real-time typing indicators
- ✅ **Message persistence** - Messages are stored and synced
- ✅ **Cross-device support** - Works on phones, computers, tablets
- ✅ **No simulations** - All messages and users are real
- ⚠️ **Setup required** - You need to configure Firebase (see FIREBASE_SETUP.md)

### Quick Start (5 minutes)

**Follow the setup guide in `FIREBASE_SETUP.md` to get real-time messaging working:**

1. **Create Firebase project** - Free account at [console.firebase.google.com](https://console.firebase.google.com/)
2. **Enable Realtime Database** - One click setup
3. **Get your config** - Copy the configuration
4. **Update the code** - Replace the config in `index.html`
5. **Test it** - Messages work across all devices and networks!

### Alternative Options

If you prefer other services:
- **Ably** - See `deploy.md` for Ably setup
- **Custom WebSocket** - See `deploy.md` for Node.js setup

## How It Works

- **Real-time Messaging**: Uses Firebase Realtime Database to sync messages across all devices
- **User Management**: Tracks real online users and their status
- **Typing Indicators**: Real-time typing indicators across all devices
- **Message Persistence**: Messages are stored and synced automatically
- **Cross-Network**: Works between any devices on any networks

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