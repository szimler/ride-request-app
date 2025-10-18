// Manual Price Calculator (No Google Maps Required)
// Uses estimated distances between common Jacksonville locations

const commonRoutes = {
  // Jacksonville to Beaches
  'jacksonville_to_jax_beach': { miles: 15, minutes: 20 },
  'jacksonville_to_atlantic_beach': { miles: 14, minutes: 18 },
  'jacksonville_to_neptune_beach': { miles: 15, minutes: 19 },
  'jacksonville_to_ponte_vedra': { miles: 20, minutes: 25 },
  
  // Jacksonville to Airport
  'jacksonville_to_airport': { miles: 12, minutes: 18 },
  'jax_beach_to_airport': { miles: 25, minutes: 30 },
  
  // Jacksonville to North
  'jacksonville_to_fernandina': { miles: 30, minutes: 35 },
  'jacksonville_to_yulee': { miles: 25, minutes: 30 },
  
  // Jacksonville to South
  'jacksonville_to_st_augustine': { miles: 45, minutes: 50 },
  'jacksonville_to_palatka': { miles: 50, minutes: 55 },
  
  // Jacksonville to West
  'jacksonville_to_orange_park': { miles: 12, minutes: 18 },
  'jacksonville_to_middleburg': { miles: 25, minutes: 30 },
  
  // Medical Centers
  'any_to_mayo_clinic': { miles: 5, minutes: 10 },
  'any_to_uf_health': { miles: 5, minutes: 10 },
  'any_to_baptist_medical': { miles: 5, minutes: 10 },
};

// Estimate distance based on cities
function estimateDistance(pickupCity, dropoffCity) {
  const pickup = pickupCity.toLowerCase().replace(/[^a-z]/g, '');
  const dropoff = dropoffCity.toLowerCase().replace(/[^a-z]/g, '');
  
  // Check for airport
  if (dropoff.includes('airport') || dropoff.includes('jax')) {
    if (pickup.includes('beach')) return { miles: 25, minutes: 30 };
    return { miles: 12, minutes: 18 };
  }
  
  // Check for medical centers
  if (dropoff.includes('mayo') || dropoff.includes('health') || dropoff.includes('baptist')) {
    return { miles: 5, minutes: 10 };
  }
  
  // Check for beach destinations
  if (dropoff.includes('beach')) {
    if (pickup.includes('jacksonville') && !pickup.includes('beach')) {
      return { miles: 15, minutes: 20 };
    }
    if (pickup.includes('beach')) {
      return { miles: 3, minutes: 8 }; // Beach to beach
    }
  }
  
  // Check for St. Augustine
  if (dropoff.includes('augustine') || pickup.includes('augustine')) {
    return { miles: 45, minutes: 50 };
  }
  
  // Check for Fernandina/Yulee
  if (dropoff.includes('fernandina') || dropoff.includes('yulee')) {
    return { miles: 28, minutes: 33 };
  }
  
  // Check for Orange Park/Middleburg
  if (dropoff.includes('orange') || dropoff.includes('middleburg')) {
    return { miles: 15, minutes: 20 };
  }
  
  // Default: Assume within Jacksonville area
  return { miles: 8, minutes: 15 };
}

// Calculate price based on YOUR formula
function calculatePrice(miles, minutes) {
  let price, calculation, tripType;
  
  // Three-tier pricing structure
  const isShortTrip = miles < 5 || minutes < 7;
  const isMediumTrip = miles >= 5 && miles <= 15;
  const isLongTrip = miles > 15;
  
  if (isShortTrip) {
    // SHORT TRIPS: < 5 miles OR < 7 minutes
    // $1.50/mile or $1.25/minute (whichever is greater), MINIMUM $6.00
    const priceByMiles = miles * 1.50;
    const priceByTime = minutes * 1.25;
    
    if (priceByMiles > priceByTime) {
      price = priceByMiles;
      calculation = `${miles.toFixed(1)} miles × $1.50 = $${priceByMiles.toFixed(2)}`;
    } else {
      price = priceByTime;
      calculation = `${minutes} min × $1.25 = $${priceByTime.toFixed(2)}`;
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
    const basePrice = miles * 1.00;
    price = basePrice * 1.3;
    calculation = `${miles.toFixed(1)} miles × $1.00 × 1.3 = $${price.toFixed(2)}`;
    tripType = 'medium';
    
  } else {
    // LONG TRIPS: > 15 miles
    // $0.75/mile × 1.2
    const basePrice = miles * 0.75;
    price = basePrice * 1.2;
    calculation = `${miles.toFixed(1)} miles × $0.75 × 1.2 = $${price.toFixed(2)}`;
    tripType = 'long';
  }
  
  // Round to nearest $0.50
  const roundedPrice = Math.ceil(price * 2) / 2;
  
  return {
    estimatedMiles: miles,
    estimatedMinutes: minutes,
    suggestedPrice: parseFloat(roundedPrice.toFixed(2)),
    exactPrice: parseFloat(price.toFixed(2)),
    calculation: calculation,
    tripType: tripType
  };
}

// Main function to get quote
function getManualQuote(pickupLocation, dropoffLocation) {
  // Extract city names (assumes format: "Address, City, FL")
  const pickupCity = pickupLocation.split(',').slice(-2, -1)[0]?.trim() || pickupLocation;
  const dropoffCity = dropoffLocation.split(',').slice(-2, -1)[0]?.trim() || dropoffLocation;
  
  // Estimate distance
  const estimated = estimateDistance(pickupCity, dropoffCity);
  
  // Calculate price
  const pricing = calculatePrice(estimated.miles, estimated.minutes);
  
  return {
    success: true,
    isEstimated: true,
    route: {
      distance: {
        miles: estimated.miles,
        text: `~${estimated.miles} miles`
      },
      duration: {
        minutes: estimated.minutes,
        text: `~${estimated.minutes} minutes`
      },
      origin: pickupLocation,
      destination: dropoffLocation
    },
    pricing: pricing,
    note: 'Estimated distance (not using Google Maps)'
  };
}

module.exports = {
  getManualQuote,
  calculatePrice,
  estimateDistance
};

