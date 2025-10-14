const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const { createRideRequest, getAllRideRequests, getRideRequestById, updateRideRequestStatus } = require('./database');
const { initializeTwilio, sendConfirmationSMS, sendBusinessNotification, sendStatusUpdateSMS, sendDriverNotification } = require('./sms');
const { getRouteAndPrice } = require('./maps');

// Try to load config
let config;
try {
  config = require('./config');
} catch (err) {
  config = {
    PORT: process.env.PORT || 3000
  };
}

const app = express();
const PORT = config.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve admin CSS file
app.get('/admin-styles.css', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-styles.css'));
});

// Serve admin JS file
app.get('/admin-app.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-app.js'));
});

// Initialize Twilio
initializeTwilio();

// Routes

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve the admin dashboard
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Serve the digital business card
app.get('/card', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'business-card.html'));
});

// Serve the printable QR code page
app.get('/print-qr', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'print-qr.html'));
});

// Generate vCard (VCF file) for contact saving
app.get('/api/vcard', (req, res) => {
  const businessName = 'Rides CEL';
  const phoneNumber = config.BUSINESS_PHONE_NUMBER || '+17142046318';
  const website = `${req.protocol}://${req.get('host')}`;
  
  // Create vCard format (version 3.0)
  const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${businessName}
ORG:${businessName}
TEL;TYPE=CELL:${phoneNumber}
URL:${website}
NOTE:Professional Ride Service - Request a ride anytime at ${website}
END:VCARD`;

  // Set headers for VCF download
  res.setHeader('Content-Type', 'text/vcard');
  res.setHeader('Content-Disposition', `attachment; filename="${businessName.replace(/\s+/g, '')}-Contact.vcf"`);
  res.send(vcard);
});

// API: Create new ride request
app.post('/api/ride-request', async (req, res) => {
  try {
    const { name, phone_number, pickup_location, dropoff_location, requested_date, requested_time } = req.body;

    // Validate required fields
    if (!name || !phone_number || !pickup_location || !dropoff_location || !requested_date || !requested_time) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Create ride request in database
    const rideRequest = await createRideRequest({
      name,
      phone_number,
      pickup_location,
      dropoff_location,
      requested_date,
      requested_time
    });

    console.log(`✓ New ride request created (ID: ${rideRequest.id})`);

    // Send confirmation SMS to customer
    const customerSMS = await sendConfirmationSMS(phone_number, name);

    // Send notification to business
    const businessSMS = await sendBusinessNotification(rideRequest);

    res.status(201).json({
      success: true,
      message: 'Ride request submitted successfully! You will receive a confirmation message shortly.',
      requestId: rideRequest.id,
      smsStatus: {
        customer: customerSMS.success,
        business: businessSMS.success
      }
    });

  } catch (err) {
    console.error('Error processing ride request:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred while processing your request. Please try again.'
    });
  }
});

// API: Get all ride requests (for admin dashboard)
app.get('/api/ride-requests', async (req, res) => {
  try {
    const requests = await getAllRideRequests();
    res.json({
      success: true,
      count: requests.length,
      requests
    });
  } catch (err) {
    console.error('Error fetching ride requests:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching ride requests'
    });
  }
});

// API: Get specific ride request
app.get('/api/ride-requests/:id', async (req, res) => {
  try {
    const request = await getRideRequestById(req.params.id);
    if (request) {
      res.json({
        success: true,
        request
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }
  } catch (err) {
    console.error('Error fetching ride request:', err);
    res.status(500).json({
      success: false,
      message: 'Error fetching ride request'
    });
  }
});

// API: Calculate route and suggested price
app.post('/api/calculate-route', async (req, res) => {
  try {
    const { pickup_location, dropoff_location } = req.body;

    if (!pickup_location || !dropoff_location) {
      return res.status(400).json({
        success: false,
        message: 'Pickup and dropoff locations are required'
      });
    }

    const result = await getRouteAndPrice(pickup_location, dropoff_location);
    res.json(result);

  } catch (err) {
    console.error('Error calculating route:', err);
    res.status(500).json({
      success: false,
      message: 'Error calculating route'
    });
  }
});

// API: Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  const adminUsername = config.ADMIN_USERNAME || 'admin';
  const adminPassword = config.ADMIN_PASSWORD || 'admin123';
  
  if (username === adminUsername && password === adminPassword) {
    res.json({
      success: true,
      message: 'Login successful'
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid username or password'
    });
  }
});

// API: Update ride request status (with SMS notification)
app.patch('/api/ride-requests/:id/status', async (req, res) => {
  try {
    const { status, quotePrice, pickupEta, rideDuration, distanceMiles, durationMinutes } = req.body;
    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required'
      });
    }

    // Validate quote price for 'quoted' status
    if (status === 'quoted' && (!quotePrice || quotePrice <= 0)) {
      return res.status(400).json({
        success: false,
        message: 'Quote price is required and must be greater than 0'
      });
    }

    // Get the ride request details first
    const rideRequest = await getRideRequestById(req.params.id);
    if (!rideRequest) {
      return res.status(404).json({
        success: false,
        message: 'Ride request not found'
      });
    }

    // Update the status in database (with quote price and time estimates if provided)
    const result = await updateRideRequestStatus(req.params.id, status, quotePrice, pickupEta, rideDuration, distanceMiles, durationMinutes);

    // Send SMS notification to customer for status changes
    let smsResult = { sent: false };
    if (['quoted', 'confirmed', 'declined', 'not_available', 'completed', 'cancelled'].includes(status)) {
      // Format ride details for SMS
      const rideDetails = {
        date: new Date(rideRequest.requested_date).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric', 
          year: 'numeric' 
        }),
        time: formatTime(rideRequest.requested_time),
        pickup: rideRequest.pickup_location,
        dropoff: rideRequest.dropoff_location,
        quotePrice: quotePrice || rideRequest.quote_price,
        pickupEta: pickupEta || rideRequest.pickup_eta_minutes,
        rideDuration: rideDuration || rideRequest.ride_duration_minutes
      };

      smsResult = await sendStatusUpdateSMS(
        rideRequest.phone_number,
        rideRequest.name,
        status,
        rideDetails
      );
      
      // Send notification to driver when ride is confirmed
      if (status === 'confirmed') {
        const updatedRequest = await getRideRequestById(req.params.id);
        await sendDriverNotification(updatedRequest);
      }
    }

    res.json({
      success: true,
      message: 'Status updated successfully',
      result,
      smsStatus: smsResult
    });
  } catch (err) {
    console.error('Error updating status:', err);
    res.status(500).json({
      success: false,
      message: 'Error updating status'
    });
  }
});

// Helper function to format time
function formatTime(timeString) {
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚕 Ride Request App Server');
  console.log('=================================');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Access the app at: http://localhost:${PORT}`);
  console.log('=================================\n');
});

