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
const GLOBAL_LOADING_EVENT = "app:global-loading";

let inFlightRequestCount = 0;

const emitGlobalLoading = () => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GLOBAL_LOADING_EVENT, {
      detail: { isLoading: inFlightRequestCount > 0, count: inFlightRequestCount },
    })
  );
};

const startGlobalLoading = () => {
  inFlightRequestCount += 1;
  emitGlobalLoading();
};

const endGlobalLoading = () => {
  inFlightRequestCount = Math.max(0, inFlightRequestCount - 1);
  emitGlobalLoading();
};

export const subscribeGlobalLoading = (
  callback: (state: { isLoading: boolean; count: number }) => void
) => {
  if (typeof window === "undefined") return () => {};

  const handler = (event: Event) => {
    const custom = event as CustomEvent<{ isLoading: boolean; count: number }>;
    callback(custom.detail || { isLoading: false, count: 0 });
  };

  window.addEventListener(GLOBAL_LOADING_EVENT, handler as EventListener);
  callback({ isLoading: inFlightRequestCount > 0, count: inFlightRequestCount });
  return () => window.removeEventListener(GLOBAL_LOADING_EVENT, handler as EventListener);
};

const buildUrl = (path: string) => `${REST_BASE_URL}${path}`;
const buildFunctionUrl = (path: string) =>
  `${FUNCTIONS_BASE_URL}/${path.replace(/^\//, "")}`;

const apiCall = async (
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE" = "GET",
  body?: any,
  preferReturn = false,
  extraHeaders?: Record<string, string>
) => {
  startGlobalLoading();
  try {
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
    if (extraHeaders) {
      Object.assign(headers, extraHeaders);
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
      if (errorMessage.includes("products_product_code_key")) {
        errorMessage = "Product code already exists. Use a unique product code.";
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return null;
    }
    const raw = await response.text();
    if (!raw || !raw.trim()) {
      return null;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  } finally {
    endGlobalLoading();
  }
};

const functionCall = async (path: string, body: any) => {
  startGlobalLoading();
  try {
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
  } finally {
    endGlobalLoading();
  }
};

const uploadToStorage = async (bucket: string, path: string, file: File) => {
  startGlobalLoading();
  try {
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
  } finally {
    endGlobalLoading();
  }
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

const normalizeBulkRows = (rows: any[]) => {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const keySet = new Set<string>();
  rows.forEach((row) => {
    Object.keys(row || {}).forEach((k) => keySet.add(k));
  });
  const keys = [...keySet];
  return rows.map((row) => {
    const normalized: Record<string, any> = {};
    keys.forEach((k) => {
      normalized[k] = Object.prototype.hasOwnProperty.call(row || {}, k) ? row[k] : null;
    });
    return normalized;
  });
};

const chunkRows = <T,>(rows: T[], size: number) => {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
};

const mapProductFromDb = (row: any) => ({
  ...row,
  productCode: row.product_code ?? row.productCode,
  urduName: row.urdu_name ?? row.urduName,
  vendorId: row.vendor_id ?? row.vendorId,
  costPrice: row.cost_price ?? row.costPrice,
  reorderPoint: row.reorder_point ?? row.reorderPoint,
  reorderQty: row.reorder_qty ?? row.reorderQty ?? 1,
  brandName: row.brand_name ?? row.brandName,
  productType: row.product_type ?? row.productType,
  isActive: row.is_active ?? row.isActive ?? true,
});

const mapProductToDb = (product: any) =>
  (() => {
    const rawVendorId = product.vendorId ?? product.vendor_id;
    const parsedVendorId: number | null =
      rawVendorId === null || rawVendorId === undefined || String(rawVendorId).trim() === ""
        ? null
        : Number(String(rawVendorId).trim());
    const vendorId =
      parsedVendorId !== null && Number.isInteger(parsedVendorId) && parsedVendorId > 0
        ? parsedVendorId
        : null;

    return stripClientOnly(
      {
        ...product,
        product_code: product.productCode ?? product.product_code,
        urdu_name: product.urduName ?? product.urdu_name,
        vendor_id: vendorId,
        cost_price: product.costPrice ?? product.cost_price,
        reorder_point: product.reorderPoint ?? product.reorder_point,
        reorder_qty: product.reorderQty ?? product.reorder_qty ?? 1,
        brand_name: product.brandName ?? product.brand_name,
        product_type: product.productType ?? product.product_type,
        is_active: product.isActive ?? product.is_active ?? true,
      },
      [
        "productCode",
        "urduName",
        "vendorId",
        "costPrice",
        "reorderPoint",
        "reorderQty",
        "brandName",
        "productType",
        "stockAvailable",
        "stockOnHand",
        "stockReserved",
      ]
    );
  })();

const sanitizeProductPayload = (payload: any) => {
  const clean = { ...(payload || {}) };
  if ("isActive" in clean) delete clean.isActive;
  return clean;
};

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

const mapSalesInvoiceFromDb = (row: any) => ({
  id: row.id,
  customerId: row.customer_id ?? row.customerId,
  customerName: row.customer_name ?? row.customerName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_received ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  items: Array.isArray(row.items) ? row.items.map(mapSalesInvoiceItemFromDb) : [],
});

const mapSalesInvoiceItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.invoice_id ?? row.invoiceId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapQuotationFromDb = (row: any) => ({
  id: row.id,
  customerId: row.customer_id ?? row.customerId,
  customerName: row.customer_name ?? row.customerName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_received ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  items: Array.isArray(row.items) ? row.items.map(mapQuotationItemFromDb) : [],
});

const mapQuotationItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.quotation_id ?? row.quotationId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapSalesInvoiceToDb = (invoice: any) =>
  stripClientOnly(
    {
      ...invoice,
      customer_id: invoice.customerId ?? invoice.customer_id,
      customer_name: invoice.customerName ?? invoice.customer_name,
      vehicle_number: invoice.vehicleNumber ?? invoice.vehicle_number,
      due_date: invoice.dueDate ?? invoice.due_date,
      payment_status: invoice.paymentStatus ?? invoice.payment_status,
      overall_discount: invoice.overallDiscount ?? invoice.overall_discount ?? 0,
      amount_received: invoice.amountReceived ?? invoice.amount_received ?? 0,
      total_amount: invoice.totalAmount ?? invoice.total_amount ?? 0,
    },
    ["items", "customerId", "customerName", "vehicleNumber", "dueDate", "paymentStatus", "overallDiscount", "amountReceived", "totalAmount"]
  );

const mapSalesInvoiceItemToDb = (item: any, invoiceId: string) => ({
  invoice_id: invoiceId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

const mapQuotationToDb = (quotation: any) =>
  stripClientOnly(
    {
      ...quotation,
      customer_id: quotation.customerId ?? quotation.customer_id,
      customer_name: quotation.customerName ?? quotation.customer_name,
      vehicle_number: quotation.vehicleNumber ?? quotation.vehicle_number,
      due_date: quotation.dueDate ?? quotation.due_date,
      payment_status: quotation.paymentStatus ?? quotation.payment_status,
      overall_discount: quotation.overallDiscount ?? quotation.overall_discount ?? 0,
      amount_received: quotation.amountReceived ?? quotation.amount_received ?? 0,
      total_amount: quotation.totalAmount ?? quotation.total_amount ?? 0,
    },
    [
      "items",
      "customerId",
      "customerName",
      "vehicleNumber",
      "dueDate",
      "paymentStatus",
      "overallDiscount",
      "amountReceived",
      "totalAmount",
    ]
  );

const mapQuotationItemToDb = (item: any, quotationId: string) => ({
  quotation_id: quotationId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

const mapSalesReturnFromDb = (row: any) => ({
  id: row.id,
  customerId: row.customer_id ?? row.customerId,
  customerName: row.customer_name ?? row.customerName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_refunded ?? row.amountRefunded ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  items: Array.isArray(row.items) ? row.items.map(mapSalesReturnItemFromDb) : [],
});

const mapSalesReturnItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.sales_return_id ?? row.salesReturnId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_price ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapSalesReturnToDb = (invoice: any) =>
  stripClientOnly(
    {
      ...invoice,
      customer_id: invoice.customerId ?? invoice.customer_id,
      customer_name: invoice.customerName ?? invoice.customer_name,
      vehicle_number: invoice.vehicleNumber ?? invoice.vehicle_number,
      due_date: invoice.dueDate ?? invoice.due_date,
      payment_status: invoice.paymentStatus ?? invoice.payment_status,
      overall_discount: invoice.overallDiscount ?? invoice.overall_discount ?? 0,
      amount_refunded: invoice.amountReceived ?? invoice.amount_refunded ?? 0,
      total_amount: invoice.totalAmount ?? invoice.total_amount ?? 0,
    },
    ["items", "customerId", "customerName", "vehicleNumber", "dueDate", "paymentStatus", "overallDiscount", "amountReceived", "totalAmount"]
  );

const mapSalesReturnItemToDb = (item: any, salesReturnId: string) => ({
  sales_return_id: salesReturnId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_price: Number(item.unitPrice ?? item.unit_price ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

const mapReceivePaymentFromDb = (row: any) => ({
  id: row.id,
  customerId: row.customer_id ?? row.customerId,
  customerName: row.customer_name ?? row.customerName,
  invoiceId: row.invoice_id ?? row.invoiceId ?? "",
  reference: row.reference ?? "",
  date: row.date,
  status: row.status,
  totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
  notes: row.notes ?? "",
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
});

const mapReceivePaymentToDb = (payment: any) =>
  stripClientOnly(
    {
      ...payment,
      customer_id: payment.customerId ?? payment.customer_id,
      customer_name: payment.customerName ?? payment.customer_name,
      invoice_id: payment.invoiceId ?? payment.invoice_id ?? null,
      reference: payment.reference ?? null,
      total_amount: payment.totalAmount ?? payment.total_amount ?? 0,
    },
    ["customerId", "customerName", "totalAmount", "invoiceId"]
  );

const mapMakePaymentFromDb = (row: any) => ({
  id: row.id,
  vendorId: row.vendor_id ?? row.vendorId,
  vendorName: row.vendor_name ?? row.vendorName,
  invoiceId: row.invoice_id ?? row.invoiceId ?? "",
  reference: row.reference ?? "",
  date: row.date,
  status: row.status,
  totalAmount: Number(row.total_amount ?? row.totalAmount ?? 0),
  notes: row.notes ?? "",
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
});

const mapMakePaymentToDb = (payment: any) =>
  stripClientOnly(
    {
      ...payment,
      vendor_id: payment.vendorId ?? payment.vendor_id,
      vendor_name: payment.vendorName ?? payment.vendor_name,
      invoice_id: payment.invoiceId ?? payment.invoice_id ?? null,
      reference: payment.reference ?? null,
      total_amount: payment.totalAmount ?? payment.total_amount ?? 0,
    },
    ["vendorId", "vendorName", "totalAmount", "invoiceId"]
  );

const mapPurchaseInvoiceFromDb = (row: any) => ({
  id: row.id,
  customerId: row.vendor_id ?? row.vendorId,
  customerName: row.vendor_name ?? row.vendorName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_paid ?? row.amountPaid ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  items: Array.isArray(row.items) ? row.items.map(mapPurchaseInvoiceItemFromDb) : [],
});

const mapPurchaseInvoiceItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.purchase_invoice_id ?? row.purchaseInvoiceId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_cost ?? row.unitCost ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapPurchaseInvoiceToDb = (invoice: any) =>
  stripClientOnly(
    {
      ...invoice,
      vendor_id: invoice.customerId ?? invoice.vendor_id,
      vendor_name: invoice.customerName ?? invoice.vendor_name,
      vehicle_number: invoice.vehicleNumber ?? invoice.vehicle_number,
      due_date: invoice.dueDate ?? invoice.due_date,
      payment_status: invoice.paymentStatus ?? invoice.payment_status,
      overall_discount: invoice.overallDiscount ?? invoice.overall_discount ?? 0,
      amount_paid: invoice.amountReceived ?? invoice.amount_paid ?? 0,
      total_amount: invoice.totalAmount ?? invoice.total_amount ?? 0,
    },
    [
      "items",
      "customerId",
      "customerName",
      "vehicleNumber",
      "dueDate",
      "paymentStatus",
      "overallDiscount",
      "amountReceived",
      "totalAmount",
    ]
  );

const mapPurchaseInvoiceItemToDb = (item: any, invoiceId: string) => ({
  purchase_invoice_id: invoiceId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_cost: Number(item.unitPrice ?? item.unit_cost ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

const mapPurchaseOrderFromDb = (row: any) => ({
  id: row.id,
  customerId: row.vendor_id ?? row.vendorId,
  customerName: row.vendor_name ?? row.vendorName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_paid ?? row.amountPaid ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  items: Array.isArray(row.items) ? row.items.map(mapPurchaseOrderItemFromDb) : [],
});

const mapPurchaseOrderItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.purchase_order_id ?? row.purchaseOrderId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_cost ?? row.unitCost ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapPurchaseOrderToDb = (order: any) =>
  stripClientOnly(
    {
      ...order,
      vendor_id: order.customerId ?? order.vendor_id,
      vendor_name: order.customerName ?? order.vendor_name,
      vehicle_number: order.vehicleNumber ?? order.vehicle_number,
      due_date: order.dueDate ?? order.due_date,
      payment_status: order.paymentStatus ?? order.payment_status,
      overall_discount: order.overallDiscount ?? order.overall_discount ?? 0,
      amount_paid: order.amountReceived ?? order.amount_paid ?? 0,
      total_amount: order.totalAmount ?? order.total_amount ?? 0,
    },
    [
      "items",
      "customerId",
      "customerName",
      "vehicleNumber",
      "dueDate",
      "paymentStatus",
      "overallDiscount",
      "amountReceived",
      "totalAmount",
    ]
  );

const mapPurchaseOrderItemToDb = (item: any, orderId: string) => ({
  purchase_order_id: orderId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_cost: Number(item.unitPrice ?? item.unit_cost ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

const mapPurchaseReturnFromDb = (row: any) => ({
  id: row.id,
  customerId: row.vendor_id ?? row.vendorId,
  customerName: row.vendor_name ?? row.vendorName,
  reference: row.reference,
  vehicleNumber: row.vehicle_number ?? row.vehicleNumber,
  date: row.date,
  dueDate: row.due_date ?? row.dueDate,
  status: row.status,
  paymentStatus: row.payment_status ?? row.paymentStatus,
  notes: row.notes,
  overallDiscount: row.overall_discount ?? row.overallDiscount ?? 0,
  amountReceived: row.amount_paid ?? row.amountPaid ?? row.amountReceived ?? 0,
  totalAmount: row.total_amount ?? row.totalAmount ?? 0,
  createdAt: row.created_at ?? row.createdAt,
  updatedAt: row.updated_at ?? row.updatedAt,
  items: Array.isArray(row.items) ? row.items.map(mapPurchaseReturnItemFromDb) : [],
});

const mapPurchaseReturnItemFromDb = (row: any) => ({
  id: row.id,
  invoiceId: row.purchase_return_id ?? row.purchaseReturnId,
  productId: row.product_id ?? row.productId,
  productCode: row.product_code ?? row.productCode,
  productName: row.product_name ?? row.productName,
  unit: row.unit,
  quantity: Number(row.quantity ?? 0),
  unitPrice: Number(row.unit_cost ?? row.unitCost ?? row.unitPrice ?? 0),
  discountValue: Number(row.discount_value ?? row.discountValue ?? 0),
  discountType: row.discount_type ?? row.discountType ?? "fixed",
  tax: Number(row.tax ?? 0),
  total: Number(row.total ?? 0),
});

const mapPurchaseReturnToDb = (invoice: any) =>
  stripClientOnly(
    {
      ...invoice,
      vendor_id: invoice.customerId ?? invoice.vendor_id,
      vendor_name: invoice.customerName ?? invoice.vendor_name,
      vehicle_number: invoice.vehicleNumber ?? invoice.vehicle_number,
      due_date: invoice.dueDate ?? invoice.due_date,
      payment_status: invoice.paymentStatus ?? invoice.payment_status,
      overall_discount: invoice.overallDiscount ?? invoice.overall_discount ?? 0,
      amount_paid: invoice.amountReceived ?? invoice.amount_paid ?? 0,
      total_amount: invoice.totalAmount ?? invoice.total_amount ?? 0,
    },
    [
      "items",
      "customerId",
      "customerName",
      "vehicleNumber",
      "dueDate",
      "paymentStatus",
      "overallDiscount",
      "amountReceived",
      "totalAmount",
    ]
  );

const mapPurchaseReturnItemToDb = (item: any, invoiceId: string) => ({
  purchase_return_id: invoiceId,
  product_id: item.productId ?? item.product_id ?? null,
  product_code: item.productCode ?? item.product_code ?? "",
  product_name: item.productName ?? item.product_name ?? "",
  unit: item.unit ?? "",
  quantity: Number(item.quantity ?? 0),
  unit_cost: Number(item.unitPrice ?? item.unit_cost ?? 0),
  discount_value: Number(item.discountValue ?? item.discount_value ?? 0),
  discount_type: item.discountType ?? item.discount_type ?? "fixed",
  tax: Number(item.tax ?? 0),
  total: Number(item.total ?? 0),
});

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

const mapStockLedgerFromDb = (row: any) => ({
  id: row.id,
  companyId: row.company_id ?? row.companyId,
  productId: row.product_id ?? row.productId,
  qty: Number(row.qty ?? 0),
  direction: row.direction,
  reason: row.reason,
  source: row.source,
  sourceId: row.source_id ?? row.sourceId,
  sourceRef: row.source_ref ?? row.source_id ?? row.sourceRef,
  createdAt: row.created_at ?? row.createdAt,
});

const SALES_INVOICE_ID_PATTERN = /^SI-(\d{6})$/;
const SALES_RETURN_ID_PATTERN = /^SR-(\d{6})$/;
const QUOTATION_ID_PATTERN = /^QT-(\d{6})$/;
const PURCHASE_INVOICE_ID_PATTERN = /^PI-(\d{6})$/;
const PURCHASE_ORDER_ID_PATTERN = /^PO-(\d{6})$/;
const PURCHASE_RETURN_ID_PATTERN = /^PR-(\d{6})$/;
const RECEIVE_PAYMENT_ID_PATTERN = /^RP-(\d{6})$/;
const MAKE_PAYMENT_ID_PATTERN = /^MP-(\d{6})$/;
const STOCK_ADJUSTMENT_ID_PATTERN = /^ADJ-(\d{6})$/;

const parseSalesInvoiceNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(SALES_INVOICE_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatSalesInvoiceId = (num: number) => `SI-${String(num).padStart(6, "0")}`;

const parseSalesReturnNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(SALES_RETURN_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatSalesReturnId = (num: number) => `SR-${String(num).padStart(6, "0")}`;

const parseReceivePaymentNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(RECEIVE_PAYMENT_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatReceivePaymentId = (num: number) => `RP-${String(num).padStart(6, "0")}`;

const parseMakePaymentNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(MAKE_PAYMENT_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatMakePaymentId = (num: number) => `MP-${String(num).padStart(6, "0")}`;

const parseQuotationNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(QUOTATION_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatQuotationId = (num: number) => `QT-${String(num).padStart(6, "0")}`;

const isSalesInvoiceDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "sales_invoices_pkey"');
};

const isQuotationDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "quotations_pkey"');
};

const isSalesReturnDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "sales_returns_pkey"');
};

const isReceivePaymentDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "receive_payments_pkey"');
};

const isMakePaymentDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "make_payments_pkey"');
};

const getLatestSalesInvoiceId = async () => {
  const rows = await apiCall("/sales_invoices?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const getLatestQuotationId = async () => {
  const rows = await apiCall("/quotations?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const getLatestSalesReturnId = async () => {
  const rows = await apiCall("/sales_returns?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const getLatestReceivePaymentId = async () => {
  const rows = await apiCall("/receive_payments?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const getLatestMakePaymentId = async () => {
  const rows = await apiCall("/make_payments?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const parsePurchaseInvoiceNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(PURCHASE_INVOICE_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatPurchaseInvoiceId = (num: number) => `PI-${String(num).padStart(6, "0")}`;

const isPurchaseInvoiceDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "purchase_invoices_pkey"');
};

const getLatestPurchaseInvoiceId = async () => {
  const rows = await apiCall("/purchase_invoices?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const parsePurchaseOrderNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(PURCHASE_ORDER_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatPurchaseOrderId = (num: number) => `PO-${String(num).padStart(6, "0")}`;

const isPurchaseOrderDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "purchase_orders_pkey"');
};

const getLatestPurchaseOrderId = async () => {
  const rows = await apiCall("/purchase_orders?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const parsePurchaseReturnNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(PURCHASE_RETURN_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatPurchaseReturnId = (num: number) => `PR-${String(num).padStart(6, "0")}`;

const isPurchaseReturnDuplicateKeyError = (err: unknown) => {
  if (!(err instanceof Error)) return false;
  return err.message.includes('duplicate key value violates unique constraint "purchase_returns_pkey"');
};

const getLatestPurchaseReturnId = async () => {
  const rows = await apiCall("/purchase_returns?select=id&order=created_at.desc&limit=1");
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[0]?.id ?? null;
};

const parseStockAdjustmentNumber = (id?: string) => {
  if (!id) return -1;
  const match = id.match(STOCK_ADJUSTMENT_ID_PATTERN);
  return match ? Number(match[1]) : -1;
};

const formatStockAdjustmentId = (num: number) => `ADJ-${String(num).padStart(6, "0")}`;

const getLatestStockAdjustmentId = async (companyId: string) => {
  const rows = await apiCall(
    `/stock_ledger?select=source_id,source_ref&company_id=eq.${companyId}&source=eq.stock_adjustment&order=created_at.desc&limit=50`
  );
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const maxFound = rows.reduce((max, row) => {
    const sourceId = parseStockAdjustmentNumber(row?.source_id);
    const sourceRef = parseStockAdjustmentNumber(row?.source_ref);
    return Math.max(max, sourceId, sourceRef);
  }, -1);
  return maxFound > 0 ? formatStockAdjustmentId(maxFound) : null;
};

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
    const pageSize = 1000;
    let offset = 0;
    let allRows: any[] = [];
    while (true) {
      const rows = await apiCall(
        `/products?select=*&order=id.desc&limit=${pageSize}&offset=${offset}`
      );
      const batch = Array.isArray(rows) ? rows : [];
      allRows = allRows.concat(batch);
      if (batch.length < pageSize) break;
      offset += pageSize;
      if (offset > 1000000) break;
    }
    return allRows.map(mapProductFromDb);
  },
  getById: (id: string) =>
    getFirst(`/products?select=*&id=eq.${id}`).then(mapProductFromDb),
  create: async (product: any) => {
    await ensurePermission("products.write");
    const productPayload = sanitizeProductPayload(
      mapProductToDb(attachOwnership(product))
    );
    const created = await apiCall(
      "/products",
      "POST",
      productPayload,
      true
    )
      .then(firstRow)
      .then(mapProductFromDb);

    const openingQty = Number(product?.stock ?? created?.stock ?? 0);
    const companyId = created?.company_id ?? product?.company_id ?? getActiveCompanyId();
    const productId = Number(created?.id);

    if (openingQty > 0 && companyId && Number.isFinite(productId)) {
      await apiCall("/stock_ledger", "POST", {
        company_id: companyId,
        product_id: productId,
        qty: openingQty,
        direction: "IN",
        reason: "opening_stock",
        source: "products",
        source_id: String(created.id),
        source_ref: `OPEN-${created.id}`,
      });
    }

    return created;
  },
  update: async (id: string, product: any) => {
    await ensurePermission("products.write");
    const productPayload = sanitizeProductPayload(mapProductToDb(product));
    return apiCall(`/products?id=eq.${id}`, "PATCH", productPayload, true)
      .then(firstRow)
      .then(mapProductFromDb);
  },
  delete: async (id: string) => {
    await ensurePermission("products.delete");
    return apiCall(`/products?id=eq.${id}`, "DELETE");
  },
  isUsed: async (id: string) => {
    const [salesItems, stockRows] = await Promise.all([
      apiCall(`/sales_invoice_items?select=id&product_id=eq.${id}&limit=1`).catch(() => []),
      apiCall(`/stock_ledger?select=id&product_id=eq.${id}&limit=1`).catch(() => []),
    ]);
    const hasSales = Array.isArray(salesItems) && salesItems.length > 0;
    const hasStock = Array.isArray(stockRows) && stockRows.length > 0;
    return hasSales || hasStock;
  },
  bulkDelete: async (ids: Array<string | number>) => {
    await ensurePermission("products.delete");
    return apiCall(`/products?id=${buildInFilter(ids)}`, "DELETE");
  },
  import: async (products: any[]) => {
    await ensurePermission("products.write");
    const rows = normalizeBulkRows(products.map(attachOwnership).map(mapProductToDb));
    const chunks = chunkRows(rows, 100);
    for (const chunk of chunks) {
      await apiCall(
        "/products?on_conflict=product_code",
        "POST",
        chunk,
        false,
        { Prefer: "resolution=merge-duplicates,return=minimal" }
      );
    }
    return null;
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
    const rows = normalizeBulkRows(customers.map(attachOwnership).map(mapCustomerToDb));
    return apiCall(
      "/customers",
      "POST",
      rows,
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
    const rows = normalizeBulkRows(vendors.map(attachOwnership).map(mapVendorToDb));
    return apiCall(
      "/vendors",
      "POST",
      rows,
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
  import: async (categories: any[]) => {
    await ensurePermission("categories.write");
    const rows = normalizeBulkRows(
      categories.map(attachOwnership).map((category) =>
        mapCategoryToDb({
          ...category,
          type: category?.type || "product",
        })
      )
    );
    return apiCall("/categories", "POST", rows, true);
  },
};

// ============ SALES INVOICES ============
export const salesInvoiceAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/sales_invoices?select=*,items:sales_invoice_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapSalesInvoiceFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(
      `/sales_invoices?select=*,items:sales_invoice_items(*)&id=eq.${id}`
    );
    return mapSalesInvoiceFromDb(row);
  },
  create: async (invoice: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(invoice);
    let header: any = null;
    let createPayload = mapSalesInvoiceToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/sales_invoices", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isSalesInvoiceDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestSalesInvoiceId();
        const currentNum = parseSalesInvoiceNumber(createPayload?.id);
        const latestNum = parseSalesInvoiceNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatSalesInvoiceId(nextNum) };
      }
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/sales_invoice_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapSalesInvoiceItemToDb(item, header.id))
        ),
        true
      );
    }

    return salesInvoiceAPI.getById(header.id);
  },
  update: async (id: string, invoice: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/sales_invoices?id=eq.${id}`, "PATCH", mapSalesInvoiceToDb(invoice), true);

    await apiCall(`/sales_invoice_items?invoice_id=eq.${id}`, "DELETE");
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/sales_invoice_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapSalesInvoiceItemToDb(item, id))
        ),
        true
      );
    }

    return salesInvoiceAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/sales_invoices?id=eq.${id}`, "DELETE");
  },
};

// ============ QUOTATIONS ============
export const quotationAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/quotations?select=*,items:quotation_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapQuotationFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(`/quotations?select=*,items:quotation_items(*)&id=eq.${id}`);
    return mapQuotationFromDb(row);
  },
  create: async (quotation: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(quotation);
    let header: any = null;
    let createPayload = mapQuotationToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/quotations", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isQuotationDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestQuotationId();
        const currentNum = parseQuotationNumber(createPayload?.id);
        const latestNum = parseQuotationNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatQuotationId(nextNum) };
      }
    }

    const items = Array.isArray(quotation.items) ? quotation.items : [];
    if (items.length > 0) {
      await apiCall(
        "/quotation_items",
        "POST",
        items.map((item: any) => attachCompanyId(mapQuotationItemToDb(item, header.id))),
        true
      );
    }

    return quotationAPI.getById(header.id);
  },
  update: async (id: string, quotation: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/quotations?id=eq.${id}`, "PATCH", mapQuotationToDb(quotation), true);
    await apiCall(`/quotation_items?quotation_id=eq.${id}`, "DELETE");
    const items = Array.isArray(quotation.items) ? quotation.items : [];
    if (items.length > 0) {
      await apiCall(
        "/quotation_items",
        "POST",
        items.map((item: any) => attachCompanyId(mapQuotationItemToDb(item, id))),
        true
      );
    }
    return quotationAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/quotations?id=eq.${id}`, "DELETE");
  },
};

// ============ SALES RETURNS ============
export const salesReturnAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/sales_returns?select=*,items:sales_return_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapSalesReturnFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(`/sales_returns?select=*,items:sales_return_items(*)&id=eq.${id}`);
    return mapSalesReturnFromDb(row);
  },
  create: async (salesReturn: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(salesReturn);
    let header: any = null;
    let createPayload = mapSalesReturnToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/sales_returns", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isSalesReturnDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestSalesReturnId();
        const currentNum = parseSalesReturnNumber(createPayload?.id);
        const latestNum = parseSalesReturnNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatSalesReturnId(nextNum) };
      }
    }

    const items = Array.isArray(salesReturn.items) ? salesReturn.items : [];
    if (items.length > 0) {
      await apiCall(
        "/sales_return_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapSalesReturnItemToDb(item, header.id))
        ),
        true
      );
    }

    // Re-apply header once items are in place so header-level stock trigger
    // posts the effective IN rows from current lines.
    await apiCall(
      `/sales_returns?id=eq.${header.id}`,
      "PATCH",
      mapSalesReturnToDb(withCompany),
      true
    );

    return salesReturnAPI.getById(header.id);
  },
  update: async (id: string, salesReturn: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/sales_return_items?sales_return_id=eq.${id}`, "DELETE");
    const items = Array.isArray(salesReturn.items) ? salesReturn.items : [];
    if (items.length > 0) {
      await apiCall(
        "/sales_return_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapSalesReturnItemToDb(item, id))
        ),
        true
      );
    }

    // Patch header last so stock trigger rebuilds from the latest item rows.
    await apiCall(`/sales_returns?id=eq.${id}`, "PATCH", mapSalesReturnToDb(salesReturn), true);

    return salesReturnAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/sales_returns?id=eq.${id}`, "DELETE");
  },
};

// ============ RECEIVE PAYMENTS ============
export const receivePaymentAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall("/receive_payments?select=*&order=created_at.desc");
    return Array.isArray(rows) ? rows.map(mapReceivePaymentFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(`/receive_payments?select=*&id=eq.${id}`);
    return mapReceivePaymentFromDb(row);
  },
  create: async (payment: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(payment);
    let payload = mapReceivePaymentToDb(withCompany);
    let created: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        created = await apiCall("/receive_payments", "POST", payload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isReceivePaymentDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestReceivePaymentId();
        const currentNum = parseReceivePaymentNumber(payload?.id);
        const latestNum = parseReceivePaymentNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        payload = { ...payload, id: formatReceivePaymentId(nextNum) };
      }
    }
    return mapReceivePaymentFromDb(created);
  },
  update: async (id: string, payment: any) => {
    await ensurePermission("sales_invoices.write");
    const row = await apiCall(
      `/receive_payments?id=eq.${id}`,
      "PATCH",
      mapReceivePaymentToDb(payment),
      true
    ).then(firstRow);
    return mapReceivePaymentFromDb(row);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/receive_payments?id=eq.${id}`, "DELETE");
  },
};

// ============ MAKE PAYMENTS ============
export const makePaymentAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall("/make_payments?select=*&order=created_at.desc");
    return Array.isArray(rows) ? rows.map(mapMakePaymentFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(`/make_payments?select=*&id=eq.${id}`);
    return mapMakePaymentFromDb(row);
  },
  create: async (payment: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(payment);
    let payload = mapMakePaymentToDb(withCompany);
    let created: any = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        created = await apiCall("/make_payments", "POST", payload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isMakePaymentDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestMakePaymentId();
        const currentNum = parseMakePaymentNumber(payload?.id);
        const latestNum = parseMakePaymentNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        payload = { ...payload, id: formatMakePaymentId(nextNum) };
      }
    }
    return mapMakePaymentFromDb(created);
  },
  update: async (id: string, payment: any) => {
    await ensurePermission("sales_invoices.write");
    const row = await apiCall(
      `/make_payments?id=eq.${id}`,
      "PATCH",
      mapMakePaymentToDb(payment),
      true
    ).then(firstRow);
    return mapMakePaymentFromDb(row);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/make_payments?id=eq.${id}`, "DELETE");
  },
};

// ============ PURCHASE INVOICES ============
export const purchaseInvoiceAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/purchase_invoices?select=*,items:purchase_invoice_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapPurchaseInvoiceFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(
      `/purchase_invoices?select=*,items:purchase_invoice_items(*)&id=eq.${id}`
    );
    return mapPurchaseInvoiceFromDb(row);
  },
  create: async (invoice: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(invoice);
    let header: any = null;
    let createPayload = mapPurchaseInvoiceToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/purchase_invoices", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isPurchaseInvoiceDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestPurchaseInvoiceId();
        const currentNum = parsePurchaseInvoiceNumber(createPayload?.id);
        const latestNum = parsePurchaseInvoiceNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatPurchaseInvoiceId(nextNum) };
      }
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_invoice_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapPurchaseInvoiceItemToDb(item, header.id))
        ),
        true
      );
    }

    // Re-apply header once items are in place so header-level stock trigger
    // posts the effective IN rows from current lines.
    await apiCall(
      `/purchase_invoices?id=eq.${header.id}`,
      "PATCH",
      mapPurchaseInvoiceToDb(withCompany),
      true
    );

    return purchaseInvoiceAPI.getById(header.id);
  },
  update: async (id: string, invoice: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/purchase_invoice_items?purchase_invoice_id=eq.${id}`, "DELETE");

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_invoice_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapPurchaseInvoiceItemToDb(item, id))
        ),
        true
      );
    }
    // Patch header last so stock trigger rebuilds from the latest item rows.
    await apiCall(`/purchase_invoices?id=eq.${id}`, "PATCH", mapPurchaseInvoiceToDb(invoice), true);

    return purchaseInvoiceAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/purchase_invoices?id=eq.${id}`, "DELETE");
  },
};

// ============ PURCHASE ORDERS ============
export const purchaseOrderAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/purchase_orders?select=*,items:purchase_order_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapPurchaseOrderFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(
      `/purchase_orders?select=*,items:purchase_order_items(*)&id=eq.${id}`
    );
    return mapPurchaseOrderFromDb(row);
  },
  create: async (order: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(order);
    let header: any = null;
    let createPayload = mapPurchaseOrderToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/purchase_orders", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isPurchaseOrderDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestPurchaseOrderId();
        const currentNum = parsePurchaseOrderNumber(createPayload?.id);
        const latestNum = parsePurchaseOrderNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatPurchaseOrderId(nextNum) };
      }
    }

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_order_items",
        "POST",
        items.map((item: any) => attachCompanyId(mapPurchaseOrderItemToDb(item, header.id))),
        true
      );
    }

    return purchaseOrderAPI.getById(header.id);
  },
  update: async (id: string, order: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/purchase_orders?id=eq.${id}`, "PATCH", mapPurchaseOrderToDb(order), true);
    await apiCall(`/purchase_order_items?purchase_order_id=eq.${id}`, "DELETE");

    const items = Array.isArray(order.items) ? order.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_order_items",
        "POST",
        items.map((item: any) => attachCompanyId(mapPurchaseOrderItemToDb(item, id))),
        true
      );
    }

    return purchaseOrderAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/purchase_orders?id=eq.${id}`, "DELETE");
  },
};

// ============ PURCHASE RETURNS ============
export const purchaseReturnAPI = {
  getAll: async () => {
    await ensurePermission("sales_invoices.read");
    const rows = await apiCall(
      "/purchase_returns?select=*,items:purchase_return_items(*)&order=created_at.desc"
    );
    return Array.isArray(rows) ? rows.map(mapPurchaseReturnFromDb) : rows;
  },
  getById: async (id: string) => {
    await ensurePermission("sales_invoices.read");
    const row = await getFirst(
      `/purchase_returns?select=*,items:purchase_return_items(*)&id=eq.${id}`
    );
    return mapPurchaseReturnFromDb(row);
  },
  create: async (invoice: any) => {
    await ensurePermission("sales_invoices.write");
    const withCompany = attachOwnership(invoice);
    let header: any = null;
    let createPayload = mapPurchaseReturnToDb(withCompany);

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        header = await apiCall("/purchase_returns", "POST", createPayload, true).then(firstRow);
        break;
      } catch (err) {
        if (!isPurchaseReturnDuplicateKeyError(err) || attempt === 2) {
          throw err;
        }
        const latestId = await getLatestPurchaseReturnId();
        const currentNum = parsePurchaseReturnNumber(createPayload?.id);
        const latestNum = parsePurchaseReturnNumber(latestId ?? undefined);
        const nextNum = Math.max(currentNum, latestNum, 0) + 1;
        createPayload = { ...createPayload, id: formatPurchaseReturnId(nextNum) };
      }
    }

    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_return_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapPurchaseReturnItemToDb(item, header.id))
        ),
        true
      );
    }

    await apiCall(
      `/purchase_returns?id=eq.${header.id}`,
      "PATCH",
      mapPurchaseReturnToDb(withCompany),
      true
    );

    return purchaseReturnAPI.getById(header.id);
  },
  update: async (id: string, invoice: any) => {
    await ensurePermission("sales_invoices.write");
    await apiCall(`/purchase_return_items?purchase_return_id=eq.${id}`, "DELETE");
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    if (items.length > 0) {
      await apiCall(
        "/purchase_return_items",
        "POST",
        items.map((item: any) =>
          attachCompanyId(mapPurchaseReturnItemToDb(item, id))
        ),
        true
      );
    }

    await apiCall(`/purchase_returns?id=eq.${id}`, "PATCH", mapPurchaseReturnToDb(invoice), true);

    return purchaseReturnAPI.getById(id);
  },
  delete: async (id: string) => {
    await ensurePermission("sales_invoices.delete");
    return apiCall(`/purchase_returns?id=eq.${id}`, "DELETE");
  },
};

