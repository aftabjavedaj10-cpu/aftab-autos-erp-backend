export interface ReportDefinition {
  id: number;
  title: string;
  description: string;
  category: "Sales" | "Inventory" | "Financial" | "Audit" | "Tax" | string;
  icon: string;
  tab?: string;
}

export const WAREHOUSES: string[] = [
  "Main",
  "Warehouse A",
  "Warehouse B",
];

export const ALL_REPORTS: ReportDefinition[] = [
  {
    id: 1,
    title: "Stock Ledger",
    description: "Track all inventory movements, in/out flows, and running stock.",
    category: "Inventory",
    icon: "SL",
    tab: "report_stock_ledger",
  },
  {
    id: 2,
    title: "Customer Ledger",
    description: "Per-customer balances, invoices, and payment history.",
    category: "Sales",
    icon: "CL",
    tab: "report_customer_ledger",
  },
  {
    id: 3,
    title: "Vendor Ledger",
    description: "Payables, bills, and settlement history by vendor.",
    category: "Financial",
    icon: "VL",
    tab: "report_vendor_ledger",
  },
  {
    id: 4,
    title: "Low Inventory Report",
    description: "Track low-stock items with category and vendor filters.",
    category: "Inventory",
    icon: "LI",
    tab: "report_low_inventory",
  },
];
