// Ride Request App Configuration
// ═══════════════════════════════════════════════════════════
// 
// TO CHANGE PASSWORD: Edit ADMIN_PASSWORD below
// TO CHANGE USERNAME: Edit ADMIN_USERNAME below
// 
// Then restart the server: npm start
// 
// ═══════════════════════════════════════════════════════════

module.exports = {
  // Server Configuration
  PORT: 3000,
  
  // ┌─────────────────────────────────────────────────────────┐
  // │  ADMIN LOGIN - CHANGE THESE!                            │
  // └─────────────────────────────────────────────────────────┘
  ADMIN_USERNAME: 'admin',        // ← Change this to your username
  ADMIN_PASSWORD: 'MySecure2025', // ← Change this to your password!
  
  
  // ┌─────────────────────────────────────────────────────────┐
  // │  TWILIO SMS (Optional)                                  │
  // │  Get credentials from: https://www.twilio.com/console   │
  // └─────────────────────────────────────────────────────────┘
  TWILIO_ACCOUNT_SID: '',         // Skipped - requires A2P registration
  TWILIO_AUTH_TOKEN: '',          // Skipped - requires A2P registration
  TWILIO_PHONE_NUMBER: '',        // Skipped - requires A2P registration
  BUSINESS_PHONE_NUMBER: '',      // Not needed without Twilio
  DRIVER_PHONE_NUMBER: '',        // Not needed without Twilio
  
  
  // ┌─────────────────────────────────────────────────────────┐
  // │  GOOGLE MAPS (Optional)                                 │
  // │  Get API key from: https://console.cloud.google.com/    │
  // │  Enable: Distance Matrix API                            │
  // └─────────────────────────────────────────────────────────┘
  GOOGLE_MAPS_API_KEY: 'AIzaSyCIMXA0Sfa7y1T_HU0HKDUfZRrQLseJZC4'
};

// ═══════════════════════════════════════════════════════════
// SECURITY TIPS:
// ═══════════════════════════════════════════════════════════
// 
// ✓ Use a strong password (8+ characters)
// ✓ Mix letters, numbers, and symbols
// ✓ Don't share this file publicly
// ✓ Change the default password before going live!
// 
// Good passwords:
//   - MyRides2025!
//   - SecureRide#2024
//   - TaxiAdmin$99
// 
// Bad passwords:
//   - password
//   - 123456
//   - admin
// 
// ═══════════════════════════════════════════════════════════

