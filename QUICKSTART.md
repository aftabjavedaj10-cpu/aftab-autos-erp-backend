# 🚀 Quickstart - Get Aftab Autos ERP Running in 5 Minutes

## Prerequisites
- Node.js 18+ installed
- PostgreSQL on Railway (DATABASE_URL in backend/.env)
- Git (optional)

## Step 1: Initialize Database (One-time)

Run this SQL script on your Railway PostgreSQL via the web dashboard:

**Dashboard → PostgreSQL → Query Editor → Paste & Execute:**

```sql
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  type VARCHAR(50),
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  vendor_code VARCHAR(50) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  category VARCHAR(100),
  opening_balance DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  product_code VARCHAR(50) UNIQUE,
  barcode VARCHAR(100) UNIQUE,
  category VARCHAR(100),
  vendor_id INT,
  price DECIMAL(12,2),
  cost_price DECIMAL(12,2),
  stock INT DEFAULT 0,
  reorder_point INT DEFAULT 0,
  unit VARCHAR(50),
  warehouse VARCHAR(100),
  brand_name VARCHAR(100),
  product_type VARCHAR(100),
  description TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(vendor_id) REFERENCES vendors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  customer_code VARCHAR(50) UNIQUE,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  state VARCHAR(100),
  country VARCHAR(100),
  category VARCHAR(100),
  opening_balance DECIMAL(12,2) DEFAULT 0,
  balance DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  image VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_vendor_id ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_customers_code ON customers(customer_code);
CREATE INDEX IF NOT EXISTS idx_vendors_code ON vendors(vendor_code);
CREATE INDEX IF NOT EXISTS idx_categories_type ON categories(type);
```

✅ Done! Tables created with proper relationships and indexes.

## Step 2: Start Backend Server

```bash
# In one terminal window
cd backend
npm install
npm start
```

Expected output:
```
Server running on port 5000
Connected to database
```

✅ Backend ready at http://localhost:5000

## Step 3: Start Frontend Dev Server

```bash
# In another terminal window
cd frontend
npm install
npm run dev
```

Expected output:
```
  VITE v7.2.5  ready in xxx ms

  ➜  Local:   http://localhost:5173
  ➜  press h to show help
```

✅ Frontend ready at http://localhost:5173

## Step 4: Test the Integration

### Test API Endpoint
```bash
# In a third terminal window
curl http://localhost:5000/api/health
# Should return 200 OK
```

### Test in Browser
1. Open http://localhost:5173
2. Dashboard loads with stats
3. Click "Products" → "Import Excel"
4. Create a CSV file:
```csv
name,productCode,category,price,costPrice,stock,reorderPoint,unit
Car Engine Oil,CEO001,Fluids,250,150,50,10,liters
Air Filter,AF002,Filters,500,300,5,10,pcs
```
5. Upload and map columns
6. Click "Process Import"
7. Success! Data appears in Products list and persists in database

## 🎯 Common Operations

### Add a Product
1. Go to Products page
2. Click "+ Add Product" button
3. Fill in details (Name, Code, Price, Stock, etc.)
4. Click "Save"
5. Product is created in database

### Import Bulk Data
1. Go to Products/Customers/Vendors page
2. Click "Import Excel"
3. Upload CSV or XLSX file
4. Map columns to fields
5. Click "Process Import"
6. All rows inserted into database

### Delete Product
1. Go to Products page
2. Find the product
3. Click delete icon
4. Confirms deletion from database

### Update Product
1. Click edit icon on product
2. Change details
3. Click "Save"
4. Database updated

## 🐛 Troubleshooting

| Problem | Solution |
|---------|----------|
| "Connection refused" | Ensure backend is running (`npm start` in backend) |
| "Cannot find module apiService" | Check file exists at `frontend/src/services/apiService.ts` |
| Database queries fail | Verify DATABASE_URL in backend/.env and that schema was created |
| Frontend shows loading forever | Check backend is running and accessible at localhost:5000 |
| Import fails silently | Check browser console for errors and backend logs |

## 📋 File Checklist

Verify these files exist:

**Backend**.
- [ ] `backend/.env` (with DATABASE_URL)
- [ ] `backend/app.js`
- [ ] `backend/config/db.js`
- [ ] `backend/routes/products.js`
- [ ] `backend/routes/customers.js`
- [ ] `backend/routes/vendors.js`
- [ ] `backend/routes/categories.js`
- [ ] `backend/controllers/productController.js`
- [ ] `backend/controllers/customerController.js`
- [ ] `backend/controllers/vendorController.js`
- [ ] `backend/controllers/categoryController.js`

**Frontend**:
- [ ] `frontend/.env.local` (with VITE_API_URL=http://localhost:5000/api)
- [ ] `frontend/src/services/apiService.ts`
- [ ] `frontend/src/pages/Dashboard.tsx`
- [ ] `frontend/src/components/ImportModal.tsx`

## 🎉 Success Criteria

Your ERP is working when:

✅ Backend starts without errors on port 5000
✅ Frontend loads on port 5173
✅ Dashboard shows "Total Products", "Total Vendors", etc.
✅ Can add a product via form
✅ Can import multiple products via CSV
✅ Data persists after page refresh
✅ Can delete products/customers/vendors
✅ No console errors in browser

## 📚 Full Documentation

For detailed information, see:
- `INTEGRATION_GUIDE.md` - Architecture and setup
- `COMPLETION_SUMMARY.md` - What was implemented
- `backend/database.sql` - Database schema
- `frontend/src/services/apiService.ts` - API methods

## 🔒 Next Steps

1. ✅ Test locally (you are here)
2. Add JWT authentication (see INTEGRATION_GUIDE.md)
3. Deploy backend to Railway
4. Deploy frontend to Vercel
5. Connect production backend to frontend
6. Test end-to-end
7. Add more features (search, filters, reports)

## 💡 Tips

- **Keep terminals open** while developing (backend + frontend in separate windows)
- **Reload page** if you add data via API tools like Postman
- **Check network tab** in browser DevTools to see API calls
- **Watch backend logs** for query errors during testing

---

**Ready? Start with Step 1 above! 🚀**

Questions? Check the troubleshooting section or review INTEGRATION_GUIDE.md for detailed setup.
