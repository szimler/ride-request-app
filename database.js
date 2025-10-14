const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const dbPath = path.join(__dirname, 'ride_requests.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('✓ Connected to SQLite database');
    initializeDatabase();
  }
});

// Initialize database tables
function initializeDatabase() {
  db.run(`
    CREATE TABLE IF NOT EXISTS ride_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      pickup_location TEXT NOT NULL,
      dropoff_location TEXT NOT NULL,
      requested_date TEXT NOT NULL,
      requested_time TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      quote_price REAL,
      pickup_eta_minutes INTEGER,
      ride_duration_minutes INTEGER,
      distance_miles REAL,
      duration_minutes REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT
    )
  `, (err) => {
    if (err) {
      console.error('Error creating table:', err.message);
    } else {
      console.log('✓ Database table ready');
      // Add new columns if they don't exist (for existing databases)
      db.run(`ALTER TABLE ride_requests ADD COLUMN quote_price REAL`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Note: Could not add quote_price column (may already exist)');
        }
      });
      db.run(`ALTER TABLE ride_requests ADD COLUMN pickup_eta_minutes INTEGER`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Note: Could not add pickup_eta_minutes column (may already exist)');
        }
      });
      db.run(`ALTER TABLE ride_requests ADD COLUMN ride_duration_minutes INTEGER`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Note: Could not add ride_duration_minutes column (may already exist)');
        }
      });
      db.run(`ALTER TABLE ride_requests ADD COLUMN distance_miles REAL`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Note: Could not add distance_miles column (may already exist)');
        }
      });
      db.run(`ALTER TABLE ride_requests ADD COLUMN duration_minutes REAL`, (alterErr) => {
        if (alterErr && !alterErr.message.includes('duplicate column')) {
          console.error('Note: Could not add duration_minutes column (may already exist)');
        }
      });
    }
  });
}

// Insert a new ride request
function createRideRequest(requestData) {
  return new Promise((resolve, reject) => {
    const { name, phone_number, pickup_location, dropoff_location, requested_date, requested_time } = requestData;
    
    const sql = `
      INSERT INTO ride_requests (name, phone_number, pickup_location, dropoff_location, requested_date, requested_time)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    db.run(sql, [name, phone_number, pickup_location, dropoff_location, requested_date, requested_time], function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({
          id: this.lastID,
          ...requestData
        });
      }
    });
  });
}

// Get all ride requests
function getAllRideRequests() {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM ride_requests ORDER BY created_at DESC', [], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

// Get a single ride request by ID
function getRideRequestById(id) {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM ride_requests WHERE id = ?', [id], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

// Update ride request status
function updateRideRequestStatus(id, status, quotePrice = null, pickupEta = null, rideDuration = null, distanceMiles = null, durationMinutes = null) {
  return new Promise((resolve, reject) => {
    let sql, params;
    
    if (quotePrice !== null) {
      sql = 'UPDATE ride_requests SET status = ?, quote_price = ?, pickup_eta_minutes = ?, ride_duration_minutes = ?, distance_miles = ?, duration_minutes = ? WHERE id = ?';
      params = [status, quotePrice, pickupEta, rideDuration, distanceMiles, durationMinutes, id];
    } else {
      sql = 'UPDATE ride_requests SET status = ? WHERE id = ?';
      params = [status, id];
    }
    
    db.run(sql, params, function(err) {
      if (err) {
        reject(err);
      } else {
        resolve({ id, status, quotePrice, pickupEta, rideDuration, distanceMiles, durationMinutes, changes: this.changes });
      }
    });
  });
}

module.exports = {
  db,
  createRideRequest,
  getAllRideRequests,
  getRideRequestById,
  updateRideRequestStatus
};

