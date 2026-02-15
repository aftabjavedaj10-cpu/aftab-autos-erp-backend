import React, { useMemo, useState, useEffect, useRef } from "react";
import type { Product, StockLedgerEntry } from "../types";
import { formatDateDMY } from "../services/dateFormat";
import { FiCalendar } from "react-icons/fi";

interface StockLedgerPageProps {
  onBack: () => void;
  products: Product[];
  stockLedger: StockLedgerEntry[];
}

const parseDMYToISO = (value: string): string | null => {
  const trimmed = String(value || "").trim();
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  if (date.toISOString().slice(0, 10) !== iso) return null;
  return iso;
};

const StockLedgerPage: React.FC<StockLedgerPageProps> = ({
  onBack,
  products,
  stockLedger,
}) => {
  const defaultToDate = new Date().toISOString().split("T")[0];
  const defaultFromDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  })();

  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [direction, setDirection] = useState("all");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const [fromDate, setFromDate] = useState(defaultFromDate);
  const [toDate, setToDate] = useState(defaultToDate);
  const [fromDateInput, setFromDateInput] = useState(formatDateDMY(defaultFromDate));
  const [toDateInput, setToDateInput] = useState(formatDateDMY(defaultToDate));
  const searchRef = useRef<HTMLDivElement>(null);
  const fromDatePickerRef = useRef<HTMLInputElement>(null);
  const toDatePickerRef = useRef<HTMLInputElement>(null);

  const productMap = useMemo(() => {
    const map = new Map<string, Product>();
    products.forEach((p) => map.set(String(p.id), p));
    return map;
  }, [products]);

  const filteredProductList = useMemo(() => {
    const query = productSearch.toLowerCase().trim();
    if (!query) return products.slice(0, 30);
    return products
      .filter((p) => {
        const name = String(p.name || "").toLowerCase();
        const code = String(
          (p as any).productCode || (p as any).product_code || ""
        ).toLowerCase();
        const id = String(p.id || "").toLowerCase();
        return name.includes(query) || code.includes(query) || id.includes(query);
      })
      .slice(0, 30);
  }, [products, productSearch]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [productSearch, showResults]);

  useEffect(() => {
    setFromDateInput(formatDateDMY(fromDate));
  }, [fromDate]);

  useEffect(() => {
    setToDateInput(formatDateDMY(toDate));
  }, [toDate]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectProduct = (product: Product) => {
    setSelectedProductId(String(product.id));
    setProductSearch(product.name);
    setShowResults(false);
  };

  const handleProductSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filteredProductList.length - 1, 0))
      );
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const target = filteredProductList[highlightedIndex];
      if (target) selectProduct(target);
      return;
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (!selectedProductId) return [];
    const dir = direction.toLowerCase();
    const invoiceQuery = invoiceSearch.trim().toLowerCase();
    const startDate = fromDate ? new Date(fromDate) : null;
    const endDate = toDate ? new Date(toDate) : null;
    if (startDate) startDate.setHours(0, 0, 0, 0);
    if (endDate) endDate.setHours(23, 59, 59, 999);

    return stockLedger.filter((entry) => {
      const matchesProduct = String(entry.productId) === String(selectedProductId);
      const matchesDirection =
        dir === "all" || String(entry.direction || "").toLowerCase() === dir;
      const invoiceText = String(entry.sourceRef || entry.sourceId || "").toLowerCase();
      const matchesInvoice = !invoiceQuery || invoiceText.includes(invoiceQuery);

      const entryDate = entry.createdAt ? new Date(entry.createdAt) : null;
      const matchesFrom = !startDate || (!!entryDate && entryDate >= startDate);
      const matchesTo = !endDate || (!!entryDate && entryDate <= endDate);
      return matchesProduct && matchesDirection && matchesInvoice && matchesFrom && matchesTo;
    });
  }, [stockLedger, selectedProductId, direction, invoiceSearch, fromDate, toDate]);

  const stockSummary = useMemo(() => {
    if (!selectedProductId) {
      return { onHand: 0, reserved: 0, available: 0 };
    }
    const productRows = stockLedger.filter(
      (entry) => String(entry.productId) === String(selectedProductId)
    );

    const onHand = productRows.reduce((sum, entry) => {
      const qty = Number(entry.qty || 0);
      const dir = String(entry.direction || "").toUpperCase();
      return sum + (dir === "OUT" ? -qty : qty);
    }, 0);

    const reserved = productRows.reduce((sum, entry) => {
      const dir = String(entry.direction || "").toUpperCase();
      const reason = String(entry.reason || "").toLowerCase();
      const qty = Number(entry.qty || 0);
      if (dir === "OUT" && reason === "invoice_pending") return sum + qty;
      if (dir === "IN" && reason === "invoice_reversal") return Math.max(0, sum - qty);
      return sum;
    }, 0);

    const available = Math.max(0, onHand - reserved);
    return { onHand, reserved, available };
  }, [selectedProductId, stockLedger]);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4 print:hidden">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={onBack}
              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm active:scale-95"
            >
              <span className="text-sm">&larr;</span>
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
          <div className="relative w-full md:w-72" ref={searchRef}>
            <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">
              Search
            </span>
            <input
              type="text"
              placeholder="Search and select product..."
              value={productSearch}
              onFocus={() => setShowResults(true)}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setSelectedProductId("");
                setShowResults(true);
              }}
              onKeyDown={handleProductSearchKeyDown}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 rounded-xl py-2 pl-16 pr-12 text-[11px] font-bold dark:text-white outline-none"
            />
            {!!selectedProductId && (
              <button
                onClick={() => {
                  setSelectedProductId("");
                  setProductSearch("");
                  setShowResults(false);
                }}
                className="absolute inset-y-0 right-3 text-slate-400 hover:text-rose-600 text-xs font-black"
                title="Clear selection"
              >
                X
              </button>
            )}
            {showResults && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
                {filteredProductList.length > 0 ? (
                  filteredProductList.map((p, idx) => (
                    <button
                      key={p.id}
                      onClick={() => selectProduct(p)}
                      className={`w-full text-left px-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                        highlightedIndex === idx
                          ? "bg-orange-50 dark:bg-slate-800"
                          : "hover:bg-orange-50 dark:hover:bg-slate-800"
                      }`}
                    >
                      <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase">
                        {p.name}
                      </p>
                      <p className="text-[9px] text-slate-400 font-bold uppercase">
                        {(p as any).productCode || (p as any).product_code || p.id}
                      </p>
                    </button>
                  ))
                ) : (
                  <div className="px-4 py-3 text-[11px] font-bold text-slate-400">
                    No products found
                  </div>
                )}
              </div>
            )}
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
          <div className="w-full md:w-48">
            <input
              type="text"
              placeholder="Search Invoice #..."
              value={invoiceSearch}
              onChange={(e) => setInvoiceSearch(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[11px] font-bold outline-none"
            />
          </div>
          <div className="w-full md:w-auto flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={fromDateInput}
                onChange={(e) => setFromDateInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDMYToISO(fromDateInput);
                  if (parsed) {
                    setFromDate(parsed);
                  } else {
                    setFromDateInput(formatDateDMY(fromDate));
                  }
                }}
                className="bg-slate-50 border rounded-xl py-2 pl-3 pr-8 text-[11px] font-bold outline-none w-32"
                title="From date"
                placeholder="dd/mm/yyyy"
              />
              <input
                ref={fromDatePickerRef}
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="absolute pointer-events-none opacity-0 w-0 h-0"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  const el = fromDatePickerRef.current;
                  if (!el) return;
                  if ((el as any).showPicker) {
                    (el as any).showPicker();
                  } else {
                    el.click();
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-600"
                aria-label="Open from date picker"
              >
                <FiCalendar className="text-[14px]" />
              </button>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">to</span>
            <div className="relative">
              <input
                type="text"
                value={toDateInput}
                onChange={(e) => setToDateInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDMYToISO(toDateInput);
                  if (parsed) {
                    setToDate(parsed);
                  } else {
                    setToDateInput(formatDateDMY(toDate));
                  }
                }}
                className="bg-slate-50 border rounded-xl py-2 pl-3 pr-8 text-[11px] font-bold outline-none w-32"
                title="To date"
                placeholder="dd/mm/yyyy"
              />
              <input
                ref={toDatePickerRef}
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="absolute pointer-events-none opacity-0 w-0 h-0"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  const el = toDatePickerRef.current;
                  if (!el) return;
                  if ((el as any).showPicker) {
                    (el as any).showPicker();
                  } else {
                    el.click();
                  }
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-orange-600"
                aria-label="Open to date picker"
              >
                <FiCalendar className="text-[14px]" />
              </button>
            </div>
          </div>
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            {selectedProductId ? "Selected product entries" : "Select a product to view ledger"}:{" "}
            {selectedProductId ? filteredRows.length : 0}
          </div>
        </div>
      </div>

      {selectedProductId && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Stock In Hand
            </p>
            <p className="text-xl font-black text-slate-900 dark:text-white">
              {stockSummary.onHand}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Reserved Qty
            </p>
            <p className="text-xl font-black text-amber-600">
              {stockSummary.reserved}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-1">
              Available Qty
            </p>
            <p className="text-xl font-black text-emerald-600">
              {stockSummary.available}
            </p>
          </div>
        </div>
      )}

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
                <th className="px-4 py-3">Invoice #</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((entry) => {
                const product = productMap.get(String(entry.productId));
                return (
                  <tr key={entry.id} className="hover:bg-slate-50 text-[11px]">
                    <td className="px-4 py-2 font-black text-slate-900">
                      {product?.name || entry.productId}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500 uppercase">
                      {(product as any)?.productCode || (product as any)?.product_code || "-"}
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
                    <td className="px-4 py-2 text-[10px] font-black text-indigo-600">
                      {entry.sourceRef || "-"}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-500">
                      {entry.reason || "-"}
                    </td>
                    <td className="px-4 py-2 text-[10px] font-bold text-slate-400">
                      {formatDateDMY(entry.createdAt)}
                    </td>
                  </tr>
                );
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    No ledger entries.
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

export default StockLedgerPage;
