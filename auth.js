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
        if (window.firebaseDatabase && window.firebaseRef && window.firebasePush && window.firebaseSet && window.firebaseGet) {
            this.database = window.firebaseDatabase;
            this.ref = window.firebaseRef;
            this.push = window.firebasePush;
            this.set = window.firebaseSet;
            this.get = window.firebaseGet;
            this.onValue = window.firebaseOnValue;
            this.setupEventListeners();
        } else {
            setTimeout(() => this.waitForFirebase(), 100);
        }
    }

    setupEventListeners() {
        // Registration form
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleRegister();
            });
        }

        // Login form
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.handleLogin();
            });
        }

        // Real-time validation
        const usernameInputs = document.querySelectorAll('input[name="username"]');
        usernameInputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.validateUsername(e.target.value, e.target.id);
            });
        });
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
        
        // Check if username is already taken
        this.checkUsernameAvailability(username, inputId);
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
            const usersRef = this.ref(this.database, 'registered_users');
            const userRef = this.ref(usersRef, username);
            
            const snapshot = await this.get(userRef);
            const errorElement = document.getElementById(inputId.replace('username', 'error'));
            const input = document.getElementById(inputId);
            
            if (snapshot.exists()) {
                this.showError(errorElement, input, 'Username is already taken');
                return false;
            } else {
                this.hideError(errorElement, input);
                return true;
            }
        } catch (error) {
            console.error('Error checking username availability:', error);
            return true; // Allow if we can't check
        }
    }

    async handleRegister() {
        const username = document.getElementById('register-username').value.trim();
        const password = document.getElementById('register-password').value;
        const errorElement = document.getElementById('register-error');
        const submitBtn = document.querySelector('#register-form .auth-btn');
        
        // Validate username
        if (!this.validateUsername(username, 'register-username')) {
            return;
        }
        
        // Validate password
        if (password.length < 6) {
            this.showError(errorElement, document.getElementById('register-password'), 'Password must be at least 6 characters long');
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Registering...';
        
        try {
            // Check if username is available
            const isAvailable = await this.checkUsernameAvailability(username, 'register-username');
            if (!isAvailable) {
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
                status: 'online'
            };
            
            // Save to Firebase
            const usersRef = this.ref(this.database, 'registered_users');
            const userRef = this.ref(usersRef, username);
            await this.set(userRef, userData);
            
            // Save to localStorage for immediate access
            localStorage.setItem('hackconvo_user', JSON.stringify({
                ...userData,
                isRegistered: true
            }));
            
            // Show success message
            this.showSuccessMessage('Registration successful! Redirecting to chat...');
            
            // Redirect to chat after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showError(errorElement, document.getElementById('register-username'), 'Registration failed. Please try again.');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Register';
        }
    }

    async handleLogin() {
        const username = document.getElementById('login-username').value.trim();
        const password = document.getElementById('login-password').value;
        const errorElement = document.getElementById('login-error');
        const submitBtn = document.querySelector('#login-form .auth-btn');
        
        // Validate inputs
        if (!username || !password) {
            this.showError(errorElement, document.getElementById('login-username'), 'Please enter both username and password');
            return;
        }
        
        // Disable submit button
        submitBtn.disabled = true;
        submitBtn.textContent = 'Logging in...';
        
        try {
            // Get user from Firebase
            const usersRef = this.ref(this.database, 'registered_users');
            const userRef = this.ref(usersRef, username);
            const snapshot = await this.get(userRef);
            
            if (!snapshot.exists()) {
                this.showError(errorElement, document.getElementById('login-username'), 'Invalid username or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }
            
            const userData = snapshot.val();
            
            // Check password
            if (userData.password !== this.hashPassword(password)) {
                this.showError(errorElement, document.getElementById('login-password'), 'Invalid username or password');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Login';
                return;
            }
            
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
            
            // Show success message
            this.showSuccessMessage('Login successful! Redirecting to chat...');
            
            // Redirect to chat after 2 seconds
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            
        } catch (error) {
            console.error('Login error:', error);
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
        form.insertBefore(successDiv, form.firstChild);
        
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