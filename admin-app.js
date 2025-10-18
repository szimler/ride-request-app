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
const sortFilter = document.getElementById('sortFilter');

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
    
    // Request notification permission for alerts
    requestNotificationPermission();
    
    // Initialize timeline
    initializeTimeline();
    
    // Fallback polling every 60 seconds (WebSocket handles most updates)
    setInterval(() => {
        loadRideRequests();
        updateTimeline();
    }, 60000);
}

// Request notification permission
function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
        // Immediate request (better for iPhone)
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showNotification('✓ Notifications enabled! You will be alerted of new ride requests.', 'success');
                // Test notification
                setTimeout(() => {
                    new Notification('🎉 Notifications Working!', {
                        body: 'You will now be alerted for new rides, even when app is minimized.',
                        icon: '/favicon.ico',
                        badge: '/favicon.ico'
                    });
                }, 1000);
            } else {
                showNotification('⚠️ Enable notifications in browser settings for alerts!', 'error');
            }
        });
    }
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
        
        // Start repeating notification for this new ride
        startRepeatingNotification(request.id);
        
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
                // Find the new ride(s)
                const newRides = result.requests.filter(r => !allRequests.find(old => old.id === r.id));
                newRides.forEach(ride => {
                    if (ride.status === 'pending') {
                        startRepeatingNotification(ride.id);
                    }
                });
            }
            
            previousRequestCount = newRequestCount;
            allRequests = result.requests;
            filteredRequests = allRequests;
            updateStats();
            applyFilters(); // Apply current filter instead of just displaying all
            updateTimeline(); // Update timeline view
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
    
    requestsList.innerHTML = filteredRequests.map(request => {
        // Check for conflicts
        const conflicts = getConflictsForRide(request);
        const hasConflict = conflicts.confirmed.length > 0 || conflicts.quoted.length > 0;
        const conflictType = conflicts.confirmed.length > 0 ? 'urgent' : 'warning';
        
        const isUnacknowledged = unacknowledgedRides.has(request.id);
        
        return `
        <div class="request-card ${hasConflict ? 'has-conflict' : ''} ${isUnacknowledged ? 'unacknowledged-ride' : ''}" data-id="${request.id}">
            <input type="checkbox" class="select-ride-checkbox" data-id="${request.id}" onchange="updateBatchDeleteUI()" title="Select for batch delete">
            <button class="delete-ride-btn" onclick="deleteRideRequest(${request.id})" title="Delete this ride request">
                ✕
            </button>
            ${isUnacknowledged ? `
                <div class="unack-badge" title="New ride - tap card to stop notification">
                    🔔 NEW
                </div>
            ` : ''}
            ${hasConflict ? `
                <div class="conflict-indicator ${conflictType}" title="${conflictType === 'urgent' ? 'CONFLICT with confirmed ride!' : 'Potential conflict with quoted ride'}">
                    ${conflictType === 'urgent' ? '🚨' : '⚠️'}
                </div>
            ` : ''}
            
            <!-- Prominent Date/Time Display -->
            <div class="ride-datetime-badge ${request.status}">
                <div class="datetime-date">
                    <span class="date-icon">📅</span>
                    <span class="date-text">${formatDate(request.requested_date)}</span>
                </div>
                <div class="datetime-time">
                    <span class="time-icon">🕐</span>
                    <span class="time-text">${formatTime(request.requested_time)}</span>
                </div>
                ${request.service_type === 'hourly' ? `
                    <div class="datetime-duration">
                        ⏱️ ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}
                    </div>
                ` : ''}
            </div>
            
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
                        <button 
                            class="add-customer-btn" 
                            onclick="quickAddToCustomers(${request.id})" 
                            title="Add to Customer Database"
                        >
                            ➕ Save Customer
                        </button>
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
                        ${request.distance_miles && !isNaN(parseFloat(request.distance_miles)) ? `<div class="quote-info">📏 Distance to Dropoff: ${parseFloat(request.distance_miles).toFixed(1)} miles</div>` : ''}
                        ${request.duration_minutes && !isNaN(parseFloat(request.duration_minutes)) ? `<div class="quote-info">⏱️ Estimated Drive Time: ${Math.round(parseFloat(request.duration_minutes))} minutes</div>` : ''}
                        ${request.pickup_eta_minutes ? `<div class="quote-info">🚗 Your Pickup ETA: ${request.pickup_eta_minutes} minutes</div>` : ''}
                        ${request.ride_duration_minutes ? `<div class="quote-info">🕐 Total Ride Duration: ${request.ride_duration_minutes} minutes</div>` : ''}
                    `}
                </div>
            ` : ''}
            
            <div class="request-actions">
                ${request.status === 'pending' ? `
                    ${request.service_type === 'hourly' ? `
                        <button class="action-btn btn-info" onclick="checkDriverAvailability(${request.id})" title="Contact driver to check availability">
                            📞 Check Availability
                        </button>
                        <button class="action-btn btn-confirm" onclick="confirmHourlyBooking(${request.id})">
                            ✓ Confirm Booking
                        </button>
                        <button class="action-btn btn-cancel" onclick="declineHourlyBooking(${request.id})">
                            ✗ Decline
                        </button>
                    ` : `
                    <button class="action-btn btn-info" onclick="preQuoteDriver(${request.id})" title="SMS driver for YES/NO confirmation">
                        📱 Pre-Quote (Driver)
                    </button>
                    <button class="action-btn btn-confirm" onclick="showQuotePopup(${request.id})">
                        💵 Send Quote to Rider
                    </button>
                    <button class="action-btn btn-cancel" onclick="notAvailableSMS(${request.id})">
                        ✗ Not Available (SMS)
                    </button>
                    `}
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
                ${request.status === 'deleted' ? `
                    <button class="action-btn btn-confirm" onclick="updateStatus(${request.id}, 'pending')" style="background: #10B981;">
                        ♻️ Restore to Pending
                    </button>
                    <button class="action-btn btn-cancel" onclick="permanentlyDeleteRide(${request.id})" style="background: #7C3AED;">
                        🗑️ Permanently Delete (Empty Trash)
                    </button>
                ` : ''}
                ${request.status === 'cancelled' || request.status === 'not_available' || request.status === 'declined' ? `
                    <button class="action-btn btn-confirm" onclick="updateStatus(${request.id}, 'pending')" style="background: #6B7280;">
                        Reset to Pending
                    </button>
                ` : ''}
            </div>
        </div>
    `;
    }).join('');
    
    // Initialize batch delete UI
    updateBatchDeleteUI();
    
    // Add click listeners to acknowledge unacknowledged rides
    setTimeout(() => {
        document.querySelectorAll('.request-card.unacknowledged-ride').forEach(card => {
            const rideId = parseInt(card.dataset.id);
            card.addEventListener('click', function(e) {
                // Don't acknowledge if clicking on buttons, checkboxes, or links
                if (!e.target.closest('button') && 
                    !e.target.closest('input[type="checkbox"]') &&
                    !e.target.closest('a')) {
                    if (unacknowledgedRides.has(rideId)) {
                        acknowledgeRide(rideId);
                        card.classList.remove('unacknowledged-ride');
                        const badge = card.querySelector('.unack-badge');
                        if (badge) badge.remove();
                        showNotification('✓ Notification stopped for this ride', 'info');
                    }
                }
            });
        });
    }, 100);
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

// Search and filter - Initialize after DOM is ready
function applyFilters() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusValue = statusFilter ? statusFilter.value : 'active';
    const sortValue = sortFilter ? sortFilter.value : 'date-desc';
    
    console.log('🔍 Applying filters:', { 
        searchTerm, 
        statusValue, 
        sortValue, 
        totalRequests: allRequests.length 
    });
    
    // Filter
    filteredRequests = allRequests.filter(request => {
        const matchesSearch = !searchTerm || 
            request.name.toLowerCase().includes(searchTerm) ||
            request.phone_number.includes(searchTerm) ||
            request.pickup_location.toLowerCase().includes(searchTerm) ||
            request.dropoff_location.toLowerCase().includes(searchTerm);
        
        // Handle special "active" filter (pending, quoted, confirmed)
        let matchesStatus;
        if (statusValue === 'active') {
            matchesStatus = ['pending', 'quoted', 'confirmed'].includes(request.status);
        } else if (statusValue === 'all') {
            matchesStatus = true;
        } else {
            matchesStatus = request.status === statusValue;
        }
        
        console.log(`Request ${request.id}: ${request.name}, status: ${request.status}, matches: ${matchesSearch && matchesStatus}`);
        
        return matchesSearch && matchesStatus;
    });
    
    console.log('✅ Filtered results:', filteredRequests.length, 'out of', allRequests.length);
    
    // Sort
    switch (sortValue) {
        case 'date-desc':
            // Newest first (default)
            filteredRequests.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            console.log('📅 Sorted by: Newest First');
            break;
        case 'date-asc':
            // Oldest first
            filteredRequests.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            console.log('📅 Sorted by: Oldest First');
            break;
        case 'name-asc':
            // Name A-Z
            filteredRequests.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
            console.log('👤 Sorted by: Name A-Z');
            break;
        case 'name-desc':
            // Name Z-A
            filteredRequests.sort((a, b) => b.name.toLowerCase().localeCompare(a.name.toLowerCase()));
            console.log('👤 Sorted by: Name Z-A');
            break;
    }
    
    displayRequests();
}

// Attach filter event listeners after DOM loads
if (searchInput) searchInput.addEventListener('input', applyFilters);
if (statusFilter) statusFilter.addEventListener('change', applyFilters);
if (sortFilter) sortFilter.addEventListener('change', applyFilters);

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
let visualFlashEnabled = true;
let browserNotificationsEnabled = true;
let vibrationEnabled = true;
let soundPattern = 'triple';
let flashPattern = 'red-pulse';
let vibrationPattern = 'standard';
let smsMethod = 'native';
let skipSmsConfirmation = true;
let showSmsPreview = false;

// Load settings from localStorage
function loadSettings() {
    const savedAudioEnabled = localStorage.getItem('audioEnabled');
    const savedVolume = localStorage.getItem('audioVolume');
    const savedVisualFlash = localStorage.getItem('visualFlashEnabled');
    const savedBrowserNotifications = localStorage.getItem('browserNotificationsEnabled');
    const savedVibration = localStorage.getItem('vibrationEnabled');
    const savedSoundPattern = localStorage.getItem('soundPattern');
    const savedFlashPattern = localStorage.getItem('flashPattern');
    const savedVibrationPattern = localStorage.getItem('vibrationPattern');
    
    if (savedAudioEnabled !== null) {
        audioEnabled = savedAudioEnabled === 'true';
    }
    
    if (savedVolume !== null) {
        audioVolume = parseFloat(savedVolume);
    }
    
    if (savedVisualFlash !== null) {
        visualFlashEnabled = savedVisualFlash === 'true';
    }
    
    if (savedBrowserNotifications !== null) {
        browserNotificationsEnabled = savedBrowserNotifications === 'true';
    }
    
    if (savedVibration !== null) {
        vibrationEnabled = savedVibration === 'true';
    }
    
    if (savedSoundPattern) {
        soundPattern = savedSoundPattern;
    }
    
    if (savedFlashPattern) {
        flashPattern = savedFlashPattern;
    }
    
    if (savedVibrationPattern) {
        vibrationPattern = savedVibrationPattern;
    }
    
    // Load SMS settings
    const savedSmsMethod = localStorage.getItem('smsMethod');
    const savedSkipSmsConfirmation = localStorage.getItem('skipSmsConfirmation');
    const savedShowSmsPreview = localStorage.getItem('showSmsPreview');
    
    if (savedSmsMethod) {
        smsMethod = savedSmsMethod;
    }
    
    if (savedSkipSmsConfirmation !== null) {
        skipSmsConfirmation = savedSkipSmsConfirmation === 'true';
    }
    
    if (savedShowSmsPreview !== null) {
        showSmsPreview = savedShowSmsPreview === 'true';
    }
    
    // Update UI if elements exist
    const audioEnabledCheckbox = document.getElementById('audioEnabled');
    const volumeControl = document.getElementById('volumeControl');
    const volumeValue = document.getElementById('volumeValue');
    const visualFlashCheckbox = document.getElementById('visualFlashEnabled');
    const browserNotificationsCheckbox = document.getElementById('browserNotificationsEnabled');
    const vibrationCheckbox = document.getElementById('vibrationEnabled');
    const soundPatternSelect = document.getElementById('soundPattern');
    const flashPatternSelect = document.getElementById('flashPattern');
    const vibrationPatternSelect = document.getElementById('vibrationPattern');
    
    if (audioEnabledCheckbox) audioEnabledCheckbox.checked = audioEnabled;
    if (volumeControl) {
        volumeControl.value = audioVolume * 100;
        if (volumeValue) volumeValue.textContent = Math.round(audioVolume * 100) + '%';
    }
    if (visualFlashCheckbox) visualFlashCheckbox.checked = visualFlashEnabled;
    if (browserNotificationsCheckbox) browserNotificationsCheckbox.checked = browserNotificationsEnabled;
    if (vibrationCheckbox) vibrationCheckbox.checked = vibrationEnabled;
    if (soundPatternSelect) soundPatternSelect.value = soundPattern;
    if (flashPatternSelect) flashPatternSelect.value = flashPattern;
    if (vibrationPatternSelect) vibrationPatternSelect.value = vibrationPattern;
    
    // SMS settings
    const smsMethodSelect = document.getElementById('smsMethod');
    const skipSmsConfirmationCheckbox = document.getElementById('skipSmsConfirmation');
    const showSmsPreviewCheckbox = document.getElementById('showSmsPreview');
    
    if (smsMethodSelect) smsMethodSelect.value = smsMethod;
    if (skipSmsConfirmationCheckbox) skipSmsConfirmationCheckbox.checked = skipSmsConfirmation;
    if (showSmsPreviewCheckbox) showSmsPreviewCheckbox.checked = showSmsPreview;
}

// Save settings to localStorage
function saveSettings() {
    localStorage.setItem('audioEnabled', audioEnabled);
    localStorage.setItem('audioVolume', audioVolume);
    localStorage.setItem('visualFlashEnabled', visualFlashEnabled);
    localStorage.setItem('browserNotificationsEnabled', browserNotificationsEnabled);
    localStorage.setItem('vibrationEnabled', vibrationEnabled);
    localStorage.setItem('soundPattern', soundPattern);
    localStorage.setItem('flashPattern', flashPattern);
    localStorage.setItem('vibrationPattern', vibrationPattern);
    localStorage.setItem('smsMethod', smsMethod);
    localStorage.setItem('skipSmsConfirmation', skipSmsConfirmation);
    localStorage.setItem('showSmsPreview', showSmsPreview);
}

// Play notification sound - MUCH LOUDER with multiple beeps
function playNotificationSound() {
    if (audioEnabled) {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // Play sound based on selected pattern
        playSoundPattern(soundPattern);
    }
    
    // Request browser/phone notification (if enabled)
    if (browserNotificationsEnabled) {
        showBrowserNotification();
    }
    
    // Visual flash alert (if enabled)
    if (visualFlashEnabled) {
        flashScreenAlert();
    }
}

// Play different sound patterns
function playSoundPattern(pattern) {
    switch(pattern) {
        case 'triple':
            // Triple beep (default)
            playBeep(0, 900);
            playBeep(0.2, 700);
            playBeep(0.4, 900);
            break;
        case 'urgent':
            // Fast urgent beeps
            playBeep(0, 1000);
            playBeep(0.1, 1000);
            playBeep(0.2, 1000);
            playBeep(0.3, 1000);
            playBeep(0.4, 1000);
            playBeep(0.5, 1000);
            break;
        case 'gentle':
            // Gentle chimes
            playBeep(0, 600);
            playBeep(0.15, 800);
            playBeep(0.3, 1000);
            break;
        case 'siren':
            // Siren effect
            for (let i = 0; i < 4; i++) {
                playSweep(i * 0.3, 400, 1200, 0.3);
            }
            break;
        case 'doorbell':
            // Classic doorbell
            playBeep(0, 800);
            playBeep(0.15, 600);
            break;
        default:
            // Default to triple
            playBeep(0, 900);
            playBeep(0.2, 700);
            playBeep(0.4, 900);
    }
}

function playBeep(delay, frequency) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    const startTime = audioContext.currentTime + delay;
    const duration = 0.15;
    
    // Increased volume (max of 1.0)
    gainNode.gain.setValueAtTime(Math.min(audioVolume * 2, 1.0), startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

// Play frequency sweep (for siren effect)
function playSweep(delay, startFreq, endFreq, duration) {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    
    const startTime = audioContext.currentTime + delay;
    
    // Sweep from start to end frequency
    oscillator.frequency.setValueAtTime(startFreq, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
    
    gainNode.gain.setValueAtTime(Math.min(audioVolume * 2, 1.0), startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

// Browser/Phone notification with vibration
function showBrowserNotification(rideId = null) {
    if (!browserNotificationsEnabled) return;
    
    // Try vibration (works on Android, limited on iPhone)
    if (vibrationEnabled && 'vibrate' in navigator) {
        try {
            navigator.vibrate(getVibrationPattern(vibrationPattern));
        } catch (e) {
            console.log('Vibration not supported');
        }
    }
    
    if ('Notification' in window && Notification.permission === 'granted') {
        const notificationOptions = {
            body: 'A new ride request has been received. Click to view.',
            icon: '/favicon.ico',
            badge: '/favicon.ico',
            requireInteraction: true, // Stays until clicked
            tag: rideId ? `ride-${rideId}` : 'ride-request',
            renotify: true, // Allow duplicate notifications
            silent: false // Play sound
        };
        
        // Add vibration if enabled (for Android)
        if (vibrationEnabled && 'vibrate' in navigator) {
            notificationOptions.vibrate = getVibrationPattern(vibrationPattern);
        }
        
        const notification = new Notification('🚕 New Ride Request!', notificationOptions);
        
        notification.onclick = function() {
            window.focus();
            if (rideId) {
                acknowledgeRide(rideId);
            }
            this.close();
        };
    } else if ('Notification' in window && Notification.permission !== 'denied') {
        // Request permission
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                showBrowserNotification(rideId);
            }
        });
    }
}

// Get vibration pattern based on selection
function getVibrationPattern(pattern) {
    switch(pattern) {
        case 'standard':
            return [200, 100, 200, 100, 200]; // Standard 5 pulses
        case 'sos':
            return [100, 50, 100, 50, 100, 100, 200, 50, 200, 50, 200, 100, 100, 50, 100, 50, 100]; // SOS: ... --- ...
        case 'heartbeat':
            return [100, 50, 150, 200, 100, 50, 150]; // Heartbeat rhythm
        case 'urgent':
            return [100, 50, 100, 50, 100, 50, 100, 50, 100, 50, 100]; // Rapid pulses
        case 'gentle':
            return [300, 200, 300]; // Gentle long pulses
        default:
            return [200, 100, 200, 100, 200];
    }
}

// Visual screen flash alert
function flashScreenAlert() {
    if (!visualFlashEnabled) return;
    
    const flash = document.createElement('div');
    flash.style.cssText = getFlashStyle(flashPattern);
    
    // Add flash animations if not already present
    if (!document.getElementById('flashAlertStyles')) {
        const style = document.createElement('style');
        style.id = 'flashAlertStyles';
        style.textContent = `
            @keyframes flashRedPulse {
                0%, 100% { opacity: 0; }
                50% { opacity: 1; }
            }
            @keyframes flashRedFast {
                0%, 100% { opacity: 0; }
                16%, 33%, 50%, 66%, 83% { opacity: 1; }
                8%, 25%, 41%, 58%, 75%, 91% { opacity: 0; }
            }
            @keyframes flashYellowPulse {
                0%, 100% { opacity: 0; }
                50% { opacity: 0.8; }
            }
            @keyframes flashRainbow {
                0% { background: rgba(239, 68, 68, 0.4); }
                20% { background: rgba(249, 115, 22, 0.4); }
                40% { background: rgba(234, 179, 8, 0.4); }
                60% { background: rgba(34, 197, 94, 0.4); }
                80% { background: rgba(59, 130, 246, 0.4); }
                100% { background: rgba(168, 85, 247, 0.4); }
            }
            @keyframes flashStrobe {
                0%, 100% { opacity: 0; }
                10%, 30%, 50%, 70%, 90% { opacity: 1; }
                20%, 40%, 60%, 80% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    document.body.appendChild(flash);
    
    // Remove after animation
    const duration = flashPattern === 'strobe' ? 1000 : flashPattern === 'red-fast' ? 1200 : 1500;
    setTimeout(() => {
        flash.remove();
    }, duration);
}

// Get flash style based on pattern
function getFlashStyle(pattern) {
    const baseStyle = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 999999;
        pointer-events: none;
    `;
    
    switch(pattern) {
        case 'red-pulse':
            return baseStyle + `background: rgba(239, 68, 68, 0.3); animation: flashRedPulse 0.5s ease-in-out 3;`;
        case 'red-fast':
            return baseStyle + `background: rgba(239, 68, 68, 0.4); animation: flashRedFast 0.2s ease-in-out 6;`;
        case 'yellow-pulse':
            return baseStyle + `background: rgba(234, 179, 8, 0.3); animation: flashYellowPulse 0.5s ease-in-out 3;`;
        case 'rainbow':
            return baseStyle + `animation: flashRainbow 1.5s linear;`;
        case 'strobe':
            return baseStyle + `background: rgba(255, 255, 255, 0.8); animation: flashStrobe 0.1s linear 10;`;
        default:
            return baseStyle + `background: rgba(239, 68, 68, 0.3); animation: flashRedPulse 0.5s ease-in-out 3;`;
    }
}

// Test visual flash
function testVisualFlash() {
    if (visualFlashEnabled) {
        flashScreenAlert();
    } else {
        showNotification('Visual flash alerts are disabled in settings', 'error');
    }
}

// Test browser notification
function testBrowserNotification() {
    if (browserNotificationsEnabled) {
        showBrowserNotification();
    } else {
        showNotification('Browser notifications are disabled in settings', 'error');
    }
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

// ============================================
// SCHEDULE & CALENDAR FUNCTIONS (Basic Setup)
// ============================================

function openScheduleModal() {
    document.getElementById('scheduleModal').classList.remove('hidden');
    loadSchedule();
}

function closeScheduleModal() {
    document.getElementById('scheduleModal').classList.add('hidden');
}

let currentScheduleView = 'today';

function switchScheduleView(view) {
    currentScheduleView = view;
    
    // Update tab active states
    document.querySelectorAll('.schedule-tab').forEach(tab => {
        if (tab.dataset.view === view) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    loadSchedule();
}

function loadSchedule() {
    const scheduleContent = document.getElementById('scheduleContent');
    const scheduleLoading = document.getElementById('scheduleLoading');
    const scheduleEmpty = document.getElementById('scheduleEmpty');
    const scheduleDate = document.getElementById('scheduleDate');
    
    scheduleLoading.classList.remove('hidden');
    scheduleContent.classList.add('hidden');
    scheduleEmpty.classList.add('hidden');
    
    // Calculate date range based on current view
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let startDate, endDate, dateLabel;
    
    switch(currentScheduleView) {
        case 'yesterday':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 1);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59);
            dateLabel = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            break;
        case 'today':
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59);
            dateLabel = 'Today - ' + today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            break;
        case 'tomorrow':
            startDate = new Date(today);
            startDate.setDate(today.getDate() + 1);
            endDate = new Date(startDate);
            endDate.setHours(23, 59, 59);
            dateLabel = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
            break;
        case 'week':
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setDate(today.getDate() + 7);
            dateLabel = 'This Week';
            break;
        case 'past7':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 7);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59);
            dateLabel = 'Last 7 Days';
            break;
        case 'past30':
            startDate = new Date(today);
            startDate.setDate(today.getDate() - 30);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59);
            dateLabel = 'Last 30 Days';
            break;
        default:
            startDate = new Date(today);
            endDate = new Date(today);
            endDate.setHours(23, 59, 59);
            dateLabel = 'Today';
    }
    
    if (scheduleDate) scheduleDate.textContent = dateLabel;
    
    // Filter rides based on date range
    const scheduledRides = allRequests.filter(request => {
        // Only show confirmed and completed rides in schedule
        if (!['confirmed', 'completed'].includes(request.status)) return false;
        
        const requestDate = new Date(request.requested_date);
        return requestDate >= startDate && requestDate <= endDate;
    });
    
    setTimeout(() => {
        scheduleLoading.classList.add('hidden');
        
        if (scheduledRides.length === 0) {
            scheduleEmpty.classList.remove('hidden');
        } else {
            scheduleContent.classList.remove('hidden');
            displaySchedule(scheduledRides, startDate, endDate);
        }
    }, 300);
}

function displaySchedule(rides, startDate, endDate) {
    const scheduleContent = document.getElementById('scheduleContent');
    
    // Group rides by date
    const ridesByDate = {};
    rides.forEach(ride => {
        const dateKey = ride.requested_date;
        if (!ridesByDate[dateKey]) {
            ridesByDate[dateKey] = [];
        }
        ridesByDate[dateKey].push(ride);
    });
    
    // Sort dates
    const sortedDates = Object.keys(ridesByDate).sort();
    
    // Build HTML
    let html = '';
    sortedDates.forEach(dateKey => {
        const dateObj = new Date(dateKey + 'T00:00:00');
        const dateLabel = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
        });
        
        const dayRides = ridesByDate[dateKey].sort((a, b) => {
            return a.requested_time.localeCompare(b.requested_time);
        });
        
        html += `<div class="schedule-date-section">`;
        html += `<div class="schedule-date-header">${dateLabel}</div>`;
        
        dayRides.forEach(ride => {
            const time = formatTime(ride.requested_time);
            const duration = ride.service_type === 'hourly' 
                ? `${ride.hours_needed} hour${ride.hours_needed > 1 ? 's' : ''}`
                : ride.ride_duration_minutes 
                    ? `${ride.ride_duration_minutes} min` 
                    : 'Duration unknown';
            
            html += `
                <div class="schedule-ride-card ${ride.service_type === 'hourly' ? 'hourly' : ''}">
                    <div class="schedule-ride-header">
                        <div>
                            <div class="schedule-ride-time">🕐 ${time}</div>
                            <div class="schedule-ride-duration">${duration}</div>
                        </div>
                        <div>
                            ${ride.service_type === 'hourly' ? '<span class="schedule-hourly-badge">HOURLY</span>' : ''}
                            ${ride.status === 'completed' ? '<span class="status-badge status-completed">Completed</span>' : '<span class="status-badge status-confirmed">Confirmed</span>'}
                        </div>
                    </div>
                    <div class="schedule-ride-customer">👤 ${escapeHtml(ride.name)} - ${escapeHtml(ride.phone_number)}</div>
                    <div class="schedule-ride-details">
                        <div class="schedule-ride-location">📍 <strong>Pickup:</strong> ${escapeHtml(ride.pickup_location)}</div>
                        ${ride.dropoff_location ? `<div class="schedule-ride-location">🎯 <strong>Drop-off:</strong> ${escapeHtml(ride.dropoff_location)}</div>` : ''}
                        ${ride.quote_price ? `<div style="margin-top: 8px; color: #10B981; font-weight: 600;">💰 $${parseFloat(ride.quote_price).toFixed(2)}</div>` : ''}
                    </div>
                    <div class="schedule-timeline-bar ${ride.service_type === 'hourly' ? 'hourly' : ''}"></div>
                </div>
            `;
        });
        
        html += `</div>`;
    });
    
    scheduleContent.innerHTML = html;
}

// ============================================
// CONFLICT DETECTION
// ============================================

// Calculate ride time range
function getRideTimeRange(ride) {
    const requestDate = new Date(ride.requested_date + 'T' + ride.requested_time);
    
    let durationMinutes = 0;
    
    if (ride.service_type === 'hourly') {
        // Hourly service duration
        durationMinutes = (ride.hours_needed || 1) * 60;
    } else {
        // Point-to-point service
        // Use ride_duration_minutes if available, or estimate 30 min + drive time
        durationMinutes = ride.ride_duration_minutes || ride.duration_minutes || 45;
    }
    
    // Add buffer time (15 minutes before and after for pickup/dropoff)
    const bufferMinutes = 15;
    const startTime = new Date(requestDate.getTime() - (bufferMinutes * 60000));
    const endTime = new Date(requestDate.getTime() + ((durationMinutes + bufferMinutes) * 60000));
    
    return { startTime, endTime, durationMinutes };
}

// Check if two rides overlap
function ridesOverlap(ride1, ride2) {
    const range1 = getRideTimeRange(ride1);
    const range2 = getRideTimeRange(ride2);
    
    return range1.startTime < range2.endTime && range1.endTime > range2.startTime;
}

// Get conflicts for a specific ride
function getConflictsForRide(ride) {
    const conflicts = {
        confirmed: [], // Can't accept - already confirmed
        quoted: []     // Warning - quoted but not confirmed yet
    };
    
    allRequests.forEach(otherRide => {
        if (otherRide.id === ride.id) return; // Skip self
        
        if (ridesOverlap(ride, otherRide)) {
            if (otherRide.status === 'confirmed') {
                conflicts.confirmed.push(otherRide);
            } else if (otherRide.status === 'quoted') {
                conflicts.quoted.push(otherRide);
            }
        }
    });
    
    return conflicts;
}

// Show conflict warning before quoting
function checkConflictsBeforeQuote(requestId) {
    const ride = allRequests.find(r => r.id === requestId);
    if (!ride) return true; // Allow if not found
    
    const conflicts = getConflictsForRide(ride);
    
    if (conflicts.confirmed.length > 0) {
        const conflictDetails = conflicts.confirmed.map(c => 
            `• ${formatTime(c.requested_time)} - ${c.name} (${c.service_type === 'hourly' ? c.hours_needed + 'hr' : 'point-to-point'})`
        ).join('\n');
        
        alert(`🚨 CONFLICT DETECTED!\n\nYou already have CONFIRMED ride(s) at this time:\n\n${conflictDetails}\n\n⚠️ You cannot be in two places at once!\n\nPlease decline this request or reschedule the conflicting ride.`);
        return false;
    }
    
    if (conflicts.quoted.length > 0) {
        const conflictDetails = conflicts.quoted.map(c => 
            `• ${formatTime(c.requested_time)} - ${c.name} (${c.service_type === 'hourly' ? c.hours_needed + 'hr' : 'point-to-point'})`
        ).join('\n');
        
        const proceed = confirm(`⚠️ POTENTIAL CONFLICT\n\nYou have QUOTED ride(s) at this time:\n\n${conflictDetails}\n\nIf both customers accept, you'll have a conflict.\n\nDo you want to proceed with this quote?`);
        return proceed;
    }
    
    return true; // No conflicts
}

