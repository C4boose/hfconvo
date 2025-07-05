// HackConvo Authentication System
class HackConvoAuth {
    constructor() {
        this.database = null;
        this.ref = null;
        this.push = null;
        this.onValue = null;
        this.set = null;
        this.get = null;
        this.init();
    }

    init() {
        // Wait for Firebase to be available
        this.waitForFirebase();
    }

    waitForFirebase() {
        console.log('[AUTH DEBUG] Checking Firebase availability...');
        console.log('[AUTH DEBUG] firebaseDatabase:', !!window.firebaseDatabase);
        console.log('[AUTH DEBUG] firebaseRef:', !!window.firebaseRef);
        console.log('[AUTH DEBUG] firebasePush:', !!window.firebasePush);
        console.log('[AUTH DEBUG] firebaseSet:', !!window.firebaseSet);
        console.log('[AUTH DEBUG] firebaseGet:', !!window.firebaseGet);
        
        if (window.firebaseDatabase && window.firebaseRef && window.firebasePush && window.firebaseSet && window.firebaseGet) {
            console.log('[AUTH DEBUG] Firebase is ready, setting up auth...');
            // Store references to Firebase functions
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.push = window.firebasePush;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            this.onValue = window.firebaseOnValue;
            this.setupEventListeners();
        } else {
            console.log('[AUTH DEBUG] Firebase not ready, retrying...');
            setTimeout(() => this.waitForFirebase(), 100);
        }
    }

