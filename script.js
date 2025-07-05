// HackConvo - Real-time Public Chat Application JavaScript
class HackConvo {
    constructor() {
        this.currentUser = this.loadUser();
        
        // Handle unregistered users
        if (!this.currentUser) {
            console.log('User not registered - enabling read-only mode');
            this.isReadOnly = true;
        } else {
            // Ensure currentUser has all required properties
            if (!this.currentUser.avatar) {
                this.currentUser.avatar = `https://ui-avatars.com/api/?name=${this.currentUser.username}&background=333&color=fff`;
                this.saveUser(this.currentUser);
            }
            this.isReadOnly = false;
        }
        
        this.messages = [];
        this.onlineUsers = new Map();
        this.activeStreams = new Map();
        this.typingUsers = new Map();
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
        
        // WebSocket connection
        this.ws = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 1000;
        this.heartbeatInterval = null;
        this.typingTimeout = null;
        this.lastTypingTime = 0;
        
        this.init();
    }

    init() {
        console.log('Initializing HackConvo with user:', this.currentUser);
        
        // Prevent multiple initializations
        if (this.initialized) {
            console.log('Already initialized, skipping...');
            return;
        }
        this.initialized = true;
        
        this.setupEventListeners();
        this.setupMediaControls();
        this.setupHeaderControls();
        this.loadMessages();
        
        if (this.isReadOnly) {
            this.setupReadOnlyMode();
        } else {
            this.initUserProfile();
            this.connectWebSocket();
            this.setupTypingIndicator();
        }
        
        // Load saved theme
        const savedTheme = localStorage.getItem('theme') || 'dark';
        this.setTheme(savedTheme);
        
        // Firebase will handle real-time users and messages
    }

    connectWebSocket() {
        console.log('[DEBUG] Attempting to connect to Firebase...');
        console.log('[DEBUG] Firebase database available:', !!window.firebaseDatabase);
        console.log('[DEBUG] Firebase ref available:', !!window.firebaseRef);
        
        try {
            // Wait for Firebase to be available
            if (window.firebaseDatabase && window.firebaseRef) {
                console.log('[DEBUG] Firebase is ready, connecting...');
                this.connectFirebase();
            } else {
                console.log('[DEBUG] Firebase not ready, waiting...');
                // Wait a bit for Firebase to load
                setTimeout(() => {
                    if (window.firebaseDatabase && window.firebaseRef) {
                        console.log('[DEBUG] Firebase is now ready, connecting...');
                        this.connectFirebase();
                    } else {
                        console.error('[DEBUG] Firebase not available after timeout, enabling simulated mode');
                        this.updateConnectionStatus(false);
                        this.enableSimulatedMode();
                    }
                }, 2000); // Increased timeout
            }
        } catch (error) {
            console.error('[DEBUG] Failed to connect:', error);
            this.updateConnectionStatus(false);
            this.enableSimulatedMode();
        }
    }

    connectFirebase() {
        try {
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.push = window.firebasePush;
            this.onValue = window.firebaseOnValue;
            this.off = window.firebaseOff;
            this.remove = window.firebaseRemove;
            this.child = window.firebaseChild;
            
            console.log('Firebase connected');
            this.updateConnectionStatus(true);
            this.reconnectAttempts = 0;
            this.startHeartbeat();
            
            // Subscribe to messages
            this.messagesRef = this.ref(this.database, 'messages');
            this.onValue(this.messagesRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.handleFirebaseMessages(data);
                }
            });
            
