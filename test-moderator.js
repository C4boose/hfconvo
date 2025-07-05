// Test script to debug moderator access
console.log('=== MODERATOR ACCESS TEST ===');

// Check if we're on admin page
const isAdminPage = window.location.pathname.includes('admin.html');
console.log('On admin page:', isAdminPage);

// Check localStorage
const userData = localStorage.getItem('hackconvo_user');
console.log('User data from localStorage:', userData);

if (userData) {
    const user = JSON.parse(userData);
    console.log('Parsed user:', user);
    console.log('User role:', user.role);
    console.log('Username:', user.username);
    
    // Check if role is valid for admin access
    const canAccessAdmin = user.role === 'admin' || user.role === 'moderator';
    console.log('Can access admin page:', canAccessAdmin);
    
    if (!canAccessAdmin) {
        console.log('❌ User cannot access admin page');
        console.log('Current role:', user.role);
        console.log('Required roles: admin or moderator');
    } else {
        console.log('✅ User can access admin page');
    }
} else {
    console.log('❌ No user data found in localStorage');
}

// Check if admin object exists
if (typeof admin !== 'undefined') {
    console.log('Admin object exists:', !!admin);
    console.log('Admin current user:', admin.currentUser);
    console.log('Admin user role:', admin.userRole);
} else {
    console.log('❌ Admin object not found');
}

console.log('=== END MODERATOR ACCESS TEST ===');

// Function to make a user moderator
function makeModerator(username) {
    if (!window.firebaseDatabase || !window.firebaseRef || !window.firebaseSet) {
        console.error('Firebase not available');
        return;
    }
    
    const database = window.firebaseDatabase;
    const ref = window.firebaseRef;
    const set = window.firebaseSet;
    
    const userRef = ref(database, `registered_users/${username}`);
    
    // Get current user data first
    if (window.firebaseGet) {
        const get = window.firebaseGet;
        get(userRef).then((snapshot) => {
            const userData = snapshot.val();
            if (userData) {
                const updatedUserData = {
                    ...userData,
                    role: 'moderator',
                    roleUpdatedAt: Date.now(),
                    roleUpdatedBy: 'debug_script'
                };
                
                set(userRef, updatedUserData).then(() => {
                    console.log(`✅ Made ${username} a moderator`);
                }).catch(error => {
                    console.error('Error updating user:', error);
                });
            } else {
                console.error('User not found:', username);
            }
        }).catch(error => {
            console.error('Error fetching user:', error);
        });
    } else {
        console.error('Firebase get not available');
    }
}

console.log('Use makeModerator("username") to make someone a moderator'); 