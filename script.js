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
            this.checkUserStatus().catch(error => {
                console.error('[DEBUG] Error in checkUserStatus:', error);
            }); // Check if user is muted/banned
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
        console.log('[DEBUG] Firebase set available:', !!window.firebaseSet);
        console.log('[DEBUG] Firebase get available:', !!window.firebaseGet);
        
        try {
            // Wait for Firebase to be available
            if (window.firebaseDatabase && window.firebaseRef && window.firebaseSet && window.firebaseGet) {
                console.log('[DEBUG] Firebase is ready, connecting...');
                this.connectFirebase();
            } else {
                console.log('[DEBUG] Firebase not ready, waiting...');
                // Wait a bit for Firebase to load
                setTimeout(() => {
                    if (window.firebaseDatabase && window.firebaseRef && window.firebaseSet && window.firebaseGet) {
                        console.log('[DEBUG] Firebase is now ready, connecting...');
                        this.connectFirebase();
                    } else {
                        console.error('[DEBUG] Firebase not available after timeout, enabling simulated mode');
                        this.updateConnectionStatus(false);
                        this.enableSimulatedMode();
                    }
                }, 3000); // Increased timeout
            }
        } catch (error) {
            console.error('[DEBUG] Failed to connect:', error);
            this.updateConnectionStatus(false);
            this.enableSimulatedMode();
        }
    }

    connectFirebase() {
        try {
            // Check if all required Firebase functions are available
            if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseSet || !window.firebaseGet) {
                throw new Error('Required Firebase functions not available');
            }
            
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.push = window.firebasePush;
            this.onValue = window.firebaseOnValue;
            this.off = window.firebaseOff;
            this.remove = window.firebaseRemove;
            this.child = window.firebaseChild;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            
            console.log('[DEBUG] Firebase functions loaded successfully');
            console.log('[DEBUG] Database:', !!this.database);
            console.log('[DEBUG] Ref:', !!this.ref);
            console.log('[DEBUG] Set:', !!this.set);
            console.log('[DEBUG] Get:', !!this.get);
            
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
            
            // Subscribe to moderation updates
            this.moderationRef = this.ref(this.database, 'moderation');
            this.onValue(this.moderationRef, (snapshot) => {
                const data = snapshot.val();
                if (data) {
                    this.handleModerationUpdates(data);
                }
            });
            
            // Subscribe to user role updates (for current user)
            if (!this.isReadOnly) {
                const userRoleRef = this.ref(this.database, `registered_users/${this.currentUser.username}`);
                this.onValue(userRoleRef, (snapshot) => {
                    const userData = snapshot.val();
                    if (userData && userData.role) {
                        this.syncUserRole(userData);
                    }
                });
            }
            
            // Add current user to online users (only if registered)
            if (!this.isReadOnly) {
                this.addUserToFirebase().catch(error => {
                    console.error('[DEBUG] Error in addUserToFirebase:', error);
                });
            }
            
            // Start periodic cleanup of old messages
            this.startPeriodicCleanup();
            
        } catch (error) {
            console.error('Failed to connect to Firebase:', error);
            console.error('[DEBUG] Error details:', {
                firebaseDatabase: !!window.firebaseDatabase,
                firebaseRef: !!window.firebaseRef,
                firebaseSet: !!window.firebaseSet,
                firebaseGet: !!window.firebaseGet,
                error: error.message
            });
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

    async addUserToFirebase() {
        if (this.ref && this.database && this.get) {
            // Use username as the key to prevent duplicate entries
            const userPath = `users/${this.currentUser.username}`;
            const userRef = this.ref(this.database, userPath);
            
            try {
                // First, check if user already exists in database and get their current role
                const snapshot = await this.get(userRef);
                if (snapshot.exists()) {
                    const dbUser = snapshot.val();
                    console.log('[DEBUG] Found existing user in database:', dbUser);
                    
                    // Update local user with database role if it's higher than current
                    if (dbUser.role && this.getRoleLevel(dbUser.role) > this.getRoleLevel(this.currentUser.role || 'user')) {
                        console.log('[DEBUG] Updating local user role from', this.currentUser.role, 'to', dbUser.role);
                        this.currentUser.role = dbUser.role;
                        this.saveUser(this.currentUser);
                        
                        // Update UI to reflect new role
                        this.addAdminPanelButton();
                        this.showNotification(`Role updated to ${dbUser.role}`, 'success');
                    }
                }
                
                // Prepare user data for Firebase
                const userData = {
                    ...this.currentUser,
                    lastSeen: Date.now(),
                    status: 'online'
                };
                
                console.log('[DEBUG] Adding user to Firebase at', userPath, userData);
                
                // Use set() to overwrite any existing entry for this user
                await this.set(userRef, userData);
                console.log('[DEBUG] User added to Firebase successfully');
                
            } catch (error) {
                console.error('[DEBUG] Error adding user to Firebase:', error);
            }
        } else {
            console.warn('[DEBUG] addUserToFirebase: Firebase functions not available');
        }
    }

    getRoleLevel(role) {
        const roleLevels = {
            'user': 1,
            'moderator': 2,
            'admin': 3
        };
        return roleLevels[role] || 1;
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
        
        // Clear current online users
        this.onlineUsers.clear();
        
        const now = Date.now();
        const ONLINE_THRESHOLD = 30 * 1000; // 30 seconds
        
        // Process users directly (no more nested structure)
        Object.entries(data).forEach(([username, userData]) => {
            if (
                userData &&
                userData.username &&
                userData.lastSeen &&
                (now - userData.lastSeen < ONLINE_THRESHOLD)
            ) {
                console.log('[DEBUG] Adding online user:', username);
                this.onlineUsers.set(username, userData);
                
                // Check if this is the current user and sync role if needed
                if (username === this.currentUser.username && userData.role) {
                    this.syncUserRole(userData);
                }
            }
        });
        
        // Ensure current user is in the online users list if they're online
        if (!this.onlineUsers.has(this.currentUser.username)) {
            console.log('[DEBUG] Adding current user to online list');
            this.onlineUsers.set(this.currentUser.username, {
                ...this.currentUser,
                lastSeen: Date.now(),
                status: 'online'
            });
        }
        
        // Update UI
        this.renderOnlineUsers();
        this.updateOnlineCount();
    }

    handleModerationUpdates(data) {
        console.log('[DEBUG] Received moderation update:', data);
        
        if (!this.currentUser) return;
        
        // Check if current user is muted
        if (data.muted && data.muted[this.currentUser.username]) {
            const muteData = data.muted[this.currentUser.username];
            console.log('[DEBUG] User is muted:', muteData);
            
            if (muteData.expiresAt && Date.now() < muteData.expiresAt) {
                this.showMuteMessage(muteData);
                this.disableMessageSending();
            } else {
                // Mute expired, remove it
                this.removeMuteStatus();
            }
        } else {
            // User is not muted, enable sending
            this.enableMessageSending();
        }
        
        // Check if current user is banned
        if (data.banned && data.banned[this.currentUser.username]) {
            const banData = data.banned[this.currentUser.username];
            console.log('[DEBUG] User is banned:', banData);
            
            if (banData.expiresAt && Date.now() < banData.expiresAt) {
                this.showBanMessage(banData);
                this.disableChat();
            } else {
                // Ban expired, remove it
                this.removeBanStatus();
            }
        }
        
        // Update moderation menu permissions for all users
        this.updateModerationMenus();
    }

    updateModerationMenus() {
        // Update moderation menu permissions for all message authors
        const messageElements = document.querySelectorAll('.message-author');
        messageElements.forEach(element => {
            const username = element.getAttribute('data-username');
            if (username) {
                const canModerate = this.canModerateUser(username);
                if (canModerate) {
                    element.classList.add('can-moderate');
                    element.onclick = (event) => this.toggleModMenu(event, username);
                } else {
                    element.classList.remove('can-moderate');
                    element.onclick = null;
                }
            }
        });
    }

    syncUserRole(dbUser) {
        // Always sync role from database to ensure consistency
        if (dbUser.role && dbUser.role !== (this.currentUser.role || 'user')) {
            console.log('[DEBUG] Syncing user role from', this.currentUser.role, 'to', dbUser.role);
            this.currentUser.role = dbUser.role;
            this.saveUser(this.currentUser);
            
            // Update UI to reflect new role
            this.addAdminPanelButton();
            this.showNotification(`Role updated to ${dbUser.role}`, 'success');
        }
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
        
        // Add admin panel button for admin users
        this.addAdminPanelButton();
    }

    setupReadOnlyMode() {
        console.log('Setting up read-only mode');
        
        // Show registration banner for unregistered users
        this.showRegistrationBanner();
        
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

    showRegistrationBanner() {
        const banner = document.getElementById('registration-banner');
        if (banner) {
            // Check if user has dismissed the banner before
            const bannerDismissed = localStorage.getItem('registration_banner_dismissed');
            if (!bannerDismissed) {
                banner.style.display = 'block';
                
                // Auto-hide banner after 30 seconds
                setTimeout(() => {
                    if (banner.style.display !== 'none') {
                        this.hideRegistrationBanner();
                    }
                }, 30000);
            }
        }
    }

    hideRegistrationBanner() {
        const banner = document.getElementById('registration-banner');
        if (banner) {
            banner.style.display = 'none';
            // Remember that user dismissed the banner
            localStorage.setItem('registration_banner_dismissed', 'true');
        }
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
            
            // Check if current user is staff and can moderate this message
            const canModerate = this.canModerateUser(message.author);
            
            // Only show author name for received messages (not own messages)
            const authorDisplay = message.own ? '' : this.renderAuthorName(message.author, canModerate);
            
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

    renderAuthorName(username, canModerate) {
        if (!canModerate) {
            return `<span class="message-author">${username}</span>`;
        }
        
        return `
            <span class="message-author moddable" 
                  data-username="${username}" 
                  onclick="app.toggleModMenu(event, '${username}')">
                ${username}
                <i class="fas fa-chevron-down mod-indicator"></i>
            </span>
        `;
    }

    canModerateUser(username) {
        // Can't moderate yourself
        if (username === this.currentUser.username) {
            console.log('[MOD DEBUG] Cannot moderate yourself');
            return false;
        }
        
        // Check if current user is staff
        const userRole = this.currentUser.role || 'user';
        if (userRole === 'user') {
            console.log('[MOD DEBUG] Current user is not staff');
            return false;
        }
        
        // Get target user's role from online users first
        let targetRole = 'user';
        const targetUser = this.onlineUsers.get(username);
        if (targetUser && targetUser.role) {
            targetRole = targetUser.role;
        } else {
            // If not in online users, check if we can moderate them based on current user's role
            // Moderators can moderate regular users, admins can moderate everyone except other admins
            if (userRole === 'moderator') {
                // Moderators can moderate users (assume unknown users are regular users)
                targetRole = 'user';
            } else if (userRole === 'admin') {
                // Admins can moderate everyone except other admins
                // For now, assume unknown users are not admins
                targetRole = 'user';
            }
        }
        
        const canModerate = this.getRoleLevel(userRole) > this.getRoleLevel(targetRole);
        console.log(`[MOD DEBUG] ${this.currentUser.username} (${userRole}) can moderate ${username} (${targetRole}): ${canModerate}`);
        
        return canModerate;
    }

    toggleModMenu(event, username) {
        event.stopPropagation(); // Prevent event bubbling
        
        const existingMenu = document.getElementById('mod-menu');
        if (existingMenu) {
            // If menu is already open for this user, close it
            if (existingMenu.dataset.username === username) {
                this.hideModMenu();
                return;
            } else {
                // If menu is open for different user, close it first
                this.hideModMenu();
            }
        }
        
        const userRole = this.currentUser.role || 'user';
        const targetUser = this.onlineUsers.get(username);
        const targetRole = targetUser ? (targetUser.role || 'user') : 'user';
        
        // Create mod menu
        const modMenu = document.createElement('div');
        modMenu.className = 'mod-menu';
        modMenu.id = 'mod-menu';
        modMenu.dataset.username = username; // Track which user this menu is for
        
        let menuItems = '';
        
        // Kick option (all staff)
        menuItems += `
            <div class="mod-menu-item" onclick="app.kickUser('${username}')">
                <i class="fas fa-boot"></i> Kick (10 min)
            </div>
        `;
        
        // Mute options (all staff)
        menuItems += `
            <div class="mod-menu-item" onclick="app.showMuteModal('${username}')">
                <i class="fas fa-microphone-slash"></i> Mute
            </div>
        `;
        
        // Ban option (admin only)
        if (userRole === 'admin') {
            menuItems += `
                <div class="mod-menu-item" onclick="app.showBanModal('${username}')">
                    <i class="fas fa-ban"></i> Ban
                </div>
            `;
        }
        
        // Role management (admin only, can't change own role)
        if (userRole === 'admin' && username !== this.currentUser.username) {
            menuItems += `
                <div class="mod-menu-item" onclick="app.showRoleModal('${username}', '${targetRole}')">
                    <i class="fas fa-user-tag"></i> Change Role
                </div>
            `;
        }
        
        modMenu.innerHTML = menuItems;
        
        // Position the menu
        const rect = event.target.getBoundingClientRect();
        modMenu.style.position = 'fixed';
        modMenu.style.left = rect.left + 'px';
        modMenu.style.top = (rect.bottom + 5) + 'px';
        modMenu.style.zIndex = '1000';
        
        document.body.appendChild(modMenu);
        
        // Add click outside to close
        setTimeout(() => {
            document.addEventListener('click', this.hideModMenuOnClick);
        }, 100);
    }

    hideModMenu() {
        const modMenu = document.getElementById('mod-menu');
        if (modMenu) {
            modMenu.remove();
        }
    }

    hideModMenuOnClick = (event) => {
        if (!event.target.closest('.mod-menu') && !event.target.closest('.moddable')) {
            this.hideModMenu();
            document.removeEventListener('click', this.hideModMenuOnClick);
        }
    }

    // Moderation functions
    async kickUser(username) {
        if (!confirm(`Are you sure you want to kick ${username}? They will be unable to chat for 10 minutes.`)) return;
        
        try {
            console.log(`[MOD] Kicking user: ${username}`);
            
            // Remove user from online users
            const onlineUserRef = this.ref(this.database, `users/${username}`);
            await this.remove(onlineUserRef);
            
            // Create kick data with 10-minute timeout
            const kickData = {
                username: username,
                adminUsername: this.currentUser.username,
                reason: 'Kicked by ' + (this.currentUser.role || 'staff'),
                timestamp: Date.now(),
                expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
                duration: 10
            };
            
            // Add to moderation database
            const kickRef = this.ref(this.database, `moderation/kicked/${username}`);
            await this.set(kickRef, kickData);
            
            this.showNotification(`User ${username} has been kicked for 10 minutes.`, 'success');
            this.hideModMenu();
            
        } catch (error) {
            console.error('[MOD] Error kicking user:', error);
            this.showNotification('Failed to kick user. Please try again.', 'error');
        }
    }

    showMuteModal(username) {
        this.hideModMenu();
        this.selectedUser = username;
        
        const maxDuration = this.currentUser.role === 'admin' ? 10080 : 1440; // Admin: 7 days, Mod: 24 hours
        const defaultDuration = this.currentUser.role === 'admin' ? 60 : 30; // Admin: 1 hour, Mod: 30 minutes
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'mute-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Mute User: ${username}</h3>
                    <button onclick="app.closeMuteModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="mute-duration">Duration (minutes):</label>
                        <input type="number" id="mute-duration" min="1" max="${maxDuration}" value="${defaultDuration}" placeholder="${defaultDuration}">
                        <small style="color: var(--text-muted); font-size: 0.8rem;">
                            ${this.currentUser.role === 'admin' ? 'Maximum: 7 days (10080 minutes)' : 'Maximum: 24 hours (1440 minutes)'}
                        </small>
                    </div>
                    <div class="form-group">
                        <label for="mute-reason">Reason:</label>
                        <input type="text" id="mute-reason" placeholder="Enter reason for mute">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.closeMuteModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.muteUser()">Mute User</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    closeMuteModal() {
        const modal = document.getElementById('mute-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedUser = null;
    }

    async muteUser() {
        if (!this.selectedUser) return;
        
        const duration = parseInt(document.getElementById('mute-duration').value);
        const reason = document.getElementById('mute-reason').value.trim();
        
        if (!duration || duration < 1) {
            this.showNotification('Please enter a valid duration.', 'error');
            return;
        }
        
        try {
            console.log(`[MOD] Muting user: ${this.selectedUser} for ${duration} minutes`);
            
            const expiresAt = Date.now() + (duration * 60 * 1000);
            
            const muteData = {
                username: this.selectedUser,
                adminUsername: this.currentUser.username,
                reason: reason || 'No reason provided',
                duration: duration,
                expiresAt: expiresAt,
                timestamp: Date.now()
            };
            
            // Add to moderation database
            const muteRef = this.ref(this.database, `moderation/muted/${this.selectedUser}`);
            await this.set(muteRef, muteData);
            
            this.closeMuteModal();
            this.hideModMenu();
            this.showNotification(`User ${this.selectedUser} has been muted for ${duration} minutes.`, 'success');
            
        } catch (error) {
            console.error('[MOD] Error muting user:', error);
            this.showNotification('Failed to mute user. Please try again.', 'error');
        }
    }

    showBanModal(username) {
        this.hideModMenu();
        this.selectedUser = username;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'ban-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Ban User: ${username}</h3>
                    <button onclick="app.closeBanModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="ban-duration">Duration (minutes, 0 for permanent):</label>
                        <input type="number" id="ban-duration" min="0" max="10080" value="1440" placeholder="1440">
                        <small style="color: var(--text-muted); font-size: 0.8rem;">
                            Maximum: 7 days (10080 minutes), 0 for permanent ban
                        </small>
                    </div>
                    <div class="form-group">
                        <label for="ban-reason">Reason:</label>
                        <input type="text" id="ban-reason" placeholder="Enter reason for ban">
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.closeBanModal()">Cancel</button>
                    <button class="btn btn-danger" onclick="app.banUser()">Ban User</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    closeBanModal() {
        const modal = document.getElementById('ban-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedUser = null;
    }

    async banUser() {
        if (!this.selectedUser) return;
        
        const duration = parseInt(document.getElementById('ban-duration').value);
        const reason = document.getElementById('ban-reason').value.trim();
        
        try {
            console.log(`[MOD] Banning user: ${this.selectedUser} for ${duration} minutes`);
            
            const expiresAt = duration > 0 ? Date.now() + (duration * 60 * 1000) : null;
            
            const banData = {
                username: this.selectedUser,
                adminUsername: this.currentUser.username,
                reason: reason || 'No reason provided',
                duration: duration,
                expiresAt: expiresAt,
                timestamp: Date.now()
            };
            
            // Add to moderation database
            const banRef = this.ref(this.database, `moderation/banned/${this.selectedUser}`);
            await this.set(banRef, banData);
            
            // Remove from online users
            const onlineUserRef = this.ref(this.database, `users/${this.selectedUser}`);
            await this.remove(onlineUserRef);
            
            this.closeBanModal();
            this.hideModMenu();
            this.showNotification(`User ${this.selectedUser} has been banned.`, 'success');
            
        } catch (error) {
            console.error('[MOD] Error banning user:', error);
            this.showNotification('Failed to ban user. Please try again.', 'error');
        }
    }

    showRoleModal(username, currentRole) {
        this.hideModMenu();
        this.selectedUser = username;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'role-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>Change Role: ${username}</h3>
                    <button onclick="app.closeRoleModal()" class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="role-select">New Role:</label>
                        <select id="role-select">
                            <option value="user" ${currentRole === 'user' ? 'selected' : ''}>User</option>
                            <option value="moderator" ${currentRole === 'moderator' ? 'selected' : ''}>Moderator</option>
                            <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="app.closeRoleModal()">Cancel</button>
                    <button class="btn btn-primary" onclick="app.changeUserRole()">Change Role</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }

    closeRoleModal() {
        const modal = document.getElementById('role-modal');
        if (modal) {
            modal.remove();
        }
        this.selectedUser = null;
    }

    async changeUserRole() {
        if (!this.selectedUser) return;
        
        const newRole = document.getElementById('role-select').value;
        
        try {
            console.log(`[MOD] Changing role for ${this.selectedUser} to ${newRole}`);
            
            // Update in both registered_users and users locations
            const registeredUserRef = this.ref(this.database, `registered_users/${this.selectedUser}`);
            const onlineUserRef = this.ref(this.database, `users/${this.selectedUser}`);
            
            const userData = {
                role: newRole,
                roleChangedAt: Date.now(),
                roleChangedBy: this.currentUser.username
            };
            
            // Update both locations
            await this.set(registeredUserRef, userData);
            await this.set(onlineUserRef, userData);
            
            this.closeRoleModal();
            this.hideModMenu();
            this.showNotification(`User ${this.selectedUser} role changed to ${newRole}.`, 'success');
            
        } catch (error) {
            console.error('[MOD] Error changing user role:', error);
            this.showNotification('Failed to change user role. Please try again.', 'error');
        }
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

    logout() {
        // Remove user from localStorage
        localStorage.removeItem('hackconvo_user');
        // Optionally clear other session data
        this.showNotification('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }

    addAdminPanelButton() {
        // Check if user is admin or moderator
        if (this.currentUser && (this.currentUser.role === 'admin' || this.currentUser.role === 'moderator')) {
            console.log(`[ADMIN DEBUG] Adding admin panel button for ${this.currentUser.role}:`, this.currentUser.username);
            
            // Add admin button to header
            const headerControls = document.querySelector('.header-controls');
            if (headerControls) {
                const adminBtn = document.createElement('button');
                adminBtn.id = 'admin-btn';
                adminBtn.className = `header-btn admin-btn ${this.currentUser.role === 'moderator' ? 'moderator-btn' : ''}`;
                adminBtn.innerHTML = '<i class="fas fa-shield-alt"></i>';
                adminBtn.title = `${this.currentUser.role === 'admin' ? 'Admin' : 'Moderator'} Panel`;
                adminBtn.addEventListener('click', () => {
                    window.location.href = 'admin.html';
                });
                
                // Insert before the first button
                headerControls.insertBefore(adminBtn, headerControls.firstChild);
            }
            
            // Add admin link to user menu
            const userMenu = document.getElementById('user-menu');
            if (userMenu) {
                const adminLink = document.createElement('a');
                adminLink.href = 'admin.html';
                adminLink.innerHTML = `<i class="fas fa-shield-alt"></i> ${this.currentUser.role === 'admin' ? 'Admin' : 'Moderator'} Panel`;
                adminLink.className = 'user-menu-item';
                userMenu.appendChild(adminLink);
            }
        }
    }

    // Check if user is muted or banned
    async checkUserStatus() {
        if (!this.currentUser || !this.database || !this.ref || !this.get) return;
        
        try {
            // Check moderation status from Firebase
            const moderationRef = this.ref(this.database, 'moderation');
            const snapshot = await this.get(moderationRef);
            
            if (snapshot.exists()) {
                const moderationData = snapshot.val();
                
                // Check if user is banned
                if (moderationData.banned && moderationData.banned[this.currentUser.username]) {
                    const banData = moderationData.banned[this.currentUser.username];
                    if (banData.expiresAt && Date.now() > banData.expiresAt) {
                        // Ban has expired, remove it
                        await this.removeBanStatus();
                    } else {
                        this.currentUser.isBanned = true;
                        this.currentUser.banData = banData;
                        this.saveUser(this.currentUser);
                        this.showBanMessage(banData);
                        return;
                    }
                } else {
                    // Clear ban status if no longer banned
                    if (this.currentUser.isBanned) {
                        delete this.currentUser.isBanned;
                        delete this.currentUser.banData;
                        this.saveUser(this.currentUser);
                    }
                }
                
                // Check if user is muted
                if (moderationData.muted && moderationData.muted[this.currentUser.username]) {
                    const muteData = moderationData.muted[this.currentUser.username];
                    if (muteData.expiresAt && Date.now() > muteData.expiresAt) {
                        // Mute has expired, remove it
                        await this.removeMuteStatus();
                    } else {
                        this.currentUser.isMuted = true;
                        this.currentUser.muteData = muteData;
                        this.saveUser(this.currentUser);
                        this.showMuteMessage(muteData);
                    }
                } else {
                    // Clear mute status if no longer muted
                    if (this.currentUser.isMuted) {
                        delete this.currentUser.isMuted;
                        delete this.currentUser.muteData;
                        this.saveUser(this.currentUser);
                        this.enableMessageSending();
                    }
                }
            }
        } catch (error) {
            console.error('[DEBUG] Error checking user status:', error);
        }
    }

    showBanMessage(banData) {
        const message = `You have been banned${banData.reason ? `: ${banData.reason}` : ''}.`;
        this.showNotification(message, 'error');
        
        // Disable chat functionality
        this.disableChat();
        
        // Redirect to login after showing message
        setTimeout(() => {
            this.logout();
        }, 3000);
    }

    showMuteMessage(muteData) {
        const expiresAt = muteData.expiresAt ? new Date(muteData.expiresAt).toLocaleString() : 'Never';
        const message = `You have been muted${muteData.reason ? `: ${muteData.reason}` : ''}. Expires: ${expiresAt}`;
        this.showNotification(message, 'warning');
        
        // Disable message sending
        this.disableMessageSending();
    }

    disableChat() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput) messageInput.disabled = true;
        if (sendBtn) sendBtn.disabled = true;
    }

    disableMessageSending() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput) {
            messageInput.disabled = true;
            messageInput.placeholder = 'You are muted and cannot send messages';
        }
        if (sendBtn) sendBtn.disabled = true;
    }

    enableMessageSending() {
        const messageInput = document.getElementById('message-input');
        const sendBtn = document.getElementById('send-btn');
        
        if (messageInput) {
            messageInput.disabled = false;
            messageInput.placeholder = 'Type your message...';
        }
        if (sendBtn) sendBtn.disabled = false;
    }

    async removeBanStatus() {
        try {
            if (this.database && this.ref && this.set) {
                const userRef = this.ref(this.database, `registered_users/${this.currentUser.username}`);
                delete this.currentUser.isBanned;
                delete this.currentUser.banData;
                await this.set(userRef, this.currentUser);
                this.saveUser(this.currentUser);
                this.showNotification('Your ban has been lifted!', 'success');
            }
        } catch (error) {
            console.error('[ADMIN DEBUG] Error removing ban status:', error);
        }
    }

    async removeMuteStatus() {
        try {
            if (this.database && this.ref && this.set) {
                const userRef = this.ref(this.database, `registered_users/${this.currentUser.username}`);
                delete this.currentUser.isMuted;
                delete this.currentUser.muteData;
                await this.set(userRef, this.currentUser);
                this.saveUser(this.currentUser);
                this.showNotification('You are no longer muted!', 'success');
                
                // Re-enable message sending
                const messageInput = document.getElementById('message-input');
                const sendBtn = document.getElementById('send-btn');
                
                if (messageInput) {
                    messageInput.disabled = false;
                    messageInput.placeholder = 'Type your message...';
                }
                if (sendBtn) sendBtn.disabled = false;
            }
        } catch (error) {
            console.error('[ADMIN DEBUG] Error removing mute status:', error);
        }
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

// Global function to hide registration banner
function hideRegistrationBanner() {
    if (window.app) {
        app.hideRegistrationBanner();
    } else {
        const banner = document.getElementById('registration-banner');
        if (banner) {
            banner.style.display = 'none';
            localStorage.setItem('registration_banner_dismissed', 'true');
        }
    }
}