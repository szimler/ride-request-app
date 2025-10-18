# 🗺️ Google Maps APIs Used in This App

## **Summary: YES, They Are Different APIs**

This app uses **TWO different Google Maps APIs**, each with its own purpose, cost, and usage quota.

---

## **1. Google Maps Places API (Autocomplete)**

### **📍 Where It's Used:**
- **Frontend only** (customer ride request form)
- `public/index.html` line 10
- `public/app.js` lines 16-42

### **🎯 Purpose:**
Provides **address autocomplete** as the customer types in the pickup and dropoff address fields.

### **How It Works:**
```javascript
// Loaded in HTML
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_KEY&libraries=places&callback=initAutocomplete"></script>

// Used in JavaScript
pickupAutocomplete = new google.maps.places.Autocomplete(pickupInput, options);
dropoffAutocomplete = new google.maps.places.Autocomplete(dropoffInput, options);
```

### **What The Customer Sees:**
1. Customer starts typing: `"105 Gold..."`
2. Dropdown appears with suggestions:
   - 105 Goldcrest Way, St. Augustine, FL 32092
   - 105 Gold Dr, St. Augustine, FL 32084
   - 105 Golden Eagle Ln, St. Augustine, FL 32086
3. Customer clicks one → address auto-fills

### **Configuration:**
- **Bounds:** Restricted to Northeast Florida (lines 23-26)
- **Component restrictions:** USA only
- **Types:** All address types

### **💰 Cost (Places API - Autocomplete):**
- **Session-based Autocomplete:** $2.83 per 1,000 sessions
- **A "session"** = from when user starts typing until they select an address
- **Free tier:** First $200/month credit (covers ~70,000 sessions)
- **Your usage:** ~100-200 sessions/month = **$0** (well within free tier)

### **API Endpoint:**
```
https://maps.googleapis.com/maps/api/place/autocomplete/json
```

---

## **2. Google Maps Distance Matrix API**

### **📍 Where It's Used:**
- **Backend only** (admin dashboard for pricing calculation)
- `maps.js` lines 13-84

### **🎯 Purpose:**
Calculates **actual driving distance and time** between two addresses to generate accurate pricing.

### **How It Works:**
```javascript
// Called from backend (maps.js)
const baseUrl = 'https://maps.googleapis.com/maps/api/distancematrix/json';
const params = {
  origins: '105 Goldcrest Way, St. Augustine, FL',
  destinations: '525 State Road 16, St. Augustine, FL',
  mode: 'driving',
  units: 'imperial',
  key: YOUR_API_KEY
};

const response = await fetch(`${baseUrl}?${params}`);
```

### **What The Admin Sees:**
1. Admin clicks **"Pre-Quote (Driver)"** or **"Send Quote to Rider"**
2. System sends API request to Google
3. Google calculates:
   - **Distance:** 13.54 miles
   - **Duration:** 22 minutes
   - **Route:** Actual driving route via roads
4. System applies pricing formula
5. Admin sees suggested price: **$18**

### **API Response Example:**
```json
{
  "status": "OK",
  "rows": [{
    "elements": [{
      "distance": {
        "value": 21797,        // meters
        "text": "13.5 mi"
      },
      "duration": {
        "value": 1339,         // seconds
        "text": "22 mins"
      },
      "status": "OK"
    }]
  }],
  "origin_addresses": ["105 Goldcrest Wy, St. Augustine, FL 32092, USA"],
  "destination_addresses": ["525 FL-16, St. Augustine, FL 32084, USA"]
}
```

### **💰 Cost (Distance Matrix API):**
- **Per request:** $5.00 per 1,000 requests
- **Free tier:** First $200/month credit (covers ~40,000 requests)
- **Your usage:** ~100-200 requests/month = **$0** (well within free tier)

### **API Endpoint:**
```
https://maps.googleapis.com/maps/api/distancematrix/json
```

---

## **🔑 Key Differences**

| Feature | Places API (Autocomplete) | Distance Matrix API |
|---------|---------------------------|---------------------|
| **Purpose** | Address suggestions | Route calculation |
| **Where Used** | Frontend (customer form) | Backend (admin pricing) |
| **When Triggered** | As customer types | When admin clicks quote button |
| **What It Returns** | List of address suggestions | Distance, duration, route |
| **Cost per 1,000** | $2.83 | $5.00 |
| **Your Monthly Usage** | ~100-200 sessions | ~100-200 requests |
| **Your Monthly Cost** | $0 (free tier) | $0 (free tier) |
| **File Location** | `public/app.js` | `maps.js` (backend) |
| **API Library** | `&libraries=places` | Native Distance Matrix |

---

## **📊 Combined API Usage Flow**

```
CUSTOMER SIDE (Places API):
┌────────────────────────────────────────────┐
│ 1. Customer types in address field        │
│    ↓                                       │
│ 2. Places API suggests addresses          │
│    ↓                                       │
│ 3. Customer selects suggestion            │
│    ↓                                       │
│ 4. Form field auto-fills                  │
│    ↓                                       │
│ 5. Customer submits form                  │
└────────────────────────────────────────────┘
              ↓
    (Address saved to database)
              ↓
ADMIN SIDE (Distance Matrix API):
┌────────────────────────────────────────────┐
│ 6. Admin clicks "Pre-Quote" or "Quote"    │
│    ↓                                       │
│ 7. Backend calls Distance Matrix API      │
│    ↓                                       │
│ 8. Google calculates actual distance      │
│    ↓                                       │
│ 9. Backend calculates price                │
│    ↓                                       │
│ 10. Admin sees suggested price             │
└────────────────────────────────────────────┘
```

---

## **🔐 API Key Configuration**

### **Current Setup:**
Both APIs use the **SAME API KEY** from `config.js`:

```javascript
// config.js
GOOGLE_MAPS_API_KEY: 'AIzaSyCIMXA0Sfa7y1T_HU0HKDUfZRrQLseJZC4'
```

### **Frontend (Places):**
```html
<!-- public/index.html line 10 -->
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSy...&libraries=places"></script>
```

### **Backend (Distance Matrix):**
```javascript
// maps.js
const params = {
  key: config.GOOGLE_MAPS_API_KEY
};
```

### **⚠️ Security Note:**
- **Frontend API key is PUBLIC** (visible in HTML source)
- **Backend API key is PRIVATE** (hidden in server)
- **Same key is used for both** (for simplicity)
- **Best practice:** Restrict API key in Google Cloud Console:
  - **Places API:** Restrict to your domain (e.g., `ride-request-app.onrender.com`)
  - **Distance Matrix API:** Restrict to server IP address

---

## **💵 Cost Breakdown Example**

### **Scenario: 100 ride requests per month**

| API | Usage | Cost per 1,000 | Total Cost |
|-----|-------|---------------|------------|
| **Places API** | 200 sessions (pickup + dropoff) | $2.83 | $0.57 |
| **Distance Matrix API** | 100 requests (1 per quote) | $5.00 | $0.50 |
| **Total** | | | **$1.07/month** |

### **With Free Tier:**
- Google gives **$200/month free credit**
- Your usage: **$1.07/month**
- **Actual cost: $0** ✅

---

## **🛠️ API Restrictions in Code**

### **Places API (Frontend):**
```javascript
// Restrict to Northeast Florida
const floridaBounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(29.5, -82.5),  // Southwest
    new google.maps.LatLng(30.8, -80.8)   // Northeast
);

const options = {
    bounds: floridaBounds,
    componentRestrictions: { country: 'us' },
    fields: ['formatted_address', 'geometry', 'name']
};
```
**Purpose:** Prevents irrelevant suggestions (e.g., addresses in California)

### **Distance Matrix API (Backend):**
```javascript
const params = {
    mode: 'driving',    // Not walking, bicycling, or transit
    units: 'imperial'   // Miles, not kilometers
};
```
**Purpose:** Ensures accurate driving distances in miles

---

## **🔍 How to Verify Both APIs Are Working**

### **Test Places API (Frontend):**
1. Open customer form: `http://localhost:3000`
2. Start typing in pickup address: `"105 Gold"`
3. **If working:** Dropdown with suggestions appears
4. **If not working:** No suggestions (check browser console for errors)

### **Test Distance Matrix API (Backend):**
1. Open admin dashboard: `http://localhost:3000/admin`
2. Click "Pre-Quote (Driver)" or "Send Quote to Rider"
3. **If working:** Shows "Route calculated: 13.5 miles, $18"
4. **If not working:** Shows "Error calculating route" (check server logs)

### **Terminal Test (Distance Matrix):**
```bash
node -e "const { getRouteAndPrice } = require('./maps.js'); getRouteAndPrice('105 Goldcrest Way, St. Augustine, FL', '525 State Road 16, St. Augustine, FL').then(r => console.log(r));"
```
**Expected output:** Route details with distance, duration, and pricing

---

## **📝 Summary**

### **Two APIs, One Key:**
✅ **Places API (Autocomplete)** → Frontend → Customer types address → Suggestions appear  
✅ **Distance Matrix API** → Backend → Admin clicks quote → Distance/duration/price calculated

### **Both Are Working:**
✅ Places API confirmed (address autocomplete in form)  
✅ Distance Matrix API confirmed (route calculation tested)

### **Cost:**
✅ **$0/month** (both within free tier)  
✅ Free tier covers **70,000 Places sessions + 40,000 Distance Matrix requests**  
✅ Your usage: **~200 Places + ~100 Distance Matrix per month**

### **Files Involved:**
- **Places API:** `public/index.html` (line 10), `public/app.js` (lines 16-42)
- **Distance Matrix API:** `maps.js` (lines 13-84), `server.js` (line 189)

---

**Last Updated:** October 15, 2025  
**API Key Location:** `config.js` (same key for both)  
**Monthly Cost:** $0 (free tier covers all usage)



