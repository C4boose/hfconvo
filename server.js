const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('.'));

// Secure endpoint to get Firebase config
app.get('/api/firebase-config', (req, res) => {
    // In production, you'd load these from environment variables
    const firebaseConfig = {
        apiKey: process.env.FIREBASE_API_KEY || "AIzaSyDwasB-_1Gp_kdUrQ9Eooyr-6TeIspEps8",
        authDomain: process.env.FIREBASE_AUTH_DOMAIN || "hfconvo.firebaseapp.com",
        databaseURL: process.env.FIREBASE_DATABASE_URL || "https://hfconvo-default-rtdb.firebaseio.com",
        projectId: process.env.FIREBASE_PROJECT_ID || "hfconvo",
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "hfconvo.firebasestorage.app",
        messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "213229553935",
        appId: process.env.FIREBASE_APP_ID || "1:213229553935:web:6d01c2c4455a610eed567a",
        measurementId: process.env.FIREBASE_MEASUREMENT_ID || "G-KF9MVZDJ3H"
    };
    
    res.json(firebaseConfig);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log('Firebase config is now served securely from /api/firebase-config');
}); 