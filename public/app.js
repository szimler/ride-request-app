// Form Elements
const form = document.getElementById('rideRequestForm');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.querySelector('.btn-text');
const btnLoading = document.querySelector('.btn-loading');
const successMessage = document.getElementById('successMessage');
const errorMessage = document.getElementById('errorMessage');
const errorText = document.getElementById('errorText');
const dateSelect = document.getElementById('requested_date');
const timeSelect = document.getElementById('requested_time');

// Google Maps Autocomplete - Initialize when API loads
let pickupAutocomplete;
let dropoffAutocomplete;

window.initAutocomplete = function() {
    const pickupInput = document.getElementById('pickup_location');
    const dropoffInput = document.getElementById('dropoff_location');
    
    if (!pickupInput || !dropoffInput) return;
    
    // Restrict to Northeast Florida area
    const floridaBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(29.5, -82.5),  // Southwest corner
        new google.maps.LatLng(30.8, -80.8)   // Northeast corner
    );
    
    const options = {
        bounds: floridaBounds,
        strictBounds: false,
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'name']
    };
    
    // Initialize autocomplete for pickup
    pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
    
    // Initialize autocomplete for dropoff
    dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, options);
    
    console.log('✓ Google Maps Autocomplete initialized');
};

// Helper function to format date as YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper function to format time as HH:MM
function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Helper function to add minutes to current time
function addMinutes(minutes) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + minutes);
    return now;
}

// Helper function to format time for display (12-hour format)
function formatTimeDisplay(time24) {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Convert dropdown values to actual date/time
function convertDateTime() {
    const now = new Date();
    let finalDate = '';
    let finalTime = '';
    let displayTime = '';
    
    // Handle date selection
    const dateValue = dateSelect.value;
    if (dateValue === 'today') {
        finalDate = formatDate(now);
    } else if (dateValue === 'tomorrow') {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        finalDate = formatDate(tomorrow);
    }
    
    // Handle time selection
    const timeValue = timeSelect.value;
    if (timeValue === 'asap') {
        finalTime = formatTime(now);
        displayTime = 'ASAP';
    } else if (timeValue === '15min') {
        const futureTime = addMinutes(15);
        finalTime = formatTime(futureTime);
        displayTime = 'In 15 minutes';
    } else if (timeValue === '30min') {
        const futureTime = addMinutes(30);
        finalTime = formatTime(futureTime);
        displayTime = 'In 30 minutes';
    } else if (timeValue === '1hour') {
        const futureTime = addMinutes(60);
        finalTime = formatTime(futureTime);
        displayTime = 'In 1 hour';
    } else {
        // It's a specific time like "14:00"
        finalTime = timeValue;
        displayTime = formatTimeDisplay(timeValue);
    }
    
    return { finalDate, finalTime, displayTime };
}

// Phone number is cleaned on submit - no auto-formatting needed
// Users can type any format: +1 714 204 6318, (714) 204-6318, 714-204-6318, etc.
// App automatically converts to +17142046318 for Twilio

// Form submission handler
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Hide previous messages
    successMessage.classList.add('hidden');
    errorMessage.classList.add('hidden');
    
    // Show loading state
    submitBtn.disabled = true;
    btnText.classList.add('hidden');
    btnLoading.classList.remove('hidden');
    
    // Convert dropdown values to actual date/time
    const { finalDate, finalTime, displayTime } = convertDateTime();
    
    // Get addresses (from autocomplete or manual entry)
    const pickupLocation = document.getElementById('pickup_location').value.trim();
    const pickupApt = document.getElementById('pickup_apt').value.trim();
    const dropoffLocation = document.getElementById('dropoff_location').value.trim();
    const dropoffApt = document.getElementById('dropoff_apt').value.trim();
    
    // Combine address with apt/suite if provided
    const fullPickupLocation = pickupApt ? `${pickupLocation}, ${pickupApt}` : pickupLocation;
    const fullDropoffLocation = dropoffApt ? `${dropoffLocation}, ${dropoffApt}` : dropoffLocation;
    
    // Clean phone number - remove all formatting and add +1
    const rawPhone = document.getElementById('phone_number').value.replace(/\D/g, ''); // Remove all non-digits
    const cleanPhone = rawPhone.startsWith('1') ? `+${rawPhone}` : `+1${rawPhone}`; // Add +1 if not there
    
    // Get form data
    const formData = {
        name: document.getElementById('name').value.trim(),
        phone_number: cleanPhone,  // Use cleaned phone number
        pickup_location: fullPickupLocation,
        dropoff_location: fullDropoffLocation,
        requested_date: finalDate,
        requested_time: finalTime
    };
    
    try {
        // Submit the ride request
        const response = await fetch('/api/ride-request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });
        
        const result = await response.json();
        
        if (response.ok && result.success) {
            // Show success message
            successMessage.classList.remove('hidden');
            
            // Reset form
            form.reset();
            
            // Scroll to success message
            successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Hide form after successful submission (optional)
            setTimeout(() => {
                form.style.opacity = '0.5';
                form.style.pointerEvents = 'none';
            }, 500);
            
        } else {
            // Show error message
            errorText.textContent = result.message || 'Please try again or contact us directly.';
            errorMessage.classList.remove('hidden');
            errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        
    } catch (error) {
        console.error('Error submitting form:', error);
        errorText.textContent = 'Network error. Please check your connection and try again.';
        errorMessage.classList.remove('hidden');
        errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } finally {
        // Reset button state
        submitBtn.disabled = false;
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
});

// Input validation feedback
const inputs = form.querySelectorAll('input[required]');
inputs.forEach(input => {
    input.addEventListener('blur', function() {
        if (this.value.trim() === '') {
            this.style.borderColor = 'var(--error-color)';
        } else {
            this.style.borderColor = 'var(--success-color)';
        }
    });
    
    input.addEventListener('focus', function() {
        this.style.borderColor = 'var(--primary-color)';
    });
});

// Dropdown validation feedback
const selects = form.querySelectorAll('select[required]');
selects.forEach(select => {
    select.addEventListener('change', function() {
        if (this.value === '') {
            this.style.borderColor = 'var(--error-color)';
        } else {
            this.style.borderColor = 'var(--success-color)';
        }
    });
    
    select.addEventListener('focus', function() {
        this.style.borderColor = 'var(--primary-color)';
    });
});

// Prevent form resubmission on page reload
if (window.history.replaceState) {
    window.history.replaceState(null, null, window.location.href);
}

// Add touch feedback for mobile
if ('ontouchstart' in window) {
    submitBtn.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.98)';
    });
    
    submitBtn.addEventListener('touchend', function() {
        this.style.transform = 'scale(1)';
    });
}

// Add to Contacts functionality
function addToContacts() {
    const contactData = {
        name: "Sebastian Zimler - Ride Service",
        phone: "+17142046318",
        website: "https://ride-request-app.onrender.com/",
        note: "Ride Service - Text only while driving"
    };
    
    // Create vCard format for contact
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${contactData.name}
ORG:Ride Service
TEL:${contactData.phone}
URL:${contactData.website}
NOTE:${contactData.note}
END:VCARD`;
    
    // Create and download vCard file
    const blob = new Blob([vcard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Sebastian_Ride_Service.vcf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    // Show success message
    alert('Contact file downloaded! Open it to add Sebastian to your contacts.');
}

// Initialize contact button when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    const addContactBtn = document.getElementById('addContactBtn');
    if (addContactBtn) {
        addContactBtn.addEventListener('click', addToContacts);
    }
});

// Log app initialization
console.log('🚕 Ride Request App initialized');
console.log('Ready to accept ride requests!');

