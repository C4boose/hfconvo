// HackConvo Admin Panel
class HackConvoAdmin {
    constructor() {
        this.currentUser = this.loadUser();
        this.database = null;
        this.ref = null;
        this.push = null;
        this.onValue = null;
        this.set = null;
        this.get = null;
        this.remove = null;
        this.child = null;
        this.users = new Map();
        this.mutedUsers = new Map();
        this.bannedUsers = new Map();
        this.selectedUser = null;
        
        this.init();
    }

    init() {
        console.log('[ADMIN DEBUG] Initializing admin panel...');
        console.log('[ADMIN DEBUG] Current user:', this.currentUser);
        
        // Check if user is admin or moderator
        if (!this.currentUser) {
            console.log('[ADMIN DEBUG] No current user found');
            this.showError('No user logged in. Please log in first.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        if (this.currentUser.role !== 'admin' && this.currentUser.role !== 'moderator') {
            console.log('[ADMIN DEBUG] User role is:', this.currentUser.role);
            console.log('[ADMIN DEBUG] User is not admin/moderator, redirecting...');
            this.showError('Access denied. Admin or moderator privileges required.');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }
        
        this.userRole = this.currentUser.role;
        console.log(`[ADMIN DEBUG] User is ${this.userRole}:`, this.currentUser.username);
        this.waitForFirebase();
    }

    waitForFirebase() {
        console.log('[ADMIN DEBUG] Checking Firebase availability...');
        
        if (window.firebaseDatabase && window.firebaseRef && window.firebasePush && window.firebaseSet && window.firebaseGet) {
            console.log('[ADMIN DEBUG] Firebase is ready, setting up admin...');
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.push = window.firebasePush;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            this.remove = window.firebaseRemove;
            this.child = window.firebaseChild;
            this.onValue = window.firebaseOnValue;
            this.setupEventListeners();
            this.loadData();
        } else {
            console.log('[ADMIN DEBUG] Firebase not ready, retrying...');
            setTimeout(() => this.waitForFirebase(), 100);
        }
    }

    setupEventListeners() {
        console.log('[ADMIN DEBUG] Setting up event listeners...');
        
        // Close modal when clicking outside
        window.onclick = (event) => {
            const modal = document.getElementById('action-modal');
            if (event.target === modal) {
                this.closeModal();
            }
        };
        
        // Update UI based on user role
        this.updateUIForRole();
    }

    updateUIForRole() {
        // Update role display
        const roleDisplay = document.getElementById('user-role-display');
        if (roleDisplay) {
            roleDisplay.textContent = this.userRole;
        }
        
        // Show/hide role management button for admins only
        const roleManagementBtn = document.getElementById('role-management-btn');
        if (roleManagementBtn) {
            roleManagementBtn.style.display = this.userRole === 'admin' ? 'block' : 'none';
        }
    }

    loadData() {
        console.log('[ADMIN DEBUG] Loading admin data...');
        
        // Load all users
        const usersRef = this.ref(this.database, 'registered_users');
        this.onValue(usersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.handleUsersData(data);
            }
        });
        
