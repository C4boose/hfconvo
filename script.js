// HackConvo - Public Chat Application JavaScript
class HackConvo {
    constructor() {
        this.currentUser = this.loadUser();
        this.messages = [];
        this.onlineUsers = new Set();
        this.activeStreams = new Map();
        this.typingUsers = new Set();
        this.sounds = {
            enabled: localStorage.getItem('soundEnabled') !== 'false'
        };
        this.webrtc = {
            localStream: null,
            screenStream: null,
            peerConnections: new Map(),
            mediaDevices: {
                audio: false,
                video: false,
                screen: false
            }
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupMediaControls();
        this.setupHeaderControls();
        this.loadMessages();
        this.loadOnlineUsers();
        this.updateOnlineCount();
        this.updateHeaderStats();
        this.startHeartbeat();
        this.setupTypingIndicator();
        this.initUserProfile();
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
    }

    setupEventListeners() {
        // Message form submission
        const messageForm = document.getElementById('message-form');
        messageForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });

        // Message input handling
        const messageInput = document.getElementById('message-input');
        messageInput.addEventListener('keydown', (e) => {
            // Enter to send (Shift+Enter for new line)
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
            
            // Escape to clear input
            if (e.key === 'Escape') {
                messageInput.value = '';
                this.updateCharCount();
            }
            
            // Ctrl+K to focus search
            if (e.ctrlKey && e.key === 'k') {
                e.preventDefault();
                document.getElementById('search-convos').focus();
            }
        });

