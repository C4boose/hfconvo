// Debug script to check user role and permissions
console.log('=== ROLE DEBUG ===');

// Check localStorage
const userData = localStorage.getItem('hackconvo_user');
console.log('LocalStorage user data:', userData);

if (userData) {
    const user = JSON.parse(userData);
    console.log('Parsed user:', user);
    console.log('User role:', user.role);
    console.log('Username:', user.username);
    
    // Check if role is valid for admin access
    const canAccessAdmin = user.role === 'admin' || user.role === 'moderator';
    console.log('Can access admin page:', canAccessAdmin);
    
    // Check Firebase for current role
    if (window.firebaseDatabase && window.firebaseRef && window.firebaseGet) {
        const database = window.firebaseDatabase;
        const ref = window.firebaseRef;
        const get = window.firebaseGet;
        
        const userRef = ref(database, `registered_users/${user.username}`);
        get(userRef).then((snapshot) => {
            const dbUser = snapshot.val();
            console.log('Firebase user data:', dbUser);
            if (dbUser) {
                console.log('Firebase role:', dbUser.role);
                console.log('Role mismatch:', user.role !== dbUser.role);
                
                if (user.role !== dbUser.role) {
                    console.log('SYNCING ROLE FROM FIREBASE...');
                    user.role = dbUser.role;
                    localStorage.setItem('hackconvo_user', JSON.stringify(user));
                    console.log('Role synced to:', user.role);
                }
            }
        }).catch(error => {
            console.error('Error fetching from Firebase:', error);
        });
    } else {
        console.log('Firebase not available');
    }
} else {
    console.log('No user data found in localStorage');
}

console.log('=== END ROLE DEBUG ==='); 