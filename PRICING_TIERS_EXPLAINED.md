# 💰 Three-Tier Pricing Structure

## ✅ Your Complete Pricing Formula:

---

## 📊 **TIER 1: SHORT TRIPS**

### **When:** Distance < 5 miles OR Time < 7 minutes

### **Formula:**
```
Price = MAX(
  distance × $1.50/mile,
  time × $0.75/minute
)

Use whichever gives the HIGHER price
```

### **Examples:**

**Example 1:** 2 miles, 5 minutes
```
Option A: 2 × $1.50 = $3.00
Option B: 5 × $0.75 = $3.75 ✓ Winner!
PRICE: $4.00 (rounded to $0.50)
```

**Example 2:** 4 miles, 10 minutes
```
Option A: 4 × $1.50 = $6.00 ✓ Winner!
Option B: 10 × $0.75 = $7.50
PRICE: $7.50 (rounded to $0.50)
```

**Example 3:** 3 miles, 15 minutes (traffic!)
```
Option A: 3 × $1.50 = $4.50
Option B: 15 × $0.75 = $11.25 ✓ Winner!
PRICE: $11.50 (rounded to $0.50)

Note: Traffic makes this more expensive - fair!
```

---

## 📊 **TIER 2: MEDIUM TRIPS**

### **When:** 5 to 15 miles

### **Formula:**
```
Price = distance × $1.00/mile × 1.3
```

### **Examples:**

**Example 1:** 8 miles, 15 minutes
```
8 × $1.00 × 1.3 = $10.40
PRICE: $10.50 (rounded to $0.50)
```

**Example 2:** 12 miles, 18 minutes
```
12 × $1.00 × 1.3 = $15.60
PRICE: $16.00 (rounded to $0.50)
```

**Example 3:** 15 miles, 22 minutes
```
15 × $1.00 × 1.3 = $19.50
PRICE: $19.50 (already clean)
```

---

## 📊 **TIER 3: LONG TRIPS**

### **When:** More than 15 miles

### **Formula:**
```
Price = distance × $0.75/mile × 1.3
```

### **Examples:**

**Example 1:** 20 miles, 25 minutes
```
20 × $0.75 × 1.3 = $19.50
PRICE: $19.50
```

**Example 2:** 30 miles, 35 minutes
```
30 × $0.75 × 1.3 = $29.25
PRICE: $29.50 (rounded to $0.50)
```

**Example 3:** Jacksonville → St. Augustine (41 miles)
```
41 × $0.75 × 1.3 = $39.97
PRICE: $40.00 (rounded to $0.50)
```

---

## 📋 **Complete Price Chart:**

| Miles | Trip Type | Calculation | Price |
|-------|-----------|-------------|-------|
| 2 | Short | 2 × $1.50 = $3.00 | **$3.00** |
| 4 | Short | 4 × $1.50 = $6.00 | **$6.00** |
| 5 | Medium | 5 × $1.00 × 1.3 = $6.50 | **$6.50** |
| 8 | Medium | 8 × $1.00 × 1.3 = $10.40 | **$10.50** |
| 10 | Medium | 10 × $1.00 × 1.3 = $13.00 | **$13.00** |
| 12 | Medium | 12 × $1.00 × 1.3 = $15.60 | **$16.00** |
| 15 | Medium | 15 × $1.00 × 1.3 = $19.50 | **$19.50** |
| 16 | Long | 16 × $0.75 × 1.3 = $15.60 | **$16.00** |
| 20 | Long | 20 × $0.75 × 1.3 = $19.50 | **$19.50** |
| 25 | Long | 25 × $0.75 × 1.3 = $24.37 | **$24.50** |
| 30 | Long | 30 × $0.75 × 1.3 = $29.25 | **$29.50** |
| 40 | Long | 40 × $0.75 × 1.3 = $39.00 | **$39.00** |
| 50 | Long | 50 × $0.75 × 1.3 = $48.75 | **$49.00** |

---

## 🎯 **Real Jacksonville Routes:**

| Route | Distance | Type | Price |
|-------|----------|------|-------|
| Beach to beach | 3 mi | Short | **$4.50** |
| Downtown area | 4 mi | Short | **$6.00** |
| Jax → Orange Park | 12 mi | Medium | **$16.00** |
| Jax → Jax Beach | 15 mi | Medium | **$19.50** |
| Jax → Airport | 14 mi | Medium | **$18.50** |
| Jax → Fernandina | 30 mi | Long | **$29.50** |
| Jax → St. Augustine | 41 mi | Long | **$40.00** |
| Jax → Palatka | 50 mi | Long | **$49.00** |

---

## 💡 **Why This Structure Works:**

### **Short Trips (< 5 mi):**
- **Higher per-mile rate** ($1.50)
- Covers minimum costs
- Accounts for time-based charges
- Fair minimum fare

### **Medium Trips (5-15 mi):**
- **Standard rate** ($1.00/mi × 1.3)
- Most common rides
- Competitive pricing
- Good profit margin

### **Long Trips (> 15 mi):**
- **Lower per-mile rate** ($0.75/mi × 1.3)
- More competitive for distance
- Customer gets better value
- Still profitable for you

---

## 🎨 **What You'll See in Admin:**

When you click "Send Quote", the popup will show:

**Short Trip Example (3 miles):**
```
📍 Route: 3 miles, 8 minutes
💰 Calculation: 8 min × $0.75 = $6.00
Trip Type: Short trip (<5 miles or <7 min)
Suggested Price: $6.00
```

**Medium Trip Example (12 miles):**
```
📍 Route: 12 miles, 18 minutes
💰 Calculation: 12 miles × $1.00 × 1.3 = $15.60
Trip Type: Medium trip (5-15 miles)
Suggested Price: $16.00
```

**Long Trip Example (41 miles):**
```
📍 Route: 41 miles, 48 minutes
💰 Calculation: 41 miles × $0.75 × 1.3 = $39.97
Trip Type: Long trip (>15 miles)
Suggested Price: $40.00
```

---

## 🧪 **Test It Now:**

<function_calls>
<invoke name="run_terminal_cmd">
<parameter name="command">Start-Process "http://localhost:3000"