        messageInput.addEventListener('input', () => {
            this.updateCharCount();
            this.handleTyping();
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+/ to show shortcuts
            if (e.ctrlKey && e.key === '/') {
                e.preventDefault();
                this.showKeyboardShortcuts();
            }
            
            // Ctrl+Shift+M to toggle sound
            if (e.ctrlKey && e.shiftKey && e.key === 'M') {
                e.preventDefault();
                this.toggleSound();
            }
            
            // Ctrl+Shift+S for screen share
            if (e.ctrlKey && e.shiftKey && e.key === 'S') {
                e.preventDefault();
                this.toggleScreenShare();
            }
            
            // Ctrl+Shift+V for video
            if (e.ctrlKey && e.shiftKey && e.key === 'V') {
                e.preventDefault();
                this.toggleVideo();
            }
            
            // Ctrl+Shift+A for audio
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                this.toggleAudio();
            }
        });

        // Settings modal
        document.querySelector('[title="Chat Settings"]').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // Double-click to edit username quickly
        document.getElementById('user-avatar').addEventListener('dblclick', () => {
            this.quickEditUsername();
        });
    }

    showKeyboardShortcuts() {
        const shortcuts = [
            'Enter - Send message',
            'Shift+Enter - New line',
            'Escape - Clear input',
            'Ctrl+/ - Show shortcuts',
            'Ctrl+Shift+M - Toggle sound',
            'Ctrl+Shift+S - Screen share',
            'Ctrl+Shift+V - Toggle video',
            'Ctrl+Shift+A - Toggle audio'
        ];
        
        alert('Keyboard Shortcuts:\n\n' + shortcuts.join('\n'));
    }

    toggleSound() {
        this.sounds.enabled = !this.sounds.enabled;
        localStorage.setItem('soundEnabled', this.sounds.enabled);
        
        // Update sound icon in user menu
        const soundIcon = document.getElementById('sound-icon');
        if (soundIcon) {
            soundIcon.className = this.sounds.enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
        }
        
        const message = this.sounds.enabled ? 'Sound enabled' : 'Sound disabled';
        this.showNotification(message);
        
        if (this.sounds.enabled) {
            this.playSound('notification');
        }
    }

    showNotification(message, type = 'info') {
        // Create toast notification
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        
        // Add to DOM
        document.body.appendChild(toast);
        
        // Animate in
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, 3000);
    }

    quickEditUsername() {
        const newUsername = prompt('Enter new username:', this.currentUser.username);
        if (newUsername && newUsername.trim() && newUsername !== this.currentUser.username) {
            this.currentUser.username = newUsername.trim();
            this.currentUser.avatar = `https://ui-avatars.com/api/?name=${newUsername}&background=333&color=fff`;
            this.saveUser(this.currentUser);
            
            // Update header displays
            document.getElementById('header-username').textContent = newUsername;
            document.getElementById('user-avatar').src = this.currentUser.avatar;
            
            // Close user menu
            this.closeUserMenu();
            
            this.showNotification(`Username changed to ${newUsername}`, 'success');
        }
    }

    loadUser() {
        const savedUser = localStorage.getItem('hackconvo_user');
        if (savedUser) {
            return JSON.parse(savedUser);
        }
        
        // Generate random user
        const names = ['CyberNinja', 'CodeBreaker', 'DigitalGhost', 'HackerElite', 'CryptoMaster', 'ByteBandit', 'NetPhantom', 'CodeWizard'];
        const randomName = names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 1000);
        
        const user = {
            id: this.generateId(),
            username: randomName,
            avatar: `https://ui-avatars.com/api/?name=${randomName}&background=333&color=fff`,
            status: 'online',
            joinedAt: Date.now()
        };
        
        this.saveUser(user);
        return user;
    }

    saveUser(user) {
        localStorage.setItem('hackconvo_user', JSON.stringify(user));
        
        // Update UI
        document.getElementById('user-avatar').src = user.avatar;
        document.getElementById('user-avatar').alt = user.username;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupHeaderControls() {
        // Notification button
        document.getElementById('notifications-btn').addEventListener('click', () => {
            this.toggleNotifications();
        });

        // Fullscreen button
        document.getElementById('fullscreen-btn').addEventListener('click', () => {
            this.toggleFullscreen();
        });

        // Settings button
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.openSettingsModal();
        });

        // User avatar click for menu
        document.getElementById('user-avatar-container').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserMenu();
        });

        // Close user menu when clicking outside
        document.addEventListener('click', () => {
            this.closeUserMenu();
        });

        // Server status updates
        this.updateServerStatus();
        setInterval(() => this.updateServerStatus(), 5000);
    }

    initUserProfile() {
        const usernameEl = document.getElementById('header-username');
        const avatarEl = document.getElementById('user-avatar');
        const soundIcon = document.getElementById('sound-icon');
        
        usernameEl.textContent = this.currentUser.username;
        avatarEl.src = this.currentUser.avatar;
        
        // Update sound icon based on current state
        soundIcon.className = this.sounds.enabled ? 'fas fa-volume-up' : 'fas fa-volume-mute';
    }

    toggleNotifications() {
        const badge = document.getElementById('notification-badge');
        const isVisible = badge.style.display !== 'none';
        
        if (isVisible) {
            badge.style.display = 'none';
            this.showNotification('Notifications cleared', 'info');
        } else {
            // Simulate new notifications
            const count = Math.floor(Math.random() * 5) + 1;
            badge.textContent = count;
            badge.style.display = 'block';
            this.showNotification(`${count} new notifications`, 'info');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().then(() => {
                const btn = document.getElementById('fullscreen-btn');
                btn.innerHTML = '<i class="fas fa-compress"></i>';
                btn.title = 'Exit Fullscreen';
                this.showNotification('Entered fullscreen mode', 'success');
            });
        } else {
            document.exitFullscreen().then(() => {
                const btn = document.getElementById('fullscreen-btn');
                btn.innerHTML = '<i class="fas fa-expand"></i>';
                btn.title = 'Toggle Fullscreen';
                this.showNotification('Exited fullscreen mode', 'info');
            });
        }
    }

    toggleUserMenu() {
        const menu = document.getElementById('user-menu');
        const isVisible = menu.style.display !== 'none';
        menu.style.display = isVisible ? 'none' : 'block';
    }

    closeUserMenu() {
        const menu = document.getElementById('user-menu');
        menu.style.display = 'none';
    }

    updateServerStatus() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const connectionIcon = document.getElementById('connection-icon');
        const latencyEl = document.getElementById('latency');
        
        // Simulate connection quality
        const quality = Math.random();
        let latency, status, color, iconClass;
        
        if (quality > 0.8) {
            latency = Math.floor(Math.random() * 20) + 5; // 5-25ms
            status = 'Connected';
            color = 'var(--online-color)';
            iconClass = 'fas fa-wifi';
        } else if (quality > 0.5) {
            latency = Math.floor(Math.random() * 50) + 25; // 25-75ms
            status = 'Good';
            color = '#ffc107';
            iconClass = 'fas fa-wifi';
        } else if (quality > 0.2) {
            latency = Math.floor(Math.random() * 100) + 75; // 75-175ms
            status = 'Slow';
            color = '#fd7e14';
            iconClass = 'fas fa-wifi';
        } else {
            latency = Math.floor(Math.random() * 200) + 200; // 200-400ms
            status = 'Poor';
            color = '#dc3545';
            iconClass = 'fas fa-wifi';
        }
        
        statusDot.style.color = color;
        statusText.textContent = status;
        statusText.style.color = color;
        connectionIcon.className = iconClass;
        connectionIcon.style.color = color;
        latencyEl.textContent = `${latency}ms`;
        latencyEl.style.color = color;
    }

    updateHeaderStats() {
        // Update all header statistics
        this.updateOnlineCount();
        this.updateMessagesToday();
        this.updateActiveStreamsCount();
        
        // Update periodically
        setTimeout(() => this.updateHeaderStats(), 30000);
    }

    updateMessagesToday() {
        // Simulate message count (could be real in production)
        const baseCount = 1247;
        const variance = Math.floor(Math.random() * 50);
        const count = baseCount + variance;
        
        const messagesEl = document.getElementById('messages-today');
        if (messagesEl) {
            messagesEl.textContent = this.formatNumber(count);
        }
    }

    updateActiveStreamsCount() {
        let streamCount = 0;
        
        // Count active media streams
        if (this.webrtc.mediaDevices.screen) streamCount++;
        if (this.webrtc.mediaDevices.video) streamCount++;
        if (this.webrtc.mediaDevices.audio && !this.webrtc.mediaDevices.video) streamCount++;
        
        // Add some simulated streams
        streamCount += Math.floor(Math.random() * 3);
        
        const streamsEl = document.getElementById('active-streams-count');
        if (streamsEl) {
            streamsEl.textContent = streamCount;
        }
    }

    formatNumber(num) {
        if (num >= 1000) {
            return (num / 1000).toFixed(1) + 'k';
        }
        return num.toString();
    }

    setupMediaControls() {
        // Screen share button
        document.getElementById('screen-share-btn').addEventListener('click', () => {
            this.toggleScreenShare();
        });

        // Voice call button
        document.getElementById('voice-call-btn').addEventListener('click', () => {
            this.toggleAudio();
        });

        // Video call button
        document.getElementById('video-call-btn').addEventListener('click', () => {
            this.toggleVideo();
        });

        // Media control overlay buttons
        document.getElementById('mute-btn').addEventListener('click', () => {
            this.toggleMute();
        });

        document.getElementById('camera-btn').addEventListener('click', () => {
            this.toggleCamera();
        });

        document.getElementById('end-call-btn').addEventListener('click', () => {
            this.endAllCalls();
        });
    }

    async toggleScreenShare() {
        try {
            if (this.webrtc.mediaDevices.screen) {
                await this.stopScreenShare();
            } else {
                await this.startScreenShare();
            }
        } catch (error) {
            console.error('Screen share error:', error);
            this.showNotification('Screen share failed: ' + error.message, 'error');
        }
    }

    async startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });

            this.webrtc.screenStream = stream;
            this.webrtc.mediaDevices.screen = true;
            
            this.addStreamToDisplay(stream, this.currentUser.username, 'screen');
            this.updateActiveStreams();
            this.updateMediaButton('screen-share-btn', true);
            
            // Listen for screen share end
            stream.getVideoTracks()[0].addEventListener('ended', () => {
                this.stopScreenShare();
            });

            this.playSound('notification');
            this.showNotification('Screen sharing started', 'success');
            
        } catch (error) {
            throw new Error('Failed to start screen sharing');
        }
    }

    async stopScreenShare() {
        if (this.webrtc.screenStream) {
            this.webrtc.screenStream.getTracks().forEach(track => track.stop());
            this.webrtc.screenStream = null;
        }
        
        this.webrtc.mediaDevices.screen = false;
        this.removeStreamFromDisplay(this.currentUser.username, 'screen');
        this.updateActiveStreams();
        this.updateMediaButton('screen-share-btn', false);
        
        this.showNotification('Screen sharing stopped', 'info');
    }

    async toggleAudio() {
        try {
            if (this.webrtc.mediaDevices.audio) {
                await this.stopAudio();
            } else {
                await this.startAudio();
            }
        } catch (error) {
            console.error('Audio error:', error);
            this.showNotification('Audio failed: ' + error.message, 'error');
        }
    }

    async startAudio() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            if (!this.webrtc.localStream) {
                this.webrtc.localStream = stream;
            } else {
                // Add audio track to existing stream
                const audioTrack = stream.getAudioTracks()[0];
                this.webrtc.localStream.addTrack(audioTrack);
            }
            
            this.webrtc.mediaDevices.audio = true;
            this.updateActiveStreams();
            this.updateMediaButton('voice-call-btn', true);
            
            this.playSound('notification');
            this.showNotification('Voice chat started', 'success');
            
        } catch (error) {
            throw new Error('Failed to start audio');
        }
    }

    async stopAudio() {
        if (this.webrtc.localStream) {
            this.webrtc.localStream.getAudioTracks().forEach(track => track.stop());
        }
        
        this.webrtc.mediaDevices.audio = false;
        this.updateActiveStreams();
        this.updateMediaButton('voice-call-btn', false);
        
        this.showNotification('Voice chat stopped', 'info');
    }

    async toggleVideo() {
        try {
            if (this.webrtc.mediaDevices.video) {
                await this.stopVideo();
            } else {
                await this.startVideo();
            }
        } catch (error) {
            console.error('Video error:', error);
            this.showNotification('Video failed: ' + error.message, 'error');
        }
    }

    async startVideo() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            
            this.webrtc.localStream = stream;
            this.webrtc.mediaDevices.video = true;
            this.webrtc.mediaDevices.audio = true;
            
            this.addStreamToDisplay(stream, this.currentUser.username, 'video');
            this.updateActiveStreams();
            this.updateMediaButton('video-call-btn', true);
            
            this.playSound('notification');
            this.showNotification('Video chat started', 'success');
            
        } catch (error) {
            throw new Error('Failed to start video');
        }
    }

    async stopVideo() {
        if (this.webrtc.localStream) {
            this.webrtc.localStream.getTracks().forEach(track => track.stop());
            this.webrtc.localStream = null;
        }
        
        this.webrtc.mediaDevices.video = false;
        this.webrtc.mediaDevices.audio = false;
        this.removeStreamFromDisplay(this.currentUser.username, 'video');
        this.updateActiveStreams();
        this.updateMediaButton('video-call-btn', false);
        
        this.showNotification('Video chat stopped', 'info');
    }

    toggleMute() {
        if (this.webrtc.localStream) {
            const audioTracks = this.webrtc.localStream.getAudioTracks();
            const muted = !audioTracks[0].enabled;
            audioTracks.forEach(track => track.enabled = muted);
            
            const muteBtn = document.getElementById('mute-btn');
            muteBtn.classList.toggle('active', !muted);
            muteBtn.innerHTML = muted ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
            
            this.showNotification(muted ? 'Unmuted' : 'Muted', 'info');
        }
    }

    toggleCamera() {
        if (this.webrtc.localStream) {
            const videoTracks = this.webrtc.localStream.getVideoTracks();
            const enabled = !videoTracks[0].enabled;
            videoTracks.forEach(track => track.enabled = enabled);
            
            const cameraBtn = document.getElementById('camera-btn');
            cameraBtn.classList.toggle('active', enabled);
            cameraBtn.innerHTML = enabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
            
            this.showNotification(enabled ? 'Camera on' : 'Camera off', 'info');
        }
    }

    endAllCalls() {
        this.stopScreenShare();
        this.stopVideo();
        this.stopAudio();
        
        const mediaDisplay = document.getElementById('media-display');
        mediaDisplay.style.display = 'none';
        
        this.showNotification('All calls ended', 'info');
    }

    addStreamToDisplay(stream, username, type) {
        const mediaDisplay = document.getElementById('media-display');
        const mediaGrid = document.getElementById('media-grid');
        
        mediaDisplay.style.display = 'block';
        
        const streamElement = document.createElement('div');
        streamElement.className = 'media-stream';
        streamElement.id = `stream-${username}-${type}`;
        
        if (type === 'screen' || type === 'video') {
            const video = document.createElement('video');
            video.srcObject = stream;
            video.autoplay = true;
            video.muted = type === 'video' && username === this.currentUser.username; // Mute own video
            streamElement.appendChild(video);
        }
        
        const streamInfo = document.createElement('div');
        streamInfo.className = 'stream-info';
        streamInfo.innerHTML = `${username} - ${type === 'screen' ? 'Screen Share' : type === 'video' ? 'Video Call' : 'Audio Call'}`;
        streamElement.appendChild(streamInfo);
        
        mediaGrid.appendChild(streamElement);
    }

    removeStreamFromDisplay(username, type) {
        const streamElement = document.getElementById(`stream-${username}-${type}`);
        if (streamElement) {
            streamElement.remove();
        }
        
        // Hide media display if no streams
        const mediaGrid = document.getElementById('media-grid');
        if (mediaGrid.children.length === 0) {
            document.getElementById('media-display').style.display = 'none';
        }
    }

    updateMediaButton(buttonId, active) {
        const button = document.getElementById(buttonId);
        button.classList.toggle('active', active);
    }

    updateActiveStreams() {
        const streamsList = document.getElementById('active-streams-list');
        const streams = [];
        
        if (this.webrtc.mediaDevices.screen) {
            streams.push({
                user: this.currentUser.username,
                type: 'Screen Share',
                icon: 'fas fa-desktop'
            });
        }
        
        if (this.webrtc.mediaDevices.video) {
            streams.push({
                user: this.currentUser.username,
                type: 'Video Call',
                icon: 'fas fa-video'
            });
        }
        
        if (this.webrtc.mediaDevices.audio && !this.webrtc.mediaDevices.video) {
            streams.push({
                user: this.currentUser.username,
                type: 'Voice Call',
                icon: 'fas fa-microphone'
            });
        }
        
        if (streams.length === 0) {
            streamsList.innerHTML = '<div class="no-streams">No active streams</div>';
        } else {
            streamsList.innerHTML = streams.map(stream => `
                <div class="stream-item">
                    <div class="stream-user">${stream.user}</div>
                    <div class="stream-type">
                        <i class="${stream.icon}"></i> ${stream.type}
                    </div>
                </div>
            `).join('');
        }
    }

    loadOnlineUsers() {
        // Simulate online users
        const sampleUsers = [
            { username: 'CyberAdmin', avatar: 'https://ui-avatars.com/api/?name=CyberAdmin&background=dc3545&color=fff', status: 'Admin' },
            { username: 'CodeMaster', avatar: 'https://ui-avatars.com/api/?name=CodeMaster&background=28a745&color=fff', status: 'Moderator' },
            { username: 'SecurityPro', avatar: 'https://ui-avatars.com/api/?name=SecurityPro&background=ffc107&color=000', status: 'Online' },
            { username: 'NetPhantom', avatar: 'https://ui-avatars.com/api/?name=NetPhantom&background=6f42c1&color=fff', status: 'Online' },
            { username: 'ByteBandit', avatar: 'https://ui-avatars.com/api/?name=ByteBandit&background=fd7e14&color=fff', status: 'Online' },
            { username: 'CryptoNinja', avatar: 'https://ui-avatars.com/api/?name=CryptoNinja&background=20c997&color=fff', status: 'Online' },
            { username: 'DataBreaker', avatar: 'https://ui-avatars.com/api/?name=DataBreaker&background=e83e8c&color=fff', status: 'Online' }
        ];
        
        // Add current user
        sampleUsers.unshift({
            username: this.currentUser.username,
            avatar: this.currentUser.avatar,
            status: 'You'
        });
        
        this.renderOnlineUsers(sampleUsers);
    }

    renderOnlineUsers(users) {
        const usersList = document.getElementById('online-users-list');
        
        usersList.innerHTML = users.map(user => `
            <div class="user-item">
                <img src="${user.avatar}" alt="${user.username}">
                <div class="user-info">
                    <div class="user-name">${user.username}</div>
                    <div class="user-status">${user.status}</div>
                </div>
            </div>
        `).join('');
    }



    loadMessages() {
        // Sample messages for demo
        const sampleMessages = [
            {
                id: this.generateId(),
                author: 'CyberAdmin',
                avatar: 'https://ui-avatars.com/api/?name=CyberAdmin&background=dc3545&color=fff',
                text: 'Welcome to **HackConvo**! This is a public chat platform for developers and tech enthusiasts. Feel free to use `code` formatting and @mention others!',
                timestamp: Date.now() - 3600000,
                own: false,
                reactions: [
                    { userId: 'user1', emoji: '👋', timestamp: Date.now() - 3595000 },
                    { userId: 'user2', emoji: '❤️', timestamp: Date.now() - 3590000 },
                    { userId: 'user3', emoji: '👍', timestamp: Date.now() - 3585000 }
                ]
            },
            {
                id: this.generateId(),
                author: 'CodeMaster',
                avatar: 'https://ui-avatars.com/api/?name=CodeMaster&background=28a745&color=fff',
                text: 'Hey everyone! Anyone working on *interesting* projects? I\'m currently building a web scraper using `requests` and `BeautifulSoup` in Python.',
                timestamp: Date.now() - 1800000,
                own: false,
                reactions: [
                    { userId: 'user4', emoji: '👍', timestamp: Date.now() - 1795000 },
                    { userId: 'user5', emoji: '😍', timestamp: Date.now() - 1790000 }
                ]
            },
            {
                id: this.generateId(),
                author: 'SecurityPro',
                avatar: 'https://ui-avatars.com/api/?name=SecurityPro&background=ffc107&color=000',
                text: 'Just finished a **penetration testing** project. The results were eye-opening! Found this SQL injection vulnerability:\n\n```sql\nSELECT * FROM users WHERE id = \'1\' OR \'1\'=\'1\';--\n```\n\nAlways sanitize your inputs! 🔐',
                timestamp: Date.now() - 900000,
                own: false,
                reactions: [
                    { userId: 'user6', emoji: '😱', timestamp: Date.now() - 895000 },
                    { userId: 'user7', emoji: '🔥', timestamp: Date.now() - 890000 },
                    { userId: 'user8', emoji: '👍', timestamp: Date.now() - 885000 }
                ]
            },
            {
                id: this.generateId(),
                author: this.currentUser.username,
                avatar: this.currentUser.avatar,
                text: 'Hello everyone! **Excited** to be here! Looking forward to learning from you all 🚀',
                timestamp: Date.now() - 300000,
                own: true,
                reactions: [
                    { userId: 'user9', emoji: '👋', timestamp: Date.now() - 295000 },
                    { userId: 'user10', emoji: '🎉', timestamp: Date.now() - 290000 }
                ]
            }
        ];

        this.messages = sampleMessages;
        this.renderMessages();
    }

    renderMessages() {
        const container = document.getElementById('messages-list');
        container.innerHTML = '';

        this.messages.forEach((message, index) => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.own ? 'own' : ''}`;
            messageEl.dataset.messageId = message.id;
            
            const isOnline = Math.random() > 0.3; // Simulate some users being online
            const reactions = message.reactions || [];
            const hasReactions = reactions.length > 0;
            
            messageEl.innerHTML = `
                <img src="${message.avatar}" alt="${message.author}" class="message-avatar">
                <div class="message-content">
                    <div class="message-header">
                        <span class="message-author">
                            ${message.author}
                            ${isOnline ? '<span class="user-status-dot"></span>' : ''}
                        </span>
                        <span class="message-time">${this.formatTime(message.timestamp)}</span>
                    </div>
                    <div class="message-text">${this.formatMessage(message.text)}</div>
                    ${hasReactions ? this.renderReactions(reactions) : ''}
                    <div class="message-actions">
                        <button class="message-action" onclick="app.toggleReaction('${message.id}', '👍')" title="Like">
                            <i class="fas fa-thumbs-up"></i>
                        </button>
                        <button class="message-action" onclick="app.toggleReaction('${message.id}', '❤️')" title="Love">
                            <i class="fas fa-heart"></i>
                        </button>
                        <button class="message-action" onclick="app.toggleReaction('${message.id}', '😂')" title="Laugh">
                            <i class="fas fa-laugh"></i>
                        </button>
                        <button class="message-action" onclick="app.replyToMessage('${message.id}')" title="Reply">
                            <i class="fas fa-reply"></i>
                        </button>
                    </div>
                </div>
            `;

            container.appendChild(messageEl);
        });

        this.scrollToBottom();
    }

    renderReactions(reactions) {
        if (!reactions || reactions.length === 0) return '';
        
        const reactionCounts = {};
        reactions.forEach(reaction => {
            reactionCounts[reaction.emoji] = (reactionCounts[reaction.emoji] || 0) + 1;
        });

        const reactionElements = Object.entries(reactionCounts).map(([emoji, count]) => 
            `<div class="reaction" onclick="app.toggleReaction('${message.id}', '${emoji}')">
                ${emoji} ${count}
            </div>`
        ).join('');

        return `<div class="message-reactions">${reactionElements}</div>`;
    }

    formatMessage(text) {
        // Auto-link URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        text = text.replace(urlRegex, '<a href="$1" target="_blank">$1</a>');
        
        // Format @mentions
        const mentionRegex = /@(\w+)/g;
        text = text.replace(mentionRegex, '<span class="mention">@$1</span>');
        
        // Format **bold**
        const boldRegex = /\*\*(.*?)\*\*/g;
        text = text.replace(boldRegex, '<strong>$1</strong>');
        
        // Format *italic*
        const italicRegex = /\*(.*?)\*/g;
        text = text.replace(italicRegex, '<em>$1</em>');
        
        // Format `code`
        const codeRegex = /`(.*?)`/g;
        text = text.replace(codeRegex, '<code>$1</code>');
        
        // Format ```code blocks```
        const codeBlockRegex = /```([\s\S]*?)```/g;
        text = text.replace(codeBlockRegex, '<pre><code>$1</code></pre>');
        
        return text;
    }

    toggleReaction(messageId, emoji) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        if (!message.reactions) message.reactions = [];
        
        // Check if user already reacted with this emoji
        const existingReaction = message.reactions.find(r => 
            r.userId === this.currentUser.id && r.emoji === emoji
        );

        if (existingReaction) {
            // Remove reaction
            message.reactions = message.reactions.filter(r => r !== existingReaction);
        } else {
            // Add reaction
            message.reactions.push({
                userId: this.currentUser.id,
                emoji: emoji,
                timestamp: Date.now()
            });
        }

        this.renderMessages();
        this.playSound('reaction');
    }

    replyToMessage(messageId) {
        const message = this.messages.find(m => m.id === messageId);
        if (!message) return;

        const input = document.getElementById('message-input');
        input.value = `@${message.author} `;
        input.focus();
        
        // Scroll to bottom to show input
        input.scrollIntoView({ behavior: 'smooth' });
    }

    sendMessage() {
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text) return;

        const message = {
            id: this.generateId(),
            author: this.currentUser.username,
            avatar: this.currentUser.avatar,
            text: text,
            timestamp: Date.now(),
            own: true
        };

        this.messages.push(message);
        input.value = '';
        this.updateCharCount();
        this.clearTyping();
        
        this.renderMessages();
        this.playSound('send');

        // Simulate responses (for demo)
        setTimeout(() => {
            this.simulateResponse(text);
        }, 1000 + Math.random() * 2000);
    }

    simulateResponse(originalMessage) {
        const responses = [
            "That's interesting! Tell me more.",
            "I agree with that point.",
            "Great question! Let me think about it.",
            "Thanks for sharing that information.",
            "I have a different perspective on this.",
            "Can you elaborate on that?",
            "That's a good point to consider.",
            "I've experienced something similar.",
            "Interesting take on the topic!"
        ];

        const authors = ['TechGuru', 'DevExpert', 'CyberSage', 'CodeNinja', 'DigitalWizard'];
        const author = authors[Math.floor(Math.random() * authors.length)];
        
        const response = {
            id: this.generateId(),
            author: author,
            avatar: `https://ui-avatars.com/api/?name=${author}&background=${this.getRandomColor()}&color=fff`,
            text: responses[Math.floor(Math.random() * responses.length)],
            timestamp: Date.now(),
            own: false
        };

        this.messages.push(response);
        this.renderMessages();
        this.playSound('receive');
        
        // Update conversation preview
        const conv = this.conversations.find(c => c.id === this.currentChat);
        if (conv) {
            conv.lastMessage = response.text;
            conv.lastMessageTime = response.timestamp;
            this.renderConversations();
        }
    }

    getRandomColor() {
        const colors = ['007bff', '28a745', 'dc3545', 'ffc107', '17a2b8', '6f42c1', 'fd7e14'];
        return colors[Math.floor(Math.random() * colors.length)];
    }

    updateCharCount() {
        const input = document.getElementById('message-input');
        const count = document.getElementById('char-count');
        const length = input.value.length;
        
        count.textContent = length;
        
        if (length > 1800) {
            count.style.color = 'var(--unread-color)';
        } else if (length > 1500) {
            count.style.color = 'var(--accent-secondary)';
        } else {
            count.style.color = 'var(--text-muted)';
        }
    }

    handleTyping() {
        // Simulate typing indicator
        const indicator = document.getElementById('typing-indicator');
        indicator.classList.add('show');
        
        clearTimeout(this.typingTimeout);
        this.typingTimeout = setTimeout(() => {
            indicator.classList.remove('show');
        }, 1000);
    }

    clearTyping() {
        const indicator = document.getElementById('typing-indicator');
        indicator.classList.remove('show');
        clearTimeout(this.typingTimeout);
    }

    setupTypingIndicator() {
        // Simulate other users typing occasionally
        setInterval(() => {
            if (Math.random() < 0.1) { // 10% chance every 5 seconds
                this.showTyping();
            }
        }, 5000);
    }

    showTyping() {
        const indicator = document.getElementById('typing-indicator');
        const authors = ['DevExpert', 'CyberSage', 'TechGuru'];
        const author = authors[Math.floor(Math.random() * authors.length)];
        
        document.querySelector('.typing-text').textContent = `${author} is typing...`;
        indicator.classList.add('show');
        
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000 + Math.random() * 3000);
    }

    scrollToBottom() {
        const container = document.getElementById('messages-list');
        container.scrollTop = container.scrollHeight;
        
        // Hide scroll-to-bottom button
        document.getElementById('scroll-to-bottom').classList.remove('show');
    }

    updateOnlineCount() {
        // Simulate online users
        const count = 120 + Math.floor(Math.random() * 20); // 120-140 users
        
        // Update all online count displays
        const onlineCountEl = document.getElementById('online-count');
        const headerOnlineCountEl = document.getElementById('header-online-count');
        const sidebarCounter = document.getElementById('sidebar-online-count');
        
        if (onlineCountEl) onlineCountEl.textContent = count;
        if (headerOnlineCountEl) headerOnlineCountEl.textContent = count;
        if (sidebarCounter) sidebarCounter.textContent = `${count} online`;
        
        // Add some simulated user activity
        this.onlineUsers.clear();
        for (let i = 0; i < count; i++) {
            this.onlineUsers.add(`user${i}`);
        }
        
        // Update periodically
        setTimeout(() => {
            const newCount = Math.max(100, count + Math.floor(Math.random() * 10) - 5);
            if (onlineCountEl) onlineCountEl.textContent = newCount;
            if (headerOnlineCountEl) headerOnlineCountEl.textContent = newCount;
            if (sidebarCounter) sidebarCounter.textContent = `${newCount} online`;
            this.updateOnlineCount(); // Recursive update
        }, 30000 + Math.random() * 30000);
    }

    startHeartbeat() {
        // Simulate connection status
        const statusIcon = document.querySelector('.messages-network-status');
        
        setInterval(() => {
            if (Math.random() < 0.95) { // 95% uptime
                statusIcon.className = 'fa fa-wifi fa-lg green messages-network-status';
                statusIcon.title = 'Connected';
            } else {
                statusIcon.className = 'fa fa-wifi fa-lg text-danger messages-network-status';
                statusIcon.title = 'Connection issues';
            }
        }, 10000);
    }



    openSettingsModal() {
        const modal = document.getElementById('settings-modal');
        modal.style.display = 'block';
        
        // Populate current settings
        document.getElementById('username-input').value = this.currentUser.username;
        document.getElementById('theme-select').value = localStorage.getItem('theme') || 'dark';
        document.getElementById('sound-notifications').checked = this.sounds.enabled;
    }

    setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }

    playSound(type) {
        if (!this.sounds.enabled) return;
        
        // Create audio context for sound effects
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different sounds for different actions
            switch(type) {
                case 'send':
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.15, audioContext.currentTime);
                    break;
                case 'receive':
                    oscillator.frequency.setValueAtTime(400, audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
                    break;
                case 'reaction':
                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.05);
                    gainNode.gain.setValueAtTime(0.08, audioContext.currentTime);
                    break;
                case 'typing':
                    oscillator.frequency.setValueAtTime(300, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.05, audioContext.currentTime);
                    break;
                case 'notification':
                    oscillator.frequency.setValueAtTime(600, audioContext.currentTime);
                    oscillator.frequency.setValueAtTime(800, audioContext.currentTime + 0.1);
                    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.2);
                    gainNode.gain.setValueAtTime(0.12, audioContext.currentTime);
                    break;
                default:
                    oscillator.frequency.setValueAtTime(500, audioContext.currentTime);
                    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            }
            
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (e) {
            // Fallback for browsers without Web Audio API
            console.log('Audio not supported');
        }
    }

    formatTime(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}m ago`;
        if (hours < 24) return `${hours}h ago`;
        if (days < 7) return `${days}d ago`;
        
        return new Date(timestamp).toLocaleDateString();
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Global functions
function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('open');
}

function scrollToBottom() {
    const container = document.getElementById('messages-list');
    container.scrollTop = container.scrollHeight;
}

function startNewChat() {
    // Not needed in single room chat
    console.log('Single room chat - no new chat needed');
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function saveSettings() {
    const username = document.getElementById('username-input').value.trim();
    const theme = document.getElementById('theme-select').value;
    const soundEnabled = document.getElementById('sound-notifications').checked;
    
    if (username && username !== app.currentUser.username) {
        app.currentUser.username = username;
        app.currentUser.avatar = `https://ui-avatars.com/api/?name=${username}&background=333&color=fff`;
        app.saveUser(app.currentUser);
    }
    
    app.setTheme(theme);
    app.sounds.enabled = soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled);
    
    closeModal('settings-modal');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new HackConvo();
    
    // Handle scroll-to-bottom visibility
    const messagesContainer = document.getElementById('messages-list');
    const scrollButton = document.getElementById('scroll-to-bottom');
    
    messagesContainer.addEventListener('scroll', () => {
        const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
        const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
        
        if (isNearBottom) {
            scrollButton.classList.remove('show');
        } else {
            scrollButton.classList.add('show');
        }
    });
    
    // Handle modal clicks
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            e.target.style.display = 'none';
        }
    });
    
    // Auto-resize textarea
    const messageInput = document.getElementById('message-input');
    messageInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
});

// Handle page visibility for notifications
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        // Page is hidden - could implement desktop notifications here
    } else {
        // Page is visible - reset any notification indicators
        document.title = 'HackConvo - Public Chat';
    }
});