import React, { useEffect, useMemo, useState } from "react";
import type { Category, Product, SalesInvoice, Vendor } from "../types";

interface LowInventoryReportPageProps {
  onBack: () => void;
  products: Product[];
  categories: Category[];
  vendors: Vendor[];
  purchaseOrders: SalesInvoice[];
  onBulkAddToPurchaseOrder: (payload: { productIds: string[]; purchaseOrderId?: string }) => Promise<void>;
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
  purchaseOrders,
  onBulkAddToPurchaseOrder,
}) => {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [vendorFilter, setVendorFilter] = useState("All");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

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
    return [
      { value: "All", label: "All" },
      ...vendors
        .map((v) => ({
          value: String(v.id || "").trim(),
          label: String(v.name || "").trim(),
        }))
        .filter((v) => v.value && v.label),
    ];
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
          vendorId: String(p.vendorId || "").trim(),
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
      .filter((p) => vendorFilter === "All" || String((p as any).vendorId || "") === vendorFilter)
      .sort((a, b) => a.stockInHand - b.stockInHand);
  }, [products, vendorNameById, search, categoryFilter, vendorFilter]);

  const purchaseOrderOptions = useMemo(() => {
    const base = purchaseOrders
      .filter((po) => {
        if (vendorFilter === "All") return true;
        return String(po.customerId || "").trim() === vendorFilter;
      })
      .filter((po) => !["Void", "Deleted"].includes(String(po.status || "")))
      .sort((a, b) => String(b.id).localeCompare(String(a.id)));
    return base;
  }, [purchaseOrders, vendorFilter]);

  const selectedRows = useMemo(() => {
    return rows.filter((r) => selectedIds.has(String(r.id)));
  }, [rows, selectedIds]);

  useEffect(() => {
    setSelectedIds(new Set());
    setSelectedPurchaseOrderId("");
    setActionError("");
  }, [search, categoryFilter, vendorFilter]);

  const toggleAll = () => {
    if (selectedIds.size > 0 && selectedRows.length === rows.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(rows.map((r) => String(r.id))));
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const runBulkAction = async (purchaseOrderId?: string) => {
    if (selectedRows.length === 0) return;
    try {
      setIsSubmitting(true);
      setActionError("");
      await onBulkAddToPurchaseOrder({
        productIds: selectedRows.map((r) => String(r.id)),
        purchaseOrderId: purchaseOrderId || undefined,
      });
      setSelectedIds(new Set());
      setSelectedPurchaseOrderId("");
    } catch (error: any) {
      setActionError(error?.message || "Failed to process purchase order action.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <option key={opt.value} value={opt.value}>
                  {opt.label}
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
                <th className="px-3 py-3 w-12">
                  <button
                    onClick={toggleAll}
                    className={`w-4 h-4 rounded border flex items-center justify-center ${
                      selectedRows.length === rows.length && rows.length > 0
                        ? "bg-orange-600 border-orange-600"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {selectedRows.length === rows.length && rows.length > 0 && (
                      <span className="text-white text-[10px]">✓</span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-3 w-40">Product Code</th>
                <th className="px-4 py-3">Product Name</th>
                <th className="px-4 py-3 text-right w-40">Alert Level</th>
                <th className="px-4 py-3 text-right w-40">Reorder Qty</th>
                <th className="px-4 py-3 text-right w-40">Stock In Hand</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.id)} className="hover:bg-slate-50 text-[11px] border-b border-slate-200">
                  <td className="px-3 py-1.5">
                    <button
                      onClick={() => toggleOne(String(row.id))}
                      className={`w-4 h-4 rounded border flex items-center justify-center ${
                        selectedIds.has(String(row.id)) ? "bg-orange-600 border-orange-600" : "border-slate-300 bg-white"
                      }`}
                    >
                      {selectedIds.has(String(row.id)) && <span className="text-white text-[10px]">✓</span>}
                    </button>
                  </td>
                  <td className="px-4 py-1.5 font-medium text-slate-700 uppercase">{row.productCode || "-"}</td>
                  <td className="px-4 py-1.5 font-medium text-slate-900 uppercase">{row.name || "-"}</td>
                  <td className="px-4 py-1.5 text-right font-black text-amber-600">{row.reorderPoint.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-black text-sky-700">{Number((row as any).reorderQty ?? 1).toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-black text-rose-600">{row.stockInHand.toLocaleString()}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    No low inventory products found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {actionError && (
        <div className="mt-3 px-4 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-bold">
          {actionError}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] bg-slate-900 text-white rounded-2xl px-4 py-3 shadow-2xl border border-white/10 flex flex-wrap items-center gap-3">
          <span className="text-[10px] font-black uppercase tracking-wider">
            {selectedRows.length} selected
          </span>
          <select
            value={selectedPurchaseOrderId}
            onChange={(e) => setSelectedPurchaseOrderId(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg py-1.5 px-2 text-[11px] font-bold min-w-[180px]"
          >
            <option value="">Select Purchase Order #</option>
            {purchaseOrderOptions.map((po) => (
              <option key={String(po.id)} value={String(po.id)}>
                {String(po.id)} - {String(po.customerName || "")}
              </option>
            ))}
          </select>
          <button
            onClick={() => runBulkAction(selectedPurchaseOrderId)}
            disabled={!selectedPurchaseOrderId || isSubmitting}
            className="px-3 py-1.5 rounded-lg bg-orange-600 disabled:bg-slate-700 text-[10px] font-black uppercase tracking-wider"
          >
            Add To PO
          </button>
          <button
            onClick={() => runBulkAction()}
            disabled={isSubmitting}
            className="px-3 py-1.5 rounded-lg bg-emerald-600 disabled:bg-slate-700 text-[10px] font-black uppercase tracking-wider"
          >
            Create New PO
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-2 py-1.5 text-[10px] font-black uppercase tracking-wider text-slate-300"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};

export default LowInventoryReportPage;
