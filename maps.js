// Google Maps Distance Matrix API integration

let config;
try {
  config = require('./config');
} catch (err) {
  config = {
    GOOGLE_MAPS_API_KEY: process.env.GOOGLE_MAPS_API_KEY
  };
}

// Calculate distance and time between two locations
async function getDistanceAndTime(origin, destination) {
  if (!config.GOOGLE_MAPS_API_KEY) {
    console.warn('⚠ Google Maps API key not configured - Using fallback estimator');
    return { success: false, message: 'Google Maps not configured' };
  }
  
  console.log(`🗺️ Calling Google Maps API for: ${origin} → ${destination}`);

  try {
    const fetch = (await import('node-fetch')).default;
    
    // Build API URL
    const baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
    const params = new URLSearchParams({
      origins: origin,
      destinations: destination,
      mode: 'driving',
      units: 'imperial', // miles
      key: config.GOOGLE_MAPS_API_KEY
    });

    const response = await fetch(`${baseUrl}?${params}`);
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data.status);
      return { 
        success: false, 
        message: `API error: ${data.status}`,
        error: data.error_message 
      };
    }

    const element = data.rows[0].elements[0];

    if (element.status !== 'OK') {
      console.error('Route not found:', element.status);
      return { 
        success: false, 
        message: 'Could not find route between locations' 
      };
    }

    // Extract distance and duration
    const distanceMiles = element.distance.value / 1609.34; // meters to miles
    const durationMinutes = element.duration.value / 60; // seconds to minutes

    console.log(`✅ Google Maps SUCCESS: ${distanceMiles.toFixed(2)} miles, ${durationMinutes.toFixed(1)} minutes (REAL DATA)`);

    return {
      success: true,
      distance: {
        miles: parseFloat(distanceMiles.toFixed(2)),
        text: element.distance.text
      },
      duration: {
        minutes: parseFloat(durationMinutes.toFixed(1)),
        text: element.duration.text
      },
      origin: data.origin_addresses[0],
      destination: data.destination_addresses[0]
    };

  } catch (err) {
    console.error('Error calculating route:', err);
    return { 
      success: false, 
      message: 'Error calculating route',
      error: err.message 
    };
  }
}

// Calculate price based on distance and time
function calculatePrice(distanceMiles, durationMinutes) {
  let price;
  let calculation;
  let tripType;

  // Three-tier pricing structure
  const isShortTrip = distanceMiles < 5 || durationMinutes < 7;
  const isMediumTrip = distanceMiles >= 5 && distanceMiles <= 15;
  const isLongTrip = distanceMiles > 15;

  if (isShortTrip) {
    // SHORT TRIPS: < 5 miles OR < 7 minutes
    // $1.50/mile or $1.25/minute (whichever is greater), MINIMUM $6.00
    const priceByMiles = distanceMiles * 1.50;
    const priceByTime = durationMinutes * 1.25;
    
    if (priceByMiles > priceByTime) {
      price = priceByMiles;
      calculation = `${distanceMiles} miles × $1.50 = $${priceByMiles.toFixed(2)}`;
    } else {
      price = priceByTime;
      calculation = `${durationMinutes} min × $1.25 = $${priceByTime.toFixed(2)}`;
    }
    
    // Enforce minimum of $6.00 for short trips
    if (price < 6.00) {
      price = 6.00;
      calculation = `Minimum fare (${calculation} → $6.00 minimum)`;
    }
    
    tripType = 'short';
    
  } else if (isMediumTrip) {
    // MEDIUM TRIPS: 5-15 miles
    // $1.00/mile × 1.3
    const basePrice = distanceMiles * 1.00;
    price = basePrice * 1.3;
    calculation = `${distanceMiles} miles × $1.00 × 1.3 = $${price.toFixed(2)}`;
    tripType = 'medium';
    
  } else {
    // LONG TRIPS: > 15 miles
    // $0.75/mile × 1.2
    const basePrice = distanceMiles * 0.75;
    price = basePrice * 1.2;
    calculation = `${distanceMiles} miles × $0.75 × 1.2 = $${price.toFixed(2)}`;
    tripType = 'long';
  }

  // Round to nearest dollar or half dollar for cleaner pricing
  const roundedPrice = Math.ceil(price * 2) / 2; // Rounds to nearest $0.50

  return {
    suggestedPrice: parseFloat(roundedPrice.toFixed(2)),
    exactPrice: parseFloat(price.toFixed(2)),
    calculation: calculation,
    tripType: tripType
  };
}

// Get route info and calculate suggested price
async function getRouteAndPrice(origin, destination) {
  // Try Google Maps first
  const routeInfo = await getDistanceAndTime(origin, destination);

  if (!routeInfo.success) {
    // Fallback to manual estimation
    console.log('⚠️ Google Maps FAILED - Using manual estimation (distances are approximate!)');
    try {
      const manualCalc = require('./manual-calculator');
      const manualResult = manualCalc.getManualQuote(origin, destination);
      console.log(`📊 Manual estimate: ${manualResult.route.distance.miles} miles, ${manualResult.route.duration.minutes} minutes`);
      return manualResult;
    } catch (err) {
      console.error('Manual calculator error:', err);
      return routeInfo; // Return the original error
    }
  }

  const pricing = calculatePrice(routeInfo.distance.miles, routeInfo.duration.minutes);

  return {
    success: true,
    isEstimated: false,
    route: {
      distance: routeInfo.distance,
      duration: routeInfo.duration,
      origin: routeInfo.origin,
      destination: routeInfo.destination
    },
    pricing: pricing
  };
}

module.exports = {
  getDistanceAndTime,
  calculatePrice,
  getRouteAndPrice
};

