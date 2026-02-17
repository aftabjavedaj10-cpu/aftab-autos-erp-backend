import React, { useMemo, useState } from "react";
import type { Category, Product, Vendor } from "../types";

interface LowInventoryReportPageProps {
  onBack: () => void;
  products: Product[];
  categories: Category[];
  vendors: Vendor[];
}

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const LowInventoryReportPage: React.FC<LowInventoryReportPageProps> = ({
  onBack,
  products,
  categories,
  vendors,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((v) => map.set(String(v.id || ""), String(v.name || "")));
    return map;
  }, [vendors]);

  const categoryOptions = useMemo(() => {
    const base = categories
      .filter((c) => String(c.type || "").toLowerCase() === "product")
      .map((c) => c.name)
      .filter(Boolean);
    const fromProducts = products.map((p) => String(p.category || "").trim()).filter(Boolean);
    return ["All", ...Array.from(new Set([...base, ...fromProducts]))];
  }, [categories, products]);

  const vendorOptions = useMemo(() => {
    return ["All", ...vendors.map((v) => String(v.name || "").trim()).filter(Boolean)];
  }, [vendors]);

  const rows = useMemo(() => {
    return products
      .map((p) => {
        const stockInHand = toNumber(
          p.stockOnHand !== undefined ? p.stockOnHand : p.stockAvailable !== undefined ? p.stockAvailable : p.stock
        );
        const reorderPoint = toNumber(p.reorderPoint);
        return {
          ...p,
          stockInHand,
          reorderPoint,
          vendorName: vendorNameById.get(String(p.vendorId || "")) || "",
        };
      })
      .filter((p) => p.stockInHand <= p.reorderPoint)
      .filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          String(p.name || "").toLowerCase().includes(q) ||
          String(p.productCode || "").toLowerCase().includes(q)
        );
      })
      .filter((p) => categoryFilter === "All" || String(p.category || "").trim() === categoryFilter)
      .filter((p) => vendorFilter === "All" || String(p.vendorName || "").trim() === vendorFilter)
      .sort((a, b) => a.stockInHand - b.stockInHand);
  }, [products, vendorNameById, search, categoryFilter, vendorFilter]);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={onBack}
              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm active:scale-95"
            >
              <span className="text-sm">←</span>
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Low Inventory Report
            </h1>
          </div>
          <p className="text-slate-500 text-[8px] uppercase tracking-widest">Audit Hub</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Search Product
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
              placeholder="Code or product name..."
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Category
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[12px] font-bold"
            >
              {categoryOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Vendor
            </label>
            <select
              value={vendorFilter}
              onChange={(e) => setVendorFilter(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[12px] font-bold"
            >
              {vendorOptions.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-extrabold uppercase text-slate-600 tracking-widest border-b">
                <th className="px-4 py-3 w-40">Product Code</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-right w-40">Stock In Hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-slate-50 text-[11px] border-b border-slate-200">
                  <td className="px-4 py-1.5 font-medium text-slate-700 uppercase">{row.productCode || "-"}</td>
                  <td className="px-4 py-1.5 font-medium text-slate-900 uppercase">{row.name || "-"}</td>
                  <td className="px-4 py-1.5 text-right font-black text-rose-600">{row.stockInHand.toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    No low inventory products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LowInventoryReportPage;

