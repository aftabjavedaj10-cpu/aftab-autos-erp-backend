export interface ReportDefinition {
  id: number;
  title: string;
  description: string;
  category: "Sales" | "Inventory" | "Financial" | "Audit" | "Tax" | string;
  icon: string;
  tab?: string;
}

export const ALL_REPORTS: ReportDefinition[] = [
  {
    id: 1,
    title: "Stock Ledger",
    description: "Track all inventory movements, in/out flows, and running stock.",
    category: "Inventory",
    icon: "📦",
    tab: "reports",
  },
  {
    id: 2,
    title: "Customer Ledger",
    description: "Per-customer balances, invoices, and payment history.",
    category: "Sales",
    icon: "👤",
    tab: "reports",
  },
  {
    id: 3,
    title: "Vendor Ledger",
    description: "Payables, bills, and settlement history by vendor.",
    category: "Financial",
    icon: "🏢",
    tab: "reports",
  },
  {
    id: 4,
    title: "Sales Invoices",
    description: "Invoice register with status, totals, and dates.",
    category: "Sales",
    icon: "🧾",
    tab: "sales_invoice",
  },
  {
    id: 5,
    title: "Tax Summary",
    description: "Tax collected and payable summary by period.",
    category: "Tax",
    icon: "🧮",
    tab: "reports",
  },
  {
    id: 6,
    title: "Audit Log",
    description: "Critical changes and activity audit trail.",
    category: "Audit",
    icon: "🧷",
    tab: "reports",
  },
  {
    id: 7,
    title: "Inventory Aging",
    description: "Old stock and slow-moving items by days.",
    category: "Inventory",
    icon: "⏳",
    tab: "reports",
  },
  {
    id: 8,
    title: "Profit Snapshot",
    description: "Margin and profitability overview.",
    category: "Financial",
    icon: "💹",
    tab: "reports",
  },
];
