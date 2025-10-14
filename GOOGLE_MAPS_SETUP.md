# 🗺️ Google Maps Setup - Step by Step

## Why You Need This:
Without Google Maps API, the app can't calculate distances/times automatically.
**Result:** You have to enter prices manually (what's happening now).

## 🎯 What Auto-Calculation Does:
1. You click "Send Quote"
2. App sends addresses to Google Maps
3. Google returns: "15.2 miles, 23 minutes"
4. App calculates: "15.2 × $1.00 × 1.3 = $19.76"
5. Shows you: "Suggested Price: $20.00"
6. You can accept or adjust it

---

## ⚡ Quick Setup (5 Minutes):

### **Step 1: Create Google Cloud Account**
Go to: https://console.cloud.google.com/
- Click "Try for Free" or "Sign In"
- Use your existing Google account
- **No credit card required for trial!**

### **Step 2: Create a Project**
1. Click "Select a project" (top left)
2. Click "New Project"
3. Name it: "Ride Request App"
4. Click "Create"
5. Wait 30 seconds for it to be created

### **Step 3: Enable Distance Matrix API**
1. In the search bar, type: "Distance Matrix API"
2. Click on "Distance Matrix API"
3. Click the blue "Enable" button
4. Wait for it to enable (10 seconds)

### **Step 4: Create API Key**
1. Click "Credentials" in the left menu
2. Click "Create Credentials" at the top
3. Select "API Key"
4. Copy the key (looks like: `AIzaSyC_xxxxxxxxxxx`)
5. Click "Close"

### **Step 5: Add to Your App**
1. Open `config.js` in your app folder
2. Find this line:
   ```javascript
   GOOGLE_MAPS_API_KEY: ''
   ```
3. Paste your key:
   ```javascript
   GOOGLE_MAPS_API_KEY: 'AIzaSyC_your_key_here'
   ```
4. Save the file
5. Restart server: `npm start`

---

## 💰 Pricing:
- **FREE:** 40,000 requests per month
- That's ~1,300 quotes per day!
- Perfect for starting out
- **After free tier:** $0.005 per request (half a cent)

## ✅ Testing After Setup:
1. Submit a test ride request
2. In admin, click "Send Quote"
3. You should see:
   ```
   📍 Route Information:
   Distance: 15.2 miles
   Duration: 23 minutes
   
   💰 Price Calculation:
   15.2 miles × $1.00 × 1.3 = $19.76
   Suggested Price: $20.00
   ```

---

## 🛑 Common Issues:

**"API key not working"**
- Make sure you enabled "Distance Matrix API"
- Check you copied the full key
- No spaces before/after the key in config.js

**"Over quota"**
- You've used 40,000 requests this month
- Either wait for next month or add billing

**"Permission denied"**
- Enable billing (even with free tier)
- Add restrictions if needed

---

## 📱 Quick Reference:

**Google Cloud Console:**
https://console.cloud.google.com/

**Distance Matrix API:**
https://console.cloud.google.com/apis/library/distance-matrix-backend.googleapis.com

**Your Projects:**
https://console.cloud.google.com/projectselector2/home/dashboard

---

## ⏱️ Total Time: 5 minutes
## 💵 Cost: FREE (for 40,000/month)
## 🎯 Result: Automatic quote calculation!