// ============ STOCK LEDGER ============
export const stockLedgerAPI = {
  listByCompany: async (companyId: string, limit = 2000) => {
    if (!companyId) return [];
    const rows = await apiCall(
      `/stock_ledger?select=*&company_id=eq.${companyId}&order=created_at.desc&limit=${limit}`
    );
    return Array.isArray(rows) ? rows.map(mapStockLedgerFromDb) : rows;
  },
  listRecent: async (companyId: string, limit = 50) => {
    if (!companyId) return [];
    const rows = await apiCall(
      `/stock_ledger?select=*&company_id=eq.${companyId}&order=created_at.desc&limit=${limit}`
    );
    return Array.isArray(rows) ? rows.map(mapStockLedgerFromDb) : rows;
  },
  createAdjustment: async (payload: {
    productId: string | number;
    qty: number;
    direction: "IN" | "OUT";
    reason?: string;
    sourceRef?: string;
    adjustmentNo?: string;
    adjustmentDate?: string;
  }) => {
    await ensurePermission("products.write");
    const companyId = getActiveCompanyId();
    if (!companyId) {
      throw new Error("Company not set");
    }
    const productId = Number(payload.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Invalid product");
    }
    const qty = Number(payload.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    const direction = String(payload.direction || "").toUpperCase();
    if (direction !== "IN" && direction !== "OUT") {
      throw new Error("Invalid direction");
    }

    let adjustmentNo = String(payload.adjustmentNo || "").trim();
    if (!adjustmentNo) {
      const latest = await getLatestStockAdjustmentId(companyId);
      const latestNum = parseStockAdjustmentNumber(latest ?? undefined);
      adjustmentNo = formatStockAdjustmentId(Math.max(0, latestNum) + 1);
    }

    const createdAt =
      payload.adjustmentDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.adjustmentDate)
        ? `${payload.adjustmentDate}T00:00:00`
        : undefined;

    const created = await apiCall(
      "/stock_ledger",
      "POST",
      {
        company_id: companyId,
        product_id: productId,
        qty,
        direction,
        reason: payload.reason || "stock_adjustment",
        source: "stock_adjustment",
        source_id: adjustmentNo,
        source_ref: payload.sourceRef || adjustmentNo,
        ...(createdAt ? { created_at: createdAt } : {}),
      },
      true
    ).then(firstRow);
    return mapStockLedgerFromDb(created);
  },
  updateAdjustment: async (
    adjustmentRowId: string,
    payload: {
      productId: string | number;
      qty: number;
      direction: "IN" | "OUT";
      reason?: string;
      sourceRef?: string;
      adjustmentNo?: string;
      adjustmentDate?: string;
    }
  ) => {
    await ensurePermission("products.write");
    const companyId = getActiveCompanyId();
    if (!companyId) {
      throw new Error("Company not set");
    }
    const productId = Number(payload.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
      throw new Error("Invalid product");
    }
    const qty = Number(payload.qty || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error("Quantity must be greater than 0");
    }
    const direction = String(payload.direction || "").toUpperCase();
    if (direction !== "IN" && direction !== "OUT") {
      throw new Error("Invalid direction");
    }
    const createdAt =
      payload.adjustmentDate && /^\d{4}-\d{2}-\d{2}$/.test(payload.adjustmentDate)
        ? `${payload.adjustmentDate}T00:00:00`
        : undefined;

    const patchBody: Record<string, any> = {
      product_id: productId,
      qty,
      direction,
      reason: payload.reason || "stock_adjustment",
      source: "stock_adjustment",
    };
    if (payload.adjustmentNo) patchBody.source_id = payload.adjustmentNo;
    if (payload.sourceRef) patchBody.source_ref = payload.sourceRef;
    if (createdAt) patchBody.created_at = createdAt;

    const updated = await apiCall(
      `/stock_ledger?id=eq.${adjustmentRowId}&company_id=eq.${companyId}&source=eq.stock_adjustment`,
      "PATCH",
      patchBody,
      true
    ).then(firstRow);
    if (!updated) {
      throw new Error("Adjustment update returned no data");
    }
    return mapStockLedgerFromDb(updated);
  },
  deleteAdjustment: async (adjustmentRowId: string) => {
    await ensurePermission("products.delete");
    const companyId = getActiveCompanyId();
    if (!companyId) {
      throw new Error("Company not set");
    }
    return apiCall(
      `/stock_ledger?id=eq.${adjustmentRowId}&company_id=eq.${companyId}&source=eq.stock_adjustment`,
      "DELETE"
    );
  },
};

// ============ COMPANIES & PROFILES ============
export const companyAPI = {
  create: async (name: string) => {
    // Bootstrap path: allow creating first/active company without requiring
    // company-scoped permission that does not exist yet.
    if (getActiveCompanyId()) {
      await ensurePermission("settings.manage_company");
    }
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
  salesInvoiceAPI,
  salesReturnAPI,
  receivePaymentAPI,
  makePaymentAPI,
  purchaseInvoiceAPI,
  purchaseOrderAPI,
  purchaseReturnAPI,
  quotationAPI,
  stockLedgerAPI,
  companyAPI,
  profileAPI,
  companyMemberAPI,
  companyInviteAPI,
  storageAPI,
  companyAdminAPI,
  roleAPI,
  permissionAPI,
};
