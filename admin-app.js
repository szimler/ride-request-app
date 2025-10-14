// Authentication state
let isAuthenticated = false;
let allRequests = [];
let filteredRequests = [];

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

// Check for saved session
const savedAuth = sessionStorage.getItem('adminAuth');
if (savedAuth === 'true') {
    showDashboard();
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
            sessionStorage.setItem('adminAuth', 'true');
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
logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('adminAuth');
    loginScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    loginForm.reset();
});

// Show dashboard
function showDashboard() {
    loginScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    loadRideRequests();
    
    // Auto-refresh every 30 seconds
    setInterval(loadRideRequests, 30000);
}

// Load all ride requests
async function loadRideRequests() {
    try {
        const response = await fetch('/api/ride-requests');
        const result = await response.json();
        
        if (result.success) {
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
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="10" r="3"></circle>
                        <path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 6.9 8 11.7z"></path>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">Pickup</div>
                        <div class="detail-value">${escapeHtml(request.pickup_location)}</div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">Drop-off</div>
                        <div class="detail-value">${escapeHtml(request.dropoff_location)}</div>
                    </div>
                </div>
                
                <div class="detail-item">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                    </svg>
                    <div class="detail-content">
                        <div class="detail-label">Date & Time</div>
                        <div class="detail-value">${formatDate(request.requested_date)} at ${formatTime(request.requested_time)}</div>
                    </div>
                </div>
                
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
                    ${request.distance_miles ? `<div class="quote-info">📏 Distance to Dropoff: ${request.distance_miles.toFixed(1)} miles</div>` : ''}
                    ${request.duration_minutes ? `<div class="quote-info">⏱️ Estimated Drive Time: ${Math.round(request.duration_minutes)} minutes</div>` : ''}
                    ${request.pickup_eta_minutes ? `<div class="quote-info">🚗 Your Pickup ETA: ${request.pickup_eta_minutes} minutes</div>` : ''}
                    ${request.ride_duration_minutes ? `<div class="quote-info">🕐 Total Ride Duration: ${request.ride_duration_minutes} minutes</div>` : ''}
                </div>
            ` : ''}
            
            <div class="request-actions">
                ${request.status === 'pending' ? `
                    <button class="action-btn btn-confirm" onclick="sendQuote(${request.id})">
                        💵 Send Quote
                    </button>
                    <button class="action-btn btn-cancel" onclick="updateStatus(${request.id}, 'not_available')">
                        ✗ Not Available
                    </button>
                ` : ''}
                ${request.status === 'quoted' ? `
                    <button class="action-btn btn-confirm" onclick="updateStatus(${request.id}, 'confirmed')">
                        ✓ Confirm Ride (Customer Accepted)
                    </button>
                    <button class="action-btn btn-cancel" onclick="updateStatus(${request.id}, 'declined')">
                        ✗ Declined (Customer Rejected)
                    </button>
                ` : ''}
                ${request.status === 'confirmed' ? `
                    <button class="action-btn btn-complete" onclick="updateStatus(${request.id}, 'completed')">
                        ✓ Complete Ride
                    </button>
                    <button class="action-btn btn-cancel" onclick="updateStatus(${request.id}, 'cancelled')">
                        Cancel
                    </button>
                ` : ''}
                ${request.status === 'completed' || request.status === 'cancelled' || request.status === 'not_available' || request.status === 'declined' ? `
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
            headers: { 'Content-Type': 'application/json' },
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

console.log('🚕 Admin Dashboard initialized');

