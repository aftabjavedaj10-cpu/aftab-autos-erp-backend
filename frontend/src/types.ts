export interface Product {
  id: string;
  name: string;
  productCode: string;
  barcode: string;
  brandName?: string;
  category?: string;
  vendorId: string;
  price: number | string;
  costPrice: number | string;
  stock: number;
  reorderPoint: number;
  unit: string;
  image?: string;
  warehouse?: string;
  productType?: 'Product' | 'Service';
  description?: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'product' | 'customer' | 'vendor';
  description?: string;
  itemCount?: number;
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

export type UserRole = "admin" | "manager" | "staff";

export interface Company {
  id: string;
  name: string;
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
  role?: UserRole;
  companyId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
