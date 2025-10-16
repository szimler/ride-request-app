// Authentication state
let isAuthenticated = false;
let allRequests = [];
let filteredRequests = [];
let authToken = null;
let currentUser = null;
let socket = null;

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const dashboardScreen = document.getElementById('dashboardScreen');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const requestsList = document.getElementById('requestsList');
const loadingMessage = document.getElementById('loadingMessage');
const emptyState = document.getElementById('emptyState');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');

// Stats elements
const totalRequestsEl = document.getElementById('totalRequests');
const pendingRequestsEl = document.getElementById('pendingRequests');
const todayRequestsEl = document.getElementById('todayRequests');

// Check for saved token and auto-login
const savedToken = localStorage.getItem('adminToken');
if (savedToken) {
    verifyAndAutoLogin(savedToken);
}

async function verifyAndAutoLogin(token) {
    try {
        const response = await fetch('/api/admin/verify', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const result = await response.json();
            authToken = token;
            currentUser = result.user;
            showDashboard();
        } else {
            localStorage.removeItem('adminToken');
        }
    } catch (error) {
        console.error('Auto-login failed:', error);
        localStorage.removeItem('adminToken');
    }
}

// Login form handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    
    const btnText = loginForm.querySelector('.btn-text');
    const btnLoading = loginForm.querySelector('.btn-loading');
    const loginBtn = loginForm.querySelector('.login-btn');
    
    loginError.classList.add('hidden');
    loginBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    
    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            authToken = result.token;
            currentUser = result.user;
            localStorage.setItem('adminToken', result.token);
            localStorage.setItem('currentUser', JSON.stringify(result.user));
            showDashboard();
        } else {
            loginError.textContent = result.message || 'Invalid credentials';
            loginError.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Login error:', error);
        loginError.textContent = 'Connection error. Please try again.';
        loginError.classList.remove('hidden');
    } finally {
        loginBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
});

// Logout handler
logoutBtn.addEventListener('click', async () => {
    try {
        // Notify server
        await fetch('/api/admin/logout', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
    } catch (error) {
        console.error('Logout error:', error);
    }
    
    // Disconnect WebSocket
    if (socket) {
        socket.disconnect();
        socket = null;
    }
    
    // Clear local data
    localStorage.removeItem('adminToken');
    localStorage.removeItem('currentUser');
    authToken = null;
    currentUser = null;
    
    // Show login screen
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    loginForm.reset();
});

// Show dashboard
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadRideRequests();
    initializeWebSocket();
    
    // Fallback polling every 60 seconds (WebSocket handles most updates)
    setInterval(loadRideRequests, 60000);
}

// Initialize WebSocket connection for real-time updates
function initializeWebSocket() {
    if (socket) return; // Already connected
    
    // Load Socket.IO client from CDN
    if (typeof io === 'undefined') {
        const script = document.createElement('script');
        script.src = '/socket.io/socket.io.js';
        script.onload = () => connectWebSocket();
        document.head.appendChild(script);
    } else {
        connectWebSocket();
    }
}

function connectWebSocket() {
    socket = io({
        auth: {
            token: authToken
        }
    });
    
    // Authenticate
    socket.emit('authenticate', authToken);
    
    // Connection events
    socket.on('authenticated', (data) => {
        console.log('✓ WebSocket connected:', data);
        showNotification(`Connected as ${data.username}. ${data.connectedAdmins} admin(s) online`, 'success');
    });
    
    socket.on('auth_error', (data) => {
        console.error('WebSocket auth error:', data);
        showNotification('Real-time connection failed', 'error');
    });
    
    socket.on('admin_connected', (data) => {
        showNotification(`${data.username} connected (${data.totalConnected} online)`, 'info');
    });
    
    socket.on('admin_disconnected', (data) => {
        showNotification(`${data.username} disconnected (${data.totalConnected} online)`, 'info');
    });
    
    // Real-time ride request updates
    socket.on('new_ride_request', (request) => {
        console.log('New ride request:', request);
        playNotificationSound();
        showNotification('New ride request received!', 'success');
        loadRideRequests(); // Reload to show new request
    });
    
    socket.on('ride_request_updated', (data) => {
        console.log('Ride request updated by:', data.updatedBy);
        if (data.updatedBy !== currentUser.username) {
            showNotification(`${data.updatedBy} updated a ride request`, 'info');
        }
        loadRideRequests(); // Reload to show changes
    });
    
    socket.on('user_created', (user) => {
        showNotification(`New admin user created: ${user.username}`, 'info');
    });
    
    socket.on('user_updated', (data) => {
        showNotification('Admin user updated', 'info');
    });
    
    socket.on('user_deleted', (data) => {
        showNotification('Admin user deactivated', 'info');
    });
    
    socket.on('connect_error', (error) => {
        console.error('WebSocket connection error:', error);
        showNotification('Real-time connection lost. Using polling...', 'warning');
    });
    
    socket.on('disconnect', () => {
        console.log('WebSocket disconnected');
    });
}

// Load all ride requests
async function loadRideRequests() {
    try {
        const response = await fetch('/api/ride-requests');
        const result = await response.json();
        
        if (result.success) {
            const newRequestCount = result.requests.length;
            
            // Check if there are new requests (audio notification)
            if (previousRequestCount > 0 && newRequestCount > previousRequestCount) {
                playNotificationSound();
                showNotification('New ride request received!', 'success');
            }
            
            previousRequestCount = newRequestCount;
            allRequests = result.requests;
            filteredRequests = allRequests;
            updateStats();
            displayRequests();
        }
    } catch (error) {
        console.error('Error loading requests:', error);
    } finally {
        loadingMessage.classList.add('hidden');
    }
}

// Update statistics
function updateStats() {
    const today = new Date().toISOString().split('T')[0];
    
    totalRequestsEl.textContent = allRequests.length;
    
    const pending = allRequests.filter(r => r.status === 'pending').length;
    pendingRequestsEl.textContent = pending;
    
    const todayReqs = allRequests.filter(r => r.created_at.startsWith(today)).length;
    todayRequestsEl.textContent = todayReqs;
}

// Display ride requests
function displayRequests() {
    if (filteredRequests.length === 0) {
        requestsList.innerHTML = '';
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    requestsList.innerHTML = filteredRequests.map(request => `
        <div class="request-card" data-id="${request.id}">
            <div class="request-header">
                <div class="request-info">
                    <h3>${escapeHtml(request.name)}</h3>
                    <div class="phone-actions">
                        <a href="tel:${request.phone_number}" class="phone-link">
                            📞 ${escapeHtml(request.phone_number)}
                        </a>
                        <a href="sms:${request.phone_number}" class="sms-link">
                            💬 Text
                        </a>
                    </div>
                </div>
                <span class="status-badge status-${request.status}">${request.status}</span>
            </div>
            
            <div class="request-details">
                ${request.service_type === 'hourly' ? `
                    <div class="detail-item" style="background: #FEF3C7; padding: 12px; border-radius: 8px; grid-column: 1 / -1;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        <div class="detail-content">
                            <div class="detail-label">🚗 HOURLY SERVICE</div>
                            <div class="detail-value"><strong>${request.hours_needed} Hour${request.hours_needed > 1 ? 's' : ''} Needed</strong></div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="10" r="3"></circle>
                        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"></path>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">${request.service_type === 'hourly' ? 'Starting Location' : 'Pickup'}</div>
                        <div class="detail-value">${escapeHtml(request.pickup_location)}</div>
                    </div>
                </div>
                
                ${request.service_type !== 'hourly' ? `
                    <div class="detail-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                        </svg>
                        <div class="detail-content">
                            <div class="detail-label">Drop-off</div>
                            <div class="detail-value">${escapeHtml(request.dropoff_location)}</div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">${request.service_type === 'hourly' ? 'Start Date & Time' : 'Date & Time'}</div>
                        <div class="detail-value">${formatDate(request.requested_date)} at ${formatTime(request.requested_time)}</div>
                    </div>
                </div>
                
                ${request.service_type === 'hourly' && request.notes ? `
                    <div class="detail-item" style="grid-column: 1 / -1;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        <div class="detail-content">
                            <div class="detail-label">Special Requests / Notes</div>
                            <div class="detail-value">${escapeHtml(request.notes)}</div>
                        </div>
                    </div>
                ` : ''}
                
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <polyline points="12 6 12 12 16 14"></polyline>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">Submitted</div>
                        <div class="detail-value">${formatDateTime(request.created_at)}</div>
                    </div>
                </div>
            </div>
            
            ${request.quote_price ? `
                <div class="quote-display">
                    <div class="quote-header"><strong>💰 Quote: $${parseFloat(request.quote_price).toFixed(2)}</strong></div>
                    ${request.service_type === 'hourly' ? `
                        <div class="quote-info">⏰ Service Duration: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}</div>
                        <div class="quote-info">💵 Rate: $${(parseFloat(request.quote_price) / request.hours_needed).toFixed(2)}/hour</div>
                        ${request.pickup_eta_minutes ? `<div class="quote-info">🚗 Pickup ETA: ${request.pickup_eta_minutes} minutes</div>` : ''}
                    ` : `
                        ${request.distance_miles ? `<div class="quote-info">📏 Distance to Dropoff: ${request.distance_miles.toFixed(1)} miles</div>` : ''}
                        ${request.duration_minutes ? `<div class="quote-info">⏱️ Estimated Drive Time: ${Math.round(request.duration_minutes)} minutes</div>` : ''}
                        ${request.pickup_eta_minutes ? `<div class="quote-info">🚗 Your Pickup ETA: ${request.pickup_eta_minutes} minutes</div>` : ''}
                        ${request.ride_duration_minutes ? `<div class="quote-info">🕐 Total Ride Duration: ${request.ride_duration_minutes} minutes</div>` : ''}
                    `}
                </div>
            ` : ''}
            
            <div class="request-actions">
                ${request.status === 'pending' ? `
                    <button class="action-btn btn-info" onclick="preQuoteDriver(${request.id})" title="SMS driver for YES/NO confirmation">
                        📱 Pre-Quote (Driver)
                    </button>
                    <button class="action-btn btn-confirm" onclick="showQuotePopup(${request.id})">
                        💵 Send Quote to Rider
                    </button>
                    <button class="action-btn btn-cancel" onclick="notAvailableSMS(${request.id})">
                        ✗ Not Available (SMS)
                    </button>
                ` : ''}
                ${request.status === 'quoted' ? `
                    <button class="action-btn btn-copy" onclick="copyQuote(${request.id})" title="Copy quote details to clipboard">
                        📋 Copy Quote
                    </button>
                    <button class="action-btn btn-info" onclick="smsRiderQuote(${request.id})" title="Open SMS app with quote">
                        💬 SMS Rider
                    </button>
                    <button class="action-btn btn-confirm" onclick="confirmAndSMSDriver(${request.id})">
                        ✓ Confirm & SMS Driver
                    </button>
                    <button class="action-btn btn-cancel" onclick="updateStatus(${request.id}, 'declined')">
                        ✗ Declined
                    </button>
                    <button class="action-btn btn-back" onclick="updateStatus(${request.id}, 'pending')">
                        ← Back to Pending
                    </button>
                ` : ''}
                ${request.status === 'confirmed' ? `
                    <button class="action-btn btn-info" onclick="smsDriverConfirmed(${request.id})" title="Resend confirmation to driver">
                        📱 SMS Driver Again
                    </button>
                    <button class="action-btn btn-complete" onclick="updateStatus(${request.id}, 'completed')">
                        ✓ Complete Ride
                    </button>
                    <button class="action-btn btn-cancel" onclick="updateStatus(${request.id}, 'cancelled')">
                        ✗ Cancel
                    </button>
                    <button class="action-btn btn-back" onclick="updateStatus(${request.id}, 'quoted')">
                        ← Back to Quoted
                    </button>
                ` : ''}
                ${request.status === 'completed' ? `
                    <button class="action-btn btn-back" onclick="updateStatus(${request.id}, 'confirmed')">
                        ← Back to Confirmed
                    </button>
                    <button class="action-btn btn-confirm" onclick="updateStatus(${request.id}, 'pending')" style="background: #6B7280;">
                        Reset to Pending
                    </button>
                ` : ''}
                ${request.status === 'cancelled' || request.status === 'not_available' || request.status === 'declined' ? `
                    <button class="action-btn btn-confirm" onclick="updateStatus(${request.id}, 'pending')" style="background: #6B7280;">
                        Reset to Pending
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

// Send quote to customer
async function sendQuote(requestId) {
    // Find the request
    const request = allRequests.find(r => r.id === requestId);
    
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    // Show calculating message
    showNotification('Calculating route and suggested price...', 'info');
    
    try {
        // Calculate route and price
        const response = await fetch('/api/calculate-route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                pickup_location: request.pickup_location,
                dropoff_location: request.dropoff_location
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show modal with route info and suggested price
            showPriceCalculationModal(requestId, result);
        } else {
            // Fallback to manual entry if Google Maps fails
            console.warn('Google Maps calculation failed:', result.message);
            showManualPriceEntry(requestId);
        }
        
    } catch (error) {
        console.error('Error calculating route:', error);
        // Fallback to manual entry
        showManualPriceEntry(requestId);
    }
}

// Show price calculation modal with route details
function showPriceCalculationModal(requestId, routeData) {
    const { route, pricing, isEstimated } = routeData;
    
    const estimatedNote = isEstimated ? '\n⚠️ Note: Distance is estimated (Google Maps not configured)\n' : '';
    
    const message = `
📍 Route Information:
Distance: ${route.distance.text} (${route.distance.miles} miles)
Duration: ${route.duration.text} (${route.duration.minutes} minutes)
${estimatedNote}
💰 Price Calculation:
${pricing.calculation}
Trip Type: ${pricing.tripType === 'short' ? 'Short trip (<5 miles or <7 min)' : pricing.tripType === 'medium' ? 'Medium trip (5-15 miles)' : 'Long trip (>15 miles)'}

Suggested Price: $${pricing.suggestedPrice}

You can adjust this price before sending to customer.
    `.trim();
    
    const price = prompt(message + '\n\nEnter final price to send to customer:', pricing.suggestedPrice);
    
    if (price === null) {
        return; // User cancelled
    }
    
    const finalPrice = parseFloat(price);
    
    if (isNaN(finalPrice) || finalPrice <= 0) {
        showNotification('Please enter a valid price greater than 0', 'error');
        return;
    }
    
    // Ask for pickup ETA
    const pickupEta = prompt('How many minutes until you can pick up the customer?\n(Optional - leave blank to skip)', route.duration.minutes);
    const pickupEtaMinutes = pickupEta && !isNaN(pickupEta) ? parseInt(pickupEta) : null;
    
    // Ask for ride duration
    const rideDuration = prompt('How long will the ride take? (minutes)\n(Optional - leave blank to skip)', route.duration.minutes);
    const rideDurationMinutes = rideDuration && !isNaN(rideDuration) ? parseInt(rideDuration) : null;
    
    // Save distance and duration for display
    updateStatus(requestId, 'quoted', finalPrice, pickupEtaMinutes, rideDurationMinutes, route.distance.miles, route.duration.minutes);
}

// Fallback: Manual price entry (if Google Maps not configured)
function showManualPriceEntry(requestId) {
    const quotePrice = prompt('Enter the quote price for this ride (numbers only):');
    
    if (quotePrice === null) {
        return; // User cancelled
    }
    
    const price = parseFloat(quotePrice);
    
    if (isNaN(price) || price <= 0) {
        showNotification('Please enter a valid price greater than 0', 'error');
        return;
    }
    
    updateStatus(requestId, 'quoted', price);
}

// Update request status
async function updateStatus(requestId, newStatus, quotePrice = null, pickupEta = null, rideDuration = null, distanceMiles = null, durationMinutes = null) {
    try {
        const body = { status: newStatus };
        if (quotePrice !== null) {
            body.quotePrice = quotePrice;
        }
        if (pickupEta !== null) {
            body.pickupEta = pickupEta;
        }
        if (rideDuration !== null) {
            body.rideDuration = rideDuration;
        }
        if (distanceMiles !== null) {
            body.distanceMiles = distanceMiles;
        }
        if (durationMinutes !== null) {
            body.durationMinutes = durationMinutes;
        }
        
        const response = await fetch(`/api/ride-requests/${requestId}/status`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify(body)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Show success feedback
            showNotification(`Status updated successfully! ${result.smsStatus?.success ? 'SMS sent to customer.' : ''}`, 'success');
            
            // Reload requests
            await loadRideRequests();
        } else {
            showNotification(result.message || 'Error updating status', 'error');
        }
    } catch (error) {
        console.error('Error updating status:', error);
        showNotification('Connection error', 'error');
    }
}

// Search and filter
searchInput.addEventListener('input', applyFilters);
statusFilter.addEventListener('change', applyFilters);

function applyFilters() {
    const searchTerm = searchInput.value.toLowerCase();
    const statusValue = statusFilter.value;
    
    filteredRequests = allRequests.filter(request => {
        const matchesSearch = !searchTerm || 
            request.name.toLowerCase().includes(searchTerm) ||
            request.phone_number.includes(searchTerm) ||
            request.pickup_location.toLowerCase().includes(searchTerm) ||
            request.dropoff_location.toLowerCase().includes(searchTerm);
        
        const matchesStatus = statusValue === 'all' || request.status === statusValue;
        
        return matchesSearch && matchesStatus;
    });
    
    displayRequests();
}

// Refresh button
refreshBtn.addEventListener('click', async () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    await loadRideRequests();
    setTimeout(() => {
        refreshBtn.style.transform = 'rotate(0deg)';
    }, 500);
});

// Utility functions
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    // Handle YYYY-MM-DD format without timezone issues
    if (dateString.includes('-') && dateString.length === 10) {
        const [year, month, day] = dateString.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(timeString) {
    if (!timeString) return '';
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

function formatDateTime(dateTimeString) {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    // Show relative time if recent
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    
    // Otherwise show full date/time
    return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true 
    });
}

function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    let bgColor = '#10B981'; // success - green
    if (type === 'error') bgColor = '#EF4444'; // red
    if (type === 'info') bgColor = '#3B82F6'; // blue
    
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        background: ${bgColor};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 1000;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(400px); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(400px); opacity: 0; }
    }
    .icon-btn { transition: transform 0.5s ease; }
`;
document.head.appendChild(style);

// ============================================
// AUDIO NOTIFICATIONS
// ============================================

let audioContext = null;
let audioEnabled = true;
let audioVolume = 0.5;

// Load settings from localStorage
function loadSettings() {
    const savedAudioEnabled = localStorage.getItem('audioEnabled');
    const savedVolume = localStorage.getItem('audioVolume');
    
    if (savedAudioEnabled !== null) {
        audioEnabled = savedAudioEnabled === 'true';
    }
    
    if (savedVolume !== null) {
        audioVolume = parseFloat(savedVolume);
    }
    
    // Update UI if elements exist
    const audioEnabledCheckbox = document.getElementById('audioEnabled');
    const volumeControl = document.getElementById('volumeControl');
    const volumeValue = document.getElementById('volumeValue');
    
    if (audioEnabledCheckbox) audioEnabledCheckbox.checked = audioEnabled;
    if (volumeControl) {
        volumeControl.value = audioVolume * 100;
        if (volumeValue) volumeValue.textContent = Math.round(audioVolume * 100) + '%';
    }
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('audioEnabled', audioEnabled);
    localStorage.setItem('audioVolume', audioVolume);
}

// Play notification sound
function playNotificationSound() {
    if (!audioEnabled) return;
    
    if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(audioVolume, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
}

// Test notification sound
function testNotificationSound() {
    playNotificationSound();
    showNotification('Test sound played', 'info');
}

// Settings modal functions
function openSettingsModal() {
    document.getElementById('settingsModal').classList.remove('hidden');
}

function closeSettingsModal() {
    document.getElementById('settingsModal').classList.add('hidden');
    saveSettings();
}

// Settings event listeners
document.addEventListener('DOMContentLoaded', function() {
    const settingsBtn = document.getElementById('settingsBtn');
    const audioEnabledCheckbox = document.getElementById('audioEnabled');
    const volumeControl = document.getElementById('volumeControl');
    const volumeValue = document.getElementById('volumeValue');
    
    if (settingsBtn) {
        settingsBtn.addEventListener('click', openSettingsModal);
    }
    
    if (audioEnabledCheckbox) {
        audioEnabledCheckbox.addEventListener('change', function() {
            audioEnabled = this.checked;
            saveSettings();
        });
    }
    
    if (volumeControl) {
        volumeControl.addEventListener('input', function() {
            audioVolume = this.value / 100;
            if (volumeValue) volumeValue.textContent = Math.round(this.value) + '%';
            saveSettings();
        });
    }
    
    loadSettings();
});

// Track previous request count to detect new requests
let previousRequestCount = 0;

// Modified loadRideRequests to check for new requests
const originalLoadRideRequests = loadRideRequests;

// ============================================
// NEW WORKFLOW FUNCTIONS
// ============================================

let currentQuoteRequestId = null;

// 1. PRE-QUOTE TO DRIVER
async function preQuoteDriver(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    const driverPhone = '7142046318'; // Driver phone number
    let message;
    
    // Check if this is an hourly service request
    if (request.service_type === 'hourly') {
        // HOURLY SERVICE - Different format
        const estimatedTotal = request.estimated_total || (request.hours_needed * 45); // Default $45/hr if not calculated
        
        message = `🚗 HOURLY SERVICE REQUEST

Rider: ${request.name}
Phone: ${request.phone_number}

📍 Starting Location: ${request.pickup_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Start Time: ${formatTime(request.requested_time)}

⏱️ Hours Needed: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}
💰 Estimated Total: $${estimatedTotal.toFixed(2)}
💵 Rate: ~$${(estimatedTotal / request.hours_needed).toFixed(2)}/hour

${request.notes ? `📝 Notes: ${request.notes}` : ''}

Reply with:
✓ YES $__ ETA __ min (confirm price & pickup time)
✗ NO (not available)`;
        
    } else {
        // STANDARD TRIP - Calculate route if not already done
        if (!request.distance_miles) {
            showNotification('Calculating route...', 'info');
            try {
                const response = await fetch('/api/calculate-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pickup_location: request.pickup_location,
                        dropoff_location: request.dropoff_location
                    })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    request.distance_miles = result.route.distance.miles;
                    request.duration_minutes = result.route.duration.minutes;
                    request.suggested_price = result.pricing.suggestedPrice;
                    request.trip_type = result.pricing.tripType;
                    request.calculation = result.pricing.calculation;
                    
                    showNotification(`Route calculated: ${request.distance_miles.toFixed(1)} miles, $${request.suggested_price}`, 'success');
                } else {
                    showNotification(result.message || 'Failed to calculate route', 'warning');
                }
            } catch (error) {
                console.error('Error calculating route:', error);
                showNotification('Error calculating route', 'warning');
            }
        }
        
        // Format standard trip message
        message = `🚕 PRE-QUOTE REQUEST

Rider: ${request.name}
Phone: ${request.phone_number}

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}

📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

${request.distance_miles ? `📏 Distance: ${request.distance_miles.toFixed(1)} miles` : ''}
${request.duration_minutes ? `⏱️ Duration: ${Math.round(request.duration_minutes)} minutes` : ''}
${request.suggested_price ? `💰 Suggested Price: $${request.suggested_price}` : ''}
${request.calculation ? `📊 Calculation: ${request.calculation}` : ''}

Reply with:
✓ YES $${request.suggested_price || '__'} ETA __ min (accept suggested price)
✓ YES $__ ETA __ min (suggest different price)
✗ NO (not available)`;
    }

    // Open SMS app
    const smsLink = `sms:${driverPhone}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    showNotification('Pre-quote SMS opened for driver', 'success');
}

// 2. SHOW QUOTE POPUP
async function showQuotePopup(requestId) {
    console.log('=== SHOW QUOTE POPUP CALLED ===');
    console.log('Request ID:', requestId);
    
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        console.error('Request not found!');
        showNotification('Request not found', 'error');
        return;
    }
    
    console.log('Request found:', request);
    console.log('Service Type:', request.service_type);
    
    currentQuoteRequestId = requestId;
    
    const routeInfo = document.getElementById('routeInfo');
    
    // Handle HOURLY SERVICE differently
    if (request.service_type === 'hourly') {
        // HOURLY SERVICE - Show hourly pricing info
        const estimatedTotal = request.estimated_total || (request.hours_needed * 45);
        const hourlyRate = estimatedTotal / request.hours_needed;
        
        document.getElementById('routeDistance').textContent = `${request.hours_needed} Hour${request.hours_needed > 1 ? 's' : ''}`;
        document.getElementById('routeDuration').textContent = `Starting at ${formatTime(request.requested_time)}`;
        document.getElementById('routeTripType').textContent = 'HOURLY SERVICE';
        document.getElementById('routeCalculation').textContent = `$${hourlyRate.toFixed(2)}/hour × ${request.hours_needed} hours`;
        routeInfo.classList.remove('hidden');
        
        // Pre-fill with hourly pricing
        document.getElementById('quotePrice').value = estimatedTotal.toFixed(2);
        document.getElementById('quoteETA').value = 15;
        document.getElementById('quoteDuration').value = request.hours_needed * 60; // Convert hours to minutes
        
    } else {
        // STANDARD TRIP - Calculate route if not already done
        if (!request.distance_miles) {
            console.log('🚀 No distance found, calling API...');
            showNotification('Calculating route...', 'info');
            try {
                const response = await fetch('/api/calculate-route', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        pickup_location: request.pickup_location,
                        dropoff_location: request.dropoff_location
                    })
                });
                
                const result = await response.json();
                console.log('Route calculation result:', result);
                
                if (result.success) {
                    // Extract data from nested structure
                    request.distance_miles = result.route.distance.miles;
                    request.duration_minutes = result.route.duration.minutes;
                    request.suggested_price = result.pricing.suggestedPrice;
                    request.trip_type = result.pricing.tripType;
                    request.calculation = result.pricing.calculation;
                    
                    console.log('✅ Parsed data:', {
                        distance: request.distance_miles,
                        duration: request.duration_minutes,
                        price: request.suggested_price,
                        type: request.trip_type
                    });
                    
                    showNotification(`Route calculated: ${request.distance_miles.toFixed(1)} miles, $${request.suggested_price}`, 'success');
                } else {
                    showNotification(result.message || 'Failed to calculate route', 'error');
                }
            } catch (error) {
                console.error('Error calculating route:', error);
                showNotification('Error calculating route', 'error');
            }
        }
        
        // Display route information if available
        if (request.distance_miles) {
            document.getElementById('routeDistance').textContent = `${request.distance_miles.toFixed(1)} miles`;
            document.getElementById('routeDuration').textContent = `${Math.round(request.duration_minutes)} minutes`;
            document.getElementById('routeTripType').textContent = request.trip_type ? request.trip_type.toUpperCase() : 'N/A';
            document.getElementById('routeCalculation').textContent = request.calculation || 'N/A';
            routeInfo.classList.remove('hidden');
        } else {
            routeInfo.classList.add('hidden');
        }
        
        // Pre-fill the popup
        document.getElementById('quotePrice').value = request.suggested_price || request.quote_price || '';
        document.getElementById('quoteETA').value = request.pickup_eta_minutes || 15;
        document.getElementById('quoteDuration').value = request.duration_minutes ? Math.round(request.duration_minutes) : '';
    }
    
    // Show popup
    document.getElementById('quotePopup').classList.remove('hidden');
    
    // Update preview on input
    const updatePreview = () => {
        const price = document.getElementById('quotePrice').value;
        const eta = document.getElementById('quoteETA').value;
        const duration = document.getElementById('quoteDuration').value;
        
        if (price && eta) {
            let previewText;
            
            if (request.service_type === 'hourly') {
                // HOURLY SERVICE PREVIEW
                previewText = `Hi ${request.name}!

Your Hourly Service Quote:

📍 Starting Location: ${request.pickup_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Start Time: ${formatTime(request.requested_time)}

⏱️ Service Duration: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}
💰 Total Price: $${parseFloat(price).toFixed(2)}
💵 Rate: $${(parseFloat(price) / request.hours_needed).toFixed(2)}/hour
🚗 Estimated Pickup: ${eta} minutes

${request.notes ? `📝 Special Requests: ${request.notes}\n\n` : ''}Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
            } else {
                // STANDARD TRIP PREVIEW
                previewText = `Hi ${request.name}!

Your Ride Quote:

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${parseFloat(price).toFixed(2)}
🚗 Estimated Pickup: ${eta} minutes
${duration ? `⏱️ Ride Duration: ${duration} minutes\n` : ''}
Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
            }
            
            document.getElementById('quotePreviewText').textContent = previewText;
        }
    };
    
    document.getElementById('quotePrice').addEventListener('input', updatePreview);
    document.getElementById('quoteETA').addEventListener('input', updatePreview);
    document.getElementById('quoteDuration').addEventListener('input', updatePreview);
    
    updatePreview();
}

// 3. CLOSE QUOTE POPUP
function closeQuotePopup() {
    document.getElementById('quotePopup').classList.add('hidden');
    currentQuoteRequestId = null;
}

// 4. SUBMIT QUOTE TO RIDER (SMS)
async function submitQuoteToRider() {
    if (!currentQuoteRequestId) return;
    
    const request = allRequests.find(r => r.id === currentQuoteRequestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    const price = parseFloat(document.getElementById('quotePrice').value);
    const eta = parseInt(document.getElementById('quoteETA').value);
    const duration = parseInt(document.getElementById('quoteDuration').value);
    
    if (!price || !eta || !duration) {
        showNotification('Please fill all fields', 'error');
        return;
    }
    
    // Update request in database
    try {
        console.log('📤 Sending quote update:', { price, eta, duration });
        
        const response = await fetch(`/api/ride-requests/${currentQuoteRequestId}/status`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'quoted',
                quotePrice: price,  // Changed to camelCase
                pickupEta: eta,     // Changed to camelCase
                rideDuration: duration  // Changed to camelCase
            })
        });
        
        const result = await response.json();
        console.log('📥 Server response:', result);
        
        if (!result.success) {
            showNotification(`Failed to update quote: ${result.message || 'Unknown error'}`, 'error');
            return;
        }
        
        console.log('✅ Quote updated successfully in database');
    } catch (error) {
        console.error('❌ Error updating quote:', error);
        showNotification(`Error updating quote: ${error.message}`, 'error');
        return;
    }
    
    // Format SMS message
    const message = `Hi ${request.name}!

Your Ride Quote:

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${price.toFixed(2)}
🚗 Estimated Pickup: ${eta} minutes
⏱️ Ride Duration: ${duration} minutes

Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
    
    // Open SMS app
    const smsLink = `sms:${request.phone_number}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    closeQuotePopup();
    showNotification('Quote sent! SMS app opened', 'success');
    
    // Reload requests to show updated status
    setTimeout(loadRideRequests, 500);
}