// ============================================
// TIMELINE VISUALIZATION
// ============================================

let timelineZoom = 1;

let timelineStartHour = 0;
let timelineEndHour = 24;

function initializeTimeline() {
    // Create hour markers (24 hours - midnight to midnight)
    const timelineScale = document.getElementById('timelineScale');
    if (!timelineScale) return;
    
    let html = '';
    for (let hour = timelineStartHour; hour < timelineEndHour; hour++) {
        const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        html += `<div class="timeline-hour">${displayHour}${ampm}</div>`;
    }
    timelineScale.innerHTML = html;
    
    updateTimeline();
}

function updateTimeline() {
    const timelineTrack = document.getElementById('timelineTrack');
    if (!timelineTrack) return;
    
    // Get today's rides only (confirmed, quoted, pending)
    const today = new Date().toISOString().split('T')[0];
    const todayRides = allRequests.filter(r => 
        r.requested_date === today && 
        ['confirmed', 'quoted', 'pending'].includes(r.status)
    );
    
    if (todayRides.length === 0) {
        timelineTrack.innerHTML = '<div style="text-align: center; padding: 40px; color: #9CA3AF;">No rides scheduled for today</div>';
        return;
    }
    
    // Sort by time
    todayRides.sort((a, b) => a.requested_time.localeCompare(b.requested_time));
    
    // Build timeline blocks
    let html = '';
    todayRides.forEach((ride, index) => {
        const conflicts = getConflictsForRide(ride);
        const hasConflict = conflicts.confirmed.length > 0;
        const timeRange = getRideTimeRange(ride);
        
        // Calculate position (midnight = 0%, midnight = 100%)
        const [hours, minutes] = ride.requested_time.split(':');
        const totalMinutes = (parseInt(hours) * 60) + parseInt(minutes);
        const startMinutes = timelineStartHour * 60; // Start of day
        const endMinutes = timelineEndHour * 60; // End of day
        const position = ((totalMinutes - startMinutes) / (endMinutes - startMinutes)) * 100;
        
        // Calculate width based on duration
        const duration = timeRange.durationMinutes + 30; // Add buffer
        const width = (duration / (endMinutes - startMinutes)) * 100;
        
        // Stack overlapping rides vertically
        const top = (index % 2) * 70;
        
        html += `
            <div class="timeline-ride-block ${hasConflict ? 'conflict' : ride.status}" 
                 style="left: ${position}%; width: ${Math.max(width, 8)}%; top: ${top}px;"
                 data-ride-id="${ride.id}"
                 onclick="scrollToRideCard(${ride.id})">
                <div class="timeline-ride-time">${formatTime(ride.requested_time)}</div>
                <div class="timeline-ride-name">${escapeHtml(ride.name)}</div>
            </div>
        `;
    });
    
    timelineTrack.innerHTML = html;
    
    // Add event listeners to timeline blocks
    setTimeout(() => {
        document.querySelectorAll('.timeline-ride-block').forEach(block => {
            block.addEventListener('mouseenter', function(e) {
                const rideId = parseInt(this.dataset.rideId);
                showTimelineTooltip(e, rideId);
            });
            
            block.addEventListener('mouseleave', function() {
                hideTimelineTooltip();
            });
        });
    }, 50);
}

function showTimelineTooltip(event, rideId) {
    const ride = allRequests.find(r => r.id === rideId);
    if (!ride) return;
    
    // Dim all other timeline blocks
    document.querySelectorAll('.timeline-ride-block').forEach(block => {
        if (block !== event.currentTarget) {
            block.style.opacity = '0.3';
            block.style.filter = 'grayscale(70%)';
        } else {
            block.style.opacity = '1';
            block.style.filter = 'none';
            block.style.transform = 'translateY(-8px) scale(1.1)';
            block.style.zIndex = '200';
        }
    });
    
    const tooltip = document.createElement('div');
    tooltip.className = 'timeline-tooltip';
    tooltip.id = 'timelineTooltip';
    
    const timeRange = getRideTimeRange(ride);
    const endTime = new Date(timeRange.endTime);
    const endHour = endTime.getHours();
    const endMin = endTime.getMinutes();
    const formattedEndTime = formatTime(`${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}`);
    
    // Check for conflicts
    const conflicts = getConflictsForRide(ride);
    const hasConflict = conflicts.confirmed.length > 0 || conflicts.quoted.length > 0;
    
    tooltip.innerHTML = `
        ${hasConflict ? '<div style="color: #EF4444; font-weight: 700; margin-bottom: 8px;">⚠️ CONFLICT DETECTED!</div>' : ''}
        <strong style="font-size: 16px;">${escapeHtml(ride.name)}</strong><br>
        <span style="color: #9CA3AF;">📞 ${escapeHtml(ride.phone_number)}</span><br><br>
        <div style="background: rgba(59, 130, 246, 0.1); padding: 8px; border-radius: 6px; margin: 8px 0;">
            <strong style="color: #3B82F6;">⏰ ${formatTime(ride.requested_time)} - ${formattedEndTime}</strong><br>
            ${ride.service_type === 'hourly' ? `⏱️ ${ride.hours_needed} hour service` : `⏱️ ~${Math.round(timeRange.durationMinutes)} min ride`}
        </div>
        📍 <strong>From:</strong> ${escapeHtml(ride.pickup_location)}<br>
        ${ride.dropoff_location ? `🎯 <strong>To:</strong> ${escapeHtml(ride.dropoff_location)}<br>` : ''}
        ${ride.quote_price ? `<br>💰 <strong>Quote:</strong> <span style="color: #10B981; font-size: 16px; font-weight: 700;">$${parseFloat(ride.quote_price).toFixed(2)}</span>` : ''}
        ${hasConflict ? `<br><br><span style="color: #F59E0B; font-size: 12px;">⚠️ Overlaps with ${conflicts.confirmed.length > 0 ? 'confirmed' : 'quoted'} ride(s)</span>` : ''}
    `;
    
    document.body.appendChild(tooltip);
    
    // Position tooltip
    const rect = event.currentTarget.getBoundingClientRect();
    const tooltipLeft = Math.min(rect.left, window.innerWidth - 270); // Keep on screen
    tooltip.style.left = tooltipLeft + 'px';
    tooltip.style.top = (rect.bottom + 10) + 'px';
}

function hideTimelineTooltip() {
    // Remove tooltip
    const tooltip = document.getElementById('timelineTooltip');
    if (tooltip) {
        tooltip.remove();
    }
    
    // Restore all timeline blocks to normal state
    const blocks = document.querySelectorAll('.timeline-ride-block');
    blocks.forEach(block => {
        block.style.opacity = '1';
        block.style.filter = 'none';
        block.style.transform = '';
        block.style.zIndex = '';
    });
}

function scrollToRideCard(rideId) {
    hideTimelineTooltip();
    const card = document.querySelector(`.request-card[data-id="${rideId}"]`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.style.animation = 'highlight-flash 1s ease-out';
        setTimeout(() => {
            card.style.animation = '';
        }, 1000);
    }
}

function zoomTimeline(direction) {
    const now = new Date();
    const currentHour = now.getHours();
    
    if (direction === 'in') {
        // Zoom to business hours (6 AM - 10 PM)
        timelineStartHour = 6;
        timelineEndHour = 22;
        showNotification('Zoomed to business hours (6 AM - 10 PM)', 'success');
    } else {
        // Zoom to daytime (8 AM - 6 PM)
        timelineStartHour = 8;
        timelineEndHour = 18;
        showNotification('Zoomed to daytime (8 AM - 6 PM)', 'success');
    }
    
    initializeTimeline();
}

function resetTimeline() {
    timelineStartHour = 0;
    timelineEndHour = 24;
    initializeTimeline();
    showNotification('Timeline reset to 24 hours', 'success');
}

// Add highlight animation
if (!document.getElementById('highlightFlashStyle')) {
    const style = document.createElement('style');
    style.id = 'highlightFlashStyle';
    style.textContent = `
        @keyframes highlight-flash {
            0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
            50% { box-shadow: 0 0 0 15px rgba(59, 130, 246, 0); }
            100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
    `;
    document.head.appendChild(style);
}

// Schedule button event listener
document.addEventListener('DOMContentLoaded', function() {
    const scheduleBtn = document.getElementById('scheduleBtn');
    if (scheduleBtn) {
        scheduleBtn.addEventListener('click', openScheduleModal);
    }
});

// Settings event listeners
document.addEventListener('DOMContentLoaded', function() {
    const settingsBtn = document.getElementById('settingsBtn');
    const audioEnabledCheckbox = document.getElementById('audioEnabled');
    const volumeControl = document.getElementById('volumeControl');
    const volumeValue = document.getElementById('volumeValue');
    const visualFlashCheckbox = document.getElementById('visualFlashEnabled');
    const browserNotificationsCheckbox = document.getElementById('browserNotificationsEnabled');
    const vibrationCheckbox = document.getElementById('vibrationEnabled');
    const soundPatternSelect = document.getElementById('soundPattern');
    const flashPatternSelect = document.getElementById('flashPattern');
    const vibrationPatternSelect = document.getElementById('vibrationPattern');
    
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
    
    if (visualFlashCheckbox) {
        visualFlashCheckbox.addEventListener('change', function() {
            visualFlashEnabled = this.checked;
            saveSettings();
        });
    }
    
    if (browserNotificationsCheckbox) {
        browserNotificationsCheckbox.addEventListener('change', function() {
            browserNotificationsEnabled = this.checked;
            saveSettings();
        });
    }
    
    if (vibrationCheckbox) {
        vibrationCheckbox.addEventListener('change', function() {
            vibrationEnabled = this.checked;
            saveSettings();
        });
    }
    
    if (soundPatternSelect) {
        soundPatternSelect.addEventListener('change', function() {
            soundPattern = this.value;
            saveSettings();
        });
    }
    
    if (flashPatternSelect) {
        flashPatternSelect.addEventListener('change', function() {
            flashPattern = this.value;
            saveSettings();
        });
    }
    
    if (vibrationPatternSelect) {
        vibrationPatternSelect.addEventListener('change', function() {
            vibrationPattern = this.value;
            saveSettings();
        });
    }
    
    // SMS settings listeners
    const smsMethodSelect = document.getElementById('smsMethod');
    const skipSmsConfirmationCheckbox = document.getElementById('skipSmsConfirmation');
    const showSmsPreviewCheckbox = document.getElementById('showSmsPreview');
    
    if (smsMethodSelect) {
        smsMethodSelect.addEventListener('change', function() {
            smsMethod = this.value;
            saveSettings();
            showNotification(`SMS method changed to: ${this.options[this.selectedIndex].text}`, 'success');
        });
    }
    
    if (skipSmsConfirmationCheckbox) {
        skipSmsConfirmationCheckbox.addEventListener('change', function() {
            skipSmsConfirmation = this.checked;
            saveSettings();
        });
    }
    
    if (showSmsPreviewCheckbox) {
        showSmsPreviewCheckbox.addEventListener('change', function() {
            showSmsPreview = this.checked;
            saveSettings();
        });
    }
    
    loadSettings();
});

// ============================================
// SMART SMS SENDER
// ============================================

async function sendSMS(phoneNumber, message, context = '') {
    // Show preview if enabled
    if (showSmsPreview) {
        const proceed = confirm(`📱 Send SMS to ${phoneNumber}?\n\n${context ? context + '\n\n' : ''}Message:\n${message.substring(0, 200)}${message.length > 200 ? '...' : ''}`);
        if (!proceed) return;
    }
    
    switch(smsMethod) {
        case 'native':
            // Native SMS app (with skip confirmation option)
            const smsLink = `sms:${phoneNumber}${navigator.userAgent.includes('iPhone') ? '&' : '?'}body=${encodeURIComponent(message)}`;
            if (skipSmsConfirmation) {
                // Try to open without additional confirmation
                window.location.href = smsLink;
            } else {
                window.open(smsLink, '_blank');
            }
            showNotification('SMS app opened', 'success');
            break;
            
        case 'copy':
            // Copy message then open SMS
            try {
                await navigator.clipboard.writeText(message);
                const smsLinkCopy = `sms:${phoneNumber}`;
                window.location.href = smsLinkCopy;
                showNotification('Message copied! Paste in SMS app', 'success');
            } catch (err) {
                // Fallback for older browsers
                fallbackCopyToClipboard(message);
                const smsLinkCopy = `sms:${phoneNumber}`;
                window.location.href = smsLinkCopy;
                showNotification('Message copied! Paste in SMS app', 'success');
            }
            break;
            
        case 'whatsapp':
            // WhatsApp
            const whatsappNumber = phoneNumber.replace(/\D/g, ''); // Remove non-digits
            const whatsappLink = `https://wa.me/1${whatsappNumber}?text=${encodeURIComponent(message)}`;
            window.open(whatsappLink, '_blank');
            showNotification('WhatsApp opened', 'success');
            break;
            
        case 'clipboard':
            // Copy to clipboard only
            try {
                await navigator.clipboard.writeText(message);
                showNotification(`Message copied! Send to ${phoneNumber}`, 'success');
            } catch (err) {
                fallbackCopyToClipboard(message);
                showNotification(`Message copied! Send to ${phoneNumber}`, 'success');
            }
            break;
            
        case 'twilio':
            // Direct send via Twilio (if configured)
            showNotification('Twilio direct send - feature coming soon', 'info');
            // TODO: Implement Twilio direct send via API
            break;
            
        default:
            // Fallback to native
            const smsLinkDefault = `sms:${phoneNumber}${navigator.userAgent.includes('iPhone') ? '&' : '?'}body=${encodeURIComponent(message)}`;
            window.location.href = smsLinkDefault;
            showNotification('SMS app opened', 'success');
    }
}

// Fallback copy function for older browsers
function fallbackCopyToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
}

// ============================================
// REPEATING NOTIFICATION SYSTEM
// ============================================

let unacknowledgedRides = new Set(); // Track rides that need repeating notifications
let notificationIntervals = {}; // Track interval IDs for each ride

function startRepeatingNotification(rideId) {
    // Add to unacknowledged set
    unacknowledgedRides.add(rideId);
    
    // Play initial notification
    playNotificationSound();
    showNotification('New ride request received!', 'success');
    
    // Clear any existing interval for this ride
    if (notificationIntervals[rideId]) {
        clearInterval(notificationIntervals[rideId]);
    }
    
    // Set up repeating notification every 10 seconds
    notificationIntervals[rideId] = setInterval(() => {
        if (unacknowledgedRides.has(rideId)) {
            console.log(`Repeating notification for ride ${rideId}`);
            playNotificationSound();
            
            // Force vibration on each repeat
            if (vibrationEnabled && 'vibrate' in navigator) {
                navigator.vibrate(getVibrationPattern(vibrationPattern));
            }
            
            // Show persistent notification
            showNotification('⚠️ Pending ride request needs attention!', 'warning');
        } else {
            // Stop if acknowledged
            clearInterval(notificationIntervals[rideId]);
            delete notificationIntervals[rideId];
        }
    }, 10000); // 10 seconds
}

function acknowledgeRide(rideId) {
    // Remove from unacknowledged set
    unacknowledgedRides.delete(rideId);
    
    // Clear the interval
    if (notificationIntervals[rideId]) {
        clearInterval(notificationIntervals[rideId]);
        delete notificationIntervals[rideId];
    }
    
    console.log(`Ride ${rideId} acknowledged - stopping notifications`);
}

function acknowledgeAllRides() {
    // Stop all repeating notifications
    unacknowledgedRides.forEach(rideId => {
        if (notificationIntervals[rideId]) {
            clearInterval(notificationIntervals[rideId]);
            delete notificationIntervals[rideId];
        }
    });
    unacknowledgedRides.clear();
}

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
    // Acknowledge the ride (stop repeating notifications)
    acknowledgeRide(requestId);
    
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

    // Use smart SMS sender
    sendSMS(driverPhone, message, 'Pre-Quote to Driver');
}

// 2. SHOW QUOTE POPUP
async function showQuotePopup(requestId) {
    console.log('=== SHOW QUOTE POPUP CALLED ===');
    console.log('Request ID:', requestId);
    
    // Acknowledge the ride (stop repeating notifications)
    acknowledgeRide(requestId);
    
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        console.error('Request not found!');
        showNotification('Request not found', 'error');
        return;
    }
    
    // Check for conflicts before allowing quote
    if (!checkConflictsBeforeQuote(requestId)) {
        return; // Conflict detected, abort
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
    
    // Use smart SMS sender
    sendSMS(request.phone_number, message, 'Quote to Rider');
    
    closeQuotePopup();
    showNotification('Quote sent!', 'success');
    
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
    
    // Use smart SMS sender
    sendSMS(request.phone_number, message, 'Quote to Rider');
}

// 7. CONFIRM AND SMS DRIVER
async function confirmAndSMSDriver(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) {
        showNotification('Request not found', 'error');
        return;
    }
    
    // Check for conflicts before confirming
    if (!checkConflictsBeforeQuote(requestId)) {
        return; // Conflict detected, abort
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
    
    // Use smart SMS sender
    sendSMS(driverPhone, message, 'Confirmation to Driver');
    
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
    
    // Use smart SMS sender
    sendSMS(driverPhone, message, 'Resend Confirmation to Driver');
}