            // Subscribe to online users
            this.usersRef = this.ref(this.database, 'users');
            this.onValue(this.usersRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.handleFirebaseUsers(data);
                }
            });
            
            // Add current user to online users (only if registered)
            if (!this.isReadOnly) {
                this.addUserToFirebase();
            }
            
            // Start periodic cleanup of old messages
            this.startPeriodicCleanup();
            
        } catch (error) {
            console.error('Failed to connect to Firebase:', error);
            this.updateConnectionStatus(false);
            this.enableSimulatedMode();
        }
    }

    startPeriodicCleanup() {
        // Clean up old messages based on config
        const cleanupInterval = 10; // minutes (was: window.HACKCONVO_CONFIG?.CLEANUP_INTERVAL_MINUTES || 60)
        setInterval(() => {
            if (this.messagesRef) {
                console.log('[DEBUG] Running periodic message cleanup...');
                this.performPeriodicCleanup();
            }
        }, cleanupInterval * 60 * 1000); // Every 10 minutes
    }

    performPeriodicCleanup() {
        const retentionHours = window.HACKCONVO_CONFIG?.MESSAGE_RETENTION_HOURS || 4;
        const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000);
        this.onValue(this.messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                const messages = Object.entries(data);
                const oldMessages = messages.filter(([key, message]) => message.timestamp < cutoffTime);
                if (oldMessages.length > 0 && this.remove && this.child) {
                    console.log(`[DEBUG] Periodic cleanup: removing ${oldMessages.length} old messages`);
                    oldMessages.forEach(([key, message]) => {
                        const messageRef = this.child(this.messagesRef, key);
                        this.remove(messageRef);
                        console.log('[DEBUG] Deleted message:', key, message);
                    });
                } else {
                    console.log('[DEBUG] No old messages to clean up.');
                }
            }
        }, { onlyOnce: true });
    }

    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'message':
                this.handleIncomingMessage(data);
                break;
            case 'typing':
                this.handleTypingIndicator(data);
                break;
            case 'user_join':
                this.handleUserJoin(data);
                break;
            case 'user_leave':
                this.handleUserLeave(data);
                break;
            case 'online_users':
                this.handleOnlineUsers(data);
                break;
            case 'pong':
                // Heartbeat response
                break;
            default:
                console.log('Unknown message type:', data.type);
        }
    }

    handleEchoMessage(data) {
        // Since we're using echo server, we need to filter out our own messages
        try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'message') {
                // Only handle messages from other users
                if (parsed.author !== this.currentUser.username) {
                    this.handleIncomingMessage(parsed);
                }
                // For our own messages, just clear typing indicator
                else {
                    this.typingUsers.delete(parsed.author);
                    this.updateTypingIndicator();
                }
            }
        } catch (e) {
            // Not JSON, ignore
        }
    }

    sendFirebaseMessage(message) {
        if (!this.push || !this.messagesRef) {
            console.log('Firebase not available, message sent locally only');
            return;
        }
        this.push(this.messagesRef, message).then(() => {
            // After sending, clean up old messages
            this.onValue(this.messagesRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    const entries = Object.entries(data).sort((a, b) => a[1].timestamp - b[1].timestamp);
                    if (entries.length > 20 && this.remove && this.child) {
                        const toDelete = entries.slice(0, entries.length - 20);
                        toDelete.forEach(([key, msg]) => {
                            const messageRef = this.child(this.messagesRef, key);
                            this.remove(messageRef);
                            console.log('[DEBUG] Deleted old message to keep last 20:', key, msg);
                        });
                    }
                }
            }, { onlyOnce: true });
        });
    }

    addUserToFirebase() {
        if (this.ref && this.database) {
            // Generate a unique session ID for this session
            if (!this.sessionId) {
                this.sessionId = this.generateId();
            }
            const userPath = `users/${this.currentUser.username}/${this.sessionId}`;
            const userRef = this.ref(this.database, userPath);
            const userData = {
                ...this.currentUser,
                lastSeen: Date.now(),
                status: 'online',
                sessionId: this.sessionId
            };
            console.log('[DEBUG] Adding user to Firebase at', userPath, userData);
            // Use set() instead of push()
            import('https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js').then(({ set, onDisconnect }) => {
                set(userRef, userData).then(() => {
                    onDisconnect(userRef).remove();
                    console.log('[DEBUG] onDisconnect set for user session:', userPath);
                });
            });
        } else {
            console.warn('[DEBUG] addUserToFirebase: ref or database not available');
        }
    }

    handleFirebaseMessages(data) {
        // Convert Firebase object to array and sort by timestamp
        const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
        
        // Filter out messages older than configured retention time
        const retentionHours = window.HACKCONVO_CONFIG?.MESSAGE_RETENTION_HOURS || 4;
        const cutoffTime = Date.now() - (retentionHours * 60 * 60 * 1000);
        const recentMessages = messages.filter(message => message.timestamp > cutoffTime);
        
        // Only process new messages
        const lastMessageId = localStorage.getItem('lastFirebaseMessageId');
        let newMessages = recentMessages;
        
        if (lastMessageId) {
            const lastMessageIndex = recentMessages.findIndex(m => m.id === lastMessageId);
            if (lastMessageIndex !== -1) {
                newMessages = recentMessages.slice(lastMessageIndex + 1);
            }
        }
        
        // Process new messages
        newMessages.forEach(message => {
            if (message.author !== this.currentUser.username) {
                this.handleIncomingMessage(message);
            }
        });
        
        // Store last message ID
        if (recentMessages.length > 0) {
            localStorage.setItem('lastFirebaseMessageId', recentMessages[recentMessages.length - 1].id);
        }
        
        // Clean up old messages from Firebase
        this.cleanupOldMessages(messages, cutoffTime);
    }

    cleanupOldMessages(allMessages, cutoffTime) {
        // Only run cleanup every 5 minutes to avoid excessive operations
        const lastCleanup = localStorage.getItem('lastCleanupTime');
        const now = Date.now();
        
        const throttleMinutes = window.HACKCONVO_CONFIG?.CLEANUP_THROTTLE_MINUTES || 5;
        if (lastCleanup && (now - parseInt(lastCleanup)) < throttleMinutes * 60 * 1000) {
            return; // Skip cleanup if it was done recently
        }
        
        // Find old messages to remove
        const oldMessages = allMessages.filter(message => message.timestamp < cutoffTime);
        
        if (oldMessages.length > 0 && this.remove && this.child) {
            console.log(`Cleaning up ${oldMessages.length} old messages`);
            
            // Remove old messages from Firebase
            oldMessages.forEach(message => {
                if (message.key) { // Firebase provides a 'key' property for each message
                    const messageRef = this.child(this.messagesRef, message.key);
                    this.remove(messageRef);
                }
            });
            
            // Update last cleanup time
            localStorage.setItem('lastCleanupTime', now.toString());
        }
    }

    handleFirebaseUsers(data) {
        console.log('[DEBUG] handleFirebaseUsers received data:', data);
        // Flatten all user objects from all subkeys
        const users = [];
        const now = Date.now();
        const ONLINE_THRESHOLD = 30 * 1000; // 30 seconds
        Object.values(data).forEach(userGroup => {
            if (typeof userGroup === 'object') {
                Object.values(userGroup).forEach(userObj => {
                    if (
                        userObj &&
                        userObj.username &&
                        userObj.lastSeen &&
                        (now - userObj.lastSeen < ONLINE_THRESHOLD)
                    ) {
                        users.push(userObj);
                    }
                });
            }
        });
        
        // Clear current online users
        this.onlineUsers.clear();
        
        // Add all users, but handle duplicates by preferring users with session IDs
        console.log('[DEBUG] Adding users to onlineUsers Map:');
        const userMap = new Map(); // Temporary map to handle duplicates
        
        users.forEach(user => {
            const key = user.username + ':' + (user.sessionId || '');
            console.log('- Processing user:', user.username, 'with key:', key);
            
            // If we already have this user, prefer the one with a session ID
            const existingUser = userMap.get(user.username);
            if (existingUser) {
                if (user.sessionId && !existingUser.sessionId) {
                    // New user has session ID, existing doesn't - replace
                    console.log('- Replacing user without session ID with user that has session ID');
                    userMap.set(user.username, user);
                } else if (!user.sessionId && existingUser.sessionId) {
                    // Existing user has session ID, new doesn't - keep existing
                    console.log('- Keeping existing user with session ID');
                } else {
                    // Both have or don't have session ID - keep the newer one
                    if (user.lastSeen > existingUser.lastSeen) {
                        console.log('- Replacing with newer user');
                        userMap.set(user.username, user);
                    } else {
                        console.log('- Keeping existing user (newer)');
                    }
                }
            } else {
                // First time seeing this user
                console.log('- Adding new user:', user.username);
                userMap.set(user.username, user);
            }
        });
        
        // Now add to onlineUsers Map with proper keys
        userMap.forEach(user => {
            const key = user.username + ':' + (user.sessionId || '');
            console.log('- Final add to onlineUsers:', user.username, 'with key:', key);
            this.onlineUsers.set(key, user);
        });
        
        // Ensure current user is in the online users list if they're online
        const currentUserInList = users.find(user => user.username === this.currentUser.username);
        console.log('[DEBUG] Current user in Firebase data:', !!currentUserInList);
        if (!currentUserInList) {
            // Add current user if they're not in the Firebase data but should be online
            const currentUserKey = this.currentUser.username + ':' + (this.sessionId || '');
            console.log('- Adding current user with key:', currentUserKey);
            this.onlineUsers.set(currentUserKey, {
                ...this.currentUser,
                lastSeen: Date.now(),
                status: 'online',
                sessionId: this.sessionId
            });
        }
        
        // Update UI
        this.renderOnlineUsers();
        this.updateOnlineCount();
    }

    handleIncomingMessage(data) {
        // Don't add our own messages again (they're already displayed)
        if (data.author === this.currentUser.username) {
            return;
        }

        const message = {
            id: data.id || this.generateId(),
            author: data.author,
            avatar: data.avatar,
            text: data.text,
            timestamp: data.timestamp || Date.now(),
            own: false
        };

        this.messages.push(message);
        this.renderMessages();
        this.playSound('receive');
        this.updateMessagesToday();
        
        // Clear typing indicator for this user
        this.typingUsers.delete(data.author);
        this.updateTypingIndicator();
    }

    handleTypingIndicator(data) {
        if (data.author !== this.currentUser.username) {
            this.typingUsers.set(data.author, Date.now());
            this.updateTypingIndicator();
            
            // Clear typing indicator after 3 seconds
            setTimeout(() => {
                this.typingUsers.delete(data.author);
                this.updateTypingIndicator();
            }, 3000);
        }
    }

    handleUserJoin(data) {
        this.onlineUsers.set(data.user.username, data.user);
        this.updateOnlineUsers();
        this.updateOnlineCount();
        
        if (data.user.username !== this.currentUser.username) {
            this.showNotification(`${data.user.username} joined the chat`, 'info');
        }
    }

    handleUserLeave(data) {
        this.onlineUsers.delete(data.username);
        this.typingUsers.delete(data.username);
        this.updateOnlineUsers();
        this.updateOnlineCount();
        this.updateTypingIndicator();
        
        if (data.username !== this.currentUser.username) {
            this.showNotification(`${data.username} left the chat`, 'info');
        }
    }

    handleOnlineUsers(data) {
        this.onlineUsers.clear();
        data.users.forEach(user => {
            this.onlineUsers.set(user.username, user);
        });
        this.updateOnlineUsers();
        this.updateOnlineCount();
    }

    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const connectionIcon = document.getElementById('connection-icon');
        const latency = document.getElementById('latency');
        
        if (connected) {
            statusDot.style.color = 'var(--online-color)';
            statusText.textContent = 'Connected';
            connectionIcon.className = 'fas fa-wifi';
            latency.textContent = '12ms';
        } else {
            statusDot.style.color = 'var(--offline-color)';
            statusText.textContent = 'Disconnected';
            connectionIcon.className = 'fas fa-wifi text-danger';
            latency.textContent = '--';
        }
    }

    scheduleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
            
            this.showNotification(`Reconnecting in ${delay/1000}s... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`, 'warning');
            
            setTimeout(() => {
                this.connectWebSocket();
            }, delay);
        } else {
            this.showNotification('Connection failed. Using offline mode.', 'error');
            this.enableSimulatedMode();
        }
    }

    enableSimulatedMode() {
        console.warn('[DEBUG] enableSimulatedMode called: entering simulated mode');
        this.showNotification('Firebase connection failed. Using simulated mode.', 'warning');
        this.updateConnectionStatus(false);
        
        // Add simulated users for demo purposes
        this.loadSimulatedOnlineUsers();
        this.updateOnlineCount();
    }

    startHeartbeat() {
        this.heartbeatInterval = setInterval(() => {
            // Update user's last seen timestamp
            if (this.push && this.usersRef && this.database) {
                const userRef = this.ref(this.database, `users/${this.currentUser.username}`);
                this.push(userRef, {
                    ...this.currentUser,
                    lastSeen: Date.now(),
                    status: 'online'
                });
            }
        }, 30000); // Update every 30 seconds
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
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
                this.clearTyping();
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
            setTimeout(() => {
                if (document.body.contains(toast)) {
                    document.body.removeChild(toast);
                }
            }, 300);
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
            
            // Notify server of username change
            this.sendWebSocketMessage({
                type: 'username_change',
                oldUsername: this.currentUser.username,
                newUsername: newUsername,
                user: this.currentUser
            });
            
            this.showNotification(`Username changed to ${newUsername}`, 'success');
        }
    }

    loadUser() {
        const savedUser = localStorage.getItem('hackconvo_user');
        if (savedUser) {
            try {
                const user = JSON.parse(savedUser);
                console.log('Loaded saved user:', user);
                
                // Ensure the user has all required properties
                if (!user.avatar) {
                    user.avatar = `https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff`;
                    this.saveUser(user);
                }
                
                // Mark as registered
                user.isRegistered = true;
                return user;
            } catch (error) {
                console.error('Error parsing saved user:', error);
                localStorage.removeItem('hackconvo_user');
            }
        }
        
        // Return null for unregistered users (no auto-generated user)
        console.log('No registered user found - read-only mode');
        return null;
    }

    saveUser(user) {
        localStorage.setItem('hackconvo_user', JSON.stringify(user));
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    setupHeaderControls() {
        // Notifications button
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

        // User avatar click
        document.getElementById('user-avatar-container').addEventListener('click', () => {
            this.toggleUserMenu();
        });

        // Close user menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#user-avatar-container')) {
                this.closeUserMenu();
            }
        });
    }

    setupReadOnlyMode() {
        console.log('Setting up read-only mode');
        
        // Update header to show "Guest" status
        document.getElementById('header-username').textContent = 'Guest';
        document.getElementById('user-avatar').src = 'https://ui-avatars.com/api/?name=Guest&background=666&color=fff';
        document.getElementById('user-status-text').textContent = 'Read Only';
        
        // Disable message input and show registration prompt
        const messageInput = document.getElementById('message-input');
        const inputContainer = document.querySelector('.input-container');
        const sendBtn = document.getElementById('send-btn');
        
        // Disable input
        messageInput.disabled = true;
        messageInput.placeholder = 'Register to start chatting...';
        sendBtn.disabled = true;
        
        // Add clickable placeholder text
        const placeholderText = document.createElement('div');
        placeholderText.className = 'clickable-placeholder';
        placeholderText.innerHTML = '<a href="register.html">Register to start chatting...</a>';
        placeholderText.style.cssText = `
            position: absolute;
            top: 50%;
            left: 1rem;
            transform: translateY(-50%);
            color: var(--text-muted);
            pointer-events: none;
            z-index: 5;
        `;
        
        // Make the link clickable
        const link = placeholderText.querySelector('a');
        link.style.cssText = `
            color: var(--accent-primary);
            text-decoration: none;
            pointer-events: auto;
            cursor: pointer;
        `;
        link.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'register.html';
        });
        
        inputContainer.appendChild(placeholderText);
        
        // Add registration prompt overlay
        const promptOverlay = document.createElement('div');
        promptOverlay.className = 'read-only-prompt';
        promptOverlay.innerHTML = `
            <div class="prompt-content">
                <i class="fas fa-user-plus"></i>
                <h3>Join the Conversation</h3>
                <p>Register to start chatting with other developers</p>
                <div class="prompt-buttons">
                    <a href="register.html" class="btn btn-primary">Register</a>
                    <a href="login.html" class="btn btn-secondary">Login</a>
                </div>
            </div>
        `;
        
        inputContainer.appendChild(promptOverlay);
        
        // Connect to Firebase for read-only access (messages and users)
        this.connectWebSocket();
    }

    initUserProfile() {
        console.log('Initializing user profile with:', this.currentUser);
        
        if (!this.currentUser || !this.currentUser.username) {
            console.error('Current user is invalid:', this.currentUser);
            return;
        }
        
        document.getElementById('header-username').textContent = this.currentUser.username;
        
        // Ensure avatar URL is valid
        const avatarUrl = this.currentUser.avatar || `https://ui-avatars.com/api/?name=${this.currentUser.username}&background=333&color=fff`;
        console.log('Setting avatar URL:', avatarUrl);
        
        // Double-check the URL is valid
        if (avatarUrl && avatarUrl !== 'undefined' && !avatarUrl.includes('undefined')) {
            document.getElementById('user-avatar').src = avatarUrl;
        } else {
            console.error('Invalid avatar URL:', avatarUrl);
            document.getElementById('user-avatar').src = `https://ui-avatars.com/api/?name=${this.currentUser.username}&background=333&color=fff`;
        }
        
        document.getElementById('user-status-text').textContent = 'Online';
    }

    toggleNotifications() {
        // Toggle notification badge
        const badge = document.getElementById('notification-badge');
        const isVisible = badge.style.display !== 'none';
        
        if (isVisible) {
            badge.style.display = 'none';
            this.showNotification('Notifications disabled', 'warning');
        } else {
            badge.style.display = 'block';
            badge.textContent = '3';
            this.showNotification('Notifications enabled', 'success');
        }
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.log('Error attempting to enable fullscreen:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    toggleUserMenu() {
        const menu = document.getElementById('user-menu');
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }

    closeUserMenu() {
        document.getElementById('user-menu').style.display = 'none';
    }

    updateServerStatus() {
        const statusDot = document.getElementById('status-dot');
        const statusText = document.getElementById('status-text');
        const connectionIcon = document.getElementById('connection-icon');
        const latency = document.getElementById('latency');
        
        // Simulate connection quality
        const qualities = [
            { icon: 'fas fa-wifi', latency: '8ms', color: 'var(--online-color)' },
            { icon: 'fas fa-wifi', latency: '12ms', color: 'var(--online-color)' },
            { icon: 'fas fa-wifi', latency: '18ms', color: 'var(--accent-secondary)' },
            { icon: 'fas fa-wifi', latency: '25ms', color: 'var(--text-muted)' }
        ];
        
        const quality = qualities[Math.floor(Math.random() * qualities.length)];
        
        statusDot.style.color = quality.color;
        connectionIcon.className = quality.icon;
        latency.textContent = quality.latency;
        
        // Update every 10 seconds
        setTimeout(() => this.updateServerStatus(), 10000);
    }

    updateHeaderStats() {
        this.updateMessagesToday();
        this.updateActiveStreamsCount();
        this.updateOnlineCount();
    }

    updateMessagesToday() {
        const today = new Date().toDateString();
        const todayMessages = this.messages.filter(msg => 
            new Date(msg.timestamp).toDateString() === today
        ).length;
        
        document.getElementById('messages-today').textContent = this.formatNumber(todayMessages);
    }

    updateActiveStreamsCount() {
        const count = this.activeStreams.size;
        document.getElementById('active-streams-count').textContent = count;
    }

    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    setupMediaControls() {
        // Screen share
        document.getElementById('screen-share-btn').addEventListener('click', () => {
            this.toggleScreenShare();
        });

        // Voice call
        document.getElementById('voice-call-btn').addEventListener('click', () => {
            this.toggleAudio();
        });

        // Video call
        document.getElementById('video-call-btn').addEventListener('click', () => {
            this.toggleVideo();
        });

        // Media controls
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
        if (this.webrtc.screen) {
            await this.stopScreenShare();
        } else {
            await this.startScreenShare();
        }
    }

    async startScreenShare() {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({
                video: true,
                audio: true
            });
            
            this.webrtc.screenStream = stream;
            this.webrtc.screen = true;
            
            this.addStreamToDisplay(stream, this.currentUser.username, 'screen');
            this.updateMediaButton('screen-share-btn', true);
            
            this.showNotification('Screen sharing started', 'success');
            
            // Handle stream end
            stream.getVideoTracks()[0].onended = () => {
                this.stopScreenShare();
            };
            
        } catch (error) {
            console.error('Error starting screen share:', error);
            this.showNotification('Failed to start screen share', 'error');
        }
    }

    async stopScreenShare() {
        if (this.webrtc.screenStream) {
            this.webrtc.screenStream.getTracks().forEach(track => track.stop());
            this.webrtc.screenStream = null;
            this.webrtc.screen = false;
            
            this.removeStreamFromDisplay(this.currentUser.username, 'screen');
            this.updateMediaButton('screen-share-btn', false);
            
            this.showNotification('Screen sharing stopped', 'info');
        }
    }

    async toggleAudio() {
        if (this.webrtc.mediaDevices.audio) {
            await this.stopAudio();
        } else {
            await this.startAudio();
        }
    }

    async startAudio() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: false
            });
            
            this.webrtc.localStream = stream;
            this.webrtc.mediaDevices.audio = true;
            
            this.addStreamToDisplay(stream, this.currentUser.username, 'audio');
            this.updateMediaButton('voice-call-btn', true);
            
            this.showNotification('Voice chat started', 'success');
            
        } catch (error) {
            console.error('Error starting audio:', error);
            this.showNotification('Failed to start voice chat', 'error');
        }
    }

    async stopAudio() {
        if (this.webrtc.localStream) {
            this.webrtc.localStream.getAudioTracks().forEach(track => track.stop());
            this.webrtc.localStream = null;
            this.webrtc.mediaDevices.audio = false;
            
            this.removeStreamFromDisplay(this.currentUser.username, 'audio');
            this.updateMediaButton('voice-call-btn', false);
            
            this.showNotification('Voice chat stopped', 'info');
        }
    }

    async toggleVideo() {
        if (this.webrtc.mediaDevices.video) {
            await this.stopVideo();
        } else {
            await this.startVideo();
        }
    }

    async startVideo() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: true
            });
            
            this.webrtc.localStream = stream;
            this.webrtc.mediaDevices.video = true;
            
            this.addStreamToDisplay(stream, this.currentUser.username, 'video');
            this.updateMediaButton('video-call-btn', true);
            
            this.showNotification('Video chat started', 'success');
            
        } catch (error) {
            console.error('Error starting video:', error);
            this.showNotification('Failed to start video chat', 'error');
        }
    }

    async stopVideo() {
        if (this.webrtc.localStream) {
            this.webrtc.localStream.getTracks().forEach(track => track.stop());
            this.webrtc.localStream = null;
            this.webrtc.mediaDevices.video = false;
            
            this.removeStreamFromDisplay(this.currentUser.username, 'video');
            this.updateMediaButton('video-call-btn', false);
            
            this.showNotification('Video chat stopped', 'info');
        }
    }

    toggleMute() {
        if (this.webrtc.localStream) {
            const audioTrack = this.webrtc.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                const muteBtn = document.getElementById('mute-btn');
                muteBtn.innerHTML = audioTrack.enabled ? 
                    '<i class="fas fa-microphone"></i>' : 
                    '<i class="fas fa-microphone-slash"></i>';
                
                this.showNotification(
                    audioTrack.enabled ? 'Microphone unmuted' : 'Microphone muted', 
                    'info'
                );
            }
        }
    }

    toggleCamera() {
        if (this.webrtc.localStream) {
            const videoTrack = this.webrtc.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                const cameraBtn = document.getElementById('camera-btn');
                cameraBtn.innerHTML = videoTrack.enabled ? 
                    '<i class="fas fa-video"></i>' : 
                    '<i class="fas fa-video-slash"></i>';
                
                this.showNotification(
                    videoTrack.enabled ? 'Camera enabled' : 'Camera disabled', 
                    'info'
                );
            }
        }
    }

    endAllCalls() {
        this.stopScreenShare();
        this.stopAudio();
        this.stopVideo();
        
        // Hide media display
        document.getElementById('media-display').style.display = 'none';
        
        this.showNotification('All calls ended', 'info');
    }

    addStreamToDisplay(stream, username, type) {
        const mediaDisplay = document.getElementById('media-display');
        const mediaGrid = document.getElementById('media-grid');
        
        // Show media display
        mediaDisplay.style.display = 'block';
        
        // Create stream element
        const streamElement = document.createElement('div');
        streamElement.className = 'media-stream';
        streamElement.id = `stream-${username}-${type}`;
        
        const video = document.createElement('video');
        video.autoplay = true;
        video.muted = type === 'audio' || type === 'screen';
        video.srcObject = stream;
        
        const streamInfo = document.createElement('div');
        streamInfo.className = 'stream-info';
        streamInfo.textContent = `${username} - ${type}`;
        
        streamElement.appendChild(video);
        streamElement.appendChild(streamInfo);
        mediaGrid.appendChild(streamElement);
        
        // Store stream reference
        this.activeStreams.set(`${username}-${type}`, streamElement);
        
        this.updateActiveStreams();
    }

    removeStreamFromDisplay(username, type) {
        const streamId = `${username}-${type}`;
        const streamElement = document.getElementById(`stream-${streamId}`);
        
        if (streamElement) {
            streamElement.remove();
            this.activeStreams.delete(streamId);
        }
        
        this.updateActiveStreams();
        
        // Hide media display if no streams
        if (this.activeStreams.size === 0) {
            document.getElementById('media-display').style.display = 'none';
        }
    }

    updateMediaButton(buttonId, active) {
        const button = document.getElementById(buttonId);
        if (active) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    }

    updateActiveStreams() {
        const streamsList = document.getElementById('active-streams-list');
        const noStreams = streamsList.querySelector('.no-streams');
        
        if (this.activeStreams.size === 0) {
            if (!noStreams) {
                streamsList.innerHTML = '<div class="no-streams">No active streams</div>';
            }
        } else {
            if (noStreams) {
                noStreams.remove();
            }
            
            // Update streams list
            streamsList.innerHTML = '';
            this.activeStreams.forEach((element, key) => {
                const [username, type] = key.split('-');
                const streamItem = document.createElement('div');
                streamItem.className = 'stream-item';
                streamItem.innerHTML = `
                    <div class="stream-user">${username}</div>
                    <div class="stream-type">
                        <i class="fas fa-${type === 'video' ? 'video' : type === 'audio' ? 'microphone' : 'desktop'}"></i>
                        ${type} stream
                    </div>
                `;
                streamsList.appendChild(streamItem);
            });
        }
        
        this.updateActiveStreamsCount();
    }

    loadOnlineUsers() {
        // Real users will be loaded from Firebase
        this.onlineUsers.clear();
        this.renderOnlineUsers();
    }

    loadSimulatedOnlineUsers() {
        console.log('[DEBUG] loadSimulatedOnlineUsers called');
        // Add some simulated users for demo when Firebase is not available
        const simulatedUsers = [
            {
                username: 'alice_dev',
                avatar: 'https://ui-avatars.com/api/?name=alice_dev&background=007bff&color=fff',
                status: 'online',
                lastSeen: Date.now()
            },
            {
                username: 'bob_coder',
                avatar: 'https://ui-avatars.com/api/?name=bob_coder&background=28a745&color=fff',
                status: 'online',
                lastSeen: Date.now()
            },
            {
                username: 'charlie_tech',
                avatar: 'https://ui-avatars.com/api/?name=charlie_tech&background=dc3545&color=fff',
                status: 'online',
                lastSeen: Date.now()
            },
            {
                username: 'diana_hacker',
                avatar: 'https://ui-avatars.com/api/?name=diana_hacker&background=ffc107&color=000',
                status: 'online',
                lastSeen: Date.now()
            }
        ];
        console.log('[DEBUG] Simulated users:', simulatedUsers);
        
        // Clear current users and add simulated ones
        this.onlineUsers.clear();
        simulatedUsers.forEach(user => {
            if (user.username && user.username !== 'undefined') {
                console.log('[DEBUG] Adding simulated user:', user.username);
                this.onlineUsers.set(user.username, user);
            }
        });
        
        // Add current user if valid
        console.log('[DEBUG] Current user:', this.currentUser);
        if (this.currentUser && this.currentUser.username && this.currentUser.username !== 'undefined') {
            console.log('[DEBUG] Adding current user:', this.currentUser.username);
            this.onlineUsers.set(this.currentUser.username, this.currentUser);
        }
        
        // Update UI
        this.renderOnlineUsers();
        this.updateOnlineCount();
    }

    renderOnlineUsers() {
        const usersList = document.getElementById('online-users-list');
        usersList.innerHTML = '';
        
        // Create a combined list of all users including current user
        const allUsers = Array.from(this.onlineUsers.values());
        
        // Check if current user is already in the Firebase data
        const currentUserInList = allUsers.find(user => user.username === this.currentUser.username);
        
        // Only add current user if they're not already in the Firebase data
        if (!currentUserInList) {
            allUsers.push({
                ...this.currentUser,
                status: 'online',
                lastSeen: Date.now()
            });
        }
        
        // Sort users alphabetically
        allUsers.sort((a, b) => a.username.localeCompare(b.username));
        
        // Use a Set to track usernames and avoid duplicates
        const seenUsernames = new Set();
        
        allUsers.forEach(user => {
            // Skip users with missing or invalid usernames
            if (!user.username || user.username === 'undefined') return;
            
            // Skip if we've already seen this username
            if (seenUsernames.has(user.username)) return;
            seenUsernames.add(user.username);
            
            const userItem = document.createElement('div');
            userItem.className = 'user-item';
            
            // Add special styling for current user
            if (user.username === this.currentUser.username) {
                userItem.classList.add('current-user');
            }
            
            // Ensure avatar URL is valid
            const avatarUrl = user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff`;
            
            userItem.innerHTML = `
                <img src="${avatarUrl}" alt="${user.username}" onerror="this.src='https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff'">
                <div class="user-info">
                    <div class="user-name">${user.username}${user.username === this.currentUser.username ? ' (You)' : ''}</div>
                    <div class="user-status">${user.status || 'online'}</div>
                </div>
            `;
            usersList.appendChild(userItem);
        });
    }

    loadMessages() {
        // Start with empty messages - real messages will come from Firebase
        this.messages = [];
        this.renderMessages();
        
        // Load recent messages from Firebase when connection is established
        setTimeout(() => {
            if (this.messagesRef) {
                this.loadRecentMessages();
            }
        }, 2000);
    }

    loadRecentMessages() {
        this.onValue(this.messagesRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Sort messages by timestamp and keep only the last 20
                const messages = Object.values(data).sort((a, b) => a.timestamp - b.timestamp);
                const last20 = messages.slice(-20);
                // Only load messages we haven't seen yet
                const existingIds = this.messages.map(m => m.id);
                const newMessages = last20.filter(message => !existingIds.includes(message.id));
                newMessages.forEach(message => {
                    this.messages.push({
                        ...message,
                        own: message.author === this.currentUser.username
                    });
                });
                this.renderMessages();
            }
        }, { onlyOnce: true }); // Only load once, not continuously
    }

    renderMessages() {
        const messagesList = document.getElementById('messages-list');
        // Only append new messages
        if (!this.lastRenderedMessageCount) this.lastRenderedMessageCount = 0;
        const newMessages = this.messages.slice(this.lastRenderedMessageCount);
        newMessages.forEach(message => {
            const messageElement = document.createElement('div');
            messageElement.className = `message ${message.own ? 'own' : ''}`;
            // Only show author name for received messages (not own messages)
            const authorDisplay = message.own ? '' : `<span class="message-author">${message.author}</span>`;
            // Ensure avatar URL is valid
            const avatarUrl = message.avatar || `https://ui-avatars.com/api/?name=${message.author}&background=333&color=fff`;
            messageElement.innerHTML = `
                <img src="${avatarUrl}" alt="${message.author}" class="message-avatar" onerror="this.src='https://ui-avatars.com/api/?name=${message.author}&background=333&color=fff'">
                <div class="message-content">
                    <div class="message-header">
                        ${authorDisplay}
                        <span class="message-time">${this.formatTime(message.timestamp)}</span>
                    </div>
                    <div class="message-bubble">
                        <div class="message-text">${this.formatMessage(message.text)}</div>
                    </div>
                </div>
            `;
            messagesList.appendChild(messageElement);
        });
        this.lastRenderedMessageCount = this.messages.length;
        this.scrollToBottom();
    }

    formatMessage(text) {
        // Convert URLs to links
        text = text.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank">$1</a>');
        
        // Convert @mentions
        text = text.replace(/@(\w+)/g, '<span class="mention">@$1</span>');
        
        // Convert code blocks
        text = text.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
        
        // Convert inline code
        text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
        
        // Convert bold
        text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        
        // Convert italic
        text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
        
        return this.escapeHtml(text);
    }

    sendMessage() {
        // Prevent sending messages in read-only mode
        if (this.isReadOnly) {
            this.showNotification('Please register to send messages', 'warning');
            return;
        }
        
        const input = document.getElementById('message-input');
        const text = input.value.trim();
        
        if (!text) return;

        const message = {
            id: this.generateId(),
            author: this.currentUser.username,
            avatar: this.currentUser.avatar || `https://ui-avatars.com/api/?name=${this.currentUser.username}&background=333&color=fff`,
            text: text,
            timestamp: Date.now(),
            own: true
        };

        // Add message to local display immediately
        this.messages.push(message);
        input.value = '';
        this.updateCharCount();
        this.clearTyping();
        
        this.renderMessages();
        this.playSound('send');
        this.updateMessagesToday();

        // Send via Firebase (real-time cross-network messaging)
        this.sendFirebaseMessage(message);

        // No more simulations - this is real messaging!
    }

    // simulateResponse function removed - no more fake messages!

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
        // Don't send typing indicators in read-only mode
        if (this.isReadOnly) return;
        
        const now = Date.now();
        // Only send typing indicator if enough time has passed
        if (now - this.lastTypingTime > 1000) {
            const typingData = {
                type: 'typing',
                author: this.currentUser.username,
                timestamp: now
            };
            // Send typing indicator via Firebase
            if (this.push && this.database) {
                this.push(this.ref(this.database, 'typing'), typingData);
            }
            this.lastTypingTime = now;
        }
        // Clear existing timeout
        clearTimeout(this.typingTimeout);
        // Set new timeout to stop typing indicator
        this.typingTimeout = setTimeout(() => {
            this.clearTyping();
        }, 3000);
    }

    clearTyping() {
        clearTimeout(this.typingTimeout);
    }

    setupTypingIndicator() {
        if (this.onValue && this.database) {
            const typingRef = this.ref(this.database, 'typing');
            this.onValue(typingRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    // Get all recent typing events from other users (within 3 seconds)
                    const now = Date.now();
                    const typingEvents = Object.values(data)
                        .filter(e => e.author && e.author !== this.currentUser.username && now - e.timestamp < 3000)
                        .map(e => e.author);
                    // Remove duplicates
                    const uniqueAuthors = [...new Set(typingEvents)];
                    if (uniqueAuthors.length > 0) {
                        this.showTypingIndicatorMultiple(uniqueAuthors);
                    } else {
                        this.hideTypingIndicator();
                    }
                } else {
                    this.hideTypingIndicator();
                }
            });
        }
    }

    showTypingIndicatorMultiple(usernames) {
        const indicator = document.getElementById('typing-indicator');
        indicator.style.display = 'flex';
        let text = '';
        if (usernames.length === 1) {
            text = `${usernames[0]} is typing...`;
        } else if (usernames.length === 2) {
            text = `${usernames[0]} and ${usernames[1]} are typing...`;
        } else if (usernames.length <= 4) {
            text = `${usernames.slice(0, -1).join(', ')} and ${usernames[usernames.length - 1]} are typing...`;
        } else {
            text = `${usernames.slice(0, 2).join(', ')} and ${usernames.length - 2} others are typing...`;
        }
        indicator.querySelector('.typing-text').textContent = text;
    }

    hideTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        indicator.style.display = 'none';
    }

    updateTypingIndicator() {
        const indicator = document.getElementById('typing-indicator');
        const typingText = indicator.querySelector('.typing-text');
        
        if (this.typingUsers.size === 0) {
            indicator.classList.remove('show');
            return;
        }
        
        const typingUsers = Array.from(this.typingUsers.keys());
        let text = '';
        
        if (typingUsers.length === 1) {
            text = `${typingUsers[0]} is typing...`;
        } else if (typingUsers.length === 2) {
            text = `${typingUsers[0]} and ${typingUsers[1]} are typing...`;
        } else {
            text = `${typingUsers[0]} and ${typingUsers.length - 1} others are typing...`;
        }
        
        typingText.textContent = text;
        indicator.classList.add('show');
    }

    scrollToBottom() {
        const container = document.getElementById('messages-list');
        container.scrollTop = container.scrollHeight;
        
        // Hide scroll-to-bottom button
        document.getElementById('scroll-to-bottom').classList.remove('show');
    }

    updateOnlineCount() {
        // Count all users in the onlineUsers Map (which now includes current user if they're online)
        const count = this.onlineUsers.size;
        
        // Debug logging
        console.log('[DEBUG] Online count calculation:');
        console.log('- onlineUsers.size:', count);
        console.log('- onlineUsers keys:', Array.from(this.onlineUsers.keys()));
        console.log('- onlineUsers values:', Array.from(this.onlineUsers.values()).map(u => u.username));
        
        // Update all online count displays
        const onlineCountEl = document.getElementById('online-count');
        const headerOnlineCountEl = document.getElementById('header-online-count');
        const sidebarCounter = document.getElementById('sidebar-online-count');
        
        if (onlineCountEl) onlineCountEl.textContent = count;
        if (headerOnlineCountEl) headerOnlineCountEl.textContent = count;
        if (sidebarCounter) sidebarCounter.textContent = `${count} online`;
    }

    updateOnlineUsers() {
        this.renderOnlineUsers();
        this.updateOnlineCount();
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
        
        // Update header displays
        document.getElementById('header-username').textContent = username;
        
        // Ensure avatar URL is valid
        const avatarUrl = app.currentUser.avatar || `https://ui-avatars.com/api/?name=${username}&background=333&color=fff`;
        document.getElementById('user-avatar').src = avatarUrl;
    }
    
    app.setTheme(theme);
    app.sounds.enabled = soundEnabled;
    localStorage.setItem('soundEnabled', soundEnabled);
    
    closeModal('settings-modal');
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on the main chat page (index.html)
    if (window.location.pathname.endsWith('index.html') || window.location.pathname.endsWith('/') || window.location.pathname === '') {
        const loadTime = Date.now();
        console.log('DOM loaded, initializing HackConvo...', new Date(loadTime).toISOString());
        
        // Check if this is a rapid reload
        const lastLoadTime = localStorage.getItem('lastLoadTime');
        if (lastLoadTime && (loadTime - parseInt(lastLoadTime)) < 1000) {
            console.warn('Rapid page reload detected! Time between loads:', loadTime - parseInt(lastLoadTime), 'ms');
        }
        localStorage.setItem('lastLoadTime', loadTime.toString());
        
        // Add global error handler to catch undefined URLs
        window.addEventListener('error', (event) => {
            if (event.target && event.target.src && event.target.src.includes('undefined')) {
                console.error('Undefined URL detected:', event.target.src);
                console.error('Element:', event.target);
                console.error('Stack trace:', new Error().stack);
            }
        });
        
        window.app = new HackConvo();
        
        // Handle scroll-to-bottom visibility
        const messagesContainer = document.getElementById('messages-list');
        const scrollButton = document.getElementById('scroll-to-bottom');
        
        if (messagesContainer && scrollButton) {
            messagesContainer.addEventListener('scroll', () => {
                const { scrollTop, scrollHeight, clientHeight } = messagesContainer;
                const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100;
                
                if (isNearBottom) {
                    scrollButton.classList.remove('show');
                } else {
                    scrollButton.classList.add('show');
                }
            });
        }
        
        // Handle modal clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                e.target.style.display = 'none';
            }
        });
        
        // Auto-resize textarea
        const messageInput = document.getElementById('message-input');
        if (messageInput) {
            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 120) + 'px';
            });
        }
    } else {
        console.log('Not on main chat page, skipping HackConvo initialization');
    }
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