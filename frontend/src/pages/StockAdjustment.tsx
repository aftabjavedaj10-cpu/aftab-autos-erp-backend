import React, { useMemo, useState } from "react";
import type { Product, StockLedgerEntry } from "../types";
import Pagination from "../components/Pagination";

interface StockAdjustmentPageProps {
  rows: StockLedgerEntry[];
  products: Product[];
  onAddClick: () => void;
}

const StockAdjustmentPage: React.FC<StockAdjustmentPageProps> = ({
  rows,
  products,
  onAddClick,
}) => {
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [products]);

  const adjustmentRows = useMemo(
    () => rows.filter((r) => String(r.source || "").toLowerCase() === "stock_adjustment"),
    [rows]
  );

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return adjustmentRows.filter((r) => {
      const product = productMap.get(String(r.productId));
      const productName = String(product?.name || "").toLowerCase();
      const productCode = String((product as any)?.productCode || "").toLowerCase();
      const invoiceRef = String(r.sourceRef || "").toLowerCase();
      const reason = String(r.reason || "").toLowerCase();
      const matchesDirection =
        direction === "all" || String(r.direction || "").toLowerCase() === direction;
      const matchesQuery =
        !query ||
        productName.includes(query) ||
        productCode.includes(query) ||
        invoiceRef.includes(query) ||
        reason.includes(query);
      return matchesDirection && matchesQuery;
    });
  }, [adjustmentRows, productMap, direction, search]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Stock Adjustment
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Manual stock correction history
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black py-2 px-4 rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 text-[10px] uppercase tracking-widest"
        >
          Add Adjustment
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row gap-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search product/code/reference/reason..."
            className="flex-1 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
          />
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
            className="w-full md:w-44 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white"
          >
            <option value="all">All</option>
            <option value="in">IN</option>
            <option value="out">OUT</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row) => {
                const product = productMap.get(String(row.productId));
                return (
                  <tr key={row.id} className="hover:bg-slate-50 text-[11px]">
                    <td className="px-4 py-2 font-black text-slate-900 dark:text-white">
                      {product?.name || `#${row.productId}`}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">
                      {(product as any)?.productCode || "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${
                          String(row.direction).toUpperCase() === "OUT"
                            ? "bg-rose-50 text-rose-600 border-rose-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        }`}
                      >
                        {row.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-black text-slate-700">{row.qty}</td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500">{row.reason || "-"}</td>
                    <td className="px-4 py-2 text-[10px] font-black text-indigo-600">{row.sourceRef || "-"}</td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-400">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                    </td>
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    No adjustments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredRows.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>
    </div>
  );
};

export default StockAdjustmentPage;

