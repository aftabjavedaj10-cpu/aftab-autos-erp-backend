import React, { useMemo, useRef, useEffect, useState } from "react";
import type { SalesInvoice, Vendor } from "../types";
import Pagination from "../components/Pagination";
import { formatDateDMY } from "../services/dateFormat";

interface LedgerEntry {
  id: string;
  date: string;
  postedAt?: string;
  orderHint?: number;
  description: string;
  reference: string;
  type: "Bill" | "Payment" | "Return";
  debit: number;
  credit: number;
}

const parseRefNumber = (value: string) => {
  const match = String(value || "").match(/(\d+)\s*$/);
  return match ? Number(match[1]) : -1;
};

const ledgerTypePriority: Record<LedgerEntry["type"], number> = {
  Bill: 1,
  Return: 2,
  Payment: 3,
};

const compareLedgerEntries = (a: LedgerEntry, b: LedgerEntry): number => {
  const aOpen = a.description === "Opening Balance";
  const bOpen = b.description === "Opening Balance";
  if (aOpen !== bOpen) return aOpen ? -1 : 1;
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  const aPosted = String(a.postedAt || "");
  const bPosted = String(b.postedAt || "");
  if (aPosted !== bPosted) return aPosted.localeCompare(bPosted);
  const aHint = Number.isFinite(a.orderHint) ? Number(a.orderHint) : 0;
  const bHint = Number.isFinite(b.orderHint) ? Number(b.orderHint) : 0;
  if (aHint !== bHint) return aHint - bHint;
  const aRefNum = parseRefNumber(a.reference || a.id);
  const bRefNum = parseRefNumber(b.reference || b.id);
  if (aRefNum !== bRefNum) return aRefNum - bRefNum;
  const aType = ledgerTypePriority[a.type] ?? 99;
  const bType = ledgerTypePriority[b.type] ?? 99;
  if (aType !== bType) return aType - bType;
  return String(a.reference || a.id).localeCompare(String(b.reference || b.id));
};

const TRANSACTION_TYPES = ["All Types", "Bill", "Payment", "Return"];

interface VendorLedgerPageProps {
  onBack: () => void;
  vendors: Vendor[];
  purchaseInvoices: SalesInvoice[];
}

