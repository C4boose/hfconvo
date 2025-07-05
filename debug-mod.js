// Debug script for moderator permissions
// Run this in the browser console to check moderator status

class ModDebugger {
    constructor() {
        this.database = null;
        this.ref = null;
        this.get = null;
        this.init();
    }

    init() {
        console.log('[MOD DEBUG] Initializing moderator debugger...');
        this.waitForFirebase();
    }

    waitForFirebase() {
        if (window.firebaseDatabase && window.firebaseRef && window.firebaseGet) {
            console.log('[MOD DEBUG] Firebase is ready');
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.get = window.firebaseGet;
            this.runDebug();
        } else {
            console.log('[MOD DEBUG] Firebase not ready, retrying...');
            setTimeout(() => this.waitForFirebase(), 100);
        }
    }

    async runDebug() {
        console.log('[MOD DEBUG] Running moderator permission check...');
        
        try {
            // Check current user
            const currentUser = JSON.parse(localStorage.getItem('hackconvo_user') || '{}');
            console.log('[MOD DEBUG] Current user from localStorage:', currentUser);
            
            // Check user in registered_users
            const registeredUserRef = this.ref(this.database, `registered_users/${currentUser.username}`);
            const registeredSnapshot = await this.get(registeredUserRef);
            
            if (registeredSnapshot.exists()) {
                const dbUser = registeredSnapshot.val();
                console.log('[MOD DEBUG] User in registered_users:', dbUser);
            } else {
                console.log('[MOD DEBUG] User not found in registered_users');
            }
            
            // Check user in users (online)
            const onlineUserRef = this.ref(this.database, `users/${currentUser.username}`);
            const onlineSnapshot = await this.get(onlineUserRef);
            
            if (onlineSnapshot.exists()) {
                const onlineUser = onlineSnapshot.val();
                console.log('[MOD DEBUG] User in users (online):', onlineUser);
            } else {
                console.log('[MOD DEBUG] User not found in users (online)');
            }
            
            // Check if user can access admin panel
            const canAccess = currentUser.role === 'admin' || currentUser.role === 'moderator';
            console.log('[MOD DEBUG] Can access admin panel:', canAccess);
            
            // Check role level
            const roleLevel = this.getRoleLevel(currentUser.role);
            console.log('[MOD DEBUG] Role level:', roleLevel);
            
            // Test moderation permissions
            this.testModerationPermissions(currentUser);
            
        } catch (error) {
            console.error('[MOD DEBUG] Error during debug:', error);
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

    testModerationPermissions(user) {
        console.log('[MOD DEBUG] Testing moderation permissions...');
        
        const role = user.role || 'user';
        
        // Test kick permission
        const canKick = role === 'moderator' || role === 'admin';
        console.log('[MOD DEBUG] Can kick users:', canKick);
        
        // Test mute permission
        const canMute = role === 'moderator' || role === 'admin';
        console.log('[MOD DEBUG] Can mute users:', canMute);
        
        // Test ban permission
        const canBan = role === 'admin';
        console.log('[MOD DEBUG] Can ban users:', canBan);
        
        // Test role management
        const canManageRoles = role === 'admin';
        console.log('[MOD DEBUG] Can manage roles:', canManageRoles);
        
        // Test admin panel access
        const canAccessAdmin = role === 'moderator' || role === 'admin';
        console.log('[MOD DEBUG] Can access admin panel:', canAccessAdmin);
    }

    async checkUserInDatabase(username) {
        console.log(`[MOD DEBUG] Checking user ${username} in database...`);
        
        try {
            // Check both locations
            const registeredUserRef = this.ref(this.database, `registered_users/${username}`);
            const onlineUserRef = this.ref(this.database, `users/${username}`);
            
            const registeredSnapshot = await this.get(registeredUserRef);
            const onlineSnapshot = await this.get(onlineUserRef);
            
            console.log('[MOD DEBUG] Registered user data:', registeredSnapshot.exists() ? registeredSnapshot.val() : 'Not found');
            console.log('[MOD DEBUG] Online user data:', onlineSnapshot.exists() ? onlineSnapshot.val() : 'Not found');
            
        } catch (error) {
            console.error('[MOD DEBUG] Error checking user:', error);
        }
    }

    async fixUserRole(username, newRole) {
        console.log(`[MOD DEBUG] Fixing role for ${username} to ${newRole}...`);
        
        try {
            const registeredUserRef = this.ref(this.database, `registered_users/${username}`);
            const onlineUserRef = this.ref(this.database, `users/${username}`);
            
            const userData = {
                role: newRole,
                roleFixedAt: Date.now(),
                roleFixedBy: 'ModDebugger'
            };
            
            // Update both locations
            await this.set(registeredUserRef, userData);
            await this.set(onlineUserRef, userData);
            
            console.log(`[MOD DEBUG] Successfully updated ${username} role to ${newRole}`);
            
            // Update localStorage if it's the current user
            const currentUser = JSON.parse(localStorage.getItem('hackconvo_user') || '{}');
            if (currentUser.username === username) {
                currentUser.role = newRole;
                localStorage.setItem('hackconvo_user', JSON.stringify(currentUser));
                console.log('[MOD DEBUG] Updated localStorage');
            }
            
        } catch (error) {
            console.error('[MOD DEBUG] Error fixing user role:', error);
        }
    }
}

// Initialize debugger
const modDebugger = new ModDebugger();

// Add global functions
window.debugMod = () => modDebugger.runDebug();
window.checkUser = (username) => modDebugger.checkUserInDatabase(username);
window.fixUserRole = (username, role) => modDebugger.fixUserRole(username, role);

console.log(`
=== Moderator Debug Tools ===
Available functions:
- debugMod() - Run full moderator permission check
- checkUser("username") - Check specific user in database
- fixUserRole("username", "moderator") - Fix user role

Run debugMod() to check your moderator status.
`); 