const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase and most cloud PostgreSQL providers
  },
  // Force IPv4 to avoid network unreachable errors on some cloud providers
  host: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL).hostname : undefined,
  connectionTimeoutMillis: 10000
});

// Test connection
pool.on('connect', () => {
  console.log('✓ Connected to PostgreSQL database');
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client', err);
  process.exit(-1);
});

// Initialize database tables
async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // Ride requests table
    await client.query(`
      CREATE TABLE IF NOT EXISTS ride_requests (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        pickup_location TEXT NOT NULL,
        dropoff_location TEXT NOT NULL,
        requested_date TEXT NOT NULL,
        requested_time TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        quote_price DECIMAL(10, 2),
        pickup_eta_minutes INTEGER,
        ride_duration_minutes INTEGER,
        distance_miles DECIMAL(10, 2),
        duration_minutes DECIMAL(10, 2),
        service_type TEXT,
        hours_needed INTEGER,
        start_time TEXT,
        estimated_total DECIMAL(10, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Ride requests table ready');

    // Admin users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'admin',
        is_active INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        last_login TIMESTAMP
      )
    `);
    console.log('✓ Admin users table ready');

    // Check if default admin exists
    const adminCheck = await client.query('SELECT COUNT(*) as count FROM admin_users');
    if (adminCheck.rows[0].count === '0') {
      const defaultPassword = 'admin123';
      const hash = await bcrypt.hash(defaultPassword, 10);
      await client.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
      `, ['admin', hash, 'Default Admin', 'super_admin']);
      console.log('✓ Default admin user created (username: admin, password: admin123)');
    }

    // Activity logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        username TEXT NOT NULL,
        action TEXT NOT NULL,
        target_type TEXT,
        target_id INTEGER,
        details TEXT,
        ip_address TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES admin_users(id)
      )
    `);
    console.log('✓ Activity logs table ready');

    // Customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        phone_number TEXT UNIQUE NOT NULL,
        email TEXT,
        preferred_pickup_location TEXT,
        notes TEXT,
        vip_status BOOLEAN DEFAULT FALSE,
        total_rides INTEGER DEFAULT 0,
        total_spent DECIMAL(10, 2) DEFAULT 0,
        last_ride_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    console.log('✓ Customers table ready');

  } catch (err) {
    console.error('Error initializing database:', err);
    throw err;
  } finally {
    client.release();
  }
}

// Initialize on startup
initializeDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Insert a new ride request
function createRideRequest(requestData) {
  return new Promise(async (resolve, reject) => {
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
        notes,
        estimated_total
      } = requestData;
      
      const sql = `
        INSERT INTO ride_requests (
          name, phone_number, pickup_location, dropoff_location, requested_date, requested_time,
          service_type, hours_needed, start_time, notes, estimated_total
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;
      
      const result = await pool.query(sql, [
        name, 
        phone_number, 
        pickup_location, 
        dropoff_location, 
        requested_date, 
        requested_time,
        service_type || 'regular',
        hours_needed || null,
        start_time || null,
        notes || null,
        estimated_total || null
      ]);
      
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get all ride requests
function getAllRideRequests() {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM ride_requests ORDER BY created_at DESC');
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Get a single ride request by ID
function getRideRequestById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM ride_requests WHERE id = $1', [id]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Update ride request status
function updateRideRequestStatus(id, status, quotePrice = null, pickupEta = null, rideDuration = null, distanceMiles = null, durationMinutes = null) {
  return new Promise(async (resolve, reject) => {
    try {
      let sql, params;
      
      if (quotePrice !== null) {
        sql = 'UPDATE ride_requests SET status = $1, quote_price = $2, pickup_eta_minutes = $3, ride_duration_minutes = $4, distance_miles = $5, duration_minutes = $6 WHERE id = $7 RETURNING *';
        params = [status, quotePrice, pickupEta, rideDuration, distanceMiles, durationMinutes, id];
      } else {
        sql = 'UPDATE ride_requests SET status = $1 WHERE id = $2 RETURNING *';
        params = [status, id];
      }
      
      const result = await pool.query(sql, params);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================
// ADMIN USER FUNCTIONS
// ===========================

// Create new admin user
function createAdminUser(userData) {
  return new Promise(async (resolve, reject) => {
    try {
      const { username, password_hash, full_name, email, role } = userData;
      const sql = `
        INSERT INTO admin_users (username, password_hash, full_name, email, role)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, username, full_name, email, role
      `;
      const result = await pool.query(sql, [username, password_hash, full_name, email || null, role || 'admin']);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get admin user by username
function getAdminUserByUsername(username) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM admin_users WHERE username = $1 AND is_active = 1', [username]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get admin user by ID
function getAdminUserById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM admin_users WHERE id = $1',
        [id]
      );
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get all admin users
function getAllAdminUsers() {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'SELECT id, username, full_name, email, role, is_active, created_at, last_login FROM admin_users ORDER BY created_at DESC'
      );
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Update admin user
function updateAdminUser(id, updates) {
  return new Promise(async (resolve, reject) => {
    try {
      const { full_name, email, role, is_active, password_hash } = updates;
      let sql = 'UPDATE admin_users SET full_name = $1, email = $2, role = $3, is_active = $4';
      let params = [full_name, email, role, is_active];
      
      if (password_hash) {
        sql += ', password_hash = $5 WHERE id = $6 RETURNING *';
        params.push(password_hash, id);
      } else {
        sql += ' WHERE id = $5 RETURNING *';
        params.push(id);
      }
      
      const result = await pool.query(sql, params);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Update last login time
function updateLastLogin(userId) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'UPDATE admin_users SET last_login = NOW() WHERE id = $1 RETURNING *',
        [userId]
      );
      resolve({ userId, updated: result.rowCount > 0 });
    } catch (err) {
      reject(err);
    }
  });
}

// Delete admin user (soft delete - set is_active to 0)
function deleteAdminUser(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('UPDATE admin_users SET is_active = 0 WHERE id = $1 RETURNING *', [id]);
      resolve({ id, deleted: result.rowCount > 0 });
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================
// ACTIVITY LOG FUNCTIONS
// ===========================

// Create activity log entry
function createActivityLog(logData) {
  return new Promise(async (resolve, reject) => {
    try {
      const { user_id, username, action, target_type, target_id, details, ip_address } = logData;
      const sql = `
        INSERT INTO activity_logs (user_id, username, action, target_type, target_id, details, ip_address)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;
      const result = await pool.query(sql, [
        user_id, 
        username, 
        action, 
        target_type || null, 
        target_id || null, 
        details || null, 
        ip_address || null
      ]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get all activity logs with pagination
function getActivityLogs(limit = 100, offset = 0) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      );
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Get activity logs for a specific user
function getActivityLogsByUser(userId, limit = 50) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
        [userId, limit]
      );
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Get activity logs for a specific ride request
function getActivityLogsByRideRequest(rideRequestId) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query(
        'SELECT * FROM activity_logs WHERE target_type = $1 AND target_id = $2 ORDER BY created_at DESC',
        ['ride_request', rideRequestId]
      );
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// ===========================
// CUSTOMER FUNCTIONS
// ===========================

// Create or update customer (upsert based on phone number)
function upsertCustomer(customerData) {
  return new Promise(async (resolve, reject) => {
    try {
      const { name, phone_number, email, preferred_pickup_location, notes, vip_status } = customerData;
      
      // Check if customer exists
      const existing = await pool.query('SELECT * FROM customers WHERE phone_number = $1', [phone_number]);
      
      if (existing.rows.length > 0) {
        // Update existing customer
        const sql = `
          UPDATE customers 
          SET name = $1, email = $2, preferred_pickup_location = $3, 
              notes = $4, vip_status = $5, updated_at = NOW()
          WHERE phone_number = $6
          RETURNING *
        `;
        const result = await pool.query(sql, [name, email, preferred_pickup_location, notes, vip_status, phone_number]);
        resolve(result.rows[0]);
      } else {
        // Create new customer
        const sql = `
          INSERT INTO customers (name, phone_number, email, preferred_pickup_location, notes, vip_status)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
        `;
        const result = await pool.query(sql, [name, phone_number, email, preferred_pickup_location, notes, vip_status || false]);
        resolve(result.rows[0]);
      }
    } catch (err) {
      reject(err);
    }
  });
}

// Get all customers
function getAllCustomers() {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM customers ORDER BY created_at DESC');
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Get customer by phone number
function getCustomerByPhone(phoneNumber) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM customers WHERE phone_number = $1', [phoneNumber]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get customer by ID
function getCustomerById(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('SELECT * FROM customers WHERE id = $1', [id]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Update customer
function updateCustomer(id, updates) {
  return new Promise(async (resolve, reject) => {
    try {
      const { name, email, preferred_pickup_location, notes, vip_status } = updates;
      const sql = `
        UPDATE customers 
        SET name = $1, email = $2, preferred_pickup_location = $3, 
            notes = $4, vip_status = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING *
      `;
      const result = await pool.query(sql, [name, email, preferred_pickup_location, notes, vip_status, id]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Update customer ride stats (called after ride completion)
function updateCustomerStats(phoneNumber, ridePrice) {
  return new Promise(async (resolve, reject) => {
    try {
      const sql = `
        UPDATE customers 
        SET total_rides = total_rides + 1, 
            total_spent = total_spent + $1, 
            last_ride_date = NOW(),
            updated_at = NOW()
        WHERE phone_number = $2
        RETURNING *
      `;
      const result = await pool.query(sql, [ridePrice || 0, phoneNumber]);
      resolve(result.rows[0]);
    } catch (err) {
      reject(err);
    }
  });
}

// Get customer ride history
function getCustomerRideHistory(customerId) {
  return new Promise(async (resolve, reject) => {
    try {
      const customer = await pool.query('SELECT phone_number FROM customers WHERE id = $1', [customerId]);
      if (customer.rows.length === 0) {
        resolve([]);
        return;
      }
      
      const result = await pool.query(
        'SELECT * FROM ride_requests WHERE phone_number = $1 ORDER BY created_at DESC',
        [customer.rows[0].phone_number]
      );
      resolve(result.rows);
    } catch (err) {
      reject(err);
    }
  });
}

// Delete customer
function deleteCustomer(id) {
  return new Promise(async (resolve, reject) => {
    try {
      const result = await pool.query('DELETE FROM customers WHERE id = $1 RETURNING *', [id]);
      resolve({ id, deleted: result.rowCount > 0 });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  pool,
  createRideRequest,
  getAllRideRequests,
  getRideRequestById,
  updateRideRequestStatus,
  // Admin user functions
  createAdminUser,
  getAdminUserByUsername,
  getAdminUserById,
  getAllAdminUsers,
  updateAdminUser,
  updateLastLogin,
  deleteAdminUser,
  // Activity log functions
  createActivityLog,
  getActivityLogs,
  getActivityLogsByUser,
  getActivityLogsByRideRequest,
  // Customer functions
  upsertCustomer,
  getAllCustomers,
  getCustomerByPhone,
  getCustomerById,
  updateCustomer,
  updateCustomerStats,
  getCustomerRideHistory,
  deleteCustomer
};
