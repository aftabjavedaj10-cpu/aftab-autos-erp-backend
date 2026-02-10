import React, { useMemo, useState } from "react";
import type { Product, Customer, Vendor, StockLedgerEntry } from "../types";

interface ReportsPageProps {
  products: Product[];
  customers: Customer[];
  vendors: Vendor[];
  stockLedger: StockLedgerEntry[];
}

const REPORT_TABS = [
  { key: "stock", label: "Stock Ledger" },
  { key: "customers", label: "Customer Ledger" },
  { key: "vendors", label: "Vendor Ledger" },
];

const ReportsPage: React.FC<ReportsPageProps> = ({
  products,
  customers,
  vendors,
  stockLedger,
}) => {
  const [activeTab, setActiveTab] = useState("stock");

  const stockRows = useMemo(() => stockLedger.slice(0, 100), [stockLedger]);

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Reports
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Ledgers and analytics for your company.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden mb-6">
        <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100 dark:border-slate-800">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${
                activeTab === tab.key
                  ? "bg-orange-600 text-white shadow-lg shadow-orange-600/20"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-orange-100/70 hover:text-orange-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "stock" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  Stock Ledger (Recent)
                </h2>
                <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                  Live movements
                </p>
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                {stockLedger.length} entries
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                    <th className="px-6 py-4">Product</th>
                    <th className="px-6 py-4">Direction</th>
                    <th className="px-6 py-4">Qty</th>
                    <th className="px-6 py-4">Reason</th>
                    <th className="px-6 py-4">When</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {stockRows.map((entry) => {
                    const product = products.find((p) => p.id === entry.productId);
                    return (
                      <tr
                        key={entry.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-[11px] font-black text-slate-900 dark:text-white">
                            {product?.name || entry.productId}
                          </div>
                          {product?.productCode && (
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              {product.productCode}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                              String(entry.direction).toUpperCase() === "OUT"
                                ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20"
                                : "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20"
                            }`}
                          >
                            {entry.direction}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                          {entry.qty}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                          {entry.reason || "—"}
                        </td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400">
                          {entry.createdAt
                            ? new Date(entry.createdAt).toLocaleString()
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                  {stockRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                      >
                        No ledger entries yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "customers" && (
          <div className="p-8">
            <div className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2">
              Customer Ledger
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Coming next. We will show per-customer balances and movement history.
            </p>
            <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Customers loaded: {customers.length}
            </div>
          </div>
        )}

        {activeTab === "vendors" && (
          <div className="p-8">
            <div className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-2">
              Vendor Ledger
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Coming next. We will show payables, bills, and payments.
            </p>
            <div className="mt-4 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              Vendors loaded: {vendors.length}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportsPage;