// 9. NOT AVAILABLE SMS
async function notAvailableSMS(requestId) {
    // Acknowledge the ride (stop repeating notifications)
    acknowledgeRide(requestId);
    
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
    
    // Use smart SMS sender
    sendSMS(request.phone_number, message, 'Not Available Message');
    
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

// ======================
// CUSTOMER MANAGEMENT FUNCTIONS
// ======================

let allCustomers = [];
let filteredCustomers = [];
let editingCustomerId = null;

// Open customers modal
function openCustomersModal() {
    const modal = document.getElementById('customersModal');
    if (modal) {
        modal.classList.remove('hidden');
        loadCustomers();
    }
}

// Close customers modal
function closeCustomersModal() {
    const modal = document.getElementById('customersModal');
    if (modal) {
        modal.classList.add('hidden');
        cancelAddCustomer();
    }
}

// Load all customers
async function loadCustomers() {
    try {
        const response = await fetch('/api/customers', {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            allCustomers = result.customers;
            filteredCustomers = allCustomers;
            displayCustomers();
            updateCustomerStats();
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        showNotification('Error loading customers', 'error');
    }
}

// Display customers
function displayCustomers() {
    const customersList = document.getElementById('customersList');
    
    if (!customersList) return;
    
    if (filteredCustomers.length === 0) {
        customersList.innerHTML = '<p style="text-align: center; color: #9CA3AF; padding: 40px;">No customers found</p>';
        return;
    }
    
    customersList.innerHTML = filteredCustomers.map(customer => `
        <div class="customer-card" style="background: white; border: 1px solid #E5E7EB; border-radius: 8px; padding: 20px; margin-bottom: 15px;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 15px;">
                <div>
                    <h3 style="margin: 0 0 8px 0; display: flex; align-items: center; gap: 8px;">
                        ${customer.vip_status ? '⭐' : ''} 
                        ${escapeHtml(customer.name)}
                    </h3>
                    <div style="display: flex; gap: 20px; color: #6B7280; font-size: 14px;">
                        <span>📞 ${escapeHtml(customer.phone_number)}</span>
                        ${customer.email ? `<span>✉️ ${escapeHtml(customer.email)}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="icon-btn" onclick="editCustomer(${customer.id})" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="viewCustomerHistory(${customer.id})" title="View Ride History" style="color: #3B82F6;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                    </button>
                    <button class="icon-btn" onclick="deleteCustomerConfirm(${customer.id})" title="Delete" style="color: #EF4444;">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 15px;">
                <div style="background: #F9FAFB; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 13px; color: #6B7280; margin-bottom: 4px;">Total Rides</div>
                    <div style="font-size: 20px; font-weight: 600; color: #1F2937;">${customer.total_rides || 0}</div>
                </div>
                <div style="background: #F9FAFB; padding: 12px; border-radius: 6px;">
                    <div style="font-size: 13px; color: #6B7280; margin-bottom: 4px;">Total Spent</div>
                    <div style="font-size: 20px; font-weight: 600; color: #059669;">$${parseFloat(customer.total_spent || 0).toFixed(2)}</div>
                </div>
            </div>
            
            ${customer.preferred_pickup_location ? `
                <div style="background: #FFFBEB; padding: 12px; border-radius: 6px; border-left: 3px solid #F59E0B; margin-bottom: 10px;">
                    <strong style="font-size: 13px; color: #92400E;">📍 Preferred Pickup:</strong>
                    <div style="color: #78350F;">${escapeHtml(customer.preferred_pickup_location)}</div>
                </div>
            ` : ''}
            
            ${customer.notes ? `
                <div style="background: #EFF6FF; padding: 12px; border-radius: 6px; border-left: 3px solid #3B82F6;">
                    <strong style="font-size: 13px; color: #1E40AF;">📝 Notes:</strong>
                    <div style="color: #1E3A8A;">${escapeHtml(customer.notes)}</div>
                </div>
            ` : ''}
            
            ${customer.last_ride_date ? `
                <div style="font-size: 13px; color: #9CA3AF; margin-top: 10px;">
                    Last ride: ${formatDateTime(customer.last_ride_date)}
                </div>
            ` : ''}
        </div>
    `).join('');
}

// Update customer stats
function updateCustomerStats() {
    const totalCustomersEl = document.getElementById('totalCustomers');
    const vipCustomersEl = document.getElementById('vipCustomers');
    
    if (totalCustomersEl) totalCustomersEl.textContent = allCustomers.length;
    if (vipCustomersEl) vipCustomersEl.textContent = allCustomers.filter(c => c.vip_status).length;
}

// Customer search
document.addEventListener('DOMContentLoaded', function() {
    const customerSearch = document.getElementById('customerSearch');
    if (customerSearch) {
        customerSearch.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            filteredCustomers = allCustomers.filter(customer => 
                customer.name.toLowerCase().includes(searchTerm) ||
                customer.phone_number.includes(searchTerm) ||
                (customer.email && customer.email.toLowerCase().includes(searchTerm))
            );
            displayCustomers();
        });
    }
});

// Show add customer form
function showAddCustomerForm() {
    const form = document.getElementById('addCustomerForm');
    if (form) {
        form.classList.remove('hidden');
        editingCustomerId = null;
        
        // Clear form
        document.getElementById('customerName').value = '';
        document.getElementById('customerPhone').value = '';
        document.getElementById('customerEmail').value = '';
        document.getElementById('customerPickup').value = '';
        document.getElementById('customerNotes').value = '';
        document.getElementById('customerVIP').checked = false;
    }
}

// Cancel add customer
function cancelAddCustomer() {
    const form = document.getElementById('addCustomerForm');
    if (form) {
        form.classList.add('hidden');
        editingCustomerId = null;
    }
}

// Save customer
async function saveCustomer() {
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const pickup = document.getElementById('customerPickup').value.trim();
    const notes = document.getElementById('customerNotes').value.trim();
    const vip = document.getElementById('customerVIP').checked;
    
    if (!name || !phone) {
        showNotification('Name and phone number are required', 'error');
        return;
    }
    
    try {
        const url = editingCustomerId ? `/api/customers/${editingCustomerId}` : '/api/customers';
        const method = editingCustomerId ? 'PATCH' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name,
                phone_number: phone,
                email,
                preferred_pickup_location: pickup,
                notes,
                vip_status: vip
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Customer saved successfully', 'success');
            cancelAddCustomer();
            loadCustomers();
        } else {
            showNotification(result.message || 'Failed to save customer', 'error');
        }
    } catch (error) {
        console.error('Error saving customer:', error);
        showNotification('Error saving customer', 'error');
    }
}

// Edit customer
async function editCustomer(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const customer = result.customer;
            editingCustomerId = customerId;
            
            // Show form
            const form = document.getElementById('addCustomerForm');
            form.classList.remove('hidden');
            
            // Fill form
            document.getElementById('customerName').value = customer.name || '';
            document.getElementById('customerPhone').value = customer.phone_number || '';
            document.getElementById('customerEmail').value = customer.email || '';
            document.getElementById('customerPickup').value = customer.preferred_pickup_location || '';
            document.getElementById('customerNotes').value = customer.notes || '';
            document.getElementById('customerVIP').checked = customer.vip_status || false;
            
            // Scroll to form
            form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    } catch (error) {
        console.error('Error loading customer:', error);
        showNotification('Error loading customer', 'error');
    }
}

// View customer ride history
async function viewCustomerHistory(customerId) {
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            const customer = result.customer;
            const rides = result.rideHistory;
            
            let message = `Customer: ${customer.name}\n`;
            message += `Phone: ${customer.phone_number}\n`;
            message += `Total Rides: ${customer.total_rides}\n`;
            message += `Total Spent: $${parseFloat(customer.total_spent).toFixed(2)}\n\n`;
            message += `=== Ride History ===\n\n`;
            
            if (rides.length === 0) {
                message += 'No rides yet';
            } else {
                rides.slice(0, 10).forEach((ride, index) => {
                    message += `${index + 1}. ${formatDate(ride.requested_date)} - ${ride.status}\n`;
                    message += `   From: ${ride.pickup_location}\n`;
                    if (ride.service_type !== 'hourly') {
                        message += `   To: ${ride.dropoff_location}\n`;
                    }
                    if (ride.quote_price) {
                        message += `   Price: $${parseFloat(ride.quote_price).toFixed(2)}\n`;
                    }
                    message += '\n';
                });
                
                if (rides.length > 10) {
                    message += `...and ${rides.length - 10} more rides`;
                }
            }
            
            alert(message);
        }
    } catch (error) {
        console.error('Error loading customer history:', error);
        showNotification('Error loading customer history', 'error');
    }
}

// Delete customer confirmation
async function deleteCustomerConfirm(customerId) {
    const customer = allCustomers.find(c => c.id === customerId);
    if (!customer) return;
    
    if (!confirm(`Delete customer "${customer.name}"?\n\nThis will not delete their ride history, just the customer profile.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/customers/${customerId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Customer deleted successfully', 'success');
            loadCustomers();
        } else {
            showNotification(result.message || 'Failed to delete customer', 'error');
        }
    } catch (error) {
        console.error('Error deleting customer:', error);
        showNotification('Error deleting customer', 'error');
    }
}

// Quick add to customers from ride request
async function quickAddToCustomers(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    try {
        const response = await fetch('/api/customers', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                name: request.name,
                phone_number: request.phone_number,
                email: null,
                preferred_pickup_location: request.pickup_location,
                notes: null,
                vip_status: false
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`✅ ${request.name} saved to customer database!`, 'success');
        } else {
            showNotification(result.message || 'Customer already exists or error occurred', 'info');
        }
    } catch (error) {
        console.error('Error adding customer:', error);
        showNotification('Error saving to customer database', 'error');
    }
}

// Add event listener for customers button
document.addEventListener('DOMContentLoaded', function() {
    const customersBtn = document.getElementById('customersBtn');
    if (customersBtn) {
        customersBtn.addEventListener('click', openCustomersModal);
    }
});

// ======================
// HOURLY SERVICE FUNCTIONS
// ======================

// Check driver availability for hourly service
async function checkDriverAvailability(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    if (!confirm(`Check availability with driver for ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''} service?\n\nThis will send an SMS to the driver.`)) {
        return;
    }
    
    try {
        // For now, this opens SMS app with pre-filled message
        // In future, could trigger automatic SMS
        const message = `Hourly Service Request:\n` +
                       `Customer: ${request.name}\n` +
                       `Pickup: ${request.pickup_location}\n` +
                       `Date: ${formatDate(request.requested_date)}\n` +
                       `Time: ${formatTime(request.requested_time)}\n` +
                       `Duration: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}\n` +
                       `Estimated: $${request.estimated_total}\n\n` +
                       `Are you available for this booking?`;
        
        // Open SMS app
        window.open(`sms:${encodeURIComponent(request.phone_number)}?body=${encodeURIComponent(message)}`);
        
        showNotification('SMS app opened. Contact driver to confirm availability.', 'success');
    } catch (error) {
        console.error('Error:', error);
        showNotification('Error opening SMS app', 'error');
    }
}

// Confirm hourly booking
async function confirmHourlyBooking(requestId) {
    // Acknowledge the ride (stop repeating notifications)
    acknowledgeRide(requestId);
    
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    // Check for conflicts before confirming
    if (!checkConflictsBeforeQuote(requestId)) {
        return; // Conflict detected, abort
    }
    
    if (!confirm(`Confirm hourly booking for ${request.name}?\n\n` +
                 `Duration: ${request.hours_needed} hour${request.hours_needed > 1 ? 's' : ''}\n` +
                 `Estimated Total: $${request.estimated_total}\n\n` +
                 `This will:\n` +
                 `✓ Mark booking as confirmed\n` +
                 `✓ Send confirmation SMS to customer\n` +
                 `✓ Send booking details to driver`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/ride-requests/${requestId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'confirmed',
                quotePrice: request.estimated_total || 0
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Hourly booking confirmed! SMS sent to customer and driver.', 'success');
            await loadRideRequests();
        } else {
            showNotification(result.message || 'Failed to confirm booking', 'error');
        }
    } catch (error) {
        console.error('Error confirming booking:', error);
        showNotification('Error confirming booking', 'error');
    }
}

// Decline hourly booking
async function declineHourlyBooking(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    if (!confirm(`Decline hourly booking for ${request.name}?\n\n` +
                 `This will send SMS notification to customer that driver is not available.`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/ride-requests/${requestId}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${authToken}`
            },
            body: JSON.stringify({
                status: 'not_available'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Booking declined. SMS sent to customer.', 'success');
            await loadRideRequests();
        } else {
            showNotification(result.message || 'Failed to decline booking', 'error');
        }
    } catch (error) {
        console.error('Error declining booking:', error);
        showNotification('Error declining booking', 'error');
    }
}

// Delete ride request - Smart delete (soft delete first, then hard delete)
async function deleteRideRequest(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    // If already deleted, do permanent delete
    if (request.status === 'deleted') {
        if (!confirm(`⚠️ PERMANENTLY DELETE this ride?\n\nCustomer: ${request.name}\nPhone: ${request.phone_number}\n\n🚨 THIS CANNOT BE UNDONE! 🚨\n\nThe ride will be completely removed from the database.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/api/ride-requests/${requestId}/permanent`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification('Ride permanently deleted from database', 'success');
                await loadRideRequests();
            } else {
                showNotification(result.message || 'Failed to permanently delete ride', 'error');
            }
        } catch (error) {
            console.error('Error permanently deleting ride:', error);
            showNotification('Error permanently deleting ride', 'error');
        }
    } else {
        // Soft delete (no confirmation)
        try {
            const response = await fetch(`/api/ride-requests/${requestId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const result = await response.json();
            
            if (result.success) {
                showNotification(`Ride moved to deleted (view in "Deleted" filter)`, 'success');
                await loadRideRequests();
            } else {
                showNotification(result.message || 'Failed to delete ride request', 'error');
            }
        } catch (error) {
            console.error('Error deleting ride request:', error);
            showNotification('Error deleting ride request', 'error');
        }
    }
}

// Permanently delete ride request (hard delete - removes from database)
async function permanentlyDeleteRide(requestId) {
    const request = allRequests.find(r => r.id === requestId);
    if (!request) return;
    
    if (!confirm(`⚠️ PERMANENTLY DELETE this ride?\n\nCustomer: ${request.name}\nPhone: ${request.phone_number}\n\n🚨 THIS ACTION CANNOT BE UNDONE! 🚨\n\nThe ride will be COMPLETELY REMOVED from the database.\n\nAre you absolutely sure?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/ride-requests/${requestId}/permanent`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('Ride permanently deleted from database', 'success');
            await loadRideRequests();
        } else {
            showNotification(result.message || 'Failed to permanently delete ride', 'error');
        }
    } catch (error) {
        console.error('Error permanently deleting ride:', error);
        showNotification('Error permanently deleting ride', 'error');
    }
}

// Batch delete functions
function updateBatchDeleteUI() {
    const checkboxes = document.querySelectorAll('.select-ride-checkbox');
    const checked = Array.from(checkboxes).filter(cb => cb.checked);
    const controls = document.getElementById('batchDeleteControls');
    const countSpan = document.getElementById('selectedCount');
    const emptyTrashBtn = document.getElementById('emptyTrashBtn');
    
    if (countSpan) countSpan.textContent = checked.length;
    
    // Show controls if at least one checkbox exists, hide if no requests
    if (controls) {
        if (checkboxes.length > 0) {
            controls.classList.remove('hidden');
        } else {
            controls.classList.add('hidden');
        }
    }
    
    // Show/hide Empty Trash button based on current filter
    const statusFilter = document.getElementById('statusFilter');
    const deletedRides = allRequests.filter(r => r.status === 'deleted');
    
    if (emptyTrashBtn) {
        if (statusFilter && statusFilter.value === 'deleted' && deletedRides.length > 0) {
            emptyTrashBtn.classList.remove('hidden');
        } else {
            emptyTrashBtn.classList.add('hidden');
        }
    }
}

function selectAllRides() {
    const checkboxes = document.querySelectorAll('.select-ride-checkbox');
    checkboxes.forEach(cb => cb.checked = true);
    updateBatchDeleteUI();
}

function deselectAllRides() {
    const checkboxes = document.querySelectorAll('.select-ride-checkbox');
    checkboxes.forEach(cb => cb.checked = false);
    updateBatchDeleteUI();
}

async function deleteSelectedRides() {
    const checkboxes = document.querySelectorAll('.select-ride-checkbox:checked');
    const selectedIds = Array.from(checkboxes).map(cb => parseInt(cb.dataset.id));
    
    if (selectedIds.length === 0) {
        showNotification('No rides selected', 'error');
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const id of selectedIds) {
        try {
            const response = await fetch(`/api/ride-requests/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const result = await response.json();
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`Error deleting ride ${id}:`, error);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showNotification(`Moved ${successCount} ride(s) to deleted`, 'success');
    }
    if (failCount > 0) {
        showNotification(`Failed to delete ${failCount} ride(s)`, 'error');
    }
    
    await loadRideRequests();
    updateBatchDeleteUI();
}

// Empty trash - permanently delete all deleted rides
async function emptyTrash() {
    const deletedRides = allRequests.filter(r => r.status === 'deleted');
    
    if (deletedRides.length === 0) {
        showNotification('No deleted rides to remove', 'info');
        return;
    }
    
    if (!confirm(`🗑️ EMPTY TRASH?\n\nThis will PERMANENTLY DELETE ${deletedRides.length} ride(s) from the database.\n\n🚨 THIS ACTION CANNOT BE UNDONE! 🚨\n\nAre you absolutely sure?`)) {
        return;
    }
    
    let successCount = 0;
    let failCount = 0;
    
    for (const ride of deletedRides) {
        try {
            const response = await fetch(`/api/ride-requests/${ride.id}/permanent`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`
                }
            });
            
            const result = await response.json();
            if (result.success) {
                successCount++;
            } else {
                failCount++;
            }
        } catch (error) {
            console.error(`Error permanently deleting ride ${ride.id}:`, error);
            failCount++;
        }
    }
    
    if (successCount > 0) {
        showNotification(`Permanently deleted ${successCount} ride(s) from database`, 'success');
    }
    if (failCount > 0) {
        showNotification(`Failed to delete ${failCount} ride(s)`, 'error');
    }
    
    await loadRideRequests();
    updateBatchDeleteUI();
}