        // Load online users
        const onlineUsersRef = this.ref(this.database, 'users');
        this.onValue(onlineUsersRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.handleOnlineUsersData(data);
            }
        });
        
        // Load moderation data
        const moderationRef = this.ref(this.database, 'moderation');
        this.onValue(moderationRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                this.handleModerationData(data);
            }
        });
    }

    handleUsersData(data) {
        console.log('[ADMIN DEBUG] Processing users data:', data);
        this.users.clear();
        
        Object.entries(data).forEach(([username, userData]) => {
            this.users.set(username, {
                ...userData,
                username: username,
                isOnline: false,
                isMuted: false,
                isBanned: false
            });
        });
        
        this.updateStats();
        this.renderUsers();
    }

    handleOnlineUsersData(data) {
        console.log('[ADMIN DEBUG] Processing online users data:', data);
        
        // Mark all users as offline first
        this.users.forEach(user => {
            user.isOnline = false;
        });
        
        // Mark online users
        Object.entries(data).forEach(([username, userData]) => {
            if (this.users.has(username)) {
                this.users.get(username).isOnline = true;
            }
        });
        
        this.updateStats();
        this.renderUsers();
    }

    handleModerationData(data) {
        console.log('[ADMIN DEBUG] Processing moderation data:', data);
        
        this.mutedUsers.clear();
        this.bannedUsers.clear();
        
        if (data.muted) {
            Object.entries(data.muted).forEach(([username, muteData]) => {
                this.mutedUsers.set(username, muteData);
                if (this.users.has(username)) {
                    this.users.get(username).isMuted = true;
                    this.users.get(username).muteData = muteData;
                }
            });
        }
        
        if (data.banned) {
            Object.entries(data.banned).forEach(([username, banData]) => {
                this.bannedUsers.set(username, banData);
                if (this.users.has(username)) {
                    this.users.get(username).isBanned = true;
                    this.users.get(username).banData = banData;
                }
            });
        }
        
        this.updateStats();
        this.renderUsers();
        this.renderModeration();
    }

    updateStats() {
        const totalUsers = this.users.size;
        const onlineUsers = Array.from(this.users.values()).filter(user => user.isOnline).length;
        const mutedUsers = this.mutedUsers.size;
        const bannedUsers = this.bannedUsers.size;
        
        document.getElementById('total-users').textContent = totalUsers;
        document.getElementById('online-users').textContent = onlineUsers;
        document.getElementById('muted-users').textContent = mutedUsers;
        document.getElementById('banned-users').textContent = bannedUsers;
    }

    renderUsers() {
        const container = document.getElementById('all-users-list');
        if (!container) return;
        
        if (this.users.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-users"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        const usersArray = Array.from(this.users.values()).sort((a, b) => {
            // Sort by online status first, then by username
            if (a.isOnline && !b.isOnline) return -1;
            if (!a.isOnline && b.isOnline) return 1;
            return a.username.localeCompare(b.username);
        });
        
        container.innerHTML = usersArray.map(user => this.renderUserCard(user)).join('');
    }

    renderModeration() {
        const container = document.getElementById('moderation-list');
        if (!container) return;
        
        const mutedArray = Array.from(this.mutedUsers.entries());
        const bannedArray = Array.from(this.bannedUsers.entries());
        
        if (mutedArray.length === 0 && bannedArray.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-gavel"></i>
                    <p>No moderation actions taken</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        
        if (bannedArray.length > 0) {
            html += '<h3 style="color: var(--text-primary); margin-bottom: 15px;"><i class="fas fa-ban"></i> Banned Users</h3>';
            html += bannedArray.map(([username, banData]) => this.renderModerationCard(username, banData, 'banned')).join('');
        }
        
        if (mutedArray.length > 0) {
            html += '<h3 style="color: var(--text-primary); margin: 20px 0 15px 0;"><i class="fas fa-microphone-slash"></i> Muted Users</h3>';
            html += mutedArray.map(([username, muteData]) => this.renderModerationCard(username, muteData, 'muted')).join('');
        }
        
        container.innerHTML = html;
    }

    renderUserCard(user) {
        const statusClass = user.isBanned ? 'status-banned' : 
                           user.isMuted ? 'status-muted' : 
                           user.isOnline ? 'status-online' : 'status-offline';
        
        const statusText = user.isBanned ? 'Banned' : 
                          user.isMuted ? 'Muted' : 
                          user.isOnline ? 'Online' : 'Offline';
        
        // Role badge
        const roleBadge = user.role && user.role !== 'user' ? 
            `<span class="status-badge ${user.role === 'admin' ? 'status-banned' : 'status-muted'}" style="margin-right: 10px;">
                ${user.role.toUpperCase()}
            </span>` : '';
        
        // Action buttons based on permissions
        let actionButtons = '';
        
        // Kick button - available to all moderators and admins
        actionButtons += `<button class="action-btn kick" onclick="admin.kickUser('${user.username}')">Kick</button>`;
        
        // Mute button - available to all moderators and admins
        if (user.isMuted) {
            actionButtons += `<button class="action-btn unmute" onclick="admin.unmuteUser('${user.username}')">Unmute</button>`;
        } else {
            actionButtons += `<button class="action-btn mute" onclick="admin.showMuteModal('${user.username}')">Mute</button>`;
        }
        
        // Ban button - only available to admins
        if (this.userRole === 'admin') {
            if (user.isBanned) {
                actionButtons += `<button class="action-btn unban" onclick="admin.unbanUser('${user.username}')">Unban</button>`;
            } else {
                actionButtons += `<button class="action-btn ban" onclick="admin.showBanModal('${user.username}')">Ban</button>`;
            }
        }
        
        // Role management - only available to admins
        if (this.userRole === 'admin' && user.username !== this.currentUser.username) {
            actionButtons += `<button class="action-btn role" onclick="admin.showRoleModal('${user.username}', '${user.role || 'user'}')">Role</button>`;
        }
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff`}" 
                         alt="${user.username}" class="user-avatar">
                    <div class="user-details">
                        <h3>${this.escapeHtml(user.username)}</h3>
                        <p>Joined: ${new Date(user.createdAt).toLocaleDateString()}</p>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">Role: ${user.role || 'user'}</p>
                    </div>
                </div>
                <div class="user-status">
                    ${roleBadge}
                    <span class="status-badge ${statusClass}">${statusText}</span>
                    <div class="user-actions">
                        ${actionButtons}
                    </div>
                </div>
            </div>
        `;
    }

    renderModerationCard(username, data, type) {
        const user = this.users.get(username);
        const avatar = user ? user.avatar : `https://ui-avatars.com/api/?name=${username}&background=333&color=fff`;
        
        const actionText = type === 'banned' ? 'Banned' : 'Muted';
        const actionIcon = type === 'banned' ? 'ban' : 'microphone-slash';
        const actionColor = type === 'banned' ? '#dc3545' : '#ffc107';
        
        const duration = data.duration ? `${data.duration} minutes` : 'Permanent';
        const expiresAt = data.expiresAt ? new Date(data.expiresAt).toLocaleString() : 'Never';
        const reason = data.reason || 'No reason provided';
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <img src="${avatar}" alt="${username}" class="user-avatar">
                    <div class="user-details">
                        <h3>${this.escapeHtml(username)}</h3>
                        <p><strong>${actionText}</strong> by ${this.escapeHtml(data.adminUsername)}</p>
                        <p><strong>Reason:</strong> ${this.escapeHtml(reason)}</p>
                        <p><strong>Duration:</strong> ${duration}</p>
                        <p><strong>Expires:</strong> ${expiresAt}</p>
                    </div>
                </div>
                <div class="user-status">
                    <span class="status-badge" style="background: ${actionColor}; color: white;">${actionText}</span>
                    <div class="user-actions">
                        ${type === 'muted' ? 
                            `<button class="action-btn unmute" onclick="admin.unmuteUser('${username}')">Unmute</button>` :
                            `<button class="action-btn unban" onclick="admin.unbanUser('${username}')">Unban</button>`
                        }
                    </div>
                </div>
            </div>
        `;
    }

    async kickUser(username) {
        if (!confirm(`Are you sure you want to kick ${username}? They will be unable to chat for 10 minutes.`)) return;
        
        try {
            console.log(`[ADMIN DEBUG] Kicking user: ${username}`);
            
            // Remove user from online users
            const onlineUserRef = this.ref(this.database, `users/${username}`);
            await this.remove(onlineUserRef);
            
            // Create kick data with 10-minute timeout
            const kickData = {
                username: username,
                adminUsername: this.currentUser.username,
                reason: 'Kicked by ' + this.userRole,
                timestamp: Date.now(),
                expiresAt: Date.now() + (10 * 60 * 1000), // 10 minutes
                duration: 10
            };
            
            // Add to moderation database
            const kickRef = this.ref(this.database, `moderation/kicked/${username}`);
            await this.set(kickRef, kickData);
            
            // Update user status
            const userRef = this.ref(this.database, `registered_users/${username}`);
            const userData = this.users.get(username);
            if (userData) {
                userData.isKicked = true;
                userData.kickExpiresAt = kickData.expiresAt;
                await this.set(userRef, userData);
            }
            
            this.showSuccess(`User ${username} has been kicked for 10 minutes.`);
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error kicking user:', error);
            this.showError('Failed to kick user. Please try again.');
        }
    }

    showMuteModal(username) {
        this.selectedUser = username;
        const modal = document.getElementById('action-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        const maxDuration = this.userRole === 'admin' ? 10080 : 1440; // Admin: 7 days, Mod: 24 hours
        const defaultDuration = this.userRole === 'admin' ? 60 : 30; // Admin: 1 hour, Mod: 30 minutes
        
        modalTitle.textContent = `Mute User: ${username}`;
        modalBody.innerHTML = `
            <div class="form-group">
                <label for="mute-duration">Duration (minutes):</label>
                <input type="number" id="mute-duration" min="1" max="${maxDuration}" value="${defaultDuration}" placeholder="${defaultDuration}">
                <small style="color: var(--text-muted); font-size: 0.8rem;">
                    ${this.userRole === 'admin' ? 'Maximum: 7 days (10080 minutes)' : 'Maximum: 24 hours (1440 minutes)'}
                </small>
            </div>
            <div class="form-group">
                <label for="mute-reason">Reason:</label>
                <input type="text" id="mute-reason" placeholder="Enter reason for mute">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="admin.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="admin.muteUser()">Mute User</button>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async muteUser() {
        if (!this.selectedUser) return;
        
        const duration = parseInt(document.getElementById('mute-duration').value);
        const reason = document.getElementById('mute-reason').value.trim();
        
        if (!duration || duration < 1) {
            this.showError('Please enter a valid duration.');
            return;
        }
        
        try {
            console.log(`[ADMIN DEBUG] Muting user: ${this.selectedUser} for ${duration} minutes`);
            
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
            
            // Update user status
            const userRef = this.ref(this.database, `registered_users/${this.selectedUser}`);
            await this.set(userRef, {
                ...this.users.get(this.selectedUser),
                isMuted: true,
                muteExpiresAt: expiresAt
            });
            
            this.closeModal();
            this.showSuccess(`User ${this.selectedUser} has been muted for ${duration} minutes.`);
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error muting user:', error);
            this.showError('Failed to mute user. Please try again.');
        }
    }

    async unmuteUser(username) {
        if (!confirm(`Are you sure you want to unmute ${username}?`)) return;
        
        try {
            console.log(`[ADMIN DEBUG] Unmuting user: ${username}`);
            
            // Remove from moderation database
            const muteRef = this.ref(this.database, `moderation/muted/${username}`);
            await this.remove(muteRef);
            
            // Update user status
            const userRef = this.ref(this.database, `registered_users/${username}`);
            const userData = this.users.get(username);
            if (userData) {
                delete userData.isMuted;
                delete userData.muteExpiresAt;
                delete userData.muteData;
                await this.set(userRef, userData);
            }
            
            this.showSuccess(`User ${username} has been unmuted.`);
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error unmuting user:', error);
            this.showError('Failed to unmute user. Please try again.');
        }
    }

    showBanModal(username) {
        this.selectedUser = username;
        const modal = document.getElementById('action-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Ban User: ${username}`;
        modalBody.innerHTML = `
            <div class="form-group">
                <label for="ban-duration">Duration:</label>
                <select id="ban-duration">
                    <option value="1440">24 hours</option>
                    <option value="10080">7 days</option>
                    <option value="43200">30 days</option>
                    <option value="0">Permanent</option>
                </select>
            </div>
            <div class="form-group">
                <label for="ban-reason">Reason:</label>
                <input type="text" id="ban-reason" placeholder="Enter reason for ban">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="admin.closeModal()">Cancel</button>
                <button class="btn btn-danger" onclick="admin.banUser()">Ban User</button>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async banUser() {
        if (!this.selectedUser) return;
        
        const duration = parseInt(document.getElementById('ban-duration').value);
        const reason = document.getElementById('ban-reason').value.trim();
        
        try {
            console.log(`[ADMIN DEBUG] Banning user: ${this.selectedUser} for ${duration} minutes`);
            
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
            
            // Update user status
            const userRef = this.ref(this.database, `registered_users/${this.selectedUser}`);
            await this.set(userRef, {
                ...this.users.get(this.selectedUser),
                isBanned: true,
                banExpiresAt: expiresAt
            });
            
            // Remove from online users
            const onlineUserRef = this.ref(this.database, `users/${this.selectedUser}`);
            await this.remove(onlineUserRef);
            
            this.closeModal();
            this.showSuccess(`User ${this.selectedUser} has been banned.`);
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error banning user:', error);
            this.showError('Failed to ban user. Please try again.');
        }
    }

    async unbanUser(username) {
        if (!confirm(`Are you sure you want to unban ${username}?`)) return;
        
        try {
            console.log(`[ADMIN DEBUG] Unbanning user: ${username}`);
            
            // Remove from moderation database
            const banRef = this.ref(this.database, `moderation/banned/${username}`);
            await this.remove(banRef);
            
            // Update user status
            const userRef = this.ref(this.database, `registered_users/${username}`);
            const userData = this.users.get(username);
            if (userData) {
                delete userData.isBanned;
                delete userData.banExpiresAt;
                delete userData.banData;
                await this.set(userRef, userData);
            }
            
            this.showSuccess(`User ${username} has been unbanned.`);
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error unbanning user:', error);
            this.showError('Failed to unban user. Please try again.');
        }
    }

    closeModal() {
        const modal = document.getElementById('action-modal');
        modal.style.display = 'none';
        this.selectedUser = null;
    }

    loadUser() {
        try {
            const userData = localStorage.getItem('hackconvo_user');
            return userData ? JSON.parse(userData) : null;
        } catch (error) {
            console.error('[ADMIN DEBUG] Error loading user:', error);
            return null;
        }
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
            color: white;
            padding: 15px 20px;
            border-radius: 6px;
            z-index: 1001;
            display: flex;
            align-items: center;
            gap: 10px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 3000);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showRoleModal(username, currentRole) {
        this.selectedUser = username;
        const modal = document.getElementById('action-modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        
        modalTitle.textContent = `Manage Role: ${username}`;
        modalBody.innerHTML = `
            <div class="form-group">
                <label for="user-role">Role:</label>
                <select id="user-role">
                    <option value="user" ${currentRole === 'user' ? 'selected' : ''}>User</option>
                    <option value="moderator" ${currentRole === 'moderator' ? 'selected' : ''}>Moderator</option>
                    <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </div>
            <div class="form-group">
                <label for="role-reason">Reason (optional):</label>
                <input type="text" id="role-reason" placeholder="Enter reason for role change">
            </div>
            <div class="modal-actions">
                <button class="btn btn-secondary" onclick="admin.closeModal()">Cancel</button>
                <button class="btn btn-primary" onclick="admin.updateUserRole()">Update Role</button>
            </div>
        `;
        
        modal.style.display = 'block';
    }

    async updateUserRole() {
        if (!this.selectedUser) return;
        
        const newRole = document.getElementById('user-role').value;
        const reason = document.getElementById('role-reason').value.trim();
        
        try {
            console.log(`[ADMIN DEBUG] Updating role for ${this.selectedUser} to ${newRole}`);
            
            // Get current user data
            const userRef = this.ref(this.database, `registered_users/${this.selectedUser}`);
            const userData = this.users.get(this.selectedUser);
            
            if (!userData) {
                this.showError('User not found');
                return;
            }
            
            // Update user role
            const updatedUserData = {
                ...userData,
                role: newRole,
                roleUpdatedAt: Date.now(),
                roleUpdatedBy: this.currentUser.username,
                roleUpdateReason: reason || null
            };
            
            await this.set(userRef, updatedUserData);
            
            // Update local data
            this.users.set(this.selectedUser, updatedUserData);
            
            this.closeModal();
            this.showSuccess(`User ${this.selectedUser} role updated to ${newRole}`);
            
            // Refresh the display
            this.renderUsers();
            
        } catch (error) {
            console.error('[ADMIN DEBUG] Error updating user role:', error);
            this.showError('Failed to update user role. Please try again.');
        }
    }

    renderRoleManagement() {
        const container = document.getElementById('roles-list');
        if (!container) return;
        
        if (this.users.size === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-user-shield"></i>
                    <p>No users found</p>
                </div>
            `;
            return;
        }
        
        const usersArray = Array.from(this.users.values())
            .filter(user => user.username !== this.currentUser.username) // Don't show current user
            .sort((a, b) => {
                // Sort by role priority: admin > moderator > user
                const rolePriority = { admin: 3, moderator: 2, user: 1 };
                const aPriority = rolePriority[a.role || 'user'];
                const bPriority = rolePriority[b.role || 'user'];
                if (aPriority !== bPriority) return bPriority - aPriority;
                return a.username.localeCompare(b.username);
            });
        
        container.innerHTML = usersArray.map(user => this.renderRoleCard(user)).join('');
    }

    renderRoleCard(user) {
        const roleColors = {
            admin: '#dc3545',
            moderator: '#ffc107',
            user: '#6c757d'
        };
        
        const roleColor = roleColors[user.role || 'user'];
        
        return `
            <div class="user-card">
                <div class="user-info">
                    <img src="${user.avatar || `https://ui-avatars.com/api/?name=${user.username}&background=333&color=fff`}" 
                         alt="${user.username}" class="user-avatar">
                    <div class="user-details">
                        <h3>${this.escapeHtml(user.username)}</h3>
                        <p>Joined: ${new Date(user.createdAt).toLocaleDateString()}</p>
                        <p style="font-size: 0.8rem; color: var(--text-muted);">
                            Current Role: <strong style="color: ${roleColor};">${user.role || 'user'}</strong>
                        </p>
                        ${user.roleUpdatedAt ? `
                        <p style="font-size: 0.7rem; color: var(--text-muted);">
                            Updated: ${new Date(user.roleUpdatedAt).toLocaleString()}
                        </p>
                        ` : ''}
                    </div>
                </div>
                <div class="user-status">
                    <span class="status-badge" style="background: ${roleColor}; color: white;">
                        ${(user.role || 'user').toUpperCase()}
                    </span>
                    <div class="user-actions">
                        <button class="action-btn role" onclick="admin.showRoleModal('${user.username}', '${user.role || 'user'}')">
                            Change Role
                        </button>
                    </div>
                </div>
            </div>
        `;
    }
}

// Global functions for HTML onclick handlers
let admin;

function showSection(sectionName) {
    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(section => {
        section.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(`${sectionName}-section`).style.display = 'block';
    
    // Update active nav button
    document.querySelectorAll('.admin-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    
    // Handle special section rendering
    if (sectionName === 'roles' && admin) {
        admin.renderRoleManagement();
    }
}

function closeModal() {
    if (admin) {
        admin.closeModal();
    }
}

// Initialize admin when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    admin = new HackConvoAdmin();
}); 