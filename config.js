// HackConvo Configuration
const CONFIG = {
    // Message retention settings
    MESSAGE_RETENTION_HOURS: 4, // How long to keep messages (in hours)
    CLEANUP_INTERVAL_MINUTES: 60, // How often to run cleanup (in minutes)
    CLEANUP_THROTTLE_MINUTES: 5, // Minimum time between cleanups (in minutes)
    
    // Chat settings
    MAX_MESSAGE_LENGTH: 2000,
    TYPING_TIMEOUT_MS: 3000,
    HEARTBEAT_INTERVAL_MS: 30000,
    
    // UI settings
    THEME: 'dark', // 'dark', 'darker', 'black'
    SOUND_ENABLED: true
};

// Make config available globally
window.HACKCONVO_CONFIG = CONFIG; 