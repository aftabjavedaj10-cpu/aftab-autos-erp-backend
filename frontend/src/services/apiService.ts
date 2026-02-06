/**
 * API Service Layer for Aftab Autos ERP Frontend
 * Supabase REST (PostgREST) calls with Auth-required access
 */

import { getAccessToken } from "./supabaseAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

const REST_BASE_URL = `${SUPABASE_URL}/rest/v1`;

const buildUrl = (path: string) => `${REST_BASE_URL}${path}`;

const apiCall = async (
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: any,
  preferReturn = false
) => {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY || "",
    Authorization: `Bearer ${token}`,
  };

  if (method !== "GET") {
    headers["Content-Type"] = "application/json";
  }

  if (preferReturn) {
    headers["Prefer"] = "return=representation";
  }

  const options: RequestInit = {
    method,
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(buildUrl(path), options);

  if (!response.ok) {
    let errorMessage = `API Error: ${response.status}`;
    try {
      const error = await response.json();
      errorMessage = error?.message || error?.error || errorMessage;
    } catch {
      // ignore json parse errors
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
};

const getFirst = async (path: string) => {
  const rows = await apiCall(path, "GET");
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("Not found");
  }
  return rows[0];
};

const firstRow = (result: any) => (Array.isArray(result) ? result[0] : result);

const buildInFilter = (ids: Array<string | number>) =>
  `in.(${ids.map((id) => String(id).replace(/"/g, "")).join(",")})`;

const stripClientOnly = (row: any, keys: string[]) => {
  const copy = { ...row };
  for (const key of keys) {
    if (key in copy) delete copy[key];
  }
  return copy;
};

const mapProductFromDb = (row: any) => ({
  ...row,
  productCode: row.product_code ?? row.productCode,
  vendorId: row.vendor_id ?? row.vendorId,
  costPrice: row.cost_price ?? row.costPrice,
  reorderPoint: row.reorder_point ?? row.reorderPoint,
  brandName: row.brand_name ?? row.brandName,
  productType: row.product_type ?? row.productType,
});

const mapProductToDb = (product: any) =>
  stripClientOnly(
    {
      ...product,
      product_code: product.productCode ?? product.product_code,
      vendor_id: product.vendorId ?? product.vendor_id,
      cost_price: product.costPrice ?? product.cost_price,
      reorder_point: product.reorderPoint ?? product.reorder_point,
      brand_name: product.brandName ?? product.brand_name,
      product_type: product.productType ?? product.product_type,
    },
    [
      "productCode",
      "vendorId",
      "costPrice",
      "reorderPoint",
      "brandName",
      "productType",
    ]
  );

const mapCustomerFromDb = (row: any) => ({
  ...row,
  customerCode: row.customer_code ?? row.customerCode,
  openingBalance: row.opening_balance ?? row.openingBalance,
});

const mapCustomerToDb = (customer: any) =>
  stripClientOnly(
    {
      ...customer,
      customer_code: customer.customerCode ?? customer.customer_code,
      opening_balance: customer.openingBalance ?? customer.opening_balance,
    },
    ["customerCode", "openingBalance", "totalOrders"]
  );

const mapVendorFromDb = (row: any) => ({
  ...row,
  vendorCode: row.vendor_code ?? row.vendorCode,
  openingBalance: row.opening_balance ?? row.openingBalance,
});

const mapVendorToDb = (vendor: any) =>
  stripClientOnly(
    {
      ...vendor,
      vendor_code: vendor.vendorCode ?? vendor.vendor_code,
      opening_balance: vendor.openingBalance ?? vendor.opening_balance,
    },
    ["vendorCode", "openingBalance", "payableBalance"]
  );

const mapCategoryFromDb = (row: any) => ({ ...row });
const mapCategoryToDb = (category: any) =>
  stripClientOnly({ ...category }, ["itemCount"]);

// ============ PRODUCTS ============
export const productAPI = {
  getAll: () =>
    apiCall("/products?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapProductFromDb) : rows
    ),
  getById: (id: string) =>
    getFirst(`/products?select=*&id=eq.${id}`).then(mapProductFromDb),
  create: (product: any) =>
    apiCall("/products", "POST", mapProductToDb(product), true)
      .then(firstRow)
      .then(mapProductFromDb),
  update: (id: string, product: any) =>
    apiCall(`/products?id=eq.${id}`, "PATCH", mapProductToDb(product), true)
      .then(firstRow)
      .then(mapProductFromDb),
  delete: (id: string) => apiCall(`/products?id=eq.${id}`, "DELETE"),
  bulkDelete: (ids: Array<string | number>) =>
    apiCall(`/products?id=${buildInFilter(ids)}`, "DELETE"),
  import: (products: any[]) =>
    apiCall(
      "/products",
      "POST",
      products.map(mapProductToDb),
      true
    ),
};

// ============ CUSTOMERS ============
export const customerAPI = {
  getAll: () =>
    apiCall("/customers?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapCustomerFromDb) : rows
    ),
  getById: (id: string) =>
    getFirst(`/customers?select=*&id=eq.${id}`).then(mapCustomerFromDb),
  create: (customer: any) =>
    apiCall("/customers", "POST", mapCustomerToDb(customer), true)
      .then(firstRow)
      .then(mapCustomerFromDb),
  update: (id: string, customer: any) =>
    apiCall(`/customers?id=eq.${id}`, "PATCH", mapCustomerToDb(customer), true)
      .then(firstRow)
      .then(mapCustomerFromDb),
  delete: (id: string) => apiCall(`/customers?id=eq.${id}`, "DELETE"),
  bulkDelete: (ids: Array<string | number>) =>
    apiCall(`/customers?id=${buildInFilter(ids)}`, "DELETE"),
  import: (customers: any[]) =>
    apiCall(
      "/customers",
      "POST",
      customers.map(mapCustomerToDb),
      true
    ),
};

// ============ VENDORS ============
export const vendorAPI = {
  getAll: () =>
    apiCall("/vendors?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapVendorFromDb) : rows
    ),
  getById: (id: string) =>
    getFirst(`/vendors?select=*&id=eq.${id}`).then(mapVendorFromDb),
  create: (vendor: any) =>
    apiCall("/vendors", "POST", mapVendorToDb(vendor), true)
      .then(firstRow)
      .then(mapVendorFromDb),
  update: (id: string, vendor: any) =>
    apiCall(`/vendors?id=eq.${id}`, "PATCH", mapVendorToDb(vendor), true)
      .then(firstRow)
      .then(mapVendorFromDb),
  delete: (id: string) => apiCall(`/vendors?id=eq.${id}`, "DELETE"),
  bulkDelete: (ids: Array<string | number>) =>
    apiCall(`/vendors?id=${buildInFilter(ids)}`, "DELETE"),
  import: (vendors: any[]) =>
    apiCall(
      "/vendors",
      "POST",
      vendors.map(mapVendorToDb),
      true
    ),
};

// ============ CATEGORIES ============
export const categoryAPI = {
  getAll: () =>
    apiCall("/categories?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapCategoryFromDb) : rows
    ),
  getById: (id: string) =>
    getFirst(`/categories?select=*&id=eq.${id}`).then(mapCategoryFromDb),
  create: (category: any) =>
    apiCall("/categories", "POST", mapCategoryToDb(category), true)
      .then(firstRow)
      .then(mapCategoryFromDb),
  update: (id: string, category: any) =>
    apiCall(`/categories?id=eq.${id}`, "PATCH", mapCategoryToDb(category), true)
      .then(firstRow)
      .then(mapCategoryFromDb),
  delete: (id: string) => apiCall(`/categories?id=eq.${id}`, "DELETE"),
  bulkDelete: (ids: Array<string | number>) =>
    apiCall(`/categories?id=${buildInFilter(ids)}`, "DELETE"),
};

export default {
  productAPI,
  customerAPI,
  vendorAPI,
  categoryAPI,
};
