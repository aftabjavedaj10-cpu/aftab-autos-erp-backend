import React, { useMemo, useState } from "react";
import { ALL_REPORTS } from "../constants";
import type { ReportDefinition } from "../constants";
import type { Product, Customer, Vendor, StockLedgerEntry, SalesInvoice } from "../types";

const CATEGORIES = ["All", "Sales", "Inventory", "Financial", "Audit", "Tax"];

const ReportCard: React.FC<{
  report: ReportDefinition;
  isPinned: boolean;
  onTogglePin: (e: React.MouseEvent, id: number) => void;
  onAction: (tab?: string) => void;
}> = ({ report, isPinned, onTogglePin, onAction }) => (
  <div
    onClick={() => onAction(report.tab || "reports")}
    className="bg-white dark:bg-slate-900 p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 hover:shadow-xl hover:border-orange-200 dark:hover:border-orange-900/40 transition-all group cursor-pointer flex flex-col h-full relative overflow-hidden"
  >
    <button
      onClick={(e) => onTogglePin(e, report.id)}
      className={`absolute top-2 right-2 p-2 rounded-xl transition-all z-10 ${
        isPinned
          ? "bg-orange-50 dark:bg-orange-900/20 text-orange-600 opacity-100"
          : "bg-slate-50 dark:bg-slate-800 text-slate-300 opacity-0 group-hover:opacity-100 hover:text-orange-400"
      }`}
      title={isPinned ? "Unpin from dashboard" : "Pin to dashboard"}
    >
      <span className="text-[12px]">{isPinned ? "★" : "☆"}</span>
    </button>

    <div className="flex items-start justify-between mb-4">
      <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800/50 rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 group-hover:bg-orange-50 dark:group-hover:bg-orange-900/20 transition-all">
        {report.icon}
      </div>
      <div className="text-right pr-6">
        <span className="text-[8px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
          {report.category}
        </span>
      </div>
    </div>
    <h3 className="text-sm font-black text-slate-900 dark:text-white mb-2 uppercase tracking-tight leading-tight group-hover:text-orange-600 transition-colors">
      {report.title}
    </h3>
    <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed mb-6 font-medium line-clamp-2 flex-1">
      {report.description}
    </p>
    <div className="flex items-center justify-between pt-4 border-t border-slate-50 dark:border-slate-800">
      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest group-hover:text-orange-600 transition-colors">
        Access Analytics
      </span>
      <span className="text-sm opacity-0 group-hover:opacity-100 translate-x-2 group-hover:translate-x-0 transition-all text-orange-600">
        ➜
      </span>
    </div>
  </div>
);

interface ReportsPageProps {
  onNavigate: (tab: string) => void;
  pinnedIds: number[];
  onTogglePin: (id: number) => void;
  stockLedger?: StockLedgerEntry[];
  products?: Product[];
  customers?: Customer[];
  vendors?: Vendor[];
  salesInvoices?: SalesInvoice[];
}

const ReportsPage: React.FC<ReportsPageProps> = ({
  onNavigate,
  pinnedIds,
  onTogglePin,
  stockLedger = [],
  products = [],
  customers = [],
  vendors = [],
  salesInvoices = [],
}) => {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [activeReportId, setActiveReportId] = useState<number | null>(null);
  const [stockSearch, setStockSearch] = useState("");
  const [stockDirection, setStockDirection] = useState("all");
  const [customerSearch, setCustomerSearch] = useState("");
  const [vendorSearch, setVendorSearch] = useState("");

  const togglePin = (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    onTogglePin(id);
  };

  const filteredReports = useMemo(() => {
    return ALL_REPORTS.filter((r) => {
      const matchesSearch =
        r.title.toLowerCase().includes(search.toLowerCase()) ||
        r.category.toLowerCase().includes(search.toLowerCase()) ||
        r.description.toLowerCase().includes(search.toLowerCase());
      const matchesCat = activeCategory === "All" || r.category === activeCategory;
      return matchesSearch && matchesCat;
    });
  }, [search, activeCategory]);

  const pinnedReports = useMemo(
    () => ALL_REPORTS.filter((r) => pinnedIds.includes(r.id)),
    [pinnedIds]
  );

  const activeReport = useMemo(
    () => ALL_REPORTS.find((r) => r.id === activeReportId) || null,
    [activeReportId]
  );

  const stockRows = useMemo(() => {
    const query = stockSearch.toLowerCase().trim();
    const dir = stockDirection.toLowerCase();
    return stockLedger.filter((entry) => {
      const product = products.find((p) => p.id === entry.productId);
      const haystack = [
        product?.name,
        product?.productCode,
        entry.productId,
        entry.reason,
        entry.direction,
        entry.source,
        entry.sourceRef,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || haystack.includes(query);
      const matchesDirection =
        dir === "all" || String(entry.direction || "").toLowerCase() === dir;
      return matchesSearch && matchesDirection;
    });
  }, [stockLedger, products, stockSearch, stockDirection]);

  const customerLedgerRows = useMemo(() => {
    const map = new Map<
      string,
      {
        customerId?: string;
        customerName: string;
        customerCode?: string;
        phone?: string;
        email?: string;
        totalInvoices: number;
        totalBilled: number;
        totalReceived: number;
      }
    >();

    salesInvoices.forEach((inv) => {
      const id = inv.customerId || inv.customerName || inv.id;
      const customer = customers.find((c) => c.id === inv.customerId);
      const row =
        map.get(id) || {
          customerId: inv.customerId,
          customerName: customer?.name || inv.customerName || "Unknown",
          customerCode: customer?.customerCode,
          phone: customer?.phone,
          email: customer?.email,
          totalInvoices: 0,
          totalBilled: 0,
          totalReceived: 0,
        };
      row.totalInvoices += 1;
      row.totalBilled += Number(inv.totalAmount || 0);
      row.totalReceived += Number(inv.amountReceived || 0);
      map.set(id, row);
    });

    customers.forEach((c) => {
      if (!map.has(c.id || c.name)) {
        map.set(c.id || c.name, {
          customerId: c.id,
          customerName: c.name,
          customerCode: c.customerCode,
          phone: c.phone,
          email: c.email,
          totalInvoices: 0,
          totalBilled: 0,
          totalReceived: 0,
        });
      }
    });

    const query = customerSearch.toLowerCase().trim();
    return Array.from(map.values()).filter((row) => {
      if (!query) return true;
      const haystack = [
        row.customerName,
        row.customerCode,
        row.phone,
        row.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [salesInvoices, customers, customerSearch]);

  const vendorLedgerRows = useMemo(() => {
    const query = vendorSearch.toLowerCase().trim();
    return vendors.filter((v) => {
      if (!query) return true;
      const haystack = [
        v.name,
        v.vendorCode,
        v.phone,
        v.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [vendors, vendorSearch]);

  return (
    <div className="animate-in fade-in duration-500 max-w-7xl mx-auto pb-20 px-4">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-slate-950 dark:bg-orange-600 rounded-xl flex items-center justify-center text-white text-xl shadow-lg">
              📊
            </div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase leading-none">
              Intelligence Command
            </h1>
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Real-time Decision Support & Financial Ledger Analytics
          </p>
        </div>

        <div className="relative w-full md:w-80">
          <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 pointer-events-none text-sm">
            🔍
          </span>
          <input
            type="text"
            placeholder="Search Intelligence Module..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl py-3.5 pl-12 pr-4 shadow-xl outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all font-bold text-xs dark:text-white uppercase tracking-widest placeholder:text-slate-300"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {pinnedReports.length > 0 && !search && activeCategory === "All" && (
        <section className="mb-16 animate-in slide-in-from-bottom-4 duration-700">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-[10px] font-black text-orange-600 uppercase tracking-[0.4em] whitespace-nowrap">
              Pinned Reports
            </h2>
            <div className="h-px w-full bg-orange-100 dark:bg-orange-900/30"></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            {pinnedReports.map((rep) => (
              <div
                key={rep.id}
                onClick={() => {
                  if (rep.tab && rep.tab !== "reports") {
                    onNavigate(rep.tab);
                  } else {
                    setActiveReportId(rep.id);
                  }
                }}
                className="bg-gradient-to-br from-slate-950 to-slate-900 dark:from-slate-900 dark:to-black p-5 rounded-3xl shadow-2xl border border-white/10 hover:-translate-y-1 transition-all cursor-pointer group relative"
              >
                <button
                  onClick={(e) => togglePin(e, rep.id)}
                  className="absolute top-3 right-3 text-orange-400 hover:text-orange-500 transition-colors z-10"
                >
                  <span className="text-lg">★</span>
                </button>
                <div className="flex justify-between items-start mb-6">
                  <span className="text-2xl opacity-80 group-hover:scale-110 transition-transform">
                    {rep.icon}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse shadow-[0_0_8px_rgba(249,115,22,1)] mr-4"></span>
                </div>
                <h3 className="text-white text-xs font-black uppercase tracking-widest leading-tight">
                  {rep.title}
                </h3>
                <p className="text-[9px] text-slate-400 mt-2 font-bold uppercase tracking-tighter opacity-60">
                  High Priority Analytics
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap gap-2 mb-10 overflow-x-auto no-scrollbar pb-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              activeCategory === cat
                ? "bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/20"
                : "bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-100 dark:border-slate-800 hover:border-orange-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        {filteredReports.map((report) => (
          <ReportCard
            key={report.id}
            report={report}
            isPinned={pinnedIds.includes(report.id)}
            onTogglePin={togglePin}
            onAction={(tab) => {
              if (tab && tab !== "reports") {
                onNavigate(tab);
              } else {
                setActiveReportId(report.id);
              }
            }}
          />
        ))}
      </div>

      {filteredReports.length === 0 && (
        <div className="text-center py-20 bg-white/50 dark:bg-slate-900/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-slate-800">
          <span className="text-4xl mb-4 block opacity-20">📂</span>
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">
            Query Empty
          </h3>
          <p className="text-slate-400 font-bold uppercase tracking-[0.2em] text-[8px] mt-1">
            Refine your strategic search parameters.
          </p>
        </div>
      )}

      {activeReport && (
        <div className="mt-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden animate-in fade-in duration-300">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 border-b border-slate-100 dark:border-slate-800">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {activeReport.category}
              </div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">
                {activeReport.title}
              </h2>
            </div>
            <button
              onClick={() => setActiveReportId(null)}
              className="px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-orange-600 transition-all"
            >
              Back to Reports
            </button>
          </div>

          {activeReport.title === "Stock Ledger" && (
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest">
                    Recent movements
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">
                      🔍
                    </span>
                    <input
                      type="text"
                      placeholder="Search product/reason..."
                      value={stockSearch}
                      onChange={(e) => setStockSearch(e.target.value)}
                      className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-[11px] font-bold outline-none focus:ring-4 focus:ring-orange-500/10"
                    />
                  </div>
                  <select
                    value={stockDirection}
                    onChange={(e) => setStockDirection(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-3 text-[11px] font-bold outline-none focus:ring-4 focus:ring-orange-500/10"
                  >
                    <option value="all">All</option>
                    <option value="in">IN</option>
                    <option value="out">OUT</option>
                  </select>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    {stockRows.length} / {stockLedger.length}
                  </span>
                </div>
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

          {activeReport.title === "Customer Ledger" && (
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                  Customer Ledger
                </div>
                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search customer..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-[11px] font-bold outline-none focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Customer</th>
                      <th className="px-6 py-4">Invoices</th>
                      <th className="px-6 py-4">Total Billed</th>
                      <th className="px-6 py-4">Total Received</th>
                      <th className="px-6 py-4">Balance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {customerLedgerRows.map((row) => {
                      const balance = row.totalBilled - row.totalReceived;
                      return (
                        <tr
                          key={row.customerId || row.customerName}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="px-6 py-4">
                            <div className="text-[11px] font-black text-slate-900 dark:text-white">
                              {row.customerName}
                            </div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              {row.customerCode || row.email || "—"}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                            {row.totalInvoices}
                          </td>
                          <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                            Rs. {row.totalBilled.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                            Rs. {row.totalReceived.toLocaleString()}
                          </td>
                          <td className={`px-6 py-4 text-[11px] font-black ${balance > 0 ? "text-rose-600" : "text-emerald-600"}`}>
                            Rs. {balance.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                    {customerLedgerRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                        >
                          No customer data yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeReport.title === "Vendor Ledger" && (
            <div className="p-8">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-4">
                <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-widest">
                  Vendor Ledger
                </div>
                <div className="relative w-full md:w-64">
                  <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">
                    🔍
                  </span>
                  <input
                    type="text"
                    placeholder="Search vendor..."
                    value={vendorSearch}
                    onChange={(e) => setVendorSearch(e.target.value)}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-2 pl-9 pr-3 text-[11px] font-bold outline-none focus:ring-4 focus:ring-orange-500/10"
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                      <th className="px-6 py-4">Vendor</th>
                      <th className="px-6 py-4">Contact</th>
                      <th className="px-6 py-4">Balance</th>
                      <th className="px-6 py-4">Payable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {vendorLedgerRows.map((row) => (
                      <tr
                        key={row.id}
                        className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="px-6 py-4">
                          <div className="text-[11px] font-black text-slate-900 dark:text-white">
                            {row.name}
                          </div>
                          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                            {row.vendorCode || "—"}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-[11px] font-bold text-slate-600 dark:text-slate-400">
                          {row.phone || row.email || "—"}
                        </td>
                        <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                          {row.balance ?? "—"}
                        </td>
                        <td className="px-6 py-4 text-[11px] font-black text-slate-700 dark:text-slate-300">
                          {row.payableBalance ?? "—"}
                        </td>
                      </tr>
                    ))}
                    {vendorLedgerRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                        >
                          No vendor data yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReportsPage;
