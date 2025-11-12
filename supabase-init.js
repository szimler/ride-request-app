const { Pool } = require('pg');
const bcrypt = require('bcrypt');
require('dotenv').config();

// This script initializes the Supabase database with all necessary tables

async function initializeSupabase() {
  console.log('\n🚀 Initializing Supabase Database...\n');
  
  // Connect to Supabase
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });
  
  try {
    const client = await pool.connect();
    console.log('✓ Connected to Supabase PostgreSQL');
    
    // Create ride_requests table
    console.log('Creating ride_requests table...');
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
        service_type TEXT DEFAULT 'regular',
        hours_needed INTEGER,
        start_time TEXT,
        estimated_total DECIMAL(10, 2),
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log('✓ ride_requests table created');
    
    // Create admin_users table
    console.log('Creating admin_users table...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS admin_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT,
        role TEXT DEFAULT 'admin',
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP
      )
    `);
    console.log('✓ admin_users table created');
    
    // Create activity_logs table
    console.log('Creating activity_logs table...');
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES admin_users(id)
      )
    `);
    console.log('✓ activity_logs table created');
    
    // Check if default admin user exists
    const userCheck = await client.query(
      'SELECT COUNT(*) as count FROM admin_users WHERE username = $1',
      ['admin']
    );
    
    if (userCheck.rows[0].count === 0) {
      console.log('Creating default admin user...');
      const defaultPassword = 'admin123';
      const passwordHash = await bcrypt.hash(defaultPassword, 10);
      
      await client.query(`
        INSERT INTO admin_users (username, password_hash, full_name, role)
        VALUES ($1, $2, $3, $4)
      `, ['admin', passwordHash, 'Default Admin', 'super_admin']);
      
      console.log('✓ Default admin user created (username: admin, password: admin123)');
    } else {
      console.log('✓ Default admin user already exists');
    }
    
    // Get table counts
    const requestsCount = await client.query('SELECT COUNT(*) as count FROM ride_requests');
    const usersCount = await client.query('SELECT COUNT(*) as count FROM admin_users');
    const logsCount = await client.query('SELECT COUNT(*) as count FROM activity_logs');
    
    console.log('\n📊 Database Statistics:');
    console.log(`   Ride Requests: ${requestsCount.rows[0].count}`);
    console.log(`   Admin Users: ${usersCount.rows[0].count}`);
    console.log(`   Activity Logs: ${logsCount.rows[0].count}`);
    
    console.log('\n✅ Supabase database initialized successfully!\n');
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('\n❌ Error initializing Supabase:', error.message);
    console.error('Full error:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run initialization
initializeSupabase();

