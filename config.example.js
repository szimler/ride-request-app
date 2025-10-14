// Copy this file to config.js and fill in your actual credentials
module.exports = {
  PORT: 3000,
  
  // Twilio SMS Configuration (Get these from https://www.twilio.com/console)
  TWILIO_ACCOUNT_SID: 'your_account_sid_here',
  TWILIO_AUTH_TOKEN: 'your_auth_token_here',
  TWILIO_PHONE_NUMBER: '+1234567890', // Your Twilio phone number
  
  // Optional: Your business phone number (if you want SMS notifications to yourself)
  // Leave empty or comment out if you only want to use the web dashboard
  BUSINESS_PHONE_NUMBER: '+1234567890',
  
  // Driver phone number (receives ride confirmation details)
  DRIVER_PHONE_NUMBER: '+1234567890',  // Driver's phone for confirmed rides
  
  // Google Maps API Configuration (Get from https://console.cloud.google.com/)
  // Enables automatic distance/time calculation and price suggestions
  GOOGLE_MAPS_API_KEY: 'your_google_maps_api_key_here',
  
  // Admin Dashboard Credentials
  // ⚠️ IMPORTANT: Change these for security!
  ADMIN_USERNAME: 'admin',
  ADMIN_PASSWORD: 'admin123'  // Use a strong password!
};

