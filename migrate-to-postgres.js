/**
 * Migration Script: SQLite to PostgreSQL
 * 
 * This script transfers all data from your local SQLite database
 * to the new PostgreSQL database on Supabase.
 * 
 * USAGE: node migrate-to-postgres.js
 */

require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const path = require('path');

// SQLite connection (source)
const sqliteDbPath = path.join(__dirname, 'ride_requests.db');
const sqliteDb = new sqlite3.Database(sqliteDbPath);

// PostgreSQL connection (destination)
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

console.log('🔄 Starting migration from SQLite to PostgreSQL...\n');

async function migrateRideRequests() {
  return new Promise((resolve, reject) => {
    console.log('📋 Migrating ride requests...');
    
    sqliteDb.all('SELECT * FROM ride_requests', [], async (err, rows) => {
      if (err) {
        console.error('❌ Error reading SQLite ride_requests:', err);
        reject(err);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('   ℹ️  No ride requests to migrate');
        resolve(0);
        return;
      }

      let migratedCount = 0;
      
      for (const row of rows) {
        try {
          await pgPool.query(`
            INSERT INTO ride_requests (
              name, phone_number, pickup_location, dropoff_location,
              requested_date, requested_time, status, quote_price,
              pickup_eta_minutes, ride_duration_minutes, distance_miles,
              duration_minutes, service_type, hours_needed, start_time,
              estimated_total, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          `, [
            row.name,
            row.phone_number,
            row.pickup_location,
            row.dropoff_location,
            row.requested_date,
            row.requested_time,
            row.status || 'pending',
            row.quote_price || null,
            row.pickup_eta_minutes || null,
            row.ride_duration_minutes || null,
            row.distance_miles || null,
            row.duration_minutes || null,
            row.service_type || 'regular',
            row.hours_needed || null,
            row.start_time || null,
            row.estimated_total || null,
            row.notes || null,
            row.created_at || new Date().toISOString()
          ]);
          migratedCount++;
        } catch (insertErr) {
          console.error(`   ⚠️  Error migrating ride request ID ${row.id}:`, insertErr.message);
        }
      }

      console.log(`   ✅ Migrated ${migratedCount} ride requests`);
      resolve(migratedCount);
    });
  });
}

async function migrateAdminUsers() {
  return new Promise((resolve, reject) => {
    console.log('\n👥 Migrating admin users...');
    
    sqliteDb.all('SELECT * FROM admin_users', [], async (err, rows) => {
      if (err) {
        console.error('❌ Error reading SQLite admin_users:', err);
        reject(err);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('   ℹ️  No admin users to migrate (default admin will be created)');
        resolve(0);
        return;
      }

      let migratedCount = 0;
      
      for (const row of rows) {
        try {
          // Check if user already exists
          const existing = await pgPool.query(
            'SELECT id FROM admin_users WHERE username = $1',
            [row.username]
          );

          if (existing.rows.length > 0) {
            console.log(`   ℹ️  Admin user '${row.username}' already exists, skipping...`);
            continue;
          }

          await pgPool.query(`
            INSERT INTO admin_users (
              username, password_hash, full_name, email, role,
              is_active, created_at, last_login
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            row.username,
            row.password_hash,
            row.full_name,
            row.email || null,
            row.role || 'admin',
            row.is_active !== undefined ? row.is_active : 1,
            row.created_at || new Date().toISOString(),
            row.last_login || null
          ]);
          migratedCount++;
          console.log(`   ✅ Migrated admin user: ${row.username}`);
        } catch (insertErr) {
          console.error(`   ⚠️  Error migrating admin user '${row.username}':`, insertErr.message);
        }
      }

      console.log(`   ✅ Migrated ${migratedCount} admin users`);
      resolve(migratedCount);
    });
  });
}

async function migrateActivityLogs() {
  return new Promise((resolve, reject) => {
    console.log('\n📊 Migrating activity logs...');
    
    sqliteDb.all('SELECT * FROM activity_logs', [], async (err, rows) => {
      if (err) {
        // Table might not exist in older versions
        if (err.message.includes('no such table')) {
          console.log('   ℹ️  No activity_logs table found (skipping)');
          resolve(0);
          return;
        }
        console.error('❌ Error reading SQLite activity_logs:', err);
        reject(err);
        return;
      }

      if (!rows || rows.length === 0) {
        console.log('   ℹ️  No activity logs to migrate');
        resolve(0);
        return;
      }

      let migratedCount = 0;
      
      for (const row of rows) {
        try {
          await pgPool.query(`
            INSERT INTO activity_logs (
              user_id, username, action, target_type, target_id,
              details, ip_address, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            row.user_id,
            row.username,
            row.action,
            row.target_type || null,
            row.target_id || null,
            row.details || null,
            row.ip_address || null,
            row.created_at || new Date().toISOString()
          ]);
          migratedCount++;
        } catch (insertErr) {
          console.error(`   ⚠️  Error migrating activity log ID ${row.id}:`, insertErr.message);
        }
      }

      console.log(`   ✅ Migrated ${migratedCount} activity logs`);
      resolve(migratedCount);
    });
  });
}

async function runMigration() {
  try {
    // Test PostgreSQL connection
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful\n');

    // Run migrations
    const rideRequestsCount = await migrateRideRequests();
    const adminUsersCount = await migrateAdminUsers();
    const activityLogsCount = await migrateActivityLogs();

    console.log('\n' + '='.repeat(50));
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`📋 Total ride requests migrated: ${rideRequestsCount}`);
    console.log(`👥 Total admin users migrated: ${adminUsersCount}`);
    console.log(`📊 Total activity logs migrated: ${activityLogsCount}`);
    console.log('='.repeat(50));
    console.log('\n✨ Your data is now in PostgreSQL on Supabase!');
    console.log('📝 Your local SQLite database remains unchanged as a backup.\n');

  } catch (err) {
    console.error('\n❌ MIGRATION FAILED:', err);
    process.exit(1);
  } finally {
    // Close connections
    sqliteDb.close();
    await pgPool.end();
  }
}

// Run the migration
runMigration();


