require('dotenv').config(); // Load environment variables first

const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const { 
  createRideRequest, 
  getAllRideRequests, 
  getRideRequestById, 
  updateRideRequestStatus,
  createAdminUser,
  getAdminUserByUsername,
  getAdminUserById,
  getAllAdminUsers,
  updateAdminUser,
  updateLastLogin,
  deleteAdminUser,
  createActivityLog,
  upsertCustomer,
  getAllCustomers,
  getCustomerByPhone,
  getCustomerById,
  updateCustomer,
  updateCustomerStats,
  getCustomerRideHistory,
  deleteCustomer
} = require('./database');
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
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PATCH"]
  }
});

const PORT = config.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || config.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

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

// Serve admin backup functions JS file
app.get('/admin-backup-functions.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-backup-functions.js'));
});

// Initialize Twilio
initializeTwilio();

// ===========================
// AUTHENTICATION MIDDLEWARE
// ===========================

function authenticateToken(req, res, next) {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ success: false, message: 'Invalid or expired token' });
  }
}

// Helper to log user IP
function getUserIP(req) {
  return req.headers['x-forwarded-for']?.split(',')[0] || 
         req.connection.remoteAddress || 
         req.socket.remoteAddress;
}

// ===========================
// WEBSOCKET REAL-TIME UPDATES
// ===========================

const connectedAdmins = new Map(); // userId -> socket

io.on('connection', (socket) => {
  console.log('New admin connected:', socket.id);
  
  // Authenticate socket connection
  socket.on('authenticate', async (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      connectedAdmins.set(decoded.userId, socket);
      
      console.log(`Admin authenticated: ${decoded.username} (ID: ${decoded.userId})`);
      
      // Send welcome message
      socket.emit('authenticated', { 
        success: true, 
        username: decoded.username,
        connectedAdmins: connectedAdmins.size
      });
      
      // Notify all admins of new connection
      io.emit('admin_connected', { 
        username: decoded.username, 
        totalConnected: connectedAdmins.size 
      });
      
    } catch (err) {
      socket.emit('auth_error', { success: false, message: 'Invalid token' });
      socket.disconnect();
    }
  });
  
  // Broadcast ride request updates
  socket.on('ride_updated', (data) => {
    io.emit('ride_request_updated', data);
  });
  
  socket.on('disconnect', () => {
    if (socket.userId) {
      connectedAdmins.delete(socket.userId);
      console.log(`Admin disconnected: ${socket.username}`);
      
      // Notify remaining admins
      io.emit('admin_disconnected', { 
        username: socket.username, 
        totalConnected: connectedAdmins.size 
      });
    }
  });
});

// Helper function to broadcast updates to all connected admins
function broadcastUpdate(eventType, data) {
  io.emit(eventType, data);
}

// ===========================
// PUBLIC ROUTES
// ===========================

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
    const { 
      name, 
      phone_number, 
      pickup_location, 
      dropoff_location, 
      requested_date, 
      requested_time,
      service_type,
      hours_needed,
      start_time,
      date,
      notes,
      estimated_total
    } = req.body;

    // Validate required fields based on service type
    if (service_type === 'hourly') {
      // Hourly service validation
      if (!name || !phone_number || !pickup_location || !hours_needed || !start_time || !date) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required for hourly service'
        });
      }
    } else {
      // Regular ride validation
      if (!name || !phone_number || !pickup_location || !dropoff_location || !requested_date || !requested_time) {
        return res.status(400).json({
          success: false,
          message: 'All fields are required'
        });
      }
    }

    // Validate phone number format (basic validation)
    const phoneRegex = /^[\d\s\-\+\(\)]+$/;
    if (!phoneRegex.test(phone_number)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format'
      });
    }

    // Prepare data for database based on service type
    const rideData = {
      name,
      phone_number,
      pickup_location,
      service_type: service_type || 'regular'
    };

    if (service_type === 'hourly') {
      rideData.hours_needed = hours_needed;
      rideData.start_time = start_time;
      rideData.requested_date = date;
      rideData.requested_time = start_time; // Use start_time as requested_time for consistency
      rideData.dropoff_location = 'N/A (Hourly Service)';
      rideData.notes = notes || '';
      rideData.estimated_total = estimated_total;
    } else {
      rideData.dropoff_location = dropoff_location;
      rideData.requested_date = requested_date;
      rideData.requested_time = requested_time;
    }

    // Create ride request in database
    const rideRequest = await createRideRequest(rideData);

    console.log(`✓ New ride request created (ID: ${rideRequest.id})`);

    // Auto-create/update customer record
    try {
      await upsertCustomer({
        name,
        phone_number,
        email: null, // Will be added manually by admin if needed
        preferred_pickup_location: pickup_location,
        notes: null,
        vip_status: false
      });
      console.log(`✓ Customer record updated for: ${name}`);
    } catch (customerErr) {
      console.error('Warning: Could not update customer record:', customerErr);
      // Don't fail the ride request if customer update fails
    }

    // Broadcast to all connected admins
    broadcastUpdate('new_ride_request', rideRequest);

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

// ===========================
// ADMIN AUTHENTICATION ROUTES
// ===========================

// API: Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }
    
    // Get user from database
    const user = await getAdminUserByUsername(username);
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password'
      });
    }
    
    // Update last login
    await updateLastLogin(user.id);
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        username: user.username,
        fullName: user.full_name,
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    // Log activity
    await createActivityLog({
      user_id: user.id,
      username: user.username,
      action: 'login',
      ip_address: getUserIP(req)
    });
    
    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role
      }
    });
    
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: 'An error occurred during login'
    });
  }
});

// API: Admin logout
app.post('/api/admin/logout', authenticateToken, async (req, res) => {
  try {
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'logout',
      ip_address: getUserIP(req)
    });
    
    res.clearCookie('token');
    res.json({ success: true, message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ success: false, message: 'Error during logout' });
  }
});

// API: Verify token (for session persistence)
app.get('/api/admin/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    user: {
      id: req.user.userId,
      username: req.user.username,
      fullName: req.user.fullName,
      role: req.user.role
    }
  });
});

// ===========================
// ADMIN USER MANAGEMENT ROUTES
// ===========================

// API: Get all admin users
app.get('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const users = await getAllAdminUsers();
    res.json({ success: true, users });
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});

// API: Create new admin user
app.post('/api/admin/users', authenticateToken, async (req, res) => {
  try {
    const { username, password, full_name, email, role } = req.body;
    
    if (!username || !password || !full_name) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and full name are required'
      });
    }
    
    // Check if user already exists
    const existingUser = await getAdminUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Username already exists'
      });
    }
    
    // Hash password
    const password_hash = await bcrypt.hash(password, 10);
    
    // Create user
    const newUser = await createAdminUser({
      username,
      password_hash,
      full_name,
      email,
      role: role || 'admin'
    });
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'create_user',
      target_type: 'admin_user',
      target_id: newUser.id,
      details: `Created user: ${username}`,
      ip_address: getUserIP(req)
    });
    
    // Broadcast update
    broadcastUpdate('user_created', newUser);
    
    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user: newUser
    });
    
  } catch (err) {
    console.error('Error creating user:', err);
    res.status(500).json({ success: false, message: 'Error creating user' });
  }
});

// API: Update admin user
app.patch('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const { full_name, email, role, is_active, password } = req.body;
    const userId = parseInt(req.params.id);
    
    // Get current user data first
    const currentUser = await getAdminUserById(userId);
    if (!currentUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    // Build updates object with current values as fallback
    const updates = {
      full_name: full_name !== undefined ? full_name : currentUser.full_name,
      email: email !== undefined ? email : currentUser.email,
      role: role !== undefined ? role : currentUser.role,
      is_active: is_active !== undefined ? (is_active ? 1 : 0) : currentUser.is_active
    };
    
    // If password is being updated, hash it
    if (password) {
      updates.password_hash = await bcrypt.hash(password, 10);
    }
    
    await updateAdminUser(userId, updates);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'update_user',
      target_type: 'admin_user',
      target_id: userId,
      details: `Updated user settings`,
      ip_address: getUserIP(req)
    });
    
    // Broadcast update
    broadcastUpdate('user_updated', { userId, updates });
    
    res.json({ success: true, message: 'User updated successfully' });
    
  } catch (err) {
    console.error('Error updating user:', err);
    res.status(500).json({ success: false, message: 'Error updating user' });
  }
});

// API: Delete admin user (soft delete)
app.delete('/api/admin/users/:id', authenticateToken, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Prevent self-deletion
    if (userId === req.user.userId) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }
    
    await deleteAdminUser(userId);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'delete_user',
      target_type: 'admin_user',
      target_id: userId,
      details: `Deactivated user`,
      ip_address: getUserIP(req)
    });
    
    // Broadcast update
    broadcastUpdate('user_deleted', { userId });
    
    res.json({ success: true, message: 'User deactivated successfully' });
    
  } catch (err) {
    console.error('Error deleting user:', err);
    res.status(500).json({ success: false, message: 'Error deleting user' });
  }
});

// ===========================
// CUSTOMER MANAGEMENT ROUTES
// ===========================

// API: Get all customers
app.get('/api/customers', authenticateToken, async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json({ success: true, customers });
  } catch (err) {
    console.error('Error fetching customers:', err);
    res.status(500).json({ success: false, message: 'Error fetching customers' });
  }
});

// API: Get customer by ID with ride history
app.get('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    
    const rideHistory = await getCustomerRideHistory(req.params.id);
    res.json({ success: true, customer, rideHistory });
  } catch (err) {
    console.error('Error fetching customer:', err);
    res.status(500).json({ success: false, message: 'Error fetching customer' });
  }
});

// API: Create or update customer
app.post('/api/customers', authenticateToken, async (req, res) => {
  try {
    const { name, phone_number, email, preferred_pickup_location, notes, vip_status } = req.body;
    
    if (!name || !phone_number) {
      return res.status(400).json({ success: false, message: 'Name and phone number are required' });
    }
    
    const customer = await upsertCustomer({
      name,
      phone_number,
      email,
      preferred_pickup_location,
      notes,
      vip_status
    });
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'upsert_customer',
      target_type: 'customer',
      target_id: customer.id,
      details: `Updated customer: ${name}`,
      ip_address: getUserIP(req)
    });
    
    res.json({ success: true, customer });
  } catch (err) {
    console.error('Error upserting customer:', err);
    res.status(500).json({ success: false, message: 'Error saving customer' });
  }
});

// API: Update customer
app.patch('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    const customer = await updateCustomer(req.params.id, req.body);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'update_customer',
      target_type: 'customer',
      target_id: parseInt(req.params.id),
      details: `Updated customer details`,
      ip_address: getUserIP(req)
    });
    
    res.json({ success: true, customer });
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ success: false, message: 'Error updating customer' });
  }
});

// API: Delete customer
app.delete('/api/customers/:id', authenticateToken, async (req, res) => {
  try {
    await deleteCustomer(req.params.id);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'delete_customer',
      target_type: 'customer',
      target_id: parseInt(req.params.id),
      details: `Deleted customer`,
      ip_address: getUserIP(req)
    });
    
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ success: false, message: 'Error deleting customer' });
  }
});

// ===========================
// RIDE REQUEST ROUTES
// ===========================

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

// API: Update ride request status (with SMS notification) - PROTECTED
app.patch('/api/ride-requests/:id/status', authenticateToken, async (req, res) => {
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

    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'update_ride_status',
      target_type: 'ride_request',
      target_id: parseInt(req.params.id),
      details: `Changed status to: ${status}${quotePrice ? ` ($${quotePrice})` : ''}`,
      ip_address: getUserIP(req)
    });

    // Broadcast update to all connected admins
    const updatedRequest = await getRideRequestById(req.params.id);
    broadcastUpdate('ride_request_updated', {
      request: updatedRequest,
      updatedBy: req.user.username
    });

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

// ===========================
// BACKUP MANAGEMENT ROUTES
// ===========================

const backupManager = require('./backup-manager');

// Get database statistics
app.get('/api/admin/backup/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await backupManager.getStats();
    res.json(stats);
  } catch (err) {
    console.error('Error getting stats:', err);
    res.status(500).json({ success: false, message: 'Error getting database statistics' });
  }
});

// Create backup
app.post('/api/admin/backup/create', authenticateToken, async (req, res) => {
  try {
    const { customPath } = req.body;
    const result = await backupManager.createBackup(customPath);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'create_backup',
      details: `Created backup: ${result.backup.filename}`,
      ip_address: getUserIP(req)
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error creating backup:', err);
    res.status(500).json(err);
  }
});

// Export to JSON
app.post('/api/admin/backup/export-json', authenticateToken, async (req, res) => {
  try {
    const { customPath } = req.body;
    const result = await backupManager.exportToJSON(customPath);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'export_json',
      details: `Exported data to JSON: ${result.export.filename}`,
      ip_address: getUserIP(req)
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error exporting to JSON:', err);
    res.status(500).json(err);
  }
});

// List all backups
app.get('/api/admin/backup/list', authenticateToken, async (req, res) => {
  try {
    const result = await backupManager.listBackups();
    res.json(result);
  } catch (err) {
    console.error('Error listing backups:', err);
    res.status(500).json(err);
  }
});

// Delete backup
app.delete('/api/admin/backup/:filename', authenticateToken, async (req, res) => {
  try {
    const result = await backupManager.deleteBackup(req.params.filename);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'delete_backup',
      details: `Deleted backup: ${req.params.filename}`,
      ip_address: getUserIP(req)
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error deleting backup:', err);
    res.status(500).json(err);
  }
});

// Restore backup (super admin only)
app.post('/api/admin/backup/restore/:filename', authenticateToken, async (req, res) => {
  try {
    // Only super admins can restore
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({
        success: false,
        message: 'Only super admins can restore backups'
      });
    }
    
    const result = await backupManager.restoreBackup(req.params.filename);
    
    // Log activity
    await createActivityLog({
      user_id: req.user.userId,
      username: req.user.username,
      action: 'restore_backup',
      details: `Restored backup: ${req.params.filename}`,
      ip_address: getUserIP(req)
    });
    
    res.json(result);
  } catch (err) {
    console.error('Error restoring backup:', err);
    res.status(500).json(err);
  }
});

// Download backup file
app.get('/api/admin/backup/download/:filename', authenticateToken, (req, res) => {
  try {
    const backupPath = path.join(__dirname, 'backups', req.params.filename);
    
    if (!fs.existsSync(backupPath)) {
      return res.status(404).json({ success: false, message: 'Backup file not found' });
    }
    
    res.download(backupPath, req.params.filename);
  } catch (err) {
    console.error('Error downloading backup:', err);
    res.status(500).json({ success: false, message: 'Error downloading backup' });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log('\n=================================');
  console.log('🚕 Ride Request App Server');
  console.log('=================================');
  console.log(`✓ Server running on port ${PORT}`);
  console.log(`✓ Access the app at: http://localhost:${PORT}`);
  console.log(`✓ WebSocket enabled for real-time updates`);
  console.log('=================================\n');
});
