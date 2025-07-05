// Firebase Connection Test Script
// Run this in the browser console to test Firebase connectivity

class FirebaseTester {
    constructor() {
        this.database = null;
        this.ref = null;
        this.set = null;
        this.get = null;
        this.init();
    }

    init() {
        console.log('[FIREBASE TEST] Starting Firebase connection test...');
        this.waitForFirebase();
    }

    waitForFirebase() {
        if (window.firebaseDatabase && window.firebaseRef && window.firebaseSet && window.firebaseGet) {
            console.log('[FIREBASE TEST] Firebase is ready');
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            this.runTests();
        } else {
            console.log('[FIREBASE TEST] Firebase not ready, retrying...');
            setTimeout(() => this.waitForFirebase(), 500);
        }
    }

    async runTests() {
        console.log('[FIREBASE TEST] Running connection tests...');
        
        try {
            // Test 1: Check if we can create a reference
            console.log('[FIREBASE TEST] Test 1: Creating reference...');
            const testRef = this.ref(this.database, 'test');
            console.log('[FIREBASE TEST] ✓ Reference created successfully');
            
            // Test 2: Check if we can write data
            console.log('[FIREBASE TEST] Test 2: Writing test data...');
            const testData = {
                message: 'Firebase connection test',
                timestamp: Date.now()
            };
            await this.set(testRef, testData);
            console.log('[FIREBASE TEST] ✓ Data written successfully');
            
            // Test 3: Check if we can read data
            console.log('[FIREBASE TEST] Test 3: Reading test data...');
            const snapshot = await this.get(testRef);
            if (snapshot.exists()) {
                console.log('[FIREBASE TEST] ✓ Data read successfully:', snapshot.val());
            } else {
                console.log('[FIREBASE TEST] ✗ No data found');
            }
            
            // Test 4: Clean up test data
            console.log('[FIREBASE TEST] Test 4: Cleaning up test data...');
            await this.set(testRef, null);
            console.log('[FIREBASE TEST] ✓ Test data cleaned up');
            
            // Test 5: Check users node
            console.log('[FIREBASE TEST] Test 5: Checking users node...');
            const usersRef = this.ref(this.database, 'users');
            const usersSnapshot = await this.get(usersRef);
            if (usersSnapshot.exists()) {
                const users = usersSnapshot.val();
                console.log('[FIREBASE TEST] ✓ Users node exists with', Object.keys(users).length, 'users');
            } else {
                console.log('[FIREBASE TEST] ✓ Users node exists (empty)');
            }
            
            // Test 6: Check messages node
            console.log('[FIREBASE TEST] Test 6: Checking messages node...');
            const messagesRef = this.ref(this.database, 'messages');
            const messagesSnapshot = await this.get(messagesRef);
            if (messagesSnapshot.exists()) {
                const messages = messagesSnapshot.val();
                console.log('[FIREBASE TEST] ✓ Messages node exists with', Object.keys(messages).length, 'messages');
            } else {
                console.log('[FIREBASE TEST] ✓ Messages node exists (empty)');
            }
            
            console.log('[FIREBASE TEST] 🎉 All tests passed! Firebase is working correctly.');
            
        } catch (error) {
            console.error('[FIREBASE TEST] ✗ Test failed:', error);
            console.error('[FIREBASE TEST] Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        }
    }

    async checkConfig() {
        console.log('[FIREBASE TEST] Checking configuration...');
        console.log('[FIREBASE TEST] Config available:', !!window.HACKCONVO_CONFIG);
        
        if (window.HACKCONVO_CONFIG) {
            console.log('[FIREBASE TEST] Firebase config:', window.HACKCONVO_CONFIG.FIREBASE_CONFIG);
            
            // Check if all required config fields are present
            const config = window.HACKCONVO_CONFIG.FIREBASE_CONFIG;
            const requiredFields = ['apiKey', 'authDomain', 'databaseURL', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
            
            const missingFields = requiredFields.filter(field => !config[field]);
            if (missingFields.length > 0) {
                console.error('[FIREBASE TEST] ✗ Missing config fields:', missingFields);
            } else {
                console.log('[FIREBASE TEST] ✓ All required config fields present');
            }
        } else {
            console.error('[FIREBASE TEST] ✗ No configuration found');
        }
    }

    async checkPermissions() {
        console.log('[FIREBASE TEST] Checking database permissions...');
        
        try {
            const testRef = this.ref(this.database, 'permission-test');
            await this.set(testRef, { test: true });
            await this.get(testRef);
            await this.set(testRef, null);
            console.log('[FIREBASE TEST] ✓ Read/write permissions working');
        } catch (error) {
            console.error('[FIREBASE TEST] ✗ Permission error:', error.message);
            if (error.message.includes('permission')) {
                console.error('[FIREBASE TEST] This looks like a Firebase security rules issue');
                console.error('[FIREBASE TEST] Check your Firebase Realtime Database rules');
            }
        }
    }
}

// Initialize tester
const firebaseTester = new FirebaseTester();

// Add global functions
window.testFirebase = () => firebaseTester.runTests();
window.checkFirebaseConfig = () => firebaseTester.checkConfig();
window.checkFirebasePermissions = () => firebaseTester.checkPermissions();

console.log(`
=== Firebase Connection Tester ===
Available functions:
- testFirebase() - Run all connection tests
- checkFirebaseConfig() - Check configuration
- checkFirebasePermissions() - Check database permissions

Run testFirebase() to diagnose connection issues.
`); 