export interface Product {
  id: string;
  name: string;
  urduName?: string;
  productCode: string;
  barcode: string;
  brandName?: string;
  category?: string;
  vendorId: string;
  price: number | string;
  costPrice: number | string;
  stock: number;
  stockOnHand?: number;
  stockReserved?: number;
  stockAvailable?: number;
  isActive?: boolean;
  reorderPoint: number;
  reorderQty?: number;
  unit: string;
  image?: string;
  warehouse?: string;
  productType?: 'Product' | 'Service';
  description?: string;
  packagingEnabled?: boolean;
  packagings?: ProductPackaging[];
}

export interface ProductPackaging {
  id?: string;
  productId?: number | string;
  name: string;
  urduName?: string;
  code?: string;
  displayName?: string;
  displayCode?: string;
  factor: number;
  salePrice?: number | string;
  costPrice?: number | string;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface Category {
  id: string;
  name: string;
  type: 'product' | 'customer' | 'vendor';
  description?: string;
  itemCount?: number;
}

export interface UnitMaster {
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface WarehouseMaster {
  id?: string;
  name: string;
  description?: string;
  isActive?: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  vendorCode?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  balance?: string | number;
  payableBalance?: string | number;
  image?: string;
  notes?: string;
}

export interface Customer {
  id?: string;
  name: string;
  customerCode?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  category?: string;
  openingBalance?: string | number;
  balance?: string | number;
  totalOrders?: number;
  notes?: string;
  image?: string;
}

export interface SalesInvoiceItem {
  id?: string | number;
  productId: string;
  productName: string;
  productCode?: string;
  unit?: string;
  quantity: number;
  packagingId?: string;
  packagingName?: string;
  packFactor?: number;
  qtyPack?: number;
  qtyBase?: number;
  unitPrice: number;
  tax?: number;
  discountValue?: number;
  discountType?: "fixed" | "percent" | string;
  total?: number;
}

export interface SalesInvoice {
  id: string;
  customerId?: string;
  customerName: string;
  reference?: string;
  vehicleNumber?: string;
  date: string;
  dueDate?: string;
  status: "Paid" | "Unpaid" | "Partial" | "Overdue" | "Pending" | "Draft" | string;
  paymentStatus?: "Unpaid" | "Partial" | "Paid" | string;
  notes?: string;
  overallDiscount?: number;
  amountReceived?: number;
  items: SalesInvoiceItem[];
  totalAmount: number;
}

export interface StockLedgerEntry {
  id: string;
  companyId: string;
  productId: string;
  qty: number;
  direction: "IN" | "OUT" | string;
  reason?: string;
  source?: string;
  sourceId?: string;
  sourceRef?: string;
  createdAt?: string;
}

export type UserRole = string;

export interface CompanyRole {
  id: string;
  companyId: string;
  name: string;
  permissions?: string[];
  isSystem?: boolean;
  createdAt?: string;
}

export interface Company {
  id: string;
  name: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  ntn?: string;
  branches?: string[];
  ownerId?: string;
  createdAt?: string;
}

export interface CompanyMember {
  id: string;
  userId: string;
  companyId: string;
  role: UserRole;
  createdAt?: string;
  company?: Company;
  email?: string;
}

export interface CompanyInvite {
  id: string;
  companyId: string;
  email: string;
  role: UserRole;
  status: "sent" | "accepted" | "revoked";
  invitedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  lastSentAt?: string;
}

export interface Profile {
  id: string;
  email?: string;
  fullName?: string;
  username?: string;
  phone?: string;
  role?: UserRole;
  companyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  name: string;
  email?: string;
}

export interface POSTerminal {
  id: string;
  name: string;
  location: string;
  status: "Active" | "Inactive";
  assignedUserId?: string;
  lastSynced?: string;
}
