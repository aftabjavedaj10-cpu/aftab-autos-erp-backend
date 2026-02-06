# Aftab Autos ERP - Frontend-Backend Integration Guide

## Architecture Overview

The ERP system now has full frontend-to-backend-to-database integration:

```
Frontend (React/TypeScript)
    ↓
API Service Layer (apiService.ts)
    ↓
Express REST API (Backend)
    ↓
PostgreSQL Database
```

## Components Created

### Frontend API Service (`src/services/apiService.ts`)
- Centralized API calls using fetch
- Base URL: `http://localhost:5000/api`
- Methods for CRUD operations on Products, Customers, Vendors, Categories
- Error handling and automatic JSON serialization

### Backend Routes
- `POST /products` - Create product
- `GET /products` - Get all products
- `GET /products/:id` - Get single product
- `PUT /products/:id` - Update product
- `DELETE /products/:id` - Delete product
- `POST /products/bulk-delete` - Delete multiple products
- `POST /products/import` - Bulk import from CSV/XLSX
- Similar endpoints for `/customers`, `/vendors`, `/categories`

### Update Dashboard.tsx
- Added `useEffect` to fetch all data on mount from API
- All import/update/delete handlers now call API endpoints
- Error state management with try-catch blocks
- Loading state during initial data fetch

## Running the Complete Stack

### 1. Start Backend Server
```bash
cd backend
npm install
npm start
```
Backend will run on `http://localhost:5000`

### 2. Set up Database (One-time)

Run the schema initialization on your Railway PostgreSQL:
```bash
# Option 1: Using psql command line
psql $DATABASE_URL < database.sql

# Option 2: Via Railway Dashboard
# Copy contents of backend/database.sql and run in Database > Query Editor
```

This creates tables:
- `products` (18 columns with indexes)
- `customers` (15 columns)
- `vendors` (15 columns)
- `categories` (5 columns)

### 3. Start Frontend Dev Server
```bash
cd frontend
npm install
npm run dev
```
Frontend will run on `http://localhost:5173` or `http://localhost:5177`

## Environment Variables

### Frontend (`.env.local`)
```
VITE_API_URL=http://localhost:5000/api
```

### Backend (`.env`)
```
PORT=5000
JWT_SECRET=aftab_secret_key
DATABASE_URL=postgresql://...railway.internal:5432/railway
```

## How Data Flow Works

### Importing Products (Example)
1. User clicks "Import Excel" in Products page
2. ImportModal component displays
3. User selects file (CSV/XLSX)
4. Component auto-maps columns to fields
5. User clicks "Process Import"
6. ImportModal calls `apiService.productAPI.import(data)`
7. API call: `POST /api/products/import` with array of products
8. Backend controller iterates array, inserts each row
9. Returns success response
10. Dashboard handler `handleImportProducts()` calls API, then updates local state
11. Products page re-renders with new data

### Creating a Product
1. User clicks "Add Product"
2. AddProducts form component opens
3. User fills form and clicks Save
4. Form calls `onSave` handler
5. Dashboard handler calls `productAPI.create(product)` or `productAPI.update(id, product)`
6. API call: `POST /api/products` or `PUT /api/products/:id`
7. Backend validates, inserts/updates in database
8. Returns created/updated product
9. Dashboard updates local state
10. UI redirects back to Products list

## Testing the Integration

### Test 1: Check Backend Health
```bash
curl http://localhost:5000/api/health
# Should return 200 OK
```

### Test 2: Get All Products
```bash
curl http://localhost:5000/api/products
# Should return [] or array of products from database
```

### Test 3: Create a Product
```bash
curl -X POST http://localhost:5000/api/products \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Oil",
    "productCode": "TEST001",
    "category": "Fluids",
    "vendorId": "1",
    "price": 250,
    "costPrice": 150,
    "stock": 50,
    "reorderPoint": 10,
    "unit": "liters"
  }'
```

### Test 4: Import via Frontend
1. Open frontend at http://localhost:5173
2. Navigate to Products
3. Click "Import Excel"
4. Upload CSV with columns: name, productCode, category, price, stock, etc.
5. Complete mapping and import
6. Data should appear in Products list and persist in database

## Troubleshooting

### "Failed to connect to backend"
- Ensure backend is running: `npm start` in backend folder
- Check PORT=5000 in .env
- Verify CORS is enabled (it is in app.js)

