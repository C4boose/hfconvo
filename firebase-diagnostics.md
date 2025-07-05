# Firebase Connection Diagnostics

## Quick Troubleshooting Steps

### 1. Check Browser Console
Open your browser's developer tools (F12) and check the console for any error messages. Look for:
- Firebase initialization errors
- Network errors
- Permission denied errors

### 2. Test Firebase Connection
The test script has been added to your page. In the browser console, run:
```javascript
testFirebase()
```

This will run comprehensive tests to check:
- Firebase initialization
- Database connectivity
- Read/write permissions
- Configuration validity

### 3. Check Configuration
Run this in the console to verify your Firebase config:
```javascript
checkFirebaseConfig()
```

### 4. Check Database Permissions
Run this to test if you can read/write to the database:
```javascript
checkFirebasePermissions()
```

## Common Issues and Solutions

### Issue 1: "Firebase connection failed"
**Possible causes:**
- Firebase SDK not loaded properly
- Network connectivity issues
- Incorrect configuration
- Database security rules blocking access

**Solutions:**
1. Check if Firebase SDK loaded: `console.log(window.firebaseDatabase)`
2. Verify network connection
3. Check Firebase console for any service disruptions
4. Verify security rules allow read/write access

### Issue 2: "Permission denied"
**Cause:** Firebase security rules are blocking access

**Solution:** Check your Firebase Realtime Database rules. They should allow read/write access:

```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

**Note:** These are permissive rules for development. For production, you should implement proper authentication and authorization.

### Issue 3: "Configuration not found"
**Cause:** The config.js file is not loading properly

**Solution:**
1. Check if config.js is accessible
2. Verify the file path is correct
3. Check for JavaScript errors in config.js

### Issue 4: "Firebase functions not available"
**Cause:** Firebase SDK modules not loaded

**Solution:**
1. Check network connectivity
2. Verify Firebase CDN is accessible
3. Check for JavaScript errors preventing module loading

## Manual Testing Steps

1. **Open browser console** (F12)
2. **Check Firebase availability:**
   ```javascript
   console.log('Firebase Database:', !!window.firebaseDatabase);
   console.log('Firebase Ref:', !!window.firebaseRef);
   console.log('Firebase Set:', !!window.firebaseSet);
   console.log('Firebase Get:', !!window.firebaseGet);
   ```

3. **Check configuration:**
   ```javascript
   console.log('Config:', window.HACKCONVO_CONFIG);
   ```

4. **Test basic connectivity:**
   ```javascript
   if (window.firebaseDatabase && window.firebaseRef) {
       const testRef = window.firebaseRef(window.firebaseDatabase, 'test');
       window.firebaseSet(testRef, { test: true }).then(() => {
           console.log('Firebase write successful');
       }).catch(error => {
           console.error('Firebase write failed:', error);
       });
   }
   ```

## Firebase Console Checks

1. **Go to Firebase Console:** https://console.firebase.google.com
2. **Select your project:** hfconvo
3. **Check Realtime Database:**
   - Verify the database exists
   - Check if there are any error messages
   - Verify the database URL matches your config

4. **Check Project Settings:**
   - Verify the web app configuration
   - Check if the API key is correct
   - Ensure the project is not disabled

## Network Issues

If you're behind a firewall or proxy:
1. Check if Firebase domains are accessible
2. Verify HTTPS connections are allowed
3. Check if any security software is blocking Firebase

## Debug Mode

To enable more detailed logging, add this to your browser console:
```javascript
localStorage.setItem('debug', 'firebase:*');
```

Then refresh the page to see detailed Firebase logs.

## Still Having Issues?

If the problem persists:
1. Check the browser console for specific error messages
2. Run the diagnostic tests above
3. Check your Firebase project status
4. Verify your internet connection
5. Try in an incognito/private browser window 