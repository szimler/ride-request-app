// Driver App JavaScript
// Handles notifications, ride management, and driver availability

const API_BASE = window.location.origin;
const POLL_INTERVAL = 5000; // 5 seconds

// State
let driverState = {
    isAvailable: false,
    scheduleStart: '08:00',
    scheduleEnd: '18:00',
    showSchedule: true,
    soundEnabled: true,
    vibrationEnabled: true,
    volume: 100,
    vibrationPattern: 'medium',
    lastCheckedRideId: null,
    knownRideIds: new Set(),
    isConnected: false
};

// Elements
const availabilityToggle = document.getElementById('availabilityToggle');
const scheduleStart = document.getElementById('scheduleStart');
const scheduleEnd = document.getElementById('scheduleEnd');
const saveScheduleBtn = document.getElementById('saveScheduleBtn');
const scheduleDisplay = document.getElementById('scheduleDisplay');
const showScheduleToggle = document.getElementById('showScheduleToggle');
const soundEnabled = document.getElementById('soundEnabled');
const vibrationEnabled = document.getElementById('vibrationEnabled');
const volumeControl = document.getElementById('volumeControl');
const volumeDisplay = document.getElementById('volumeDisplay');
const vibrationPattern = document.getElementById('vibrationPattern');
const testVibrationBtn = document.getElementById('testVibrationBtn');
const testNotificationBtn = document.getElementById('testNotificationBtn');
const ridesList = document.getElementById('ridesList');
const sirenAlert = document.getElementById('sirenAlert');
const sirenVideo = document.getElementById('sirenVideo');
const notificationSound = document.getElementById('notificationSound');
const alertSoundBackup = document.getElementById('alertSoundBackup');
const connectionStatus = document.getElementById('connectionStatus');
const statusIndicator = connectionStatus.querySelector('.status-indicator');
const statusText = connectionStatus.querySelector('.status-text');

// Audio Context for generating alert tones
let audioContext;
let audioUnlocked = false;

// Initialize Audio Context
function initAudioContext() {
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        console.log('✓ Audio context created');
    }
    return audioContext;
}

// Generate loud alert tone using Web Audio API
function playAlertTone(duration = 2000) {
    const ctx = initAudioContext();
    
    // Resume context if suspended (browser requirement)
    if (ctx.state === 'suspended') {
        ctx.resume();
    }
    
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    
    // Create alternating siren sound (850Hz and 950Hz)
    oscillator.frequency.setValueAtTime(850, ctx.currentTime);
    oscillator.frequency.setValueAtTime(950, ctx.currentTime + 0.25);
    oscillator.frequency.setValueAtTime(850, ctx.currentTime + 0.5);
    oscillator.frequency.setValueAtTime(950, ctx.currentTime + 0.75);
    oscillator.frequency.setValueAtTime(850, ctx.currentTime + 1.0);
    oscillator.frequency.setValueAtTime(950, ctx.currentTime + 1.25);
    oscillator.frequency.setValueAtTime(850, ctx.currentTime + 1.5);
    oscillator.frequency.setValueAtTime(950, ctx.currentTime + 1.75);
    
    oscillator.type = 'sine';
    
    // Set volume based on user preference
    const volume = (driverState.volume / 100) * 0.3; // Max 30% to avoid distortion
    gainNode.gain.setValueAtTime(volume, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration / 1000);
    
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration / 1000);
    
    console.log('✓ Alert tone playing');
}

// Enable audio on first user interaction
function unlockAudio() {
    if (!audioUnlocked) {
        initAudioContext();
        
        // Try to play and pause to unlock
        const sounds = [notificationSound, alertSoundBackup];
        sounds.forEach(sound => {
            if (sound) {
                sound.play().then(() => {
                    sound.pause();
                    sound.currentTime = 0;
                }).catch(() => {});
            }
        });
        
        audioUnlocked = true;
        console.log('✓ Audio unlocked');
    }
}

// Unlock audio on any user interaction
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('touchstart', unlockAudio, { once: true });

// Vibration patterns
const vibrationPatterns = {
    short: [200],
    medium: [200, 100, 200, 100, 200],
    long: [200, 100, 200, 100, 200, 100, 200, 100, 200],
    continuous: [200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200, 100, 200]
};

// Initialize
function init() {
    loadSettings();
    setupEventListeners();
    startPolling();
    loadDriverStatus();
    updateConnectionStatus(true);
    console.log('🚗 Driver app initialized');
}

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem('driverSettings');
    if (saved) {
        const settings = JSON.parse(saved);
        // Merge settings but preserve the Set for knownRideIds
        driverState = { 
            ...driverState, 
            ...settings,
            knownRideIds: new Set() // Always reinitialize as a Set
        };
        
        // Apply to UI
        availabilityToggle.checked = driverState.isAvailable;
        scheduleStart.value = driverState.scheduleStart;
        scheduleEnd.value = driverState.scheduleEnd;
        showScheduleToggle.checked = driverState.showSchedule;
        soundEnabled.checked = driverState.soundEnabled;
        vibrationEnabled.checked = driverState.vibrationEnabled;
        volumeControl.value = driverState.volume;
        volumeDisplay.textContent = driverState.volume + '%';
        vibrationPattern.value = driverState.vibrationPattern;
        
        updateScheduleDisplay();
    }
}

// Save settings to localStorage
function saveSettings() {
    // Don't save knownRideIds (it's a Set and doesn't serialize well)
    const { knownRideIds, isConnected, lastCheckedRideId, ...settingsToSave } = driverState;
    localStorage.setItem('driverSettings', JSON.stringify(settingsToSave));
    console.log('✓ Settings saved');
}

// Setup event listeners
function setupEventListeners() {
    // Availability toggle
    availabilityToggle.addEventListener('change', async () => {
        driverState.isAvailable = availabilityToggle.checked;
        saveSettings();
        await updateDriverAvailability();
        showToast(driverState.isAvailable ? 'You are now available' : 'You are now unavailable', driverState.isAvailable ? 'success' : 'info');
    });

    // Schedule
    saveScheduleBtn.addEventListener('click', () => {
        driverState.scheduleStart = scheduleStart.value;
        driverState.scheduleEnd = scheduleEnd.value;
        saveSettings();
        updateScheduleDisplay();
        updateDriverAvailability();
        showToast('Schedule saved successfully', 'success');
    });

    // Show schedule toggle
    showScheduleToggle.addEventListener('change', async () => {
        driverState.showSchedule = showScheduleToggle.checked;
        saveSettings();
        console.log('Toggle changed. showSchedule is now:', driverState.showSchedule);
        await updateDriverAvailability();
        showToast(
            driverState.showSchedule ? 'Schedule will be shown to riders' : 'Schedule hidden from riders',
            'info'
        );
    });

    // Sound settings
    soundEnabled.addEventListener('change', () => {
        driverState.soundEnabled = soundEnabled.checked;
        saveSettings();
    });

    volumeControl.addEventListener('input', () => {
        driverState.volume = parseInt(volumeControl.value);
        volumeDisplay.textContent = driverState.volume + '%';
        notificationSound.volume = driverState.volume / 100;
        saveSettings();
    });

    // Vibration settings
    vibrationEnabled.addEventListener('change', () => {
        driverState.vibrationEnabled = vibrationEnabled.checked;
        saveSettings();
    });

    vibrationPattern.addEventListener('change', () => {
        driverState.vibrationPattern = vibrationPattern.value;
        saveSettings();
    });

    // Test buttons
    testVibrationBtn.addEventListener('click', () => {
        testVibration();
    });

    testNotificationBtn.addEventListener('click', () => {
        testFullNotification();
    });

    // Siren overlay - dismiss on touch/click
    sirenAlert.addEventListener('click', () => {
        dismissSiren();
    });

    // Set initial volume
    notificationSound.volume = driverState.volume / 100;
}

// Update schedule display
function updateScheduleDisplay() {
    scheduleDisplay.textContent = `${formatTime(driverState.scheduleStart)} - ${formatTime(driverState.scheduleEnd)}`;
}

