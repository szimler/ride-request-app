# 📇 Digital Business Card Guide

## What's Been Created

Your digital business card with QR code is ready! Customers can now easily save your contact info and access your ride request app.

---

## 🌐 Access Your Business Card

### **Live URL:**
```
http://localhost:3000/card
```

When deployed, it will be:
```
https://yourdomain.com/card
```

---

## ✨ Features

### 1. **QR Code for Contact Saving**
- Customers scan the QR code with their phone camera
- Automatically downloads your contact as a VCF file
- Works on iPhone, Android, and all modern devices

### 2. **One-Click Save Contact**
- "Save Contact" button downloads your info directly
- Compatible with all contact apps

### 3. **Direct Ride Request Link**
- "Request a Ride" button takes customers directly to your booking form
- Streamlined user experience

### 4. **Call Button**
- One-tap calling from mobile devices
- Direct phone link: (714) 204-6318

### 5. **Share Functionality**
- Share your business card via text, email, social media
- Copy link button for easy sharing

---

## 📱 How Customers Use It

### **Option 1: Scan QR Code**
1. Customer opens their phone camera
2. Points it at your QR code
3. Taps the notification/popup
4. Downloads and saves your contact

### **Option 2: Direct Access**
1. You share the link: `https://yourdomain.com/card`
2. Customer clicks "Save Contact"
3. Your info is added to their phone

### **Option 3: Request a Ride**
1. Customer visits your card page
2. Clicks "Request a Ride"
3. Goes directly to booking form

---

## 🖨️ How to Use Your Digital Card

### **For In-Person Marketing:**
1. Print the QR code on business cards
2. Display at events, venues, or in your vehicle
3. Customers scan and save your info instantly

### **For Online Marketing:**
1. Share the card link on social media
2. Add to email signatures
3. Include in text messages to customers
4. Put in Facebook/Instagram bio

### **For Your Website:**
1. Add a "Save Contact" button that links to `/card`
2. Embed the QR code on your homepage

---

## 🎨 Customization Options

To customize your business card, edit these files:

### **Change Business Name or Info:**
```javascript
// In server.js (line 62-73)
const businessName = 'Your Business Name';
const phoneNumber = 'Your Phone';
```

### **Update Styling:**
```css
// Edit: public/business-card-styles.css
// Change colors, fonts, layout
```

### **Modify Content:**
```html
// Edit: public/business-card.html
// Add email, address, or other info
```

---

## 📋 Sample Use Cases

### **Scenario 1: Trade Show/Event**
- Print large QR code poster
- Place at your booth
- People scan and save contact for future rides

### **Scenario 2: Inside Vehicle**
- Display QR code sticker on seat back
- Passengers scan to save contact
- Easy to request rides again

### **Scenario 3: Text Marketing**
- Send link to potential customers: "Save my contact: http://yourdomain.com/card"
- They click, save, and can call/book anytime

### **Scenario 4: Social Media**
- Instagram bio: "🚕 Book a Ride → yourdomain.com/card"
- Facebook post: "Save my contact for your next ride!"

---

## 🔗 Important URLs

| Purpose | URL |
|---------|-----|
| **Business Card** | http://localhost:3000/card |
| **Ride Request Form** | http://localhost:3000/ |
| **Admin Dashboard** | http://localhost:3000/admin |
| **Download Contact (vCard)** | http://localhost:3000/api/vcard |

---

## 🚀 Going Live

When you deploy your app to a live server:

1. Your card will be at: `https://yourdomain.com/card`
2. Update your marketing materials with the live URL
3. Print new QR codes with the live link
4. Share on all platforms

---

## 💡 Pro Tips

1. **Print Quality QR Codes:**
   - Save the QR code image from your card page
   - Print at high resolution (300 DPI minimum)
   - Test scanning before mass printing

2. **Track Performance:**
   - Monitor how many people visit `/card`
   - See conversion to ride requests

3. **Social Media:**
   - Use link shortener: bit.ly/ridescel-card
   - More professional and memorable

4. **Business Cards:**
   - Print traditional cards with QR code on back
   - Include: "Scan to save contact & book rides"

---

## 🛠️ Troubleshooting

### **QR Code Not Working:**
- Ensure server is running
- Check that `/api/vcard` endpoint works
- Try different QR code scanner apps

### **Contact Not Saving:**
- Check phone allows VCF downloads
- Try "Save Contact" button instead
- Verify phone number format in config

### **Styling Issues:**
- Clear browser cache
- Check that `business-card-styles.css` is loaded
- Verify all files are in `public/` folder

---

## 📞 Contact Information

**Current Setup:**
- **Phone:** (714) 204-6318
- **Business:** Rides CEL
- **Service:** Professional Ride Service

To update this information, edit `config.js`:
```javascript
BUSINESS_PHONE_NUMBER: '+17142046318'
```

---

## ✅ Next Steps

1. ✅ Test the card at: http://localhost:3000/card
2. ✅ Scan the QR code with your phone
3. ✅ Verify contact saves correctly
4. ✅ Print QR codes for physical cards
5. ✅ Share the link on social media
6. ✅ Add to email signature
7. ✅ Deploy to live server

---

**Your digital business card is ready to share!** 🎉