const VendorLedgerPage: React.FC<VendorLedgerPageProps> = ({
  onBack,
  vendors,
  purchaseInvoices,
}) => {
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [startDate, setStartDate] = useState<string>("2023-10-01");
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const selectedVendor = useMemo(
    () => vendors.find((v) => String(v.id || "") === String(selectedVendorId || "")),
    [selectedVendorId, vendors]
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredVendorList = useMemo(() => {
    if (!vendorSearch || selectedVendor?.name === vendorSearch) return vendors;
    return vendors.filter(
      (v) => {
        const name = String(v.name || "").toLowerCase();
        const id = String(v.id || "").toLowerCase();
        const query = vendorSearch.toLowerCase();
        return name.includes(query) || id.includes(query);
      }
    );
  }, [vendorSearch, selectedVendor, vendors]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [vendorSearch, showResults]);

  const rawEntries = useMemo(() => {
    const entries: LedgerEntry[] = [];
    const vendorId = selectedVendorId;
    const vendor = vendors.find((v) => String(v.id || "") === String(vendorId || ""));
    const opening = Number(vendor?.balance || 0);
    if (!Number.isNaN(opening) && opening !== 0) {
      entries.push({
        id: `open-${vendorId}`,
        date: "2023-10-01",
        postedAt: "2023-10-01T00:00:00.000Z",
        orderHint: -100,
        description: "Opening Balance",
        reference: "-",
        type: "Bill",
        debit: opening > 0 ? opening : 0,
        credit: opening < 0 ? Math.abs(opening) : 0,
      });
    }

    const vendorInvoices = purchaseInvoices
      .filter((inv) => String(inv.customerId || "") === String(vendorId))
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

    vendorInvoices.forEach((inv) => {
      const manualRef = String(inv.reference || "").trim();
      const baseRef = manualRef || String(inv.id || "");
      entries.push({
        id: `bill-${inv.id}`,
        date: inv.date,
        postedAt: String((inv as any).createdAt || (inv as any).updatedAt || inv.date || ""),
        orderHint: 10,
        description: `Purchase Bill - ${inv.id}`,
        reference: baseRef,
        type: "Bill",
        debit: Number(inv.totalAmount || 0),
        credit: 0,
      });
      const paid = Number(inv.amountReceived || 0);
      if (paid > 0) {
        entries.push({
          id: `pay-${inv.id}`,
          date: inv.date,
          postedAt: String((inv as any).createdAt || (inv as any).updatedAt || inv.date || ""),
          orderHint: 20,
          description: "Payment Made",
          reference: baseRef,
          type: "Payment",
          debit: 0,
          credit: paid,
        });
      }
    });

    return entries.sort(compareLedgerEntries);
  }, [vendors, selectedVendorId, purchaseInvoices]);

  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      const matchesDate = entry.date >= startDate && entry.date <= endDate;
      const matchesType = typeFilter === "All Types" || entry.type === typeFilter;
      return matchesDate && matchesType;
    });
  }, [rawEntries, startDate, endDate, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedVendorId, startDate, endDate, typeFilter]);

  const paginatedEntries = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredEntries.slice(start, start + rowsPerPage);
  }, [filteredEntries, currentPage, rowsPerPage]);

  const totals = useMemo(() => {
    return filteredEntries.reduce(
      (acc, entry) => ({
        debit: acc.debit + entry.debit,
        credit: acc.credit + entry.credit,
      }),
      { debit: 0, credit: 0 }
    );
  }, [filteredEntries]);

  const closingBalance = totals.debit - totals.credit;

  const runningBalances = useMemo(() => {
    let running = 0;
    const map = new Map<string, number>();
    filteredEntries.forEach((entry) => {
      running += entry.debit - entry.credit;
      map.set(entry.id, running);
    });
    return map;
  }, [filteredEntries]);

  const handleSelectVendor = (vendor: Vendor) => {
    setSelectedVendorId(String(vendor.id));
    setVendorSearch(vendor.name);
    setShowResults(false);
  };

  const handleVendorSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filteredVendorList.length - 1, 0))
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
      const target = filteredVendorList[highlightedIndex];
      if (target) handleSelectVendor(target);
      return;
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

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
              Vendor Ledger
            </h1>
          </div>
          <p className="text-slate-500 text-[8px] uppercase tracking-widest">
            Audit Hub
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="bg-slate-900 text-white font-black py-2 px-6 rounded-xl text-[9px] uppercase tracking-widest shadow-md"
        >
          Print Statement
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 mb-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="md:col-span-1 relative" ref={searchRef}>
            <div className="relative group">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[12px]">🔍</span>
              <input
                type="text"
                value={vendorSearch}
                onFocus={() => setShowResults(true)}
                onChange={(e) => {
                  setVendorSearch(e.target.value);
                  setShowResults(true);
                }}
                onKeyDown={handleVendorSearchKeyDown}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all placeholder:text-slate-400"
                placeholder="Search vendor..."
              />
            </div>
            {showResults && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {filteredVendorList.map((v, idx) => (
                  <button
                    key={v.id}
                    onClick={() => handleSelectVendor(v)}
                    className={`w-full text-left px-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      highlightedIndex === idx
                        ? "bg-orange-50 dark:bg-slate-800"
                        : "hover:bg-orange-50 dark:hover:bg-slate-800"
                    }`}
                  >
                    <p className="text-[11px] font-black text-slate-900 uppercase">
                      {v.name}
                    </p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">
                      {v.id}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              From
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-1.5 px-3 text-[11px] font-bold"
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              To
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-1.5 px-3 text-[11px] font-bold"
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Type
            </label>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-1.5 px-3 text-[11px] font-bold"
            >
              {TRANSACTION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
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
              <tr className="bg-slate-50/80 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b">
                <th className="px-4 py-3 w-24">Date</th>
                <th className="px-4 py-3">Narration</th>
                <th className="px-4 py-3 w-24">Ref</th>
                <th className="px-4 py-3 text-right w-28">Debit</th>
                <th className="px-4 py-3 text-right w-28">Credit</th>
                <th className="px-4 py-3 text-right w-32 bg-slate-100/30">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {paginatedEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 text-[11px]">
                  <td className="px-4 py-2 font-bold text-slate-500 italic">
                    {formatDateDMY(entry.date)}
                  </td>
                  <td className="px-4 py-2 font-black uppercase text-slate-900">
                    {entry.description}
                  </td>
                  <td className="px-4 py-2 font-mono text-[9px] font-black text-slate-400 uppercase">
                    {entry.reference}
                  </td>
                  <td className="px-4 py-2 text-right font-black text-orange-600">
                    {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-black text-emerald-600">
                    {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-2 text-right font-black bg-slate-50/20 italic text-slate-400 tracking-tighter">
                    {(runningBalances.get(entry.id) || 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {paginatedEntries.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest"
                  >
                    No ledger entries.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 border-t bg-slate-50/30 text-center">
          <div className="p-4 border-b md:border-b-0 md:border-r">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              Total Bills (Dr)
            </p>
            <p className="text-sm font-black text-orange-600">
              Rs. {totals.debit.toLocaleString()}
            </p>
          </div>
          <div className="p-4 border-b md:border-b-0 md:border-r">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              Total Payments (Cr)
            </p>
            <p className="text-sm font-black text-emerald-600">
              Rs. {totals.credit.toLocaleString()}
            </p>
          </div>
          <div className="p-4 md:col-span-2 bg-orange-600/5">
            <p className="text-[8px] font-black text-orange-600 uppercase tracking-widest mb-0.5">
              Closing Balance
            </p>
            <p className="text-sm font-black">
              Rs. {Math.abs(closingBalance).toLocaleString()}{" "}
              {closingBalance >= 0 ? "DR" : "CR"}
            </p>
          </div>
        </div>
        <Pagination
          totalItems={filteredEntries.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>
    </div>
  );
};

export default VendorLedgerPage;
