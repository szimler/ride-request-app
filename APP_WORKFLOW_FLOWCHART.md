# 🚕 Ride Request App - Complete Workflow Flowchart

## **Overview**
This document provides a detailed flowchart of how the ride request application works from end to end.

---

## **📱 PART 1: CUSTOMER JOURNEY**

```
┌─────────────────────────────────────────────────────────────┐
│                    CUSTOMER STARTS HERE                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Customer scans  │
                    │     QR code      │
                    │  or visits URL   │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Opens Rider App         │
                │  (public/index.html)     │
                │                          │
                │  Shows:                  │
                │  • Business card header  │
                │  • Driver photo/info     │
                │  • Service selection     │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │   CUSTOMER CHOOSES:      │
                └──────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  🚗 REGULAR RIDE   │  │ ⏰ DRIVER BY HOUR  │
        └────────────────────┘  └────────────────────┘
                    │                   │
                    ▼                   ▼
```

### **A. REGULAR RIDE FLOW**

```
┌──────────────────────────────────────────────────────────────┐
│              REGULAR RIDE REQUEST FORM                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Customer fills: │
                    │  • Name          │
                    │  • Phone         │
                    │  • Pickup        │◄──── Google Maps Autocomplete
                    │  • Pickup Apt#   │      (places API)
                    │  • Dropoff       │◄──── Google Maps Autocomplete
                    │  • Dropoff Apt#  │
                    │  • Date          │◄──── Date picker (min: today)
                    │  • Time          │◄──── Dropdown or custom
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Clicks SUBMIT   │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Frontend Validation     │
                │  (public/app.js)         │
                │                          │
                │  • All fields required?  │
                │  • Phone format valid?   │
                │  • Date not in past?     │
                └──────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                ❌ FAIL            ✅ PASS
                    │                   │
                    ▼                   ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  Show error msg    │  │  POST request to:  │
        │  Stay on form      │  │  /api/ride-request │
        └────────────────────┘  └────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Backend Processing      │
                            │  (server.js line 88)     │
                            │                          │
                            │  1. Validate data        │
                            │  2. Save to database     │
                            │     (database.js)        │
                            │  3. Send SMS to customer │
                            │     (sms.js)             │
                            │  4. Notify business      │
                            │     (sms.js)             │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Database Entry Created  │
                            │  (ride_requests.db)      │
                            │                          │
                            │  • ID: auto-increment    │
                            │  • Status: 'pending'     │
                            │  • Created timestamp     │
                            │  • All form fields       │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Customer Receives SMS:  │
                            │                          │
                            │  "Hi [Name]! Thank you   │
                            │   for your ride request. │
                            │   We'll send you a quote │
                            │   ASAP."                 │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Business Receives SMS:  │
                            │                          │
                            │  "🚕 New Ride Request!   │
                            │   Name: [Name]           │
                            │   Phone: [Phone]         │
                            │   Pickup: [Address]      │
                            │   Dropoff: [Address]"    │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Success Message Shown   │
                            │  on Customer Screen      │
                            │                          │
                            │  "✓ Request submitted!"  │
                            │  [Request Another Ride]  │
                            └──────────────────────────┘
```

### **B. HOURLY RIDE FLOW**

```
┌──────────────────────────────────────────────────────────────┐
│              HOURLY SERVICE REQUEST FORM                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Shows pricing:  │
                    │                  │
                    │  10AM-5PM: $50/hr│
                    │  7AM-10AM: $70/hr│
                    │  5PM-9PM:  $70/hr│
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Customer fills: │
                    │  • Name          │
                    │  • Phone         │
                    │  • Pickup        │◄──── Google Maps Autocomplete
                    │  • Hours needed  │
                    │  • Start time    │
                    │  • Date          │
                    │  • Notes         │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Live Price Calculator   │
                │  (public/app.js)         │
                │                          │
                │  calculateHourlyPrice()  │
                │  Updates total in        │
                │  real-time as user       │
                │  changes hours/time      │
                └──────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Shows estimate: │
                    │                  │
                    │  3 hrs @ $50/hr  │
                    │  = $150 total    │
                    └──────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Clicks SUBMIT   │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  POST to /api/ride-req   │
                │  with service_type:      │
                │  'hourly'                │
                └──────────────────────────┘
                              │
                              ▼
                    (Same database save
                     and SMS process as
                     regular ride)
```

---

## **💻 PART 2: ADMIN DASHBOARD JOURNEY**

```
┌─────────────────────────────────────────────────────────────┐
│                    ADMIN STARTS HERE                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Admin visits    │
                    │  /admin URL      │
                    └──────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Login Screen            │
                │  (admin.html)            │
                │                          │
                │  Username: admin         │
                │  Password: MySecure2025  │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  POST /api/admin/login   │
                │  (server.js line 213)    │
                └──────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                ❌ FAIL            ✅ PASS
                    │                   │
                    ▼                   ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  Show error        │  │  Show dashboard    │
        │  Stay on login     │  │  Hide login        │
        └────────────────────┘  └────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Dashboard Loads         │
                            │  (admin-app.js)          │
                            │                          │
                            │  loadRideRequests()      │
                            │  • GET /api/ride-requests│
                            │  • Display all requests  │
                            │  • Start auto-refresh    │
                            │    (every 30 seconds)    │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Shows Statistics:       │
                            │                          │
                            │  • Total Requests        │
                            │  • Pending Count         │
                            │  • Today's Count         │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  Shows Request Cards:    │
                            │                          │
                            │  Each card displays:     │
                            │  • Request ID            │
                            │  • Customer name/phone   │
                            │  • Pickup/Dropoff        │
                            │  • Date/Time             │
                            │  • Status badge          │
                            │  • Action buttons        │
                            │    (based on status)     │
                            └──────────────────────────┘
                                          │
                                          ▼
                            ┌──────────────────────────┐
                            │  🔔 Audio Notification?  │
                            │                          │
                            │  If new request detected │
                            │  and audio enabled:      │
                            │  • Play chime sound      │
                            │  • Volume from settings  │
                            └──────────────────────────┘
```

---

## **⚙️ PART 3: QUOTE WORKFLOW (Detailed)**

### **Step 1: Pre-Quote to Driver**

```
┌──────────────────────────────────────────────────────────────┐
│              ADMIN CLICKS "PRE-QUOTE (DRIVER)"               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Check if route          │
                │  already calculated?     │
                └──────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                YES (skip)          NO  │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Call Google Maps API    │
                    │     │                          │
                    │     │  POST /api/calculate-    │
                    │     │  route with:             │
                    │     │  • pickup_location       │
                    │     │  • dropoff_location      │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Backend (server.js)     │
                    │     │  calls maps.js:          │
                    │     │                          │
                    │     │  getRouteAndPrice()      │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Google Maps Distance    │
                    │     │  Matrix API called       │
                    │     │                          │
                    │     │  Returns:                │
                    │     │  • Distance (meters)     │
                    │     │  • Duration (seconds)    │
                    │     │  • Origin address        │
                    │     │  • Destination address   │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Convert & Calculate     │
                    │     │  (maps.js)               │
                    │     │                          │
                    │     │  1. Meters → Miles       │
                    │     │  2. Seconds → Minutes    │
                    │     │  3. calculatePrice()     │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  PRICING LOGIC:          │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  If < 5 miles OR < 7 min │
                    │     │  TIER 1: SHORT TRIP      │
                    │     │                          │
                    │     │  Option A: miles × $1.50 │
                    │     │  Option B: mins × $0.75  │
                    │     │  Use HIGHER value        │
                    │     │  Min price: $6.00        │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  If 5-15 miles           │
                    │     │  TIER 2: MEDIUM TRIP     │
                    │     │                          │
                    │     │  miles × $1.00 × 1.3     │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  If > 15 miles           │
                    │     │  TIER 3: LONG TRIP       │
                    │     │                          │
                    │     │  miles × $0.75 × 1.2     │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Round to nearest $0.50  │
                    │     │                          │
                    │     │  Math.ceil(price × 2)/2  │
                    │     └──────────────────────────┘
                    │                   │
                    │                   ▼
                    │     ┌──────────────────────────┐
                    │     │  Return to frontend:     │
                    │     │                          │
                    │     │  {                       │
                    │     │   success: true,         │
                    │     │   route: {               │
                    │     │     distance: {          │
                    │     │       miles: 13.54       │
                    │     │     },                   │
                    │     │     duration: {          │
                    │     │       minutes: 22.3      │
                    │     │     }                    │
                    │     │   },                     │
                    │     │   pricing: {             │
                    │     │     suggestedPrice: 18,  │
                    │     │     calculation: "..."   │
                    │     │     tripType: "medium"   │
                    │     │   }                      │
                    │     │  }                       │
                    │     └──────────────────────────┘
                    │                   │
                    └───────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Store in request object │
                            │  (admin-app.js):         │
                            │                          │
                            │  request.distance_miles  │
                            │  request.duration_minutes│
                            │  request.suggested_price │
                            │  request.trip_type       │
                            │  request.calculation     │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Format SMS message:     │
                            │                          │
                            │  🚕 PRE-QUOTE REQUEST    │
                            │                          │
                            │  Rider: [Name]           │
                            │  Phone: [Phone]          │
                            │  📍 Pickup: [Address]    │
                            │  📍 Dropoff: [Address]   │
                            │  📅 Date: [Date]         │
                            │  ⏰ Time: [Time]         │
                            │  📏 Distance: 13.5 mi    │
                            │  ⏱️ Duration: 22 min     │
                            │  💰 Suggested: $18       │
                            │  📊 Calculation: ...     │
                            │                          │
                            │  Reply with:             │
                            │  ✓ YES $18 ETA __ min    │
                            │  ✓ YES $__ ETA __ min    │
                            │  ✗ NO                    │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Open SMS app on admin's │
                            │  device with pre-filled  │
                            │  message to driver:      │
                            │                          │
                            │  sms:7142046318?body=... │
                            └──────────────────────────┘
```

### **Step 2: Send Quote to Rider**

```
┌──────────────────────────────────────────────────────────────┐
│           ADMIN CLICKS "SEND QUOTE TO RIDER"                 │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Open Quote Popup        │
                │  (showQuotePopup)        │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Check if route          │
                │  already calculated?     │
                └──────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                YES (skip)          NO  │
                    │                   ▼
                    │     (Same Google Maps API
                    │      calculation as above)
                    │                   │
                    └───────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Display Route Info:     │
                            │                          │
                            │  📊 Route Calculation    │
                            │  📏 Distance: 13.5 mi    │
                            │  ⏱️ Duration: 22 min     │
                            │  🎯 Trip Type: MEDIUM    │
                            │  💡 Calculation:         │
                            │     13.54 × $1.00 × 1.3  │
                            │     = $17.60 → $18       │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Pre-fill Form Fields:   │
                            │                          │
                            │  💰 Price: $18.00        │
                            │  🚗 ETA: 15 min          │
                            │  ⏱️ Duration: 22 min     │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Admin can adjust:       │
                            │  • Price (if needed)     │
                            │  • ETA to pickup         │
                            │  • Ride duration         │
                            │                          │
                            │  Live preview updates    │
                            │  as admin types          │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Admin clicks:           │
                            │  "📱 Send Quote via SMS" │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  submitQuoteToRider()    │
                            │                          │
                            │  PATCH /api/ride-        │
                            │  requests/:id/status     │
                            │                          │
                            │  Body:                   │
                            │  {                       │
                            │    status: 'quoted',     │
                            │    quotePrice: 18,       │
                            │    pickupEta: 15,        │
                            │    rideDuration: 22      │
                            │  }                       │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Backend Updates DB      │
                            │  (database.js)           │
                            │                          │
                            │  UPDATE ride_requests    │
                            │  SET status = 'quoted',  │
                            │      quote_price = 18,   │
                            │      pickup_eta = 15,    │
                            │      ride_duration = 22  │
                            │  WHERE id = ?            │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Open SMS app with:      │
                            │                          │
                            │  Hi [Name]!              │
                            │                          │
                            │  Your Ride Quote:        │
                            │                          │
                            │  📍 Pickup: [Address]    │
                            │  📍 Dropoff: [Address]   │
                            │  📅 Date: [Date]         │
                            │  ⏰ Time: [Time]         │
                            │                          │
                            │  💰 Price: $18.00        │
                            │  🚗 ETA: 15 minutes      │
                            │  ⏱️ Duration: 22 min     │
                            │                          │
                            │  Payment: Cash, Venmo    │
                            │  or Zelle                │
                            │                          │
                            │  Reply YES or NO         │
                            └──────────────────────────┘
                                        │
                                        ▼
                            ┌──────────────────────────┐
                            │  Close popup             │
                            │  Refresh request list    │
                            │  Status now: QUOTED      │
                            └──────────────────────────┘
```

### **Step 3: Confirm Ride**

```
┌──────────────────────────────────────────────────────────────┐
│   CUSTOMER REPLIES "YES" (manually via text message)         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Admin sees reply in     │
                │  phone's Messages app    │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Admin clicks:           │
                │  "✓ Confirm & SMS Driver"│
                │  in dashboard            │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  confirmAndSMSDriver()   │
                │                          │
                │  PATCH /api/ride-        │
                │  requests/:id/status     │
                │                          │
                │  Body:                   │
                │  { status: 'confirmed' } │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Database Updated        │
                │  Status: confirmed       │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │  Opens SMS to DRIVER:    │
                │                          │
                │  ✅ RIDE CONFIRMED       │
                │                          │
                │  Rider: [Name]           │
                │  Phone: [Phone]          │
                │  📍 Pickup: [Address]    │
                │  📍 Dropoff: [Address]   │
                │  📅 Date: [Date]         │
                │  ⏰ Time: [Time]         │
                │  💰 Agreed Price: $18    │
                │  ⏱️ Duration: ~22 min    │
                │                          │
                │  Payment: Cash, Venmo,   │
                │  or Zelle                │
                └──────────────────────────┘
```

### **Step 4: Complete or Cancel**

```
┌──────────────────────────────────────────────────────────────┐
│                   AFTER RIDE IS CONFIRMED                    │
└──────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │                   │
                    ▼                   ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  Admin clicks:     │  │  Admin clicks:     │
        │  "✓ Complete Ride" │  │  "✗ Cancel"        │
        └────────────────────┘  └────────────────────┘
                    │                   │
                    ▼                   ▼
        ┌────────────────────┐  ┌────────────────────┐
        │  Status:           │  │  Status:           │
        │  'completed'       │  │  'cancelled'       │
        │                    │  │                    │
        │  Card turns        │  │  Card turns red    │
        │  green             │  │                    │
        └────────────────────┘  └────────────────────┘
                    │                   │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Can use "Back"  │
                    │  buttons to      │
                    │  revert status   │
                    │  if needed       │
                    └──────────────────┘
```

---

## **🔄 PART 4: STATUS FLOW DIAGRAM**

```
┌─────────────────────────────────────────────────────────────┐
│                    STATUS PROGRESSION                        │
└─────────────────────────────────────────────────────────────┘

    PENDING
       │
       │  ┌─────────────────────────────────┐
       ├─►│ Pre-Quote (Driver) - SMS only   │
       │  │ No status change                │
       │  └─────────────────────────────────┘
       │
       │  ┌─────────────────────────────────┐
       ├─►│ Send Quote to Rider             │
       │  │ Status → QUOTED                 │
       │  └─────────────────────────────────┘
       │               │
       │               ▼
       │           QUOTED
       │               │
       │  ┌────────────┴────────────┐
       │  │                         │
       │  ▼                         ▼
       │  ┌──────────────┐  ┌──────────────┐
       └─►│ Not Available│  │ Declined     │
          │ (driver says │  │ (rider says  │
          │  NO)         │  │  NO)         │
          └──────────────┘  └──────────────┘
                │                   │
                └─────────┬─────────┘
                          │
                          ▼
                    NOT_AVAILABLE
                    or DECLINED
                          │
                          │  ┌──────────────────┐
                          └─►│ Can reset to     │
                             │ PENDING          │
                             └──────────────────┘

    QUOTED
       │
       │  ┌─────────────────────────────────┐
       ├─►│ Confirm & SMS Driver            │
       │  │ Status → CONFIRMED              │
       │  └─────────────────────────────────┘
       │               │
       │               ▼
       │          CONFIRMED
       │               │
       │  ┌────────────┴────────────┐
       │  │                         │
       │  ▼                         ▼
       │  ┌──────────────┐  ┌──────────────┐
       │  │ Complete Ride│  │ Cancel       │
       │  └──────────────┘  └──────────────┘
       │         │                  │
       │         ▼                  ▼
       │    COMPLETED          CANCELLED
       │         │                  │
       │         │  ┌──────────────────┐
       │         └─►│ Can use "Back"   │
       │            │ button to revert │
       └───────────►│ to previous      │
                    │ status           │
                    └──────────────────┘
```

---

## **🛠️ PART 5: TECHNICAL ARCHITECTURE**

```
┌─────────────────────────────────────────────────────────────┐
│                    SYSTEM ARCHITECTURE                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐
│   FRONTEND       │
│   (Browser)      │
└──────────────────┘
        │
        │  HTTP Requests
        ▼
┌──────────────────────────────────────────────────┐
│              EXPRESS SERVER (server.js)          │
│                                                  │
│  Routes:                                         │
│  • GET  /                → public/index.html     │
│  • GET  /admin           → admin.html            │
│  • GET  /card            → business-card.html    │
│  • POST /api/ride-request                        │
│  • GET  /api/ride-requests                       │
│  • PATCH /api/ride-requests/:id/status           │
│  • POST /api/calculate-route                     │
│  • POST /api/admin/login                         │
└──────────────────────────────────────────────────┘
        │
        ├─────────────┬─────────────┬─────────────┐
        │             │             │             │
        ▼             ▼             ▼             ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ database.js │ │   sms.js    │ │   maps.js   │ │  config.js  │
│             │ │             │ │             │ │             │
│ • SQLite DB │ │ • SMS links │ │ • Google    │ │ • API keys  │
│ • CRUD ops  │ │   for local │ │   Maps API  │ │ • Passwords │
│ • Queries   │ │ • Twilio    │ │ • Distance  │ │ • Phone #s  │
│             │ │   (disabled)│ │ • Pricing   │ │             │
└─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘
        │
        ▼
┌─────────────────────────┐
│  ride_requests.db       │
│  (SQLite Database)      │
│                         │
│  Table: ride_requests   │
│  • id                   │
│  • name                 │
│  • phone_number         │
│  • pickup_location      │
│  • pickup_apt           │
│  • dropoff_location     │
│  • dropoff_apt          │
│  • requested_date       │
│  • requested_time       │
│  • status               │
│  • quote_price          │
│  • pickup_eta_minutes   │
│  • ride_duration_minutes│
│  • distance_miles       │
│  • duration_minutes     │
│  • service_type         │
│  • hours_needed         │
│  • hourly_start_time    │
│  • hourly_date          │
│  • hourly_notes         │
│  • estimated_total      │
│  • created_at           │
└─────────────────────────┘
```

---

## **🌐 PART 6: EXTERNAL API INTEGRATIONS**

### **Google Maps Distance Matrix API**

```
┌──────────────────────────────────────────────────────────────┐
│              GOOGLE MAPS API INTEGRATION                     │
└──────────────────────────────────────────────────────────────┘

Backend (maps.js)
      │
      │  API Request
      ▼
https://maps.googleapis.com/maps/api/distancematrix/json
      │
      │  Parameters:
      │  • origins: "105 Goldcrest Way, St. Augustine, FL"
      │  • destinations: "525 State Road 16, St. Augustine, FL"
      │  • mode: driving
      │  • units: imperial
      │  • key: [API_KEY]
      │
      ▼
Google Maps Server
      │
      │  Response:
      │  {
      │    status: "OK",
      │    rows: [{
      │      elements: [{
      │        distance: { value: 21797, text: "13.5 mi" },
      │        duration: { value: 1339, text: "22 mins" },
      │        status: "OK"
      │      }]
      │    }],
      │    origin_addresses: ["105 Goldcrest Wy, ..."],
      │    destination_addresses: ["525 FL-16, ..."]
      │  }
      │
      ▼
Backend processes:
  • Convert meters to miles: 21797 / 1609.34 = 13.54
  • Convert seconds to minutes: 1339 / 60 = 22.3
  • Calculate price using tier system
  • Round to nearest $0.50
      │
      ▼
Return to frontend:
  {
    success: true,
    route: {
      distance: { miles: 13.54 },
      duration: { minutes: 22.3 }
    },
    pricing: {
      suggestedPrice: 18,
      calculation: "13.54 miles × $1.00 × 1.3 = $17.60",
      tripType: "medium"
    }
  }
```

### **Google Places Autocomplete API**

```
┌──────────────────────────────────────────────────────────────┐
│           GOOGLE PLACES AUTOCOMPLETE (Frontend)              │
└──────────────────────────────────────────────────────────────┘

Customer types in address field
      │
      ▼
Google Maps JavaScript API (loaded in browser)
      │
      │  Live suggestions as user types
      ▼
Autocomplete dropdown appears
  • 105 Goldcrest Way, St. Augustine, FL 32092
  • 105 Gold Dr, St. Augustine, FL 32084
  • ...
      │
      │  User selects address
      ▼
Address auto-filled in form field
  • Full formatted address
  • Optimized for routing
```

---

## **📊 PART 7: DATA FLOW SUMMARY**

```
CUSTOMER → Fills Form → POST /api/ride-request
                              ↓
                        Database.createRideRequest()
                              ↓
                        SQLite INSERT
                              ↓
                        SMS notifications sent
                              ↓
                        Success response
                              ↓
                        Customer sees success message

ADMIN → Clicks Pre-Quote → Calculate route → Show price
                              ↓
                        Open SMS to driver
                              ↓
                        Driver replies YES/NO manually

ADMIN → Clicks Send Quote → Calculate route → Pre-fill form
                              ↓
                        Admin adjusts if needed
                              ↓
                        PATCH /api/ride-requests/:id/status
                              ↓
                        Database UPDATE (status='quoted')
                              ↓
                        Open SMS to rider
                              ↓
                        Rider replies YES/NO manually

ADMIN → Clicks Confirm → PATCH status='confirmed'
                              ↓
                        Database UPDATE
                              ↓
                        Open SMS to driver with confirmed details

ADMIN → Clicks Complete → PATCH status='completed'
                              ↓
                        Database UPDATE
                              ↓
                        Card turns green

Auto-refresh (every 30 sec) → GET /api/ride-requests
                              ↓
                        Update dashboard
                              ↓
                        Check for new requests
                              ↓
                        Play audio notification if new
```

---

## **⚙️ PART 8: KEY FILES & THEIR ROLES**

| File | Role | Key Functions |
|------|------|---------------|
| **server.js** | Express server, API endpoints | Routes, middleware, request handling |
| **database.js** | Database operations | createRideRequest(), getAllRideRequests(), updateRideRequestStatus() |
| **maps.js** | Google Maps integration & pricing | getRouteAndPrice(), calculatePrice(), getDistanceAndTime() |
| **sms.js** | SMS handling | sendConfirmationSMS(), sendBusinessNotification(), sendStatusUpdateSMS() |
| **config.js** | Configuration | API keys, passwords, phone numbers |
| **public/index.html** | Customer ride request form | Regular ride form, hourly form, service selection |
| **public/app.js** | Customer form logic | Form validation, Google autocomplete, hourly price calculator |
| **public/styles.css** | Customer form styling | Mobile-first responsive design |
| **admin.html** | Admin dashboard structure | Login screen, request cards, quote popup, settings modal |
| **admin-app.js** | Admin dashboard logic | loadRideRequests(), showQuotePopup(), preQuoteDriver(), status updates |
| **admin-styles.css** | Admin dashboard styling | Status badges, action buttons, modals |

---

## **🎯 PART 9: BUSINESS LOGIC SUMMARY**

### **Pricing Tiers**

```
SHORT TRIPS (< 5 miles OR < 7 minutes)
  Formula: MAX(miles × $1.50, minutes × $0.75)
  Minimum: $6.00
  Example: 3 miles, 8 min → MAX($4.50, $6.00) = $6.00

MEDIUM TRIPS (5-15 miles)
  Formula: miles × $1.00 × 1.3
  Example: 10 miles → $10 × 1.3 = $13.00

LONG TRIPS (> 15 miles)
  Formula: miles × $0.75 × 1.2
  Example: 30 miles → $30 × 0.75 × 1.2 = $27.00

HOURLY SERVICE
  10 AM - 5 PM: $50/hour
  7 AM - 10 AM: $70/hour
  5 PM - 9 PM: $70/hour
```

### **Status Workflow**

1. **pending** → New request, awaiting action
2. **quoted** → Price sent to rider, awaiting response
3. **confirmed** → Rider accepted, driver notified
4. **completed** → Ride finished successfully
5. **cancelled** → Ride was cancelled
6. **declined** → Rider rejected quote
7. **not_available** → Driver not available

### **Admin Actions by Status**

| Status | Available Actions |
|--------|-------------------|
| **pending** | Pre-Quote Driver, Send Quote, Not Available |
| **quoted** | Copy Quote, SMS Rider, Confirm & SMS Driver, Declined, Back |
| **confirmed** | SMS Driver Again, Complete, Cancel, Back |
| **completed** | Back to Confirmed, Reset to Pending |
| **cancelled/declined/not_available** | Reset to Pending |

---

## **🔔 PART 10: NOTIFICATIONS & AUDIO**

```
New Request Arrives
      │
      ▼
loadRideRequests() detects new request
      │
      ▼
Check: Audio enabled? (localStorage)
      │
      ├─ NO → Skip sound
      │
      └─ YES
          │
          ▼
    Get volume setting (0-100)
          │
          ▼
    Create Web Audio API oscillator
          │
          ▼
    Play chime sound (440 Hz, 200ms)
          │
          ▼
    Notification badge appears
```

### **Settings Modal**

- **Audio Toggle**: Enable/disable notification sounds
- **Volume Slider**: 0-100% volume control
- **Test Button**: Preview notification sound
- **Settings saved** to `localStorage`

---

## **✅ COMPLETE END-TO-END FLOW**

```
1. Customer scans QR code
2. Opens ride request form
3. Fills out form with Google autocomplete help
4. Submits request
5. Database saves request (status: pending)
6. Customer receives confirmation SMS
7. Business receives notification SMS
8. Admin logs into dashboard
9. Sees new request (audio notification plays)
10. Clicks "Pre-Quote (Driver)"
11. Google Maps calculates route & price
12. SMS opens with suggested price for driver
13. Driver replies YES with ETA and price (manually)
14. Admin clicks "Send Quote to Rider"
15. Popup shows route calculation
16. Admin adjusts price/ETA if needed
17. Clicks "Send Quote via SMS"
18. Database updates (status: quoted)
19. SMS opens for rider with quote
20. Rider replies YES (manually)
21. Admin clicks "Confirm & SMS Driver"
22. Database updates (status: confirmed)
23. SMS opens to driver with ride confirmation
24. Driver picks up customer
25. Ride completes
26. Admin clicks "Complete Ride"
27. Database updates (status: completed)
28. Card turns green
29. Ride archived ✅
```

---

## **🚀 DEPLOYMENT**

```
Local Development
      │
      │  git add .
      │  git commit
      ▼
GitHub Repository
  (https://github.com/szimler/ride-request-app)
      │
      │  Auto-deploy on push to main
      ▼
Render.com
  • Detects changes
  • Pulls latest code
  • Runs npm install
  • Starts server (npm start)
      │
      ▼
Live Website
  https://ride-request-app.onrender.com/
      │
      ▼
Customers access via:
  • QR code scan
  • Direct URL
  • Business card
```

---

## **📝 NOTES**

- **SMS** currently uses `sms:` links (opens device SMS app)
- **Twilio** integration exists but is disabled
- **Google Maps API** requires valid API key in config.js
- **Database** is SQLite (file-based, no separate server needed)
- **Authentication** is simple username/password (stored in config.js)
- **Auto-refresh** updates dashboard every 30 seconds
- **Audio notifications** use Web Audio API (no external files)

---

**Last Updated:** October 15, 2025
**App Version:** 2.0 (with hourly service & enhanced quote system)