// 5. COPY QUOTE
function copyQuote(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    let quoteText;
    
    // Add rider info header
    const riderInfo = `RIDER INFO:
👤 Name: ${request.name}
📞 Phone: ${request.phone_number}

---

`;
    
    if (request.service_type === 'hourly') {
        // HOURLY SERVICE QUOTE
        quoteText = riderInfo + `Hi ${request.name}!

Your Hourly Service Quote:

📍 Starting Location: ${request.pickup_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Start Time: ${formatTime(request.requested_time)}

⏱️ Service Duration: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}
💰 Total Price: $${parseFloat(request.quote_price).toFixed(2)}
💵 Rate: $${(parseFloat(request.quote_price) / request.hours_needed).toFixed(2)}/hour
${request.pickup_eta_minutes ? `🚗 Estimated Pickup: ${request.pickup_eta_minutes} minutes\n` : ''}
${request.notes ? `📝 Special Requests: ${request.notes}\n` : ''}
Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
    } else {
        // STANDARD TRIP QUOTE
        quoteText = riderInfo + `Hi ${request.name}!

Your Ride Quote:

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${parseFloat(request.quote_price).toFixed(2)}
${request.pickup_eta_minutes ? `🚗 Estimated Pickup: ${request.pickup_eta_minutes} minutes\n` : ''}
${request.ride_duration_minutes ? `⏱️ Ride Duration: ${request.ride_duration_minutes} minutes\n` : ''}
Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
    }
    
    // Copy to clipboard
    navigator.clipboard.writeText(quoteText).then(() => {
        showNotification('Quote copied to clipboard!', 'success');
    }).catch(err => {
        console.error('Failed to copy:', err);
        showNotification('Failed to copy quote', 'error');
    });
}

// 6. SMS RIDER (with quote)
function smsRiderQuote(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    const message = `Hi ${request.name}!

Your Ride Quote:

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}
📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${parseFloat(request.quote_price).toFixed(2)}
${request.pickup_eta_minutes ? `🚗 Estimated Pickup: ${request.pickup_eta_minutes} minutes` : ''}
${request.ride_duration_minutes ? `⏱️ Ride Duration: ${request.ride_duration_minutes} minutes` : ''}

Payment: Cash, Venmo or Zelle

Do you accept the quote? Please reply YES or NO`;
    
    const smsLink = `sms:${request.phone_number}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    showNotification('SMS app opened with quote', 'success');
}

// 7. CONFIRM AND SMS DRIVER
async function confirmAndSMSDriver(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    // Update status to confirmed
    try {
        const response = await fetch(`/api/ride-requests/${requestId}/status`, {
            method: 'PATCH',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ status: 'confirmed' })
        });
        
        const result = await response.json();
        if (!result.success) {
            showNotification('Failed to confirm ride', 'error');
            return;
        }
    } catch (error) {
        console.error('Error confirming ride:', error);
        showNotification('Error confirming ride', 'error');
        return;
    }
    
    // SMS driver with confirmed details
    const driverPhone = '7142046318';
    const message = `✅ RIDE CONFIRMED

Rider: ${request.name}
Phone: ${request.phone_number}

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}

📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${parseFloat(request.quote_price).toFixed(2)}
${request.pickup_eta_minutes ? `🚗 Your ETA: ${request.pickup_eta_minutes} minutes` : ''}
${request.ride_duration_minutes ? `⏱️ Duration: ${request.ride_duration_minutes} minutes` : ''}

Customer has accepted the quote!`;
    
    const smsLink = `sms:${driverPhone}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    showNotification('Ride confirmed! SMS sent to driver', 'success');
    
    // Reload requests
    setTimeout(loadRideRequests, 500);
}

// 8. SMS DRIVER (for already confirmed rides)
function smsDriverConfirmed(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    const driverPhone = '7142046318';
    const message = `✅ RIDE REMINDER

Rider: ${request.name}
Phone: ${request.phone_number}

📍 Pickup: ${request.pickup_location}
📍 Dropoff: ${request.dropoff_location}

📅 Date: ${formatDate(request.requested_date)}
⏰ Time: ${formatTime(request.requested_time)}

💰 Price: $${parseFloat(request.quote_price).toFixed(2)}
${request.pickup_eta_minutes ? `🚗 Your ETA: ${request.pickup_eta_minutes} minutes` : ''}
${request.ride_duration_minutes ? `⏱️ Duration: ${request.ride_duration_minutes} minutes` : ''}`;
    
    const smsLink = `sms:${driverPhone}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    showNotification('SMS sent to driver', 'success');
}

// 9. NOT AVAILABLE SMS
async function notAvailableSMS(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    // Format apology message
    const message = `Hi ${request.name},

Thank you for your ride request. Unfortunately, Sebastian is currently unavailable to fulfill your request for ${formatDate(request.requested_date)} at ${formatTime(request.requested_time)}.

We apologize for any inconvenience. Sebastian hopes to be available for your future ride requests.

For immediate needs, please feel free to contact us at (714) 204-6318.

Thank you for your understanding!`;
    
    // Open SMS app
    const smsLink = `sms:${request.phone_number}?&body=${encodeURIComponent(message)}`;
    window.open(smsLink, '_blank');
    
    showNotification('Apology SMS opened', 'success');
    
    // Update status to not_available after a short delay
    setTimeout(async () => {
        try {
            await fetch(`/api/ride-requests/${requestId}/status`, {
                method: 'PATCH',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${authToken}`
                },
                body: JSON.stringify({ status: 'not_available' })
            });
            loadRideRequests();
        } catch (error) {
            console.error('Error updating status:', error);
        }
    }, 500);
}

console.log('🚕 Admin Dashboard initialized with full workflow');

// ============================================
// USER MANAGEMENT FUNCTIONS
// ============================================

// Open users modal
function openUsersModal() {
    document.getElementById('usersModal').classList.remove('hidden');
    loadAdminUsers();
}

// Close users modal
function closeUsersModal() {
    document.getElementById('usersModal').classList.add('hidden');
    hideCreateUserForm();
}

// Show create user form
function showCreateUserForm() {
    document.getElementById('createUserForm').classList.remove('hidden');
}

// Hide create user form
function hideCreateUserForm() {
    document.getElementById('createUserForm').classList.add('hidden');
    // Clear form
    document.getElementById('newUsername').value = '';
    document.getElementById('newFullName').value = '';
    document.getElementById('newEmail').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newRole').value = 'admin';
}

// Load all admin users
async function loadAdminUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayAdminUsers(result.users);
        } else {
            showNotification('Failed to load users', 'error');
        }
    } catch (error) {
        console.error('Error loading users:', error);
        showNotification('Error loading users', 'error');
    }
}

// Display admin users
function displayAdminUsers(users) {
    const usersList = document.getElementById('usersList');
    
    if (users.length === 0) {
        usersList.innerHTML = '<p style="text-align: center; color: #6B7280;">No users found</p>';
        return;
    }
    
    usersList.innerHTML = users.map(user => `
        <div class="user-card" style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <h4 style="margin: 0 0 4px 0; font-size: 16px;">${escapeHtml(user.full_name)}</h4>
                    <p style="margin: 0; color: #6B7280; font-size: 14px;">
                        @${escapeHtml(user.username)} 
                        ${user.email ? `• ${escapeHtml(user.email)}` : ''}
                    </p>
                    <div style="margin-top: 8px; display: flex; gap: 8px;">
                        <span style="background: ${user.role === 'super_admin' ? '#F59E0B' : '#3B82F6'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                            ${user.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                        </span>
                        <span style="background: ${user.is_active ? '#10B981' : '#EF4444'}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;">
                            ${user.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    ${user.last_login ? `<p style="margin: 8px 0 0 0; color: #9CA3AF; font-size: 12px;">Last login: ${formatDateTime(user.last_login)}</p>` : ''}
                </div>
                <div style="display: flex; gap: 8px;">
                    ${user.id !== currentUser.id ? `
                        <button onclick="toggleUserStatus(${user.id}, ${user.is_active})" 
                                style="padding: 6px 12px; background: ${user.is_active ? '#EF4444' : '#10B981'}; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            ${user.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    ` : '<span style="color: #9CA3AF; font-size: 12px;">(You)</span>'}
                </div>
            </div>
        </div>
    `).join('');
}

// Create new user
async function createUser() {
    const username = document.getElementById('newUsername').value.trim();
    const full_name = document.getElementById('newFullName').value.trim();
    const email = document.getElementById('newEmail').value.trim();
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;
    
    if (!username || !full_name || !password) {
        showNotification('Please fill in all required fields', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Password must be at least 6 characters', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ username, full_name, email, password, role })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('User created successfully!', 'success');
            hideCreateUserForm();
            loadAdminUsers();
        } else {
            showNotification(result.message || 'Failed to create user', 'error');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showNotification('Error creating user', 'error');
    }
}

// Toggle user active status
async function toggleUserStatus(userId, currentStatus) {
    const newStatus = currentStatus ? 0 : 1;
    const action = newStatus ? 'activate' : 'deactivate';
    
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({ is_active: newStatus })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`User ${action}d successfully`, 'success');
            loadAdminUsers();
        } else {
            showNotification(result.message || `Failed to ${action} user`, 'error');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showNotification('Error updating user', 'error');
    }
}

// Add event listener for users button
document.addEventListener('DOMContentLoaded', function() {
    const usersBtn = document.getElementById('usersBtn');
    if (usersBtn) {
        usersBtn.addEventListener('click', openUsersModal);
    }
    
    // Initialize expiration countdown
    initializeExpirationCountdown();
    
    // Add button handlers
    const backupNowBtn = document.getElementById('backupNowBtn');
    const viewInstructionsBtn = document.getElementById('viewInstructionsBtn');
    
    if (backupNowBtn) {
        backupNowBtn.addEventListener('click', () => {
            document.getElementById('backupBtn').click();
        });
    }
    
    if (viewInstructionsBtn) {
        viewInstructionsBtn.addEventListener('click', openMigrationModal);
    }
});

// ======================
// DATABASE EXPIRATION COUNTDOWN
// ======================

// Set your database creation date here (October 15, 2025)
const DATABASE_CREATED = new Date('2025-10-15');
const FREE_TIER_DAYS = 30;

function initializeExpirationCountdown() {
    updateCountdown();
    // Update every hour
    setInterval(updateCountdown, 1000 * 60 * 60);
}

function updateCountdown() {
    const now = new Date();
    const expirationDate = new Date(DATABASE_CREATED);
    expirationDate.setDate(expirationDate.getDate() + FREE_TIER_DAYS);
    
    const daysRemaining = Math.ceil((expirationDate - now) / (1000 * 60 * 60 * 24));
    
    const banner = document.getElementById('expirationBanner');
    const daysElement = document.getElementById('daysRemaining');
    const dateElement = document.getElementById('expirationDate');
    const progressFill = document.getElementById('progressFill');
    const progressLabel = document.getElementById('progressLabel');
    
    if (!banner || !daysElement || !dateElement || !progressFill || !progressLabel) {
        return;
    }
    
    // Update days remaining
    daysElement.textContent = daysRemaining;
    
    // Update expiration date
    dateElement.textContent = `(Expires: ${expirationDate.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric' 
    })})`;
    
    // Calculate progress (inverse - starts full, decreases over time)
    const progressPercent = (daysRemaining / FREE_TIER_DAYS) * 100;
    progressFill.style.width = `${progressPercent}%`;
    
    // Update banner status based on days remaining
    banner.classList.remove('warning', 'urgent');
    
    if (daysRemaining <= 2) {
        banner.classList.add('urgent');
        progressLabel.textContent = '🔴 URGENT - Backup NOW!';
    } else if (daysRemaining <= 5) {
        banner.classList.add('warning');
        progressLabel.textContent = '⚠️ Warning - Prepare Backup Soon';
    } else {
        progressLabel.textContent = '✅ All Good';
    }
    
    // Hide banner if expired
    if (daysRemaining < 0) {
        banner.style.display = 'none';
    }
}

// Migration Modal Functions
function openMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) {
        modal.classList.remove('hidden');
    }
}

function closeMigrationModal() {
    const modal = document.getElementById('migrationModal');
    if (modal) {
        modal.classList.add('hidden');
    }
}

