// Cleanup script to remove duplicate user entries from Firebase
// Run this in the browser console to clean up the database

class DatabaseCleanup {
    constructor() {
        this.database = null;
        this.ref = null;
        this.set = null;
        this.get = null;
        this.remove = null;
        this.child = null;
        this.init();
    }

    init() {
        console.log('[CLEANUP] Initializing database cleanup...');
        this.waitForFirebase();
    }

    waitForFirebase() {
        if (window.firebaseDatabase && window.firebaseRef && window.firebaseSet && window.firebaseGet && window.firebaseRemove && window.firebaseChild) {
            console.log('[CLEANUP] Firebase is ready');
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            this.remove = window.firebaseRemove;
            this.child = window.firebaseChild;
            this.setupCleanup();
        } else {
            console.log('[CLEANUP] Firebase not ready, retrying...');
            setTimeout(() => this.waitForFirebase(), 100);
        }
    }

    setupCleanup() {
        // Add global functions
        window.cleanupDatabase = () => this.cleanupDatabase();
        window.listDuplicateUsers = () => this.listDuplicateUsers();
        
        console.log(`
=== Database Cleanup Tool ===
Available functions:
- cleanupDatabase() - Remove duplicate user entries
- listDuplicateUsers() - List all duplicate users found

Run cleanupDatabase() to fix the duplicate user issue.
        `);
    }

    async listDuplicateUsers() {
        try {
            console.log('[CLEANUP] Scanning for duplicate users...');
            
            // Get all users from the users node
            const usersRef = this.ref(this.database, 'users');
            const snapshot = await this.get(usersRef);
            
            if (!snapshot.exists()) {
                console.log('[CLEANUP] No users found in database');
                return;
            }

            const users = snapshot.val();
            const duplicates = [];
            const uniqueUsers = new Map();

            // Find duplicates
            Object.entries(users).forEach(([key, userData]) => {
                if (userData && userData.username) {
                    if (uniqueUsers.has(userData.username)) {
                        // This is a duplicate
                        duplicates.push({
                            key: key,
                            username: userData.username,
                            data: userData,
                            isDuplicate: true
                        });
                    } else {
                        // First time seeing this username
                        uniqueUsers.set(userData.username, {
                            key: key,
                            username: userData.username,
                            data: userData,
                            isDuplicate: false
                        });
                    }
                }
            });

            console.log('[CLEANUP] Found duplicates:', duplicates);
            console.log('[CLEANUP] Unique users:', Array.from(uniqueUsers.values()));
            
            return {
                duplicates: duplicates,
                uniqueUsers: Array.from(uniqueUsers.values())
            };

        } catch (error) {
            console.error('[CLEANUP] Error listing duplicate users:', error);
            return null;
        }
    }

    async cleanupDatabase() {
        try {
            console.log('[CLEANUP] Starting database cleanup...');
            
            const result = await this.listDuplicateUsers();
            if (!result) {
                console.log('[CLEANUP] No data to clean up');
                return;
            }

            const { duplicates, uniqueUsers } = result;
            
            if (duplicates.length === 0) {
                console.log('[CLEANUP] No duplicates found!');
                return;
            }

            console.log(`[CLEANUP] Found ${duplicates.length} duplicate entries to remove`);
            
            // Remove duplicate entries
            const usersRef = this.ref(this.database, 'users');
            let removedCount = 0;

            for (const duplicate of duplicates) {
                try {
                    const duplicateRef = this.child(usersRef, duplicate.key);
                    await this.remove(duplicateRef);
                    console.log(`[CLEANUP] Removed duplicate: ${duplicate.username} (key: ${duplicate.key})`);
                    removedCount++;
                } catch (error) {
                    console.error(`[CLEANUP] Error removing duplicate ${duplicate.username}:`, error);
                }
            }

            console.log(`[CLEANUP] Successfully removed ${removedCount} duplicate entries`);
            
            // Now reorganize the remaining users to use username as key
            console.log('[CLEANUP] Reorganizing users to use username as key...');
            
            const reorganizedUsers = {};
            for (const user of uniqueUsers) {
                reorganizedUsers[user.username] = user.data;
            }

            // Clear the entire users node and recreate it
            await this.remove(usersRef);
            
            // Add back the unique users with username as key
            for (const [username, userData] of Object.entries(reorganizedUsers)) {
                const userRef = this.child(usersRef, username);
                await this.set(userRef, userData);
                console.log(`[CLEANUP] Reorganized user: ${username}`);
            }

            console.log('[CLEANUP] Database cleanup completed successfully!');
            console.log(`[CLEANUP] Final user count: ${Object.keys(reorganizedUsers).length}`);
            
            // Show success message
            alert(`Database cleanup completed!\nRemoved ${removedCount} duplicate entries.\nReorganized ${Object.keys(reorganizedUsers).length} unique users.`);

        } catch (error) {
            console.error('[CLEANUP] Error during cleanup:', error);
            alert('Error during cleanup: ' + error.message);
        }
    }
}

// Initialize cleanup tool
const cleanup = new DatabaseCleanup();

console.log(`
=== Database Cleanup Tool Loaded ===
Run cleanupDatabase() to fix duplicate user entries.
Run listDuplicateUsers() to see what duplicates exist.
`); 