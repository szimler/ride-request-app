# 📱 SMS Messages Reference Card

Quick reference for all SMS messages used in the workflow.

---

## 1️⃣ Pre-Quote to Driver

**When:** Admin clicks "Pre-Quote (Driver)" on pending request  
**To:** Driver (714-204-6318)  
**Purpose:** Get driver's availability and ETA

```
🚕 PRE-QUOTE REQUEST

Rider: John Smith
Phone: +1 (555) 123-4567

📍 Pickup: 123 Main St, Jacksonville, FL
📍 Dropoff: JAX Airport, Jacksonville, FL

📅 Date: Oct 14, 2025
⏰ Time: 2:00 PM

📏 Distance: 15.3 miles
⏱️ Estimated Time: 22 minutes

Please reply YES with your ETA or NO if unavailable
```

**Expected Response:** Driver texts back "YES 15 min" or "NO"

---

## 2️⃣ Quote to Rider

**When:** Admin clicks "Send Quote via SMS" after editing in popup  
**To:** Rider (from their request)  
**Purpose:** Send price quote and ask for confirmation

```
Hi John!

Your Ride Quote:

📍 Pickup: 123 Main St, Jacksonville, FL
📍 Dropoff: JAX Airport, Jacksonville, FL
📅 Date: Oct 14, 2025
⏰ Time: 2:00 PM

💰 Price: $45.00
🚗 Estimated Pickup: 15 minutes
⏱️ Ride Duration: 22 minutes

Do you accept the quote? Please reply YES or NO
```

**Expected Response:** Rider texts back "YES" or "NO"

---

## 3️⃣ Confirmed to Driver

**When:** Admin clicks "Confirm & SMS Driver" after rider accepts  
**To:** Driver (714-204-6318)  
**Purpose:** Notify driver of confirmed ride

```
✅ RIDE CONFIRMED

Rider: John Smith
Phone: +1 (555) 123-4567

📍 Pickup: 123 Main St, Jacksonville, FL
📍 Dropoff: JAX Airport, Jacksonville, FL

📅 Date: Oct 14, 2025
⏰ Time: 2:00 PM

💰 Price: $45.00
🚗 Your ETA: 15 minutes
⏱️ Duration: 22 minutes

Customer has accepted the quote!
```

**No response needed** - Informational only

---

## 4️⃣ Not Available Apology

**When:** Admin clicks "Not Available (SMS)" on pending request  
**To:** Rider (from their request)  
**Purpose:** Politely decline the ride request

```
Hi John,

Thank you for your ride request. Unfortunately, Sebastian is currently unavailable to fulfill your request for Oct 14, 2025 at 2:00 PM.

We apologize for any inconvenience. Sebastian hopes to be available for your future ride requests.

For immediate needs, please feel free to contact us at (714) 204-6318.

Thank you for your understanding!
```

**No response needed** - Request is closed

---

## 5️⃣ Driver Reminder (Optional)

**When:** Admin clicks "SMS Driver Again" on confirmed request  
**To:** Driver (714-204-6318)  
**Purpose:** Resend ride details if needed

```
✅ RIDE REMINDER

Rider: John Smith
Phone: +1 (555) 123-4567

📍 Pickup: 123 Main St, Jacksonville, FL
📍 Dropoff: JAX Airport, Jacksonville, FL

📅 Date: Oct 14, 2025
⏰ Time: 2:00 PM

💰 Price: $45.00
🚗 Your ETA: 15 minutes
⏱️ Duration: 22 minutes
```

**No response needed** - Reminder only

---

## 📋 Quick Workflow Summary:

1. **New Request** → **Pre-Quote Driver** → Driver says YES/NO
2. If YES → **Send Quote to Rider** → Rider says YES/NO
3. If YES → **Confirm & SMS Driver** → Ride confirmed
4. If NO → **Declined** or **Not Available (SMS)**

---

## 💡 Tips:

- **Pre-Quote first** to avoid sending quotes for rides you can't do
- **Edit price/ETA** in the popup before sending to rider
- **Copy Quote button** if you need to paste elsewhere
- **Back buttons** let you fix mistakes in status
- All SMS open in your default text app - just press Send!

---

## 🎯 Button Locations:

| Status | Buttons Available |
|--------|------------------|
| **Pending** | Pre-Quote (Driver), Send Quote to Rider, Not Available (SMS) |
| **Quoted** | Copy Quote, SMS Rider, Confirm & SMS Driver, Declined, Back to Pending |
| **Confirmed** | SMS Driver Again, Complete Ride, Cancel, Back to Quoted |
| **Completed** | Back to Confirmed, Reset to Pending |

---

**Note:** Driver phone (714-204-6318) is hardcoded in admin-app.js. Update there if it changes.



