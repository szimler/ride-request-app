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

// Status Button Elements
let redStatusBtn = document.getElementById('redStatusBtn');
let greenStatusBtn = document.getElementById('greenStatusBtn');

// LED Sign Elements (new scrolling LED sign)
let ledSignDisplay = document.getElementById('ledSignDisplay');
let ledScrollingText = document.getElementById('ledScrollingText');
let ledMessage = document.getElementById('ledMessage');

// Old Driver Status Elements (for backwards compatibility, may not exist)
const driverStatusEl = document.getElementById('driverStatus');
const statusLight = driverStatusEl?.querySelector('.status-light');
const statusMessage = driverStatusEl?.querySelector('.status-message');

// Google Maps Autocomplete - Initialize when API loads
let pickupAutocomplete;
let dropoffAutocomplete;
let hourlyPickupAutocomplete;

window.initAutocomplete = function() {
    console.log('🗺️ initAutocomplete called');
    
    const pickupInput = document.getElementById('pickup_location');
    const dropoffInput = document.getElementById('dropoff_location');
    const hourlyPickupInput = document.getElementById('hourly_pickup_location');
    
    console.log('Found elements:', {
        pickupInput: !!pickupInput,
        dropoffInput: !!dropoffInput,
        hourlyPickupInput: !!hourlyPickupInput
    });
    
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.error('❌ Google Maps API not loaded properly');
        return;
    }
    
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
    
    // Initialize autocomplete for regular ride form
    if (pickupInput && dropoffInput) {
        try {
    pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
    dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, options);
            console.log('✅ Google Maps Autocomplete initialized for regular ride (pickup & dropoff)');
        } catch (error) {
            console.error('❌ Error initializing regular ride autocomplete:', error);
        }
    } else {
        console.warn('⚠️ Regular ride form fields not found');
    }
    
    // Initialize autocomplete for hourly ride form
    if (hourlyPickupInput) {
        try {
            hourlyPickupAutocomplete = new google.maps.places.Autocomplete(hourlyPickupInput, options);
            console.log('✅ Google Maps Autocomplete initialized for hourly ride pickup');
        } catch (error) {
            console.error('❌ Error initializing hourly ride autocomplete:', error);
        }
    } else {
        console.warn('⚠️ Hourly ride form pickup field not found (will initialize when form is shown)');
    }
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
    // Return time string in HH:MM format
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${mins}`;
}

// Helper function to format time for display (12-hour format)
function formatTimeDisplay(time24) {
    if (!time24 || typeof time24 !== 'string') return '';
    
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Convert date input and time dropdown values to actual date/time
function convertDateTime() {
    const now = new Date();
    let finalDate = '';
    let finalTime = '';
    let displayTime = '';
    
    // Handle date selection (now using date input, not dropdown)
    const dateValue = dateSelect.value;
    if (dateValue) {
        // If date input has a value (YYYY-MM-DD format), convert to MM/DD/YYYY
        const dateObj = new Date(dateValue + 'T00:00:00');
        finalDate = formatDate(dateObj);
    } else {
        // Fallback to today if no date selected
        finalDate = formatDate(now);
    }
    
    // Handle time selection
    const timeValue = timeSelect.value;
    if (timeValue === 'asap') {
        // Get current time as HH:MM string
        const hours = String(now.getHours()).padStart(2, '0');
        const mins = String(now.getMinutes()).padStart(2, '0');
        finalTime = `${hours}:${mins}`;
        displayTime = 'ASAP';
    } else if (timeValue === '15min') {
        finalTime = addMinutes(15);
        displayTime = 'In 15 minutes';
    } else if (timeValue === '30min') {
        finalTime = addMinutes(30);
        displayTime = 'In 30 minutes';
    } else if (timeValue === '1hour') {
        finalTime = addMinutes(60);
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
        name: "Sebastian - Ride Service",
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

// Function to ensure autocomplete is initialized
function ensureAutocompleteInitialized() {
    if (!window.google || !window.google.maps || !window.google.maps.places) {
        console.warn('⚠️ Google Maps API not ready yet');
        return false;
    }
    
    const pickupInput = document.getElementById('pickup_location');
    const dropoffInput = document.getElementById('dropoff_location');
    const hourlyPickupInput = document.getElementById('hourly_pickup_location');
    
    const floridaBounds = new google.maps.LatLngBounds(
        new google.maps.LatLng(29.5, -82.5),
        new google.maps.LatLng(30.8, -80.8)
    );
    
    const options = {
        bounds: floridaBounds,
        strictBounds: false,
        componentRestrictions: { country: 'us' },
        fields: ['formatted_address', 'geometry', 'name']
    };
    
    // Initialize regular form autocomplete if not already done
    if (pickupInput && !pickupAutocomplete) {
        pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
        console.log('✅ Initialized pickup autocomplete');
    }
    
    if (dropoffInput && !dropoffAutocomplete) {
        dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, options);
        console.log('✅ Initialized dropoff autocomplete');
    }
    
    // Initialize hourly form autocomplete if not already done
    if (hourlyPickupInput && !hourlyPickupAutocomplete) {
        hourlyPickupAutocomplete = new google.maps.places.Autocomplete(hourlyPickupInput, options);
        console.log('✅ Initialized hourly pickup autocomplete');
    }
    
    return true;
}

// Service Selection Functionality
document.addEventListener('DOMContentLoaded', function() {
    const regularRideBtn = document.getElementById('regularRideBtn');
    const hourlyRideBtn = document.getElementById('hourlyRideBtn');
    const regularForm = document.getElementById('rideRequestForm');
    const hourlyForm = document.getElementById('hourlyRideForm');
    
    if (regularRideBtn && hourlyRideBtn && regularForm && hourlyForm) {
        // Regular ride button click
        regularRideBtn.addEventListener('click', function() {
            regularRideBtn.classList.add('active');
            hourlyRideBtn.classList.remove('active');
            regularForm.classList.remove('hidden');
            hourlyForm.classList.add('hidden');
            
            // Ensure autocomplete is initialized
            setTimeout(ensureAutocompleteInitialized, 100);
        });
        
        // Hourly ride button click
        hourlyRideBtn.addEventListener('click', function() {
            hourlyRideBtn.classList.add('active');
            regularRideBtn.classList.remove('active');
            hourlyForm.classList.remove('hidden');
            regularForm.classList.add('hidden');
            
            // Ensure autocomplete is initialized
            setTimeout(ensureAutocompleteInitialized, 100);
        });
    }
    
    // Try to initialize autocomplete on page load
    setTimeout(ensureAutocompleteInitialized, 500);
});

// Hourly Pricing Logic
function calculateHourlyPrice(hours, startTime) {
    const rates = {
        'morning': 70,    // 7 AM - 10 AM
        'standard': 50,   // 10 AM - 5 PM  
        'evening': 70     // 5 PM - 9 PM
    };
    
    if (!hours || !startTime) return 0;
    
    const startHour = parseInt(startTime.split(':')[0]);
    let rate = rates.standard; // Default to standard rate
    
    if (startHour >= 7 && startHour < 10) {
        rate = rates.morning;
    } else if (startHour >= 10 && startHour < 17) {
        rate = rates.standard;
    } else if (startHour >= 17 && startHour < 21) {
        rate = rates.evening;
    }
    
    return parseInt(hours) * rate;
}

function updateHourlyPrice() {
    const hoursSelect = document.getElementById('hours_needed');
    const startTimeInput = document.getElementById('hourly_start_time');
    const totalDisplay = document.getElementById('hourlyTotal');
    const breakdownDisplay = document.getElementById('priceBreakdown');
    
    if (!hoursSelect || !startTimeInput || !totalDisplay || !breakdownDisplay) return;
    
    const hours = hoursSelect.value;
    const startTime = startTimeInput.value;
    
    if (hours && startTime) {
        const total = calculateHourlyPrice(hours, startTime);
        const rate = total / parseInt(hours);
        
        totalDisplay.textContent = `$${total}`;
        
        let timeRange = '';
        const startHour = parseInt(startTime.split(':')[0]);
        
        if (startHour >= 7 && startHour < 10) {
            timeRange = 'Morning Rate (7 AM - 10 AM)';
        } else if (startHour >= 10 && startHour < 17) {
            timeRange = 'Standard Rate (10 AM - 5 PM)';
        } else if (startHour >= 17 && startHour < 21) {
            timeRange = 'Evening Rate (5 PM - 9 PM)';
        } else {
            timeRange = 'Contact for pricing outside standard hours';
        }
        
        breakdownDisplay.textContent = `${hours} hours × $${rate}/hour (${timeRange})`;
    } else {
        totalDisplay.textContent = '$0';
        breakdownDisplay.textContent = '';
    }
}

// Add event listeners for hourly pricing
document.addEventListener('DOMContentLoaded', function() {
    const hoursSelect = document.getElementById('hours_needed');
    const startTimeInput = document.getElementById('hourly_start_time');
    
    if (hoursSelect) {
        hoursSelect.addEventListener('change', updateHourlyPrice);
    }
    
    if (startTimeInput) {
        startTimeInput.addEventListener('change', updateHourlyPrice);
    }
});

// Hourly Form Submission
document.addEventListener('DOMContentLoaded', function() {
    const hourlyForm = document.getElementById('hourlyRideForm');
    
    if (hourlyForm) {
        hourlyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitBtn = document.getElementById('hourlySubmitBtn');
            const btnText = submitBtn.querySelector('.btn-text');
            const btnLoading = submitBtn.querySelector('.btn-loading');
            
            // Validate required fields
            const name = document.getElementById('hourly_name').value.trim();
            const phone = document.getElementById('hourly_phone_number').value.trim();
            const pickup = document.getElementById('hourly_pickup_location').value.trim();
            const hours = document.getElementById('hours_needed').value;
            const startTime = document.getElementById('hourly_start_time').value;
            const date = document.getElementById('hourly_date').value;
            
            // Check for missing fields
            const missingFields = [];
            if (!name) missingFields.push('Name');
            if (!phone) missingFields.push('Phone Number');
            if (!pickup) missingFields.push('Pickup Location');
            if (!hours) missingFields.push('Hours Needed');
            if (!startTime) missingFields.push('Start Time');
            if (!date) missingFields.push('Date');
            
            if (missingFields.length > 0) {
                const errorMessage = document.getElementById('errorMessage');
                const errorText = document.getElementById('errorText');
                errorText.textContent = `Please fill in the following required fields: ${missingFields.join(', ')}`;
                errorMessage.classList.remove('hidden');
                errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                return;
            }
            
            // Show loading state
            submitBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoading.classList.remove('hidden');
            
            // Get form data
            const totalPrice = calculateHourlyPrice(hours, startTime);
            
            const formData = {
                name: name,
                phone_number: phone.replace(/\D/g, ''),
                pickup_location: pickup,
                hours_needed: hours,
                start_time: startTime,
                date: date,
                notes: document.getElementById('hourly_notes').value.trim(),
                service_type: 'hourly',
                estimated_total: totalPrice
            };
            
            // Clean phone number
            const rawPhone = formData.phone_number;
            const cleanPhone = rawPhone.startsWith('1') ? `+${rawPhone}` : `+1${rawPhone}`;
            formData.phone_number = cleanPhone;
            
            try {
                // Submit the hourly ride request
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
                    const successMessage = document.getElementById('successMessage');
                    successMessage.classList.remove('hidden');
                    
                    // Reset form
                    hourlyForm.reset();
                    
                    // Scroll to success message
                    successMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    
                } else {
                    // Show error message
                    const errorMessage = document.getElementById('errorMessage');
                    const errorText = document.getElementById('errorText');
                    errorText.textContent = result.message || 'Please try again or contact us directly.';
                    errorMessage.classList.remove('hidden');
                    errorMessage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
                
            } catch (error) {
                console.error('Error submitting hourly form:', error);
                const errorMessage = document.getElementById('errorMessage');
                const errorText = document.getElementById('errorText');
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
    }
});

// Quick Date Button Functionality
document.addEventListener('DOMContentLoaded', function() {
    // Helper function to format date as YYYY-MM-DD
    function formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }
    
    // Get today and tomorrow dates
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayFormatted = formatDateForInput(today);
    const tomorrowFormatted = formatDateForInput(tomorrow);
    
    // Regular Ride Quick Date Buttons
    const regularDateInput = document.getElementById('requested_date');
    const regularTodayBtn = document.getElementById('regularTodayBtn');
    const regularTomorrowBtn = document.getElementById('regularTomorrowBtn');
    
    if (regularDateInput && regularDateInput.type === 'date') {
        // Set minimum date to today
        regularDateInput.min = todayFormatted;
        regularDateInput.value = todayFormatted;
        
        if (regularTodayBtn) {
            regularTodayBtn.classList.add('selected');
            regularTodayBtn.addEventListener('click', function() {
                regularDateInput.value = todayFormatted;
                regularTodayBtn.classList.add('selected');
                regularTomorrowBtn.classList.remove('selected');
            });
        }
        
        if (regularTomorrowBtn) {
            regularTomorrowBtn.addEventListener('click', function() {
                regularDateInput.value = tomorrowFormatted;
                regularTomorrowBtn.classList.add('selected');
                regularTodayBtn.classList.remove('selected');
            });
        }
        
        // Update button selection when date input changes manually
        regularDateInput.addEventListener('change', function() {
            if (this.value === todayFormatted) {
                regularTodayBtn.classList.add('selected');
                regularTomorrowBtn.classList.remove('selected');
            } else if (this.value === tomorrowFormatted) {
                regularTomorrowBtn.classList.add('selected');
                regularTodayBtn.classList.remove('selected');
            } else {
                regularTodayBtn.classList.remove('selected');
                regularTomorrowBtn.classList.remove('selected');
            }
        });
    }
    
    // Hourly Service Quick Date Buttons
    const hourlyDateInput = document.getElementById('hourly_date');
    const hourlyTodayBtn = document.getElementById('hourlyTodayBtn');
    const hourlyTomorrowBtn = document.getElementById('hourlyTomorrowBtn');
    
    if (hourlyDateInput && hourlyDateInput.type === 'date') {
        // Set minimum date to today
        hourlyDateInput.min = todayFormatted;
        hourlyDateInput.value = todayFormatted;
        
        if (hourlyTodayBtn) {
            hourlyTodayBtn.classList.add('selected');
            hourlyTodayBtn.addEventListener('click', function() {
                hourlyDateInput.value = todayFormatted;
                hourlyTodayBtn.classList.add('selected');
                hourlyTomorrowBtn.classList.remove('selected');
            });
        }
        
        if (hourlyTomorrowBtn) {
            hourlyTomorrowBtn.addEventListener('click', function() {
                hourlyDateInput.value = tomorrowFormatted;
                hourlyTomorrowBtn.classList.add('selected');
                hourlyTodayBtn.classList.remove('selected');
            });
        }
        
        // Update button selection when date input changes manually
        hourlyDateInput.addEventListener('change', function() {
            if (this.value === todayFormatted) {
                hourlyTodayBtn.classList.add('selected');
                hourlyTomorrowBtn.classList.remove('selected');
            } else if (this.value === tomorrowFormatted) {
                hourlyTomorrowBtn.classList.add('selected');
                hourlyTodayBtn.classList.remove('selected');
            } else {
                hourlyTodayBtn.classList.remove('selected');
                hourlyTomorrowBtn.classList.remove('selected');
            }
        });
    }
});

// Request Another Ride Button
document.addEventListener('DOMContentLoaded', function() {
    const requestAnotherRideBtn = document.getElementById('requestAnotherRideBtn');
    const successMessage = document.getElementById('successMessage');
    const regularForm = document.getElementById('rideRequestForm');
    const hourlyForm = document.getElementById('hourlyRideForm');
    const regularRideBtn = document.getElementById('regularRideBtn');
    const hourlyRideBtn = document.getElementById('hourlyRideBtn');
    
    if (requestAnotherRideBtn) {
        requestAnotherRideBtn.addEventListener('click', function() {
            // Simple solution: Just reload the page to completely reset everything
            window.location.reload();
        });
    }
});

// Driver Availability Status Checker
async function updateDriverStatus() {
    console.log('🔍 updateDriverStatus called');
    console.log('Elements found:', {
        driverStatusEl: !!driverStatusEl,
        statusLight: !!statusLight,
        statusMessage: !!statusMessage,
        ledMatrixCanvas: !!document.getElementById('ledMatrixCanvas'),
        ledMatrix: !!window.ledMatrix,
        redStatusBtn: !!redStatusBtn,
        greenStatusBtn: !!greenStatusBtn
    });

    try {
        const response = await fetch('/api/driver/status');
        console.log('📡 API response status:', response.status);
        
        if (!response.ok) {
            throw new Error('Failed to fetch driver status');
        }

        const data = await response.json();
        console.log('📦 API response data:', data);

        if (data.success && data.status) {
            const { is_available, schedule_start, schedule_end, show_schedule } = data.status;

            // Debug: Log the show_schedule value
            console.log('Driver status received:', { is_available, show_schedule, schedule_start, schedule_end });

            // Update LED Matrix display
            // LED Matrix is controlled by WebSocket updates from server
            // Driver status changes trigger server-side LED updates via WebSocket
            // DO NOT update LED here - it's handled by the 'led_sign_updated' socket event
            console.log(`ℹ️ Driver ${is_available ? 'ONLINE' : 'OFFLINE'} - LED will update via WebSocket from server`);
            
            // Update status buttons (red/green) - both always fully visible
            if (redStatusBtn && greenStatusBtn) {
                if (is_available) {
                    // Driver available: Green ON, Red OFF (both visible)
                    greenStatusBtn.src = 'green-on.png';
                    greenStatusBtn.classList.add('active');
                    
                    redStatusBtn.src = 'red-off.png';
                    redStatusBtn.classList.remove('active');
                    
                    console.log('🟢 Set buttons: Green ON, Red OFF');
                } else {
                    // Driver unavailable: Red ON, Green OFF (both visible)
                    redStatusBtn.src = 'red-on.png';
                    redStatusBtn.classList.add('active');
                    
                    greenStatusBtn.src = 'green-off.png';
                    greenStatusBtn.classList.remove('active');
                    
                    console.log('🔴 Set buttons: Red ON, Green OFF');
                }
            } else {
                console.warn('⚠️ Status button elements not found!');
            }
            
            // Update old status indicator (if present)
            if (statusLight && statusMessage) {
                statusLight.classList.remove('available', 'unavailable');
                
                if (is_available) {
                    statusLight.classList.add('available');
                    
                    // Show schedule times only if enabled
                    if (show_schedule && schedule_start && schedule_end) {
                        const startTime = formatTime(schedule_start);
                        const endTime = formatTime(schedule_end);
                        statusMessage.textContent = `🟢 Available Now (${startTime} - ${endTime})`;
                    } else {
                        statusMessage.textContent = '🟢 Available Now';
                    }
                } else {
                    statusLight.classList.add('unavailable');
                    
                    // Show schedule times only if enabled
                    if (show_schedule && schedule_start && schedule_end) {
                        const startTime = formatTime(schedule_start);
                        const endTime = formatTime(schedule_end);
                        statusMessage.textContent = `🔴 Offline (Available ${startTime} - ${endTime})`;
                    } else {
                        statusMessage.textContent = '🔴 Currently Offline';
                    }
                }
            }
        }
    } catch (err) {
        console.error('Error fetching driver status:', err);
        
        // Update LED Matrix display with error
        if (window.ledMatrix) {
            window.ledMatrix.setMessage('CONNECTION ERROR - PLEASE TRY AGAIN', 'horizontal', 'rainbow');
        }
        
        // Update old status indicator (if present)
        if (statusLight && statusMessage) {
            statusLight.classList.remove('available', 'unavailable');
            statusMessage.textContent = 'Status unavailable';
        }
        
        // Show both buttons as off in case of error
        if (redStatusBtn && greenStatusBtn) {
            redStatusBtn.src = 'red-off.png';
            redStatusBtn.classList.remove('active', 'inactive');
            greenStatusBtn.src = 'green-off.png';
            greenStatusBtn.classList.remove('active', 'inactive');
        }
    }
}

// Format time helper for driver status
function formatTime(timeString) {
    // Safety checks
    if (!timeString) return '';
    if (typeof timeString !== 'string') {
        console.error('formatTime expected string, got:', typeof timeString, timeString);
        return '';
    }
    
    const parts = timeString.split(':');
    if (parts.length !== 2) {
        console.error('Invalid time format:', timeString);
        return timeString; // Return as-is if format is unexpected
    }
    
    const [hours, minutes] = parts;
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
}

// Use Current Location Feature
const useCurrentLocationBtn = document.getElementById('useCurrentLocationBtn');

if (useCurrentLocationBtn) {
    useCurrentLocationBtn.addEventListener('click', async function() {
        if (!navigator.geolocation) {
            alert('Geolocation is not supported by your browser');
            return;
        }

        // Show loading state
        useCurrentLocationBtn.disabled = true;
        useCurrentLocationBtn.classList.add('loading');
        const originalText = useCurrentLocationBtn.textContent;
        useCurrentLocationBtn.textContent = '⌛';

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                
                console.log('📍 Current location:', lat, lng);

                // Reverse geocode using Google Maps
                if (window.google && window.google.maps) {
                    const geocoder = new google.maps.Geocoder();
                    const latlng = { lat, lng };

                    geocoder.geocode({ location: latlng }, (results, status) => {
                        if (status === 'OK' && results[0]) {
                            const address = results[0].formatted_address;
                            document.getElementById('pickup_location').value = address;
                            console.log('✓ Address found:', address);
                            
                            // Show success feedback
                            useCurrentLocationBtn.textContent = '✓';
                            setTimeout(() => {
                                useCurrentLocationBtn.textContent = originalText;
                                useCurrentLocationBtn.disabled = false;
                                useCurrentLocationBtn.classList.remove('loading');
                            }, 2000);
                        } else {
                            console.error('Geocoder failed:', status);
                            alert('Could not determine address from your location');
                            useCurrentLocationBtn.textContent = originalText;
                            useCurrentLocationBtn.disabled = false;
                            useCurrentLocationBtn.classList.remove('loading');
                        }
                    });
                } else {
                    alert('Google Maps not loaded. Please type your address manually.');
                    useCurrentLocationBtn.textContent = originalText;
                    useCurrentLocationBtn.disabled = false;
                    useCurrentLocationBtn.classList.remove('loading');
                }
            },
            (error) => {
                console.error('Geolocation error:', error);
                let errorMsg = 'Could not get your location. ';
                
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        errorMsg += 'Please allow location access in your browser settings.';
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMsg += 'Location information unavailable.';
                        break;
                    case error.TIMEOUT:
                        errorMsg += 'Location request timed out.';
                        break;
                    default:
                        errorMsg += 'Unknown error occurred.';
                }
                
                alert(errorMsg);
                useCurrentLocationBtn.textContent = originalText;
                useCurrentLocationBtn.disabled = false;
                useCurrentLocationBtn.classList.remove('loading');
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });
}

// Initialize driver status checker
document.addEventListener('DOMContentLoaded', function() {
    // Initial check
    updateDriverStatus();
    
    // Update every 10 seconds
    setInterval(updateDriverStatus, 10000);
    
    console.log('✓ Driver status checker initialized');
});

// ============================================
// LED SIGN MESSAGE LOADER (Customer Page)
// Loads message from admin-controlled database
// ============================================

async function loadLEDMessage() {
    try {
        const response = await fetch('/api/led-sign/current');
        const result = await response.json();
        
        if (result.success && result.message && window.ledMatrix) {
            const msg = result.message;
            const text = msg.message_text || msg.text || 'DRIVER AVAILABLE NOW!';
            const direction = msg.direction || 'left';
            const scrollSpeed = parseFloat(msg.scroll_speed || msg.scrollSpeed || 0.3);
            const pauseDuration = parseInt(msg.pause_duration || msg.pauseDuration || 3000);
            
            console.log('📥 Loading LED from API:', { text, direction, scrollSpeed, pauseDuration });
            
            // Set speed and pause before message
            window.ledMatrix.setSpeed(scrollSpeed);
            window.ledMatrix.setPauseDuration(pauseDuration);
            
            // Always use horizontal mode with direction control
            window.ledMatrix.setMessage(text, 'horizontal', 'rainbow', direction);
            
            console.log('✓ LED message loaded from admin settings with direction:', direction);
        }
    } catch (error) {
        console.error('Error loading LED message:', error);
        // Fallback to default with SLOW speed (0.1x) and proper scrolling
        if (window.ledMatrix) {
            window.ledMatrix.setSpeed(0.1);
            window.ledMatrix.setPauseDuration(2000);
            window.ledMatrix.setMessage('DRIVER AVAILABLE - BOOK NOW ON THE APP', 'horizontal', 'rainbow', 'left');
        }
    }
}

// Initialize LED message on page load
document.addEventListener('DOMContentLoaded', function() {
    // Wait for LED Matrix to initialize, then load admin message
    setTimeout(() => {
        if (window.ledMatrix) {
            loadLEDMessage();
        }
    }, 100);
});

// Listen for real-time LED sign updates from admin
document.addEventListener('DOMContentLoaded', function() {
    // Wait for LED Matrix to initialize
    setTimeout(() => {
        if (typeof io !== 'undefined') {
            const socket = io();
            
            socket.on('connect', () => {
                console.log('✅ Socket.IO connected for LED updates');
            });
            
            // Listen for single message updates (driver mode)
            socket.on('led_sign_updated', (data) => {
                console.log('');
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                console.log('📡 WEBSOCKET: SINGLE LED MESSAGE');
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                console.log('data.text:', data.text);
                console.log('data.direction:', data.direction);
                console.log('data.scrollSpeed:', data.scrollSpeed);
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                
                if (window.ledMatrix) {
                    window.ledMatrix.stopSequence();
                    window.ledMatrix.stopScrolling();
                    
                    const messageText = data.text || 'DRIVER AVAILABLE';
                    const direction = data.direction || 'left';
                    const speed = parseFloat(data.scrollSpeed) || 0.1;
                    const pause = parseInt(data.pauseDuration) || 2000;
                    const textColor = data.textColor || '#00FF00';
                    const bgColor = data.bgColor || '#000000';
                    
                    window.ledMatrix.setSpeed(speed);
                    window.ledMatrix.setPauseDuration(pause);
                    
                    const colorMode = data.colorMode || 'solid';
                    
                    setTimeout(() => {
                        window.ledMatrix.setMessage(messageText, 'horizontal', colorMode, direction, textColor, bgColor);
                        console.log('✅ Single message displayed with colorMode:', colorMode, 'colors:', textColor, bgColor);
                    }, 100);
                } else {
                    console.error('❌ LED Matrix not available!');
                }
            });
            
            // Listen for multiple message sequences (admin mode)
            socket.on('led_messages_updated', (data) => {
                console.log('');
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                console.log('📡 WEBSOCKET: MESSAGE SEQUENCE');
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                console.log('Message count:', data.messageCount);
                data.messages.forEach((msg, idx) => {
                    console.log(`  ${idx + 1}. "${msg.text}" - ${msg.direction} @ ${msg.speed}x, pause ${msg.pause}ms, colors: ${msg.textColor}, ${msg.bgColor}`);
                });
                console.log('▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓');
                
                if (window.ledMatrix) {
                    window.ledMatrix.stopScrolling();
                    
                    setTimeout(() => {
                        window.ledMatrix.playMessageSequence(data.messages);
                        console.log(`✅ Playing ${data.messageCount} message sequence`);
                    }, 100);
                } else {
                    console.error('❌ LED Matrix not available!');
                }
            });
            
            console.log('✓ LED sign real-time updates enabled');
        } else {
            console.warn('⚠️ Socket.IO not loaded - LED updates disabled');
        }
    }, 500); // Wait for LED Matrix to initialize
});

// Log app initialization
console.log('🚕 Ride Request App with Hourly Service initialized');
console.log('✓ LED Matrix sign ready (admin-controlled)');
console.log('Ready to accept ride requests and hourly driver services!');