    setupEventListeners() {
        console.log('[AUTH DEBUG] Setting up event listeners...');
        
        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            console.log('[AUTH DEBUG] Register form found, adding listener');
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('[AUTH DEBUG] Register form submitted');
                this.handleRegister();
            });
        } else {
            console.log('[AUTH DEBUG] Register form not found');
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            console.log('[AUTH DEBUG] Login form found, adding listener');
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                console.log('[AUTH DEBUG] Login form submitted');
                // Add small delay to ensure Firebase is ready
                setTimeout(() => this.handleLogin(), 100);
            });
        } else {
            console.log('[AUTH DEBUG] Login form not found');
        }

        // Real-time validation - only for registration form
        const registerUsernameInput = document.getElementById('register-username');
        if (registerUsernameInput) {
            registerUsernameInput.addEventListener('input', (e) => {
                this.validateUsername(e.target.value, e.target.id);
            });
        }
    }

    validateUsername(username, inputId) {
        const errorElement = document.getElementById(inputId.replace('username', 'error'));
        const input = document.getElementById(inputId);
        
        // Clear previous error
        errorElement.style.display = 'none';
        input.style.borderColor = '';
        
        // Check length
        if (username.length < 3) {
            this.showError(errorElement, input, 'Username must be at least 3 characters long');
            return false;
        }
        
        // Check for special characters (only allow letters, numbers, and underscores)
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            this.showError(errorElement, input, 'Username can only contain letters, numbers, and underscores');
            return false;
        }
        
        // Only check username availability for registration form
        if (inputId === 'register-username') {
            this.checkUsernameAvailability(username, inputId);
        }
        return true;
    }

    showError(errorElement, input, message) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        input.style.borderColor = '#dc3545';
    }

    hideError(errorElement, input) {
        errorElement.style.display = 'none';
        input.style.borderColor = '';
    }

    async checkUsernameAvailability(username, inputId) {
        try {
            console.log('[AUTH DEBUG] Checking availability for username:', username);
            console.log('[AUTH DEBUG] Database:', this.database);
            console.log('[AUTH DEBUG] Ref function:', this.ref);
            console.log('[AUTH DEBUG] Get function:', this.get);
            
            const userRef = this.ref(this.database, `registered_users/${username}`);
            console.log('[AUTH DEBUG] User ref created:', userRef);
            
            const snapshot = await this.get(userRef);
            console.log('[AUTH DEBUG] Snapshot received:', snapshot);
            
            const errorElement = document.getElementById(inputId.replace('username', 'error'));
            const input = document.getElementById(inputId);
            
            if (snapshot.exists()) {
                console.log('[AUTH DEBUG] Username already exists');
                this.showError(errorElement, input, 'Username is already taken');
                return false;
            } else {
                console.log('[AUTH DEBUG] Username is available');
                this.hideError(errorElement, input);
                return true;
            }
        } catch (error) {
            console.error('[AUTH DEBUG] Error checking username availability:', error);
            console.error('[AUTH DEBUG] Error details:', {
                message: error.message,
                stack: error.stack,
                database: this.database,
                ref: this.ref,
                get: this.get
            });
            return true; // Allow if we can't check
        }
    }

    async handleRegister() {
        console.log('[AUTH DEBUG] Starting registration...');
        
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const errorElement = document.getElementById('register-error');
        const submitBtn = document.querySelector('#register-form .auth-btn');
        
        console.log('[AUTH DEBUG] Username:', username);
        console.log('[AUTH DEBUG] Password length:', password.length);
        
        // Validate username
        if (!this.validateUsername(username, 'register-username')) {
            console.log('[AUTH DEBUG] Username validation failed');
            return;
        }
        
        // Validate password
        if (password.length < 6) {
            console.log('[AUTH DEBUG] Password validation failed');
            this.showError(errorElement, document.getElementById('register-password'), 'Password must be at least 6 characters long');
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        
        try {
            console.log('[AUTH DEBUG] Checking username availability...');
            // Check if username is available
            const isAvailable = await this.checkUsernameAvailability(username, 'register-username');
            if (!isAvailable) {
                console.log('[AUTH DEBUG] Username not available');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Register';
                return;
            }
            
            // Create user data
            const userData = {
                username: username,
                password: this.hashPassword(password), // In production, use proper hashing
                avatar: `https://ui-avatars.com/api/?name=${username}&background=333&color=fff`,
                createdAt: Date.now(),
                lastLogin: Date.now(),
                status: 'online',
                role: 'user' // Default role: user, moderator, admin
            };
            
            console.log('[AUTH DEBUG] User data created:', userData);
            
            // FIX: Use correct ref syntax
            const userRef = this.ref(this.database, `registered_users/${username}`);
            console.log('[AUTH DEBUG] User ref created:', userRef);
            
            console.log('[AUTH DEBUG] Saving to Firebase at path:', `registered_users/${username}`);
            console.log('[AUTH DEBUG] User data to save:', userData);
            
            await this.set(userRef, userData);
            console.log('[AUTH DEBUG] User saved to Firebase successfully');
            
            // Save to localStorage for immediate access
            localStorage.setItem('hackconvo_user', JSON.stringify({
                ...userData,
                isRegistered: true
            }));
            console.log('[AUTH DEBUG] User saved to localStorage');
            
            // Show success message
            console.log('[AUTH DEBUG] Showing success message');
            this.showSuccessMessage('Registration successful! Redirecting to chat...');
            
            // Redirect to chat after 2 seconds
            setTimeout(() => {
                console.log('[AUTH DEBUG] Redirecting to chat...');
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('[AUTH DEBUG] Registration error:', error);
            this.showError(errorElement, document.getElementById('register-username'), 'Registration failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    }

    async handleLogin() {
        console.log('[AUTH DEBUG] Starting login...');
        
        // Check if Firebase is ready
        if (!this.database || !this.ref || !this.get) {
            console.error('[AUTH DEBUG] Firebase not ready for login');
            const errorElement = document.getElementById('login-error');
            if (errorElement) {
                this.showError(errorElement, document.getElementById('login-username'), 'System not ready. Please try again.');
            }
            return;
        }
        
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const submitBtn = document.querySelector('#login-form .auth-btn');
        
        console.log('[AUTH DEBUG] Username:', username);
        console.log('[AUTH DEBUG] Password length:', password.length);
        console.log('[AUTH DEBUG] Error element found:', !!errorElement);
        console.log('[AUTH DEBUG] Submit button found:', !!submitBtn);
        
        // Validate inputs
        if (!username || !password) {
            console.log('[AUTH DEBUG] Missing username or password');
            this.showError(errorElement, document.getElementById('login-username'), 'Please enter both username and password');
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        try {
            console.log('[AUTH DEBUG] Getting user from Firebase...');
            console.log('[AUTH DEBUG] Database object:', this.database);
            console.log('[AUTH DEBUG] Ref function:', this.ref);
            console.log('[AUTH DEBUG] Get function:', this.get);
            
            // Get user from Firebase - use direct path like in registration
            const userRef = this.ref(this.database, `registered_users/${username}`);
            console.log('[AUTH DEBUG] User ref created:', userRef);
            
            const snapshot = await this.get(userRef);
            console.log('[AUTH DEBUG] Firebase snapshot received:', snapshot);
            console.log('[AUTH DEBUG] Firebase snapshot exists:', snapshot.exists());
            
            if (!snapshot.exists()) {
                console.log('[AUTH DEBUG] User not found in database');
                this.showError(errorElement, document.getElementById('login-username'), 'Invalid username or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }
            
            const userData = snapshot.val();
            console.log('[AUTH DEBUG] User data retrieved:', userData);
            
            // Check password
            const hashedPassword = this.hashPassword(password);
            console.log('[AUTH DEBUG] Password check - stored:', userData.password, 'input:', hashedPassword);
            
            if (userData.password !== hashedPassword) {
                console.log('[AUTH DEBUG] Password mismatch');
                this.showError(errorElement, document.getElementById('login-password'), 'Invalid username or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }
            
            console.log('[AUTH DEBUG] Password correct, updating last login...');
            // Update last login
            await this.set(userRef, {
                ...userData,
                lastLogin: Date.now(),
                status: 'online'
            });
            
            // Save to localStorage
            localStorage.setItem('hackconvo_user', JSON.stringify({
                ...userData,
                isRegistered: true
            }));
            console.log('[AUTH DEBUG] User saved to localStorage');
            
            // Show success message
            console.log('[AUTH DEBUG] Showing success message');
            this.showSuccessMessage('Login successful! Redirecting to chat...');
            
            // Redirect to chat after 2 seconds
            setTimeout(() => {
                console.log('[AUTH DEBUG] Redirecting to chat...');
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('[AUTH DEBUG] Login error:', error);
            this.showError(errorElement, document.getElementById('login-username'), 'Login failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Login';
        }
    }

    hashPassword(password) {
        // Simple hash for demo - in production use proper hashing like bcrypt
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    showSuccessMessage(message) {
        console.log('[AUTH DEBUG] Showing success message:', message);
        
        // Create success message element
        const successDiv = document.createElement('div');
        successDiv.className = 'auth-success';
        successDiv.innerHTML = `
            <i class="fas fa-check-circle"></i>
            <span>${message}</span>
        `;
        successDiv.style.cssText = `
            background: #28a745;
            color: white;
            padding: 1rem;
            border-radius: 6px;
            margin-bottom: 1rem;
            text-align: center;
            font-weight: 500;
        `;
        
        // Insert at the top of the form
        const form = document.querySelector('.auth-form');
        if (form) {
            console.log('[AUTH DEBUG] Form found, inserting success message');
            form.insertBefore(successDiv, form.firstChild);
        } else {
            console.error('[AUTH DEBUG] Form not found for success message');
        }
        
        // Remove after 3 seconds
        setTimeout(() => {
            if (successDiv.parentNode) {
                successDiv.parentNode.removeChild(successDiv);
            }
        }, 3000);
    }
}

// Initialize auth when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new HackConvoAuth();
}); 