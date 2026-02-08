/**
 * API Service Layer for Aftab Autos ERP Frontend
 * Supabase REST (PostgREST) calls with Auth-required access
 */

import {
  getAccessToken,
  getActiveCompanyId,
  getPermissions,
  getUserId,
  setPermissions,
} from "./supabaseAuth";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    "Missing Supabase env vars. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
  );
}

const REST_BASE_URL = `${SUPABASE_URL}/rest/v1`;
const FUNCTIONS_BASE_URL = `${SUPABASE_URL}/functions/v1`;

const buildUrl = (path: string) => `${REST_BASE_URL}${path}`;
const buildFunctionUrl = (path: string) =>
  `${FUNCTIONS_BASE_URL}/${path.replace(/^\//, "")}`;

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

const functionCall = async (path: string, body: any) => {
  const token = await getAccessToken();
  const response = await fetch(buildFunctionUrl(path), {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY || "",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Function call failed");
  }
  return data;
};

const uploadToStorage = async (bucket: string, path: string, file: File) => {
  const token = await getAccessToken();
  const response = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY || "",
        Authorization: `Bearer ${token}`,
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "true",
      },
      body: file,
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Upload failed");
  }
  return data;
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

const attachOwnerId = (record: any) => {
  if (record && record.owner_id) return record;
  const userId = getUserId();
  if (!userId) {
    throw new Error("Not authenticated");
  }
  return { ...record, owner_id: userId };
};

const attachCompanyId = (record: any) => {
  if (record && record.company_id) return record;
  const companyId = getActiveCompanyId();
  if (!companyId) {
    throw new Error("Company not set");
  }
  return { ...record, company_id: companyId };
};

const attachOwnership = (record: any) => attachCompanyId(attachOwnerId(record));

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

const mapCompanyFromDb = (row: any) => {
  if (!row) return row;
  return {
    ...row,
    logoUrl: row.logo_url ?? row.logoUrl,
    branches: Array.isArray(row.branches)
      ? row.branches
      : typeof row.branches === "string" && row.branches.trim()
        ? row.branches
            .split(/\r?\n/)
            .map((b: string) => b.trim())
            .filter(Boolean)
        : [],
  };
};

const mapCompanyToDb = (company: any) =>
  stripClientOnly(
    {
      ...company,
      logo_url: company.logoUrl ?? company.logo_url,
      branches: Array.isArray(company.branches)
        ? company.branches
        : undefined,
    },
    ["logoUrl", "createdAt"]
  );

const mapRoleFromDb = (row: any) => ({
  id: row.id,
  companyId: row.company_id ?? row.companyId,
  name: row.name,
  permissions: row.permissions ?? [],
  isSystem: row.is_system ?? row.isSystem,
  createdAt: row.created_at ?? row.createdAt,
});

const mapRoleToDb = (role: any) =>
  stripClientOnly(
    {
      ...role,
      company_id: role.companyId ?? role.company_id,
      is_system: role.isSystem ?? role.is_system,
    },
    ["companyId", "isSystem", "createdAt"]
  );

const ensurePermission = async (permission: string) => {
  const stored = getPermissions();
  if (stored) {
    const roleName = stored.roleName?.toLowerCase() || "";
    if (roleName === "admin" && stored.permissions.length === 0) return;
    if (stored.permissions.includes(permission)) return;
    throw new Error("Permission denied");
  }
  const fetched = await permissionAPI.getMyPermissions();
  if (fetched) {
    setPermissions(fetched);
    const roleName = fetched.roleName?.toLowerCase() || "";
    if (roleName === "admin" && fetched.permissions.length === 0) return;
    if (fetched.permissions.includes(permission)) return;
  }
  throw new Error("Permission denied");
};

// ============ PRODUCTS ============
export const productAPI = {
  getAll: async () => {
    await ensurePermission("products.read");
    return apiCall("/products?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapProductFromDb) : rows
    );
  },
  getById: (id: string) =>
    getFirst(`/products?select=*&id=eq.${id}`).then(mapProductFromDb),
  create: async (product: any) => {
    await ensurePermission("products.write");
    return apiCall("/products", "POST", mapProductToDb(attachOwnership(product)), true)
      .then(firstRow)
      .then(mapProductFromDb);
  },
  update: async (id: string, product: any) => {
    await ensurePermission("products.write");
    return apiCall(`/products?id=eq.${id}`, "PATCH", mapProductToDb(product), true)
      .then(firstRow)
      .then(mapProductFromDb);
  },
  delete: async (id: string) => {
    await ensurePermission("products.delete");
    return apiCall(`/products?id=eq.${id}`, "DELETE");
  },
  bulkDelete: async (ids: Array<string | number>) => {
    await ensurePermission("products.delete");
    return apiCall(`/products?id=${buildInFilter(ids)}`, "DELETE");
  },
  import: async (products: any[]) => {
    await ensurePermission("products.write");
    return apiCall(
      "/products",
      "POST",
      products.map(attachOwnership).map(mapProductToDb),
      true
    );
  },
};

// ============ CUSTOMERS ============
export const customerAPI = {
  getAll: async () => {
    await ensurePermission("customers.read");
    return apiCall("/customers?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapCustomerFromDb) : rows
    );
  },
  getById: (id: string) =>
    getFirst(`/customers?select=*&id=eq.${id}`).then(mapCustomerFromDb),
  create: async (customer: any) => {
    await ensurePermission("customers.write");
    return apiCall("/customers", "POST", mapCustomerToDb(attachOwnership(customer)), true)
      .then(firstRow)
      .then(mapCustomerFromDb);
  },
  update: async (id: string, customer: any) => {
    await ensurePermission("customers.write");
    return apiCall(`/customers?id=eq.${id}`, "PATCH", mapCustomerToDb(customer), true)
      .then(firstRow)
      .then(mapCustomerFromDb);
  },
  delete: async (id: string) => {
    await ensurePermission("customers.delete");
    return apiCall(`/customers?id=eq.${id}`, "DELETE");
  },
  bulkDelete: async (ids: Array<string | number>) => {
    await ensurePermission("customers.delete");
    return apiCall(`/customers?id=${buildInFilter(ids)}`, "DELETE");
  },
  import: async (customers: any[]) => {
    await ensurePermission("customers.write");
    return apiCall(
      "/customers",
      "POST",
      customers.map(attachOwnership).map(mapCustomerToDb),
      true
    );
  },
};

// ============ VENDORS ============
export const vendorAPI = {
  getAll: async () => {
    await ensurePermission("vendors.read");
    return apiCall("/vendors?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapVendorFromDb) : rows
    );
  },
  getById: (id: string) =>
    getFirst(`/vendors?select=*&id=eq.${id}`).then(mapVendorFromDb),
  create: async (vendor: any) => {
    await ensurePermission("vendors.write");
    return apiCall("/vendors", "POST", mapVendorToDb(attachOwnership(vendor)), true)
      .then(firstRow)
      .then(mapVendorFromDb);
  },
  update: async (id: string, vendor: any) => {
    await ensurePermission("vendors.write");
    return apiCall(`/vendors?id=eq.${id}`, "PATCH", mapVendorToDb(vendor), true)
      .then(firstRow)
      .then(mapVendorFromDb);
  },
  delete: async (id: string) => {
    await ensurePermission("vendors.delete");
    return apiCall(`/vendors?id=eq.${id}`, "DELETE");
  },
  bulkDelete: async (ids: Array<string | number>) => {
    await ensurePermission("vendors.delete");
    return apiCall(`/vendors?id=${buildInFilter(ids)}`, "DELETE");
  },
  import: async (vendors: any[]) => {
    await ensurePermission("vendors.write");
    return apiCall(
      "/vendors",
      "POST",
      vendors.map(attachOwnership).map(mapVendorToDb),
      true
    );
  },
};

// ============ CATEGORIES ============
export const categoryAPI = {
  getAll: async () => {
    await ensurePermission("categories.read");
    return apiCall("/categories?select=*&order=id.desc").then((rows) =>
      Array.isArray(rows) ? rows.map(mapCategoryFromDb) : rows
    );
  },
  getById: (id: string) =>
    getFirst(`/categories?select=*&id=eq.${id}`).then(mapCategoryFromDb),
  create: async (category: any) => {
    await ensurePermission("categories.write");
    return apiCall("/categories", "POST", mapCategoryToDb(attachOwnership(category)), true)
      .then(firstRow)
      .then(mapCategoryFromDb);
  },
  update: async (id: string, category: any) => {
    await ensurePermission("categories.write");
    return apiCall(`/categories?id=eq.${id}`, "PATCH", mapCategoryToDb(category), true)
      .then(firstRow)
      .then(mapCategoryFromDb);
  },
  delete: async (id: string) => {
    await ensurePermission("categories.delete");
    return apiCall(`/categories?id=eq.${id}`, "DELETE");
  },
  bulkDelete: async (ids: Array<string | number>) => {
    await ensurePermission("categories.delete");
    return apiCall(`/categories?id=${buildInFilter(ids)}`, "DELETE");
  },
};

// ============ COMPANIES & PROFILES ============
export const companyAPI = {
  create: async (name: string) => {
    await ensurePermission("settings.manage_company");
    return apiCall("/companies", "POST", { name }, true)
      .then(firstRow)
      .then(mapCompanyFromDb);
  },
  getById: (id: string) =>
    getFirst(`/companies?select=*&id=eq.${id}`).then(mapCompanyFromDb),
  update: async (id: string, payload: any) => {
    await ensurePermission("settings.manage_company");
    return apiCall(`/companies?id=eq.${id}`, "PATCH", mapCompanyToDb(payload), true)
      .then((result) => {
        const row = firstRow(result);
        if (!row) {
          throw new Error(
            "Company update returned no data. Check SELECT policy on companies."
          );
        }
        return mapCompanyFromDb(row);
      });
  },
  remove: async (id: string) => {
    await ensurePermission("settings.manage_company");
    return apiCall(`/companies?id=eq.${id}`, "DELETE");
  },
  listMyCompanies: (userId: string) =>
    apiCall(
      `/company_members?select=*,companies(*)&user_id=eq.${userId}`
    ),
};

export const profileAPI = {
  getMyProfile: () => {
    const userId = getUserId();
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return getFirst(`/profiles?select=*&id=eq.${userId}`);
  },
  upsertMyProfile: (payload: { full_name?: string; username?: string; phone?: string }) => {
    const userId = getUserId();
    if (!userId) {
      throw new Error("Not authenticated");
    }
    return apiCall(
      `/profiles?on_conflict=id`,
      "POST",
      { id: userId, ...payload },
      true
    ).then(firstRow);
  },
  findUserByEmail: (email: string) =>
    getFirst(`/profiles?select=*&email=eq.${encodeURIComponent(email)}`),
};

export const companyMemberAPI = {
  listMembers: (companyId: string) =>
    apiCall(
      `/company_members?select=*,profiles:profiles!company_members_user_id_fkey(email)&company_id=eq.${companyId}`
    ),
  addMember: (companyId: string, userId: string, role: string) =>
    apiCall(
      "/company_members",
      "POST",
      { company_id: companyId, user_id: userId, role },
      true
    ).then(firstRow),
  updateRole: (memberId: string, role: string) =>
    apiCall(`/company_members?id=eq.${memberId}`, "PATCH", { role }, true).then(
      firstRow
    ),
  removeMember: (memberId: string) =>
    apiCall(`/company_members?id=eq.${memberId}`, "DELETE"),
  inviteMember: (companyId: string, email: string, role: string) =>
    ensurePermission("settings.manage_members").then(() =>
      functionCall("invite-member", { company_id: companyId, email, role })
    ),
  removeMemberByUser: (companyId: string, userId: string, deleteUser = false) =>
    {
      if (!companyId || !userId) {
        throw new Error("company_id and user_id required");
      }
      return ensurePermission("settings.manage_members").then(() =>
        functionCall("remove-member", {
          company_id: companyId,
          user_id: userId,
          delete_user: deleteUser,
        })
      );
    },
};

export const companyInviteAPI = {
  listInvites: (companyId: string) =>
    apiCall(
      `/company_invites?select=*&company_id=eq.${companyId}&order=created_at.desc`
    ),
};

export const storageAPI = {
  uploadCompanyLogo: async (companyId: string, file: File) => {
    if (!SUPABASE_URL) throw new Error("Missing Supabase URL");
    const extension = file.name.split(".").pop()?.toLowerCase() || "png";
    const safeExt = ["png", "jpg", "jpeg", "webp"].includes(extension)
      ? extension
      : "png";
    const path = `${companyId}/logo-${Date.now()}.${safeExt}`;
    await uploadToStorage("company-logos", path, file);
    return `${SUPABASE_URL}/storage/v1/object/public/company-logos/${path}`;
  },
};

export const companyAdminAPI = {
  deleteCompany: (companyId: string) =>
    ensurePermission("settings.manage_company").then(() =>
      functionCall("delete-company", { company_id: companyId })
    ),
  bootstrapAdmin: (payload?: {
    companyName?: string;
    fullName?: string;
    username?: string;
    phone?: string;
  }) =>
    functionCall(
      "bootstrap-admin",
      payload
        ? {
            company_name: payload.companyName,
            full_name: payload.fullName,
            username: payload.username,
            phone: payload.phone,
          }
        : {}
    ),
};

export const permissionAPI = {
  getMyPermissions: async () => {
    const companyId = getActiveCompanyId();
    const userId = getUserId();
    if (!companyId || !userId) return null;
    const membership = await getFirst(
      `/company_members?select=role&company_id=eq.${companyId}&user_id=eq.${userId}`
    );
    const roleName = membership?.role || "";
    if (!roleName) return { permissions: [], roleName };
    const roles = await apiCall(
      `/company_roles?select=permissions,name&company_id=eq.${companyId}&name=eq.${encodeURIComponent(
        roleName
      )}`
    );
    const row = Array.isArray(roles) ? roles[0] : roles;
    return {
      permissions: row?.permissions || [],
      roleName: row?.name || roleName,
    };
  },
};

// ============ ROLES & PERMISSIONS ============
export const roleAPI = {
  list: (companyId: string) =>
    apiCall(`/company_roles?select=*&company_id=eq.${companyId}&order=created_at.asc`).then(
      (rows) => (Array.isArray(rows) ? rows.map(mapRoleFromDb) : rows)
    ),
  create: (companyId: string, name: string, permissions: string[] = [], isSystem = false) =>
    apiCall(
      "/company_roles",
      "POST",
      mapRoleToDb({ company_id: companyId, name, permissions, is_system: isSystem }),
      true
    )
      .then(firstRow)
      .then(mapRoleFromDb),
  update: (roleId: string, payload: any) =>
    apiCall(`/company_roles?id=eq.${roleId}`, "PATCH", mapRoleToDb(payload), true)
      .then(firstRow)
      .then(mapRoleFromDb),
  remove: (roleId: string) => apiCall(`/company_roles?id=eq.${roleId}`, "DELETE"),
};

export default {
  productAPI,
  customerAPI,
  vendorAPI,
  categoryAPI,
  companyAPI,
  profileAPI,
  companyMemberAPI,
  companyInviteAPI,
  storageAPI,
  companyAdminAPI,
  roleAPI,
  permissionAPI,
};