// Format time for display
function formatTime(timeString) {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Test vibration
function testVibration() {
    if ('vibrate' in navigator && driverState.vibrationEnabled) {
        const pattern = vibrationPatterns[driverState.vibrationPattern];
        navigator.vibrate(pattern);
        showToast('Vibration test', 'info');
    } else {
        showToast('Vibration not supported on this device', 'warning');
    }
}

// Test full notification
function testFullNotification() {
    showToast('Testing full notification...', 'info');
    triggerNotification('Test Ride Request');
}

// Trigger notification (siren, sound, vibration)
async function triggerNotification(rideName) {
    console.log('🚨 Triggering notification for:', rideName);

    // Wake screen (attempt)
    try {
        if ('wakeLock' in navigator) {
            const wakeLock = await navigator.wakeLock.request('screen');
            console.log('✓ Screen wake lock acquired');
            setTimeout(() => {
                wakeLock.release();
            }, 10000); // Release after 10 seconds
        }
    } catch (err) {
        console.log('Wake lock not supported:', err);
    }

    // Show fullscreen siren
    sirenAlert.classList.remove('hidden');
    
    // Play video (visual only - no audio in this video)
    sirenVideo.play().catch(err => console.log('Video play blocked:', err));

    // Play LOUD alert sounds
    if (driverState.soundEnabled) {
        // Method 1: Web Audio API tone (most reliable and LOUD)
        try {
            playAlertTone(3000); // 3 second alert tone
        } catch (err) {
            console.error('Error playing alert tone:', err);
        }
        
        // Method 2: Backup embedded sound
        try {
            alertSoundBackup.volume = driverState.volume / 100;
            alertSoundBackup.loop = true;
            await alertSoundBackup.play();
            
            // Stop backup sound after 3 seconds
            setTimeout(() => {
                alertSoundBackup.pause();
                alertSoundBackup.currentTime = 0;
                alertSoundBackup.loop = false;
            }, 3000);
            
            console.log('✓ Backup alert sound playing');
        } catch (err) {
            console.error('Error playing backup sound:', err);
        }
    }

    // Trigger vibration
    if (driverState.vibrationEnabled && 'vibrate' in navigator) {
        const pattern = vibrationPatterns[driverState.vibrationPattern];
        navigator.vibrate(pattern);
    }

    // Browser notification (if permitted)
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🚨 New Ride Request', {
            body: `New ride from ${rideName}`,
            icon: '/qr-code.png',
            vibrate: vibrationPatterns[driverState.vibrationPattern],
            requireInteraction: true
        });
    }
}

// Dismiss siren
function dismissSiren() {
    sirenAlert.classList.add('hidden');
    
    // Stop video
    sirenVideo.pause();
    sirenVideo.currentTime = 0;
    
    // Stop backup sound if playing
    if (alertSoundBackup) {
        alertSoundBackup.pause();
        alertSoundBackup.currentTime = 0;
        alertSoundBackup.loop = false;
    }
    
    console.log('✓ Siren dismissed');
}

// Load driver status from server
async function loadDriverStatus() {
    try {
        const response = await fetch(`${API_BASE}/api/driver/status`);
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.status) {
                driverState.isAvailable = data.status.is_available;
                driverState.scheduleStart = data.status.schedule_start || '08:00';
                driverState.scheduleEnd = data.status.schedule_end || '18:00';
                driverState.showSchedule = data.status.show_schedule !== false; // Default to true
                
                availabilityToggle.checked = driverState.isAvailable;
                scheduleStart.value = driverState.scheduleStart;
                scheduleEnd.value = driverState.scheduleEnd;
                showScheduleToggle.checked = driverState.showSchedule;
                updateScheduleDisplay();
            }
        }
    } catch (err) {
        console.error('Error loading driver status:', err);
    }
}

// Update driver availability on server
async function updateDriverAvailability() {
    try {
        const payload = {
            is_available: driverState.isAvailable,
            schedule_start: driverState.scheduleStart,
            schedule_end: driverState.scheduleEnd,
            show_schedule: driverState.showSchedule
        };
        
        console.log('Sending to server:', payload);
        
        const response = await fetch(`${API_BASE}/api/driver/status`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✓ Driver availability updated on server:', result);
        }
    } catch (err) {
        console.error('Error updating driver availability:', err);
    }
}

// Start polling for new rides
function startPolling() {
    fetchActiveRides();
    setInterval(fetchActiveRides, POLL_INTERVAL);
}

// Fetch active rides from server
async function fetchActiveRides() {
    try {
        const response = await fetch(`${API_BASE}/api/driver/active-rides`);
        
        if (!response.ok) {
            updateConnectionStatus(false);
            return;
        }

        updateConnectionStatus(true);
        
        const data = await response.json();
        
        if (data.success && data.rides) {
            // Check for new rides
            data.rides.forEach(ride => {
                if (!driverState.knownRideIds.has(ride.id)) {
                    // New ride detected!
                    console.log('🆕 New ride detected:', ride.id);
                    triggerNotification(ride.name);
                    driverState.knownRideIds.add(ride.id);
                }
            });

            displayRides(data.rides);
        }
    } catch (err) {
        console.error('Error fetching active rides:', err);
        updateConnectionStatus(false);
    }
}

