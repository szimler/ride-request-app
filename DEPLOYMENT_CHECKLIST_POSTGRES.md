# PostgreSQL Migration - Render Deployment Checklist

**Created:** October 15, 2025  
**Migration:** SQLite → PostgreSQL (Supabase)

---

## ✅ PART A: Add Environment Variable to Render (DO THIS FIRST!)

### Step-by-Step:

1. **Go to:** https://dashboard.render.com/
2. **Click:** Your web service `ride-request-app`
3. **Click:** "Environment" (left sidebar)
4. **Click:** "Add Environment Variable"
5. **Add:**
   - **Key:** `DATABASE_URL`
   - **Value:** `postgresql://postgres.dtgasltoryrfwnfalgfe:N%24CsbN%25v%40efb68Y@aws-1-us-east-2.pooler.supabase.com:5432/postgres`
6. **Click:** "Save Changes"
7. **Wait:** ~2 minutes for Render to redeploy

⚠️ **CRITICAL:** Do this BEFORE uploading files to GitHub!

---

## ✅ PART B: Upload Updated Files to GitHub

### Files to Upload (in this order):

#### 1. `package.json`
**What changed:** Removed `sqlite3`, added `pg`

**Location:** https://github.com/szimler/ride-request-app/blob/main/package.json

**Action:** 
- Edit file on GitHub
- Replace entire contents with your local version
- Commit: "Update dependencies for PostgreSQL"

---

#### 2. `server.js`
**What changed:** Added `require('dotenv').config();` at the top

**Location:** https://github.com/szimler/ride-request-app/blob/main/server.js

**Key change (line 1):**
```javascript
require('dotenv').config(); // Load environment variables first
```

**Action:**
- Edit file on GitHub
- Replace entire contents with your local version
- Commit: "Add environment variable support"

---

#### 3. `database.js`
**What changed:** Complete rewrite for PostgreSQL

**Location:** https://github.com/szimler/ride-request-app/blob/main/database.js

**Key changes:**
- Uses `pg` (PostgreSQL) instead of `sqlite3`
- Uses connection pool instead of file
- Uses `$1, $2, $3` placeholders instead of `?`

**Action:**
- Edit file on GitHub
- Replace entire contents with your local version
- Commit: "Migrate database to PostgreSQL"

---

## ✅ PART C: Verify Deployment

### After All Files Uploaded:

1. **Check Render Dashboard**
   - Should show "Deploying..." then "Live"
   - Wait 2-3 minutes

2. **Test Live Website**
   - Open: https://ride-request-app.onrender.com/
   - Submit a test ride request
   - Should work!

3. **Test Admin Panel**
   - Open: https://ride-request-app.onrender.com/admin
   - Login with your credentials
   - Should see all your ride requests
   - Try accepting/updating a ride

4. **Verify Data Persistence**
   - Submit a test ride
   - Restart Render service (Settings → Manual Deploy → Clear build cache & deploy)
   - Check if data is still there ✅ (it should be!)

---

## 🎯 What This Achieves:

**Before:**
- ❌ Data stored in local file on Render
- ❌ Data lost on restart
- ❌ Can't share data between instances

**After:**
- ✅ Data stored in Supabase (cloud PostgreSQL)
- ✅ Data persists forever
- ✅ Multiple users see same data
- ✅ Real-time updates work globally

---

## 🆘 Troubleshooting:

### If deployment fails:

**Check Render Logs:**
- Dashboard → Your service → "Logs" tab
- Look for connection errors

**Common issues:**
1. **"DATABASE_URL not found"** → Add environment variable in Render
2. **"Cannot connect to database"** → Check connection string is correct
3. **"Module not found: pg"** → Make sure package.json was uploaded

---

## 📞 Support:

If anything fails, check:
1. Render logs (for deployment errors)
2. Browser console (for frontend errors)
3. Supabase dashboard (verify database is active)

---

## ✅ Success Criteria:

- [x] Environment variable added to Render
- [x] Files uploaded to GitHub
- [x] Render shows "Live" status
- [x] Website loads: https://ride-request-app.onrender.com/
- [x] Can submit ride requests
- [x] Admin panel works
- [x] Data persists after restart

---

**Once all checkboxes are ✅, your PostgreSQL migration is COMPLETE!** 🎉


