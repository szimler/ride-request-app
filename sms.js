const twilio = require('twilio');

// Try to load config from config.js, fallback to environment variables
let config;
try {
  config = require('./config');
} catch (err) {
  config = {
    TWILIO_ACCOUNT_SID: process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: process.env.TWILIO_PHONE_NUMBER,
    BUSINESS_PHONE_NUMBER: process.env.BUSINESS_PHONE_NUMBER
  };
}

// Initialize Twilio client
let twilioClient = null;

function initializeTwilio() {
  if (config.TWILIO_ACCOUNT_SID && config.TWILIO_AUTH_TOKEN) {
    try {
      twilioClient = twilio(config.TWILIO_ACCOUNT_SID, config.TWILIO_AUTH_TOKEN);
      console.log('✓ Twilio SMS service initialized');
      return true;
    } catch (err) {
      console.error('⚠ Error initializing Twilio:', err.message);
      return false;
    }
  } else {
    console.warn('⚠ Twilio credentials not configured. SMS sending disabled.');
    return false;
  }
}

// Send initial confirmation SMS to customer
async function sendConfirmationSMS(phoneNumber, name) {
  if (!twilioClient) {
    console.log('SMS not sent - Twilio not configured');
    return { success: false, message: 'SMS service not configured' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `Hi ${name}! Thank you for your ride request. We have received your information and will contact you ASAP to confirm your ride.`,
      from: config.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`✓ Confirmation SMS sent to ${phoneNumber} (SID: ${message.sid})`);
    return { success: true, messageSid: message.sid };
  } catch (err) {
    console.error('Error sending SMS:', err.message);
    return { success: false, error: err.message };
  }
}

// Send status update SMS to customer
async function sendStatusUpdateSMS(phoneNumber, name, status, rideDetails) {
  if (!twilioClient) {
    console.log('Status update SMS not sent - Twilio not configured');
    return { success: false, message: 'SMS service not configured' };
  }

  let messageBody = '';
  
  switch(status) {
    case 'quoted':
      let quoteMsg = `Hi ${name}! Your ride quote is $${rideDetails.quotePrice} for ${rideDetails.date} at ${rideDetails.time} (${rideDetails.pickup} → ${rideDetails.dropoff}).`;
      
      if (rideDetails.pickupEta) {
        quoteMsg += ` I can pick you up in approximately ${rideDetails.pickupEta} minutes.`;
      }
      
      if (rideDetails.rideDuration) {
        quoteMsg += ` The ride will take about ${rideDetails.rideDuration} minutes.`;
      }
      
      quoteMsg += ` Reply YES to confirm or NO to decline. We'll contact you shortly!`;
      messageBody = quoteMsg;
      break;
    
    case 'confirmed':
      let confirmMsg = `Great news, ${name}! Your ride is CONFIRMED for ${rideDetails.date} at ${rideDetails.time}. Price: $${rideDetails.quotePrice || 'TBD'}.`;
      
      if (rideDetails.pickupEta) {
        confirmMsg += ` I'll arrive in approximately ${rideDetails.pickupEta} minutes.`;
      }
      
      if (rideDetails.rideDuration) {
        confirmMsg += ` Trip duration: about ${rideDetails.rideDuration} minutes.`;
      }
      
      confirmMsg += ` Pickup location: ${rideDetails.pickup}. See you then!`;
      messageBody = confirmMsg;
      break;
    
    case 'declined':
      messageBody = `Hi ${name}, no problem! We've noted that you've declined the ride for ${rideDetails.date} at ${rideDetails.time}. Feel free to contact us anytime for future rides. Thank you!`;
      break;
    
    case 'not_available':
      messageBody = `Hi ${name}, we're sorry but we're not available for your requested time (${rideDetails.date} at ${rideDetails.time}). Please call us to arrange an alternative time. Thank you for understanding!`;
      break;
    
    case 'completed':
      messageBody = `Thank you for riding with us, ${name}! We hope you had a great experience. We look forward to serving you again!`;
      break;
    
    case 'cancelled':
      messageBody = `Hi ${name}, your ride for ${rideDetails.date} at ${rideDetails.time} has been cancelled. If you have any questions, please contact us.`;
      break;
    
    default:
      return { success: false, message: 'Invalid status' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: config.TWILIO_PHONE_NUMBER,
      to: phoneNumber
    });

    console.log(`✓ Status update SMS sent to ${phoneNumber} - Status: ${status} (SID: ${message.sid})`);
    return { success: true, messageSid: message.sid };
  } catch (err) {
    console.error('Error sending status update SMS:', err.message);
    return { success: false, error: err.message };
  }
}

// Send notification SMS to business
async function sendBusinessNotification(rideRequest) {
  if (!twilioClient || !config.BUSINESS_PHONE_NUMBER) {
    console.log('Business notification not sent - Not configured');
    return { success: false, message: 'Business notification not configured' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `New Ride Request!\n\nName: ${rideRequest.name}\nPhone: ${rideRequest.phone_number}\nPickup: ${rideRequest.pickup_location}\nDropoff: ${rideRequest.dropoff_location}\nDate: ${rideRequest.requested_date}\nTime: ${rideRequest.requested_time}`,
      from: config.TWILIO_PHONE_NUMBER,
      to: config.BUSINESS_PHONE_NUMBER
    });

    console.log(`✓ Business notification sent (SID: ${message.sid})`);
    return { success: true, messageSid: message.sid };
  } catch (err) {
    console.error('Error sending business notification:', err.message);
    return { success: false, error: err.message };
  }
}

// Send ride details SMS to driver
async function sendDriverNotification(rideRequest) {
  if (!twilioClient || !config.DRIVER_PHONE_NUMBER) {
    console.log('Driver notification not sent - Not configured');
    return { success: false, message: 'Driver phone not configured' };
  }

  try {
    const message = await twilioClient.messages.create({
      body: `🚕 NEW CONFIRMED RIDE!\n\nCustomer: ${rideRequest.name}\nPhone: ${rideRequest.phone_number}\n\nPickup: ${rideRequest.pickup_location}\nDropoff: ${rideRequest.dropoff_location}\n\nDate: ${rideRequest.requested_date}\nTime: ${rideRequest.requested_time}\n\nPrice: $${rideRequest.quote_price}\n${rideRequest.pickup_eta_minutes ? `Your ETA: ${rideRequest.pickup_eta_minutes} min\n` : ''}${rideRequest.ride_duration_minutes ? `Ride Duration: ${rideRequest.ride_duration_minutes} min\n` : ''}${rideRequest.distance_miles ? `Distance: ${rideRequest.distance_miles.toFixed(1)} miles` : ''}`,
      from: config.TWILIO_PHONE_NUMBER,
      to: config.DRIVER_PHONE_NUMBER
    });

    console.log(`✓ Driver notification sent to ${config.DRIVER_PHONE_NUMBER} (SID: ${message.sid})`);
    return { success: true, messageSid: message.sid };
  } catch (err) {
    console.error('Error sending driver notification:', err.message);
    return { success: false, error: err.message };
  }
}

module.exports = {
  initializeTwilio,
  sendConfirmationSMS,
  sendBusinessNotification,
  sendStatusUpdateSMS,
  sendDriverNotification
};

