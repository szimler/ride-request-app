const { Pool } = require('pg');
require('dotenv').config();

// Migration script to move data from Render PostgreSQL to Supabase

async function migrateData() {
  console.log('\n🔄 Migrating Data from Render to Supabase...\n');
  
  // Ask for old database URL
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  const question = (query) => new Promise((resolve) => readline.question(query, resolve));
  
  console.log('Please provide your OLD Render PostgreSQL connection string:');
  console.log('(Find it in Render Dashboard → Your Service → Environment → DATABASE_URL)');
  console.log('Example: postgresql://user:pass@host.render.com:5432/dbname\n');
  
  const oldDatabaseUrl = await question('Old DATABASE_URL: ');
  
  console.log('\nPlease provide your NEW Supabase connection string:');
  console.log('(Find it in Supabase Dashboard → Project Settings → Database → Connection String)');
  console.log('Example: postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres\n');
  
  const newDatabaseUrl = await question('New DATABASE_URL: ');
  
  readline.close();
  
  console.log('\n📊 Connecting to databases...\n');
  
  // Connect to old database
  const oldPool = new Pool({
    connectionString: oldDatabaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  // Connect to new database
  const newPool = new Pool({
    connectionString: newDatabaseUrl,
    ssl: { rejectUnauthorized: false }
  });
  
  try {
    const oldClient = await oldPool.connect();
    const newClient = await newPool.connect();
    
    console.log('✓ Connected to both databases');
    
    // Export ride requests
    console.log('\n📤 Exporting ride requests from Render...');
    const requests = await oldClient.query('SELECT * FROM ride_requests ORDER BY id');
    console.log(`   Found ${requests.rows.length} ride requests`);
    
    // Export admin users
    console.log('📤 Exporting admin users from Render...');
    const users = await oldClient.query('SELECT * FROM admin_users ORDER BY id');
    console.log(`   Found ${users.rows.length} admin users`);
    
    // Export activity logs (if exists)
    let logs = { rows: [] };
    try {
      console.log('📤 Exporting activity logs from Render...');
      logs = await oldClient.query('SELECT * FROM activity_logs ORDER BY id');
      console.log(`   Found ${logs.rows.length} activity logs`);
    } catch (err) {
      console.log('   (No activity logs table found - skipping)');
    }
    
    // Import ride requests
    if (requests.rows.length > 0) {
      console.log('\n📥 Importing ride requests to Supabase...');
      for (const request of requests.rows) {
        await newClient.query(`
          INSERT INTO ride_requests (
            name, phone_number, pickup_location, dropoff_location,
            requested_date, requested_time, status, quote_price,
            pickup_eta_minutes, ride_duration_minutes, distance_miles,
            duration_minutes, service_type, hours_needed, start_time,
            estimated_total, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        `, [
          request.name, request.phone_number, request.pickup_location,
          request.dropoff_location, request.requested_date, request.requested_time,
          request.status, request.quote_price, request.pickup_eta_minutes,
          request.ride_duration_minutes, request.distance_miles, request.duration_minutes,
          request.service_type, request.hours_needed, request.start_time,
          request.estimated_total, request.notes, request.created_at
        ]);
      }
      console.log(`   ✓ Imported ${requests.rows.length} ride requests`);
    }
    
    // Import admin users
    if (users.rows.length > 0) {
      console.log('📥 Importing admin users to Supabase...');
      for (const user of users.rows) {
        try {
          await newClient.query(`
            INSERT INTO admin_users (
              username, password_hash, full_name, email, role, is_active, created_at, last_login
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            user.username, user.password_hash, user.full_name, user.email,
            user.role, user.is_active, user.created_at, user.last_login
          ]);
        } catch (err) {
          if (err.message.includes('duplicate key')) {
            console.log(`   ⚠️  User ${user.username} already exists - skipping`);
          } else {
            throw err;
          }
        }
      }
      console.log(`   ✓ Imported ${users.rows.length} admin users`);
    }
    
    // Import activity logs
    if (logs.rows.length > 0) {
      console.log('📥 Importing activity logs to Supabase...');
      for (const log of logs.rows) {
        await newClient.query(`
          INSERT INTO activity_logs (
            user_id, username, action, target_type, target_id, details, ip_address, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          log.user_id, log.username, log.action, log.target_type,
          log.target_id, log.details, log.ip_address, log.created_at
        ]);
      }
      console.log(`   ✓ Imported ${logs.rows.length} activity logs`);
    }
    
    console.log('\n✅ Migration Complete!\n');
    console.log('Summary:');
    console.log(`   • ${requests.rows.length} ride requests migrated`);
    console.log(`   • ${users.rows.length} admin users migrated`);
    console.log(`   • ${logs.rows.length} activity logs migrated`);
    console.log('\n🎉 Your data is now on Supabase!\n');
    console.log('Next steps:');
    console.log('1. Update DATABASE_URL on Render to use Supabase connection string');
    console.log('2. Redeploy your app on Render');
    console.log('3. Test the website!');
    console.log('\n');
    
    oldClient.release();
    newClient.release();
    await oldPool.end();
    await newPool.end();
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Full error:', error);
    await oldPool.end();
    await newPool.end();
    process.exit(1);
  }
}

// Run migration
migrateData();

