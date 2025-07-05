// Comprehensive fix script for moderator access and real-time updates
console.log('=== MODERATOR FIX SCRIPT ===');

// Function to check and fix user role
function checkAndFixRole() {
    const userData = localStorage.getItem('hackconvo_user');
    if (!userData) {
        console.log('❌ No user data found');
        return;
    }
    
    const user = JSON.parse(userData);
    console.log('Current user:', user);
    
    if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseGet) {
        console.log('❌ Firebase not available');
        return;
    }
    
    const database = window.firebaseDatabase;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    
    const userRef = ref(database, `registered_users/${user.username}`);
    get(userRef).then((snapshot) => {
        const dbUser = snapshot.val();
        console.log('Firebase user data:', dbUser);
        
        if (dbUser && dbUser.role) {
            if (user.role !== dbUser.role) {
                console.log(`🔄 Syncing role from ${user.role} to ${dbUser.role}`);
                user.role = dbUser.role;
                localStorage.setItem('hackconvo_user', JSON.stringify(user));
                console.log('✅ Role synced');
                
                // Reload page to apply changes
                if (window.location.pathname.includes('admin.html')) {
                    console.log('🔄 Reloading admin page...');
                    window.location.reload();
                }
            } else {
                console.log('✅ Role is already synced');
            }
        } else {
            console.log('❌ No user data in Firebase');
        }
    }).catch(error => {
        console.error('Error fetching user data:', error);
    });
}

// Function to make a user moderator
function makeModerator(username) {
    if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseSet || !window.firebaseGet) {
        console.error('❌ Firebase not available');
        return;
    }
    
    const database = window.firebaseDatabase;
    const ref = window.firebaseRef;
    const set = window.firebaseSet;
    const get = window.firebaseGet;
    
    const userRef = ref(database, `registered_users/${username}`);
    
    get(userRef).then((snapshot) => {
        const userData = snapshot.val();
        if (userData) {
            const updatedUserData = {
                ...userData,
                role: 'moderator',
                roleUpdatedAt: Date.now(),
                roleUpdatedBy: 'fix_script'
            };
            
            set(userRef, updatedUserData).then(() => {
                console.log(`✅ Made ${username} a moderator`);
                console.log('🔄 User should refresh their page to see changes');
            }).catch(error => {
                console.error('❌ Error updating user:', error);
            });
        } else {
            console.error(`❌ User not found: ${username}`);
        }
    }).catch(error => {
        console.error('❌ Error fetching user:', error);
    });
}

// Function to test moderation actions
function testModeration(username) {
    if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseSet) {
        console.error('❌ Firebase not available');
        return;
    }
    
    const database = window.firebaseDatabase;
    const ref = window.firebaseRef;
    const set = window.firebaseSet;
    
    // Test mute
    const moderationRef = ref(database, 'moderation');
    const muteData = {
        username: username,
        mutedBy: 'test_script',
        mutedAt: Date.now(),
        expiresAt: Date.now() + (5 * 60 * 1000), // 5 minutes
        reason: 'Test mute'
    };
    
    set(ref(database, `moderation/muted/${username}`), muteData).then(() => {
        console.log(`✅ Muted ${username} for 5 minutes`);
        console.log('🔄 Check if the user sees the mute effect immediately');
    }).catch(error => {
        console.error('❌ Error muting user:', error);
    });
}

// Function to check moderation status
function checkModerationStatus(username) {
    if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseGet) {
        console.error('❌ Firebase not available');
        return;
    }
    
    const database = window.firebaseDatabase;
    const ref = window.firebaseRef;
    const get = window.firebaseGet;
    
    const moderationRef = ref(database, 'moderation');
    get(moderationRef).then((snapshot) => {
        const data = snapshot.val();
        console.log('Moderation data:', data);
        
        if (data && data.muted && data.muted[username]) {
            const muteData = data.muted[username];
            const isExpired = muteData.expiresAt && Date.now() > muteData.expiresAt;
            console.log(`${username} mute status:`, {
                muted: !isExpired,
                expiresAt: new Date(muteData.expiresAt),
                reason: muteData.reason,
                mutedBy: muteData.mutedBy
            });
        } else {
            console.log(`${username} is not muted`);
        }
        
        if (data && data.banned && data.banned[username]) {
            const banData = data.banned[username];
            const isExpired = banData.expiresAt && Date.now() > banData.expiresAt;
            console.log(`${username} ban status:`, {
                banned: !isExpired,
                expiresAt: new Date(banData.expiresAt),
                reason: banData.reason,
                bannedBy: banData.bannedBy
            });
        } else {
            console.log(`${username} is not banned`);
        }
    }).catch(error => {
        console.error('❌ Error checking moderation status:', error);
    });
}

// Auto-run role check
checkAndFixRole();

console.log('=== AVAILABLE FUNCTIONS ===');
console.log('checkAndFixRole() - Check and fix user role');
console.log('makeModerator("username") - Make a user moderator');
console.log('testModeration("username") - Test mute a user for 5 minutes');
console.log('checkModerationStatus("username") - Check moderation status');
console.log('=== END MODERATOR FIX SCRIPT ==='); 