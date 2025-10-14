#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n═══════════════════════════════════════════════════════════');
console.log('  🚕 RIDE REQUEST APP - EASY SETUP');
console.log('═══════════════════════════════════════════════════════════\n');

// Load existing config if it exists
let existingConfig = {};
try {
  existingConfig = require('./config');
  console.log('✓ Found existing config.js - will update it\n');
} catch (err) {
  console.log('Creating new config.js...\n');
}

const config = {
  PORT: existingConfig.PORT || 3000,
  TWILIO_ACCOUNT_SID: existingConfig.TWILIO_ACCOUNT_SID || '',
  TWILIO_AUTH_TOKEN: existingConfig.TWILIO_AUTH_TOKEN || '',
  TWILIO_PHONE_NUMBER: existingConfig.TWILIO_PHONE_NUMBER || '',
  BUSINESS_PHONE_NUMBER: existingConfig.BUSINESS_PHONE_NUMBER || '',
  GOOGLE_MAPS_API_KEY: existingConfig.GOOGLE_MAPS_API_KEY || '',
  ADMIN_USERNAME: existingConfig.ADMIN_USERNAME || 'admin',
  ADMIN_PASSWORD: existingConfig.ADMIN_PASSWORD || 'admin123'
};

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    
    let password = '';
    process.stdout.write(prompt);
    
    const onData = (char) => {
      char = char.toString('utf8');
      
      switch (char) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          break;
        case '\u0003':
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(prompt + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          process.stdout.write('*');
          break;
      }
    };
    
    stdin.on('data', onData);
  });
}

async function setup() {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 1: Admin Dashboard Login');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const changeAdmin = await question(`Current admin username: "${config.ADMIN_USERNAME}"\nDo you want to change it? (y/n): `);
  
  if (changeAdmin.toLowerCase() === 'y') {
    const username = await question('Enter new admin username: ');
    if (username.trim()) {
      config.ADMIN_USERNAME = username.trim();
    }
  }
  
  const changePassword = await question('\nDo you want to change the admin password? (y/n): ');
  
  if (changePassword.toLowerCase() === 'y') {
    const password1 = await questionHidden('Enter new password: ');
    const password2 = await questionHidden('Confirm password: ');
    
    if (password1 === password2) {
      if (password1.length < 6) {
        console.log('⚠️  Warning: Password is short. Consider using at least 6 characters.');
      }
      config.ADMIN_PASSWORD = password1;
      console.log('✓ Password updated successfully!');
    } else {
      console.log('✗ Passwords do not match. Keeping existing password.');
    }
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 2: Twilio SMS (Optional)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const setupTwilio = await question('Do you want to configure Twilio SMS? (y/n): ');
  
  if (setupTwilio.toLowerCase() === 'y') {
    console.log('\nGet your credentials from: https://www.twilio.com/console\n');
    
    const accountSid = await question(`Account SID [${config.TWILIO_ACCOUNT_SID ? 'configured' : 'empty'}]: `);
    if (accountSid.trim()) config.TWILIO_ACCOUNT_SID = accountSid.trim();
    
    const authToken = await questionHidden(`Auth Token [${config.TWILIO_AUTH_TOKEN ? 'configured' : 'empty'}]: `);
    if (authToken.trim()) config.TWILIO_AUTH_TOKEN = authToken.trim();
    
    const twilioPhone = await question(`Twilio Phone Number [${config.TWILIO_PHONE_NUMBER || 'empty'}]: `);
    if (twilioPhone.trim()) config.TWILIO_PHONE_NUMBER = twilioPhone.trim();
    
    const businessPhone = await question(`Your business phone (optional) [${config.BUSINESS_PHONE_NUMBER || 'empty'}]: `);
    if (businessPhone.trim()) config.BUSINESS_PHONE_NUMBER = businessPhone.trim();
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 3: Google Maps Auto-Pricing (Optional)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const setupMaps = await question('Do you want to configure Google Maps? (y/n): ');
  
  if (setupMaps.toLowerCase() === 'y') {
    console.log('\nGet API key from: https://console.cloud.google.com/');
    console.log('Enable: Distance Matrix API\n');
    
    const mapsKey = await question(`Google Maps API Key [${config.GOOGLE_MAPS_API_KEY ? 'configured' : 'empty'}]: `);
    if (mapsKey.trim()) config.GOOGLE_MAPS_API_KEY = mapsKey.trim();
  }
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  STEP 4: Server Port (Optional)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const changePort = await question(`Current port: ${config.PORT}\nDo you want to change it? (y/n): `);
  
  if (changePort.toLowerCase() === 'y') {
    const port = await question('Enter new port number: ');
    const portNum = parseInt(port);
    if (!isNaN(portNum) && portNum > 0 && portNum < 65536) {
      config.PORT = portNum;
    } else {
      console.log('Invalid port number. Keeping current port.');
    }
  }
  
  // Save config
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Saving Configuration...');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  const configContent = `// Ride Request App Configuration
// Generated by setup script

module.exports = {
  // Server Configuration
  PORT: ${config.PORT},
  
  // Twilio SMS Configuration
  // Get from: https://www.twilio.com/console
  TWILIO_ACCOUNT_SID: '${config.TWILIO_ACCOUNT_SID}',
  TWILIO_AUTH_TOKEN: '${config.TWILIO_AUTH_TOKEN}',
  TWILIO_PHONE_NUMBER: '${config.TWILIO_PHONE_NUMBER}',
  
  // Your business phone (optional - for SMS notifications to you)
  BUSINESS_PHONE_NUMBER: '${config.BUSINESS_PHONE_NUMBER}',
  
  // Google Maps API Configuration
  // Get from: https://console.cloud.google.com/
  // Enable: Distance Matrix API
  GOOGLE_MAPS_API_KEY: '${config.GOOGLE_MAPS_API_KEY}',
  
  // Admin Dashboard Credentials
  ADMIN_USERNAME: '${config.ADMIN_USERNAME}',
  ADMIN_PASSWORD: '${config.ADMIN_PASSWORD}'
};
`;
  
  fs.writeFileSync(path.join(__dirname, 'config.js'), configContent, 'utf8');
  
  console.log('✓ Configuration saved to config.js\n');
  
  // Summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Configuration Summary');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log(`Server Port:        ${config.PORT}`);
  console.log(`Admin Username:     ${config.ADMIN_USERNAME}`);
  console.log(`Admin Password:     ${'*'.repeat(config.ADMIN_PASSWORD.length)}`);
  console.log(`Twilio SMS:         ${config.TWILIO_ACCOUNT_SID ? '✓ Configured' : '✗ Not configured'}`);
  console.log(`Google Maps:        ${config.GOOGLE_MAPS_API_KEY ? '✓ Configured' : '✗ Not configured'}`);
  
  console.log('\n═══════════════════════════════════════════════════════════');
  console.log('  Next Steps');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('1. Start the server:');
  console.log('   npm start\n');
  
  console.log('2. Access the app:');
  console.log(`   Customer form:  http://localhost:${config.PORT}`);
  console.log(`   Admin dashboard: http://localhost:${config.PORT}/admin\n`);
  
  console.log('3. Login credentials:');
  console.log(`   Username: ${config.ADMIN_USERNAME}`);
  console.log(`   Password: ${config.ADMIN_PASSWORD}\n`);
  
  if (!config.TWILIO_ACCOUNT_SID) {
    console.log('⚠️  Note: Twilio not configured. SMS sending disabled.');
    console.log('   Run setup again to configure: node setup.js\n');
  }
  
  if (!config.GOOGLE_MAPS_API_KEY) {
    console.log('⚠️  Note: Google Maps not configured. Auto-pricing disabled.');
    console.log('   You can still enter prices manually.\n');
  }
  
  console.log('═══════════════════════════════════════════════════════════\n');
  
  rl.close();
}

setup().catch(err => {
  console.error('Error during setup:', err);
  rl.close();
  process.exit(1);
});


