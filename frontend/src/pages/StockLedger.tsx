import React, { useMemo, useState } from "react";
import type { Product, StockLedgerEntry } from "../types";
import Pagination from "../components/Pagination";

interface StockLedgerPageProps {
  onBack: () => void;
  products: Product[];
  stockLedger: StockLedgerEntry[];
}

const StockLedgerPage: React.FC<StockLedgerPageProps> = ({
  onBack,
  products,
  stockLedger,
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

  const filteredRows = useMemo(() => {
    const query = search.toLowerCase().trim();
    const dir = direction.toLowerCase();
    return stockLedger.filter((entry) => {
      const product = productMap.get(String(entry.productId));
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
  }, [stockLedger, productMap, search, direction]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, currentPage, rowsPerPage]);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={onBack}
              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm active:scale-95"
            >
              <span className="text-sm">←</span>
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Stock Ledger
            </h1>
          </div>
          <p className="text-slate-500 text-[8px] uppercase tracking-widest">
            Audit Hub
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="relative w-full md:w-72">
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">
              🔍
            </span>
            <input
              type="text"
              placeholder="Search product/reason..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 rounded-xl py-2 pl-9 pr-3 text-[11px] font-bold dark:text-white outline-none"
            />
          </div>
          <div className="w-full md:w-40">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[11px] font-bold"
            >
              <option value="all">All</option>
              <option value="in">IN</option>
              <option value="out">OUT</option>
            </select>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {filteredRows.length} / {stockLedger.length}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b">
                <th className="px-4 py-3">Product</th>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Unit</th>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((entry) => {
                const product = productMap.get(String(entry.productId));
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 text-[11px]">
                    <td className="px-4 py-2 font-black text-slate-900">
                      {product?.name || entry.productId}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">
                      {product?.productCode || "-"}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">
                      {product?.unit || "-"}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`text-[10px] font-black uppercase px-2 py-1 rounded border ${
                          String(entry.direction).toUpperCase() === "OUT"
                            ? "bg-rose-50 text-rose-600 border-rose-100"
                            : "bg-emerald-50 text-emerald-600 border-emerald-100"
                        }`}
                      >
                        {entry.direction}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-black text-slate-700">
                      {entry.qty}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500">
                      {entry.reason || "—"}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-400">
                      {entry.createdAt
                        ? new Date(entry.createdAt).toLocaleString()
                        : "—"}
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
                    No ledger entries.
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

export default StockLedgerPage;