// Display rides in UI
function displayRides(rides) {
    if (rides.length === 0) {
        ridesList.innerHTML = '<p class="no-rides">No active rides at the moment</p>';
        return;
    }

    ridesList.innerHTML = rides.map(ride => {
        const isNew = !driverState.knownRideIds.has(ride.id);
        const serviceType = ride.service_type || 'regular';
        
        return `
            <div class="ride-card ${isNew ? 'new-ride' : ''}" data-ride-id="${ride.id}">
                <div class="ride-header">
                    <span class="ride-id">Ride #${ride.id}</span>
                    <span class="ride-time">${formatDateTime(ride.requested_date, ride.requested_time)}</span>
                </div>
                <div class="ride-details">
                    <div class="detail-row">
                        <span class="detail-label">👤 Passenger:</span>
                        <span class="detail-value">${ride.name}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">📞 Phone:</span>
                        <span class="detail-value">${ride.phone_number}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">📍 Pickup:</span>
                        <span class="detail-value">${ride.pickup_location}</span>
                    </div>
                    ${serviceType === 'hourly' ? `
                        <div class="detail-row">
                            <span class="detail-label">⏱️ Service:</span>
                            <span class="detail-value">Hourly - ${ride.hours_needed} hour(s)</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">🕐 Start Time:</span>
                            <span class="detail-value">${ride.start_time}</span>
                        </div>
                    ` : `
                        <div class="detail-row">
                            <span class="detail-label">🎯 Dropoff:</span>
                            <span class="detail-value">${ride.dropoff_location}</span>
                        </div>
                    `}
                    ${ride.notes ? `
                        <div class="detail-row">
                            <span class="detail-label">📝 Notes:</span>
                            <span class="detail-value">${ride.notes}</span>
                        </div>
                    ` : ''}
                </div>
                ${ride.quote_price ? `
                    <div class="ride-price">💰 $${parseFloat(ride.quote_price).toFixed(2)}</div>
                ` : ''}
                <button class="btn-complete" onclick="completeRide(${ride.id})">✅ Mark as Completed</button>
            </div>
        `;
    }).join('');
}

// Format date and time
function formatDateTime(dateStr, timeStr) {
    const date = new Date(dateStr);
    const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `${dateFormatted} at ${formatTime(timeStr)}`;
}

// Complete ride
window.completeRide = async function(rideId) {
    if (!confirm('Mark this ride as completed?')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/api/driver/complete-ride/${rideId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (data.success) {
            showToast('Ride marked as completed!', 'success');
            driverState.knownRideIds.delete(rideId);
            fetchActiveRides(); // Refresh list
        } else {
            showToast('Error: ' + data.message, 'error');
        }
    } catch (err) {
        console.error('Error completing ride:', err);
        showToast('Error completing ride', 'error');
    }
};

// Update connection status
function updateConnectionStatus(connected) {
    driverState.isConnected = connected;
    
    if (connected) {
        statusIndicator.className = 'status-indicator connected';
        statusText.textContent = 'Connected - Monitoring for rides';
    } else {
        statusIndicator.className = 'status-indicator disconnected';
        statusText.textContent = 'Connection lost - Reconnecting...';
    }
}

// Show toast notification
function showToast(message, type = 'info') {
    // Simple toast implementation
    const toast = document.createElement('div');
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : type === 'warning' ? '#ffc107' : '#667eea'};
        color: ${type === 'warning' ? '#000' : '#fff'};
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        z-index: 10000;
        animation: slideInRight 0.3s ease-out;
        font-weight: 500;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Request notification permission on page load
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// Initialize app
document.addEventListener('DOMContentLoaded', init);

// Keep screen awake functionality
let wakeLock = null;

async function requestWakeLock() {
    if ('wakeLock' in navigator && driverState.isAvailable) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('✓ Wake lock active');
            
            wakeLock.addEventListener('release', () => {
                console.log('Wake lock released');
            });
        } catch (err) {
            console.error('Wake lock error:', err);
        }
    }
}

// Re-acquire wake lock when tab becomes visible
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && driverState.isAvailable) {
        requestWakeLock();
    }
});

// Request wake lock when driver becomes available
availabilityToggle?.addEventListener('change', () => {
    if (driverState.isAvailable) {
        requestWakeLock();
    } else if (wakeLock) {
        wakeLock.release();
        wakeLock = null;
    }
});