### "Cannot find module apiService"
- Ensure file created at `frontend/src/services/apiService.ts`
- Check import statement: `import { productAPI, ... } from "../services/apiService"`

### Database queries failing
- Check .env DATABASE_URL is correct
- Run `database.sql` schema on PostgreSQL
- Verify Railway PostgreSQL connection is active
- Check pg library is installed: `npm list pg` in backend

### Import shows "Failed to import products"
- Check browser console for error details
- Verify CSV/XLSX file structure matches field mappings
- Check backend logs for validation errors

## Next Steps

### Security Enhancements
1. Add JWT authentication to all endpoints
2. Hash passwords in customers/vendors import
3. Add input validation and sanitization
4. Implement rate limiting

### Data Validation
1. Add constraints in database (unique indexes, NOT NULL)
2. Add field validation in controllers (regex for codes, emails)
3. Add client-side form validation

### Features
1. Search and filter products/customers/vendors
2. Reports and analytics
3. Inventory management with stock levels
4. Ledger tracking for customer/vendor balances
5. User authentication and role-based access

### Performance
1. Add pagination to GET all endpoints
2. Add caching with Redis
3. Optimize database queries with proper indexes
4. Add pagination in frontend lists

## File Structure Summary

```
backend/
  ├── app.js (Express server, all routes wired)
  ├── .env (Database and server config)
  ├── database.sql (Schema)
  ├── config/
  │   └── db.js (PostgreSQL connection pool)
  ├── controllers/
  │   ├── productController.js
  │   ├── customerController.js
  │   ├── vendorController.js
  │   └── categoryController.js
  └── routes/
      ├── products.js
      ├── customers.js
      ├── vendors.js
      └── categories.js

frontend/
  ├── .env.local (API URL)
  ├── vite.config.ts
  ├── tsconfig.json
  └── src/
      ├── App.tsx
      ├── main.tsx
      ├── services/
      │   └── apiService.ts (NEW - Centralized API calls)
      ├── pages/
      │   ├── Dashboard.tsx (UPDATED - Uses API)
      │   ├── Products.tsx (Uses ImportModal)
      │   ├── CustomersPage.tsx
      │   ├── Vendors.tsx
      │   ├── Categories.tsx
      │   ├── AddProducts.tsx
      │   ├── AddCustomer.tsx
      │   ├── AddVendor.tsx
      │   └── AddCategory.tsx
      └── components/
          ├── ImportModal.tsx (ENHANCED)
          ├── Sidebar.tsx
          ├── TopBar.tsx
          └── StatCard.tsx
```

## API Endpoints Reference

### Products
- `GET /api/products` → List all
- `POST /api/products` → Create
- `GET /api/products/:id` → Get one
- `PUT /api/products/:id` → Update
- `DELETE /api/products/:id` → Delete
- `POST /api/products/bulk-delete` → Delete multiple
- `POST /api/products/import` → Bulk import

### Customers
- `GET /api/customers` → List all
- `POST /api/customers` → Create
- `GET /api/customers/:id` → Get one
- `PUT /api/customers/:id` → Update
- `DELETE /api/customers/:id` → Delete
- `POST /api/customers/bulk-delete` → Delete multiple
- `POST /api/customers/import` → Bulk import

### Vendors
- `GET /api/vendors` → List all
- `POST /api/vendors` → Create
- `GET /api/vendors/:id` → Get one
- `PUT /api/vendors/:id` → Update
- `DELETE /api/vendors/:id` → Delete
- `POST /api/vendors/bulk-delete` → Delete multiple
- `POST /api/vendors/import` → Bulk import

### Categories
- `GET /api/categories` → List all
- `POST /api/categories` → Create
- `GET /api/categories/:id` → Get one
- `PUT /api/categories/:id` → Update
- `DELETE /api/categories/:id` → Delete
- `POST /api/categories/bulk-delete` → Delete multiple

## Success Criteria

✅ Backend API created and running on port 5000
✅ Frontend API service layer created
✅ Dashboard fetches data from API on mount
✅ CRUD operations call backend endpoints
✅ Import handlers call API endpoints
✅ Database schema defined
✅ All routes and controllers implemented
✅ Error handling in place
✅ CORS enabled for cross-origin requests

Your ERP system is now fully wired for frontend-backend integration with persistent database storage!
