# 🚕 Ride Request App

A modern, mobile-friendly web application for requesting taxi/ride services via QR code. Users scan a QR code, fill out a simple form, and receive SMS confirmation.

## ✨ Features

- 📱 **Mobile-First Design** - Optimized for iPhone and all smartphones
- 📲 **QR Code Access** - Users scan a QR code to instantly access the form
- 💰 **Quote System** - Send price quotes to customers and track acceptances
- 💬 **SMS Notifications** - Automatic confirmation and quote messages via Twilio
- 📊 **Admin Dashboard** - Secure login to manage all ride requests
- 💾 **Data Storage** - All requests saved to SQLite database
- 🎨 **Beautiful UI** - Modern, intuitive interface with smooth animations
- ⚡ **Real-time Validation** - Instant feedback on form inputs
- 🔒 **Secure** - Phone number validation and data protection

## 📋 How It Works - Complete Workflow

### Customer Side:
1. **Scan QR Code** → Opens ride request form on their phone
2. **Fill Quick Form** → Name, phone, pickup, dropoff, date/time (dropdown menus for speed)
3. **Submit** → Receives SMS: *"Thanks! We'll send you a quote ASAP."*
4. **Gets Quote** → Receives SMS: *"Your ride quote is $XX. Reply YES to confirm or NO to decline."*
5. **Confirmation** → After accepting, receives SMS: *"Ride confirmed! See you on [date/time]."*

### Business Side (Admin Dashboard):
1. **Login** → Secure admin panel at `http://yoursite.com/admin`
2. **View Request** → See all new ride requests with full details
3. **Send Quote** → Click "Send Quote" and enter price (e.g., $45)
4. **Customer SMS** → System automatically texts the quote to customer
5. **Confirm/Decline** → Click "Confirm Ride" when customer accepts, or "Declined" if they reject
6. **Track Everything** → Filter by status, search requests, view history

## 🚀 Quick Start

### Prerequisites

- **Node.js** (version 14 or higher) - [Download here](https://nodejs.org/)
- **Twilio Account** (for SMS) - [Sign up free](https://www.twilio.com/try-twilio)

### Installation Steps

#### Step 1: Install Dependencies

Open PowerShell or Command Prompt in the project folder and run:

```bash
npm install
```

This will install all required packages:
- Express (web server)
- SQLite3 (database)
- Twilio (SMS service)
- Body-parser, CORS, etc.

#### Step 2: Configure Twilio SMS

1. **Create a Twilio Account:**
   - Go to https://www.twilio.com/try-twilio
   - Sign up for a free account
   - You'll get free credits to test with

2. **Get Your Credentials:**
   - Log into Twilio Console: https://www.twilio.com/console
   - Find your **Account SID** and **Auth Token**
   - Get a Twilio phone number (free with trial account)

3. **Create Configuration File:**
   - Copy `config.example.js` to `config.js`:
   
   ```bash
   copy config.example.js config.js
   ```
   
   - Open `config.js` and fill in your credentials:
   
   ```javascript
   module.exports = {
     PORT: 3000,
     TWILIO_ACCOUNT_SID: 'AC...', // Your Account SID from Twilio
     TWILIO_AUTH_TOKEN: 'your_token_here', // Your Auth Token
     TWILIO_PHONE_NUMBER: '+1234567890', // Your Twilio phone number
     BUSINESS_PHONE_NUMBER: '+1234567890' // Your business phone (where you receive notifications)
   };
   ```

#### Step 3: Start the Server

```bash
npm start
```

You should see:

```
=================================
🚕 Ride Request App Server
=================================
✓ Server running on port 3000
✓ Access the app at: http://localhost:3000
=================================
```

#### Step 4: Test Locally

**Customer Form:**
1. Open your browser and go to: **http://localhost:3000**
2. Fill out the form with test data
3. Submit and check if you receive an SMS (if Twilio is configured)

**Admin Dashboard:**
1. Go to: **http://localhost:3000/admin**
2. Login with default credentials:
   - Username: `admin`
   - Password: `admin123`
3. View the ride request
4. Click "Send Quote" and enter a price
5. Customer receives SMS with quote
6. Mark as "Confirmed" when customer accepts

## 📱 Creating a QR Code

Once your app is deployed (see Deployment section), you can create a QR code:

### Option 1: Online QR Code Generator
1. Go to https://www.qr-code-generator.com/
2. Enter your app's URL (e.g., `https://yourapp.com`)
3. Download the QR code image
4. Print it or display it where users can scan it

### Option 2: Use a QR Code Service
- **QR Code Monkey**: https://www.qrcode-monkey.com/
- **QR Code Generator**: https://www.the-qrcode-generator.com/
- Many are free and offer customization options

## 🌐 Deployment Options

### Option 1: Deploy to Heroku (Recommended for beginners)

1. **Create Heroku Account:** https://signup.heroku.com/
2. **Install Heroku CLI:** https://devcenter.heroku.com/articles/heroku-cli
3. **Deploy:**

```bash
# Login to Heroku
heroku login

# Create new app
heroku create your-ride-app-name

# Set environment variables
heroku config:set TWILIO_ACCOUNT_SID=your_sid
heroku config:set TWILIO_AUTH_TOKEN=your_token
heroku config:set TWILIO_PHONE_NUMBER=your_twilio_number
heroku config:set BUSINESS_PHONE_NUMBER=your_business_number

# Deploy
git add .
git commit -m "Initial commit"
git push heroku main

# Your app will be live at: https://your-ride-app-name.herokuapp.com
```

### Option 2: Deploy to Render (Free tier available)

1. Go to https://render.com/
2. Create account and connect your GitHub repository
3. Create a new Web Service
4. Add environment variables in the Render dashboard
5. Deploy automatically from GitHub

### Option 3: Deploy to Your Own Server

If you have a VPS or dedicated server:

1. Copy all files to your server
2. Install Node.js on the server
3. Run `npm install`
4. Use PM2 to keep the app running:

```bash
npm install -g pm2
pm2 start server.js --name ride-app
pm2 save
pm2 startup
```

5. Set up Nginx as reverse proxy (optional but recommended)

## 📊 Managing Ride Requests

### Admin Dashboard

The built-in admin dashboard provides a complete management interface:

1. **Access:** Go to `http://localhost:3000/admin` (or your deployed URL + `/admin`)
2. **Login:** Use your configured credentials (default: admin/admin123)
3. **Features:**
   - View all ride requests in real-time
   - Send price quotes to customers
   - Confirm or decline rides
   - Mark rides as completed
   - Search and filter by status
   - Auto-refresh every 30 seconds
   - See statistics (total, pending, today's requests)

### Status Workflow:

- **Pending** → New request, awaiting your response
- **Quoted** → You've sent a price quote to customer
- **Confirmed** → Customer accepted, ride is confirmed
- **Declined** → Customer rejected the quote
- **Completed** → Ride finished successfully
- **Cancelled** → Ride was cancelled
- **Not Available** → You're not available for that time

### API Endpoints (Advanced)

For custom integrations:

- `GET /api/ride-requests` - Get all requests
- `GET /api/ride-requests/:id` - Get specific request
- `PATCH /api/ride-requests/:id/status` - Update request status (with optional quote price)
- `POST /api/admin/login` - Admin authentication

## 🔧 Configuration Options

### Change Port

Edit `config.js`:
```javascript
PORT: 8080  // Change to any available port
```

### Customize SMS Messages

Edit `sms.js` to change the message templates:

```javascript
// Customer confirmation message
body: `Hi ${name}! Thank you for your ride request...`

// Business notification message  
body: `New Ride Request!\n\nName: ${rideRequest.name}...`
```

### Disable SMS (Testing)

If you want to test without SMS, simply don't create the `config.js` file. The app will work but skip sending SMS.

## 📁 Project Structure

```
ride-request-app/
├── server.js              # Main Express server
├── database.js            # SQLite database functions
├── sms.js                 # Twilio SMS integration
├── config.example.js      # Configuration template
├── config.js              # Your actual config (create this)
├── package.json           # Node.js dependencies
├── public/                # Frontend files
│   ├── index.html         # Main form page
│   ├── styles.css         # Beautiful styling
│   └── app.js             # Frontend JavaScript
└── README.md              # This file
```

## 🛠️ Troubleshooting

### "Cannot find module 'express'"
Run `npm install` to install all dependencies.

### SMS not sending
- Check your Twilio credentials in `config.js`
- Verify your Twilio phone number is correct
- Check Twilio console for any errors
- Free Twilio accounts can only send to verified numbers

### Database errors
- Make sure the app has write permissions in the directory
- The database file `ride_requests.db` is created automatically

### Port already in use
Change the PORT in `config.js` to a different number (e.g., 3001, 8080).

### Form not submitting
- Open browser console (F12) to check for errors
- Verify the server is running
- Check network tab for failed requests

## 🔐 Security Notes

### For Production Use:

1. **Use HTTPS** - Get a free SSL certificate from Let's Encrypt
2. **Add Authentication** - Protect the admin endpoints
3. **Rate Limiting** - Prevent spam submissions
4. **Input Validation** - Already implemented, but review for your needs
5. **Environment Variables** - Never commit `config.js` to public repositories

## 📞 SMS Costs

- **Twilio Free Trial:** $15-20 credit when you sign up
- **After Trial:** ~$0.0075 per SMS (less than 1 cent)
- For 1000 requests/month: ~$7.50

## 🎨 Customization

### Change Colors

Edit `public/styles.css` and modify the `:root` variables:

```css
:root {
    --primary-color: #4F46E5;  /* Main color */
    --primary-dark: #4338CA;   /* Darker shade */
    /* ... */
}
```

### Add Your Logo

Replace the SVG in `public/index.html` header section with your logo image.

### Modify Form Fields

Edit `public/index.html` to add/remove fields, and update `server.js` accordingly.

## 🤝 Support

If you encounter any issues:

1. Check the troubleshooting section above
2. Review the console output for error messages
3. Verify all configuration is correct
4. Check Twilio console for SMS issues

## 📝 License

MIT License - Feel free to use this for personal or commercial projects.

## 🎯 Next Steps

1. ✅ Install and test locally
2. ✅ Configure Twilio for SMS
3. ✅ Deploy to a hosting service
4. ✅ Create and print QR codes
5. ✅ Test with real users
6. ✅ Monitor the database for new requests

---

**Ready to launch your ride request service!** 🚀

For questions or improvements, feel free to modify the code to fit your specific needs.

