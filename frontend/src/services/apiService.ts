/**
 * API Service Layer for Aftab Autos ERP Frontend
 * Centralized API calls to backend
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

// Helper function for API calls
const apiCall = async (
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any
) => {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `API Error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Call Failed: ${endpoint}`, error);
    throw error;
  }
};

// ============ PRODUCTS ============
export const productAPI = {
  getAll: () => apiCall("/products"),
  getById: (id: string) => apiCall(`/products/${id}`),
  create: (product: any) => apiCall("/products", "POST", product),
  update: (id: string, product: any) => apiCall(`/products/${id}`, "PUT", product),
  delete: (id: string) => apiCall(`/products/${id}`, "DELETE"),
  bulkDelete: (ids: string[]) => apiCall("/products/bulk-delete", "POST", { ids }),
  import: (products: any[]) => apiCall("/products/import", "POST", products),
};

// ============ CUSTOMERS ============
export const customerAPI = {
  getAll: () => apiCall("/customers"),
  getById: (id: string) => apiCall(`/customers/${id}`),
  create: (customer: any) => apiCall("/customers", "POST", customer),
  update: (id: string, customer: any) => apiCall(`/customers/${id}`, "PUT", customer),
  delete: (id: string) => apiCall(`/customers/${id}`, "DELETE"),
  bulkDelete: (ids: string[]) => apiCall("/customers/bulk-delete", "POST", { ids }),
  import: (customers: any[]) => apiCall("/customers/import", "POST", customers),
};

// ============ VENDORS ============
export const vendorAPI = {
  getAll: () => apiCall("/vendors"),
  getById: (id: string) => apiCall(`/vendors/${id}`),
  create: (vendor: any) => apiCall("/vendors", "POST", vendor),
  update: (id: string, vendor: any) => apiCall(`/vendors/${id}`, "PUT", vendor),
  delete: (id: string) => apiCall(`/vendors/${id}`, "DELETE"),
  bulkDelete: (ids: string[]) => apiCall("/vendors/bulk-delete", "POST", { ids }),
  import: (vendors: any[]) => apiCall("/vendors/import", "POST", vendors),
};

// ============ CATEGORIES ============
export const categoryAPI = {
  getAll: () => apiCall("/categories"),
  getById: (id: string) => apiCall(`/categories/${id}`),
  create: (category: any) => apiCall("/categories", "POST", category),
  update: (id: string, category: any) => apiCall(`/categories/${id}`, "PUT", category),
  delete: (id: string) => apiCall(`/categories/${id}`, "DELETE"),
  bulkDelete: (ids: string[]) => apiCall("/categories/bulk-delete", "POST", { ids }),
};

export default {
  productAPI,
  customerAPI,
  vendorAPI,
  categoryAPI,
};
