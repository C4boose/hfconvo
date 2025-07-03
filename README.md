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

### For Real-time Messaging (Required for multi-device chat)

The chat application uses Ably for real-time messaging. To enable messages to appear on other devices:

1. **Get a free Ably API key:**
   - Go to [https://ably.com/](https://ably.com/)
   - Sign up for a free account
   - Create a new app
   - Copy your API key

2. **Update the API key in the code:**
   - Open `script.js`
   - Find line 52: `const ABLY_API_KEY = 'YOUR_ABLY_API_KEY';`
   - Replace `'YOUR_ABLY_API_KEY'` with your actual API key

3. **Test the chat:**
   - Open the chat in multiple browser tabs or devices
   - Messages should now appear on all connected devices in real-time

### Demo Mode (Current Setup)

Currently, the app is using Ably's demo key which has limited functionality. For full real-time messaging, you need your own API key as described above.

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