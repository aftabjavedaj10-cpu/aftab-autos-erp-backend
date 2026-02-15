import React, { useMemo, useRef, useEffect, useState } from "react";
import type { Company, SalesInvoice, Vendor } from "../types";
import { formatDateDMY } from "../services/dateFormat";
import { FiCalendar, FiEye } from "react-icons/fi";

interface LedgerEntry {
  id: string;
  date: string;
  postedAt?: string;
  orderHint?: number;
  viewId?: string;
  description: string;
  detailNarration?: string;
  reference: string;
  type: "Bill" | "Payment" | "Return";
  debit: number;
  credit: number;
}

const parseRefNumber = (value: string) => {
  const match = String(value || "").match(/(\d+)\s*$/);
  return match ? Number(match[1]) : -1;
};

const buildItemsNarration = (items: any[] = []) => {
  const cleaned = items
    .filter((it) => it)
    .map((it) => {
      const name = String(it.productName || it.name || "Item").trim();
      const qty = Number(it.quantity || 0);
      const rate = Number(it.unitPrice || 0);
      const discountValue = Number(it.discountValue || 0);
      const discountType = String(it.discountType || "fixed").toLowerCase();
      const total = Number(it.total ?? rate * qty);
      const discountPart =
        discountValue > 0
          ? ` (discount ${discountType === "percent" ? `${discountValue}%` : discountValue.toLocaleString()})`
          : "";
      return `${name} ${rate.toLocaleString()} x ${qty}${discountPart} = ${total.toLocaleString()}`;
    });
  return cleaned.join("\n");
};

const ledgerTypePriority: Record<LedgerEntry["type"], number> = {
  Bill: 1,
  Return: 2,
  Payment: 3,
};

const isLedgerVisibleStatus = (status: unknown) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized !== "void" && normalized !== "deleted";
};

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
  const aRefNum = parseRefNumber(a.reference || "");
  const bRefNum = parseRefNumber(b.reference || "");
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
  company?: Company;
  onViewPurchaseInvoice?: (id: string) => void;
}

const VendorLedgerPage: React.FC<VendorLedgerPageProps> = ({
  onBack,
  vendors,
  purchaseInvoices,
  company,
  onViewPurchaseInvoice,
}) => {
  const defaultEndDate = new Date().toISOString().split("T")[0];
  const defaultStartDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  })();

  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [vendorSearch, setVendorSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [startDateInput, setStartDateInput] = useState<string>(formatDateDMY(defaultStartDate));
  const [endDateInput, setEndDateInput] = useState<string>(formatDateDMY(defaultEndDate));
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [showDetailedNarration, setShowDetailedNarration] = useState(false);
  const [includeVoid, setIncludeVoid] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const startDatePickerRef = useRef<HTMLInputElement>(null);
  const endDatePickerRef = useRef<HTMLInputElement>(null);

  const selectedVendor = useMemo(
    () => vendors.find((v) => String(v.id || "") === String(selectedVendorId || "")),
    [selectedVendorId, vendors]
  );

  useEffect(() => {
    setStartDateInput(formatDateDMY(startDate));
  }, [startDate]);

  useEffect(() => {
    setEndDateInput(formatDateDMY(endDate));
  }, [endDate]);

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
      .filter(
        (inv) =>
          String(inv.customerId || "") === String(vendorId) &&
          (isLedgerVisibleStatus((inv as any).status) ||
            (includeVoid && String((inv as any).status || "").toLowerCase() === "void") ||
            (includeDeleted && String((inv as any).status || "").toLowerCase() === "deleted"))
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id || "").localeCompare(String(b.id || ""));
      });

    vendorInvoices.forEach((inv) => {
      const manualRef = String(inv.reference || "").trim();
      entries.push({
        id: `bill-${inv.id}`,
        date: inv.date,
        postedAt: String((inv as any).createdAt || (inv as any).updatedAt || inv.date || ""),
        orderHint: 10,
        viewId: String(inv.id || ""),
        description: `Purchase Bill - ${inv.id}`,
        detailNarration: buildItemsNarration(inv.items || []),
        reference: manualRef,
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
          viewId: String(inv.id || ""),
          description: "Payment Made",
          detailNarration: buildItemsNarration(inv.items || []),
          reference: manualRef,
          type: "Payment",
          debit: 0,
          credit: paid,
        });
      }
    });

    return entries.sort(compareLedgerEntries);
  }, [vendors, selectedVendorId, purchaseInvoices, includeVoid, includeDeleted]);

  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      const matchesDate = entry.date >= startDate && entry.date <= endDate;
      const matchesType = typeFilter === "All Types" || entry.type === typeFilter;
      return matchesDate && matchesType;
    });
  }, [rawEntries, startDate, endDate, typeFilter]);

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

  const handleViewEntry = (entry: LedgerEntry) => {
    if (!entry.viewId) return;
    onViewPurchaseInvoice?.(entry.viewId);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-slate-900 text-white font-black py-2 px-6 rounded-xl text-[9px] uppercase tracking-widest shadow-md"
          >
            Print Statement
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 mb-4 print:hidden">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
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
            <div className="relative">
              <input
                type="text"
                value={startDateInput}
                onChange={(e) => setStartDateInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDMYToISO(startDateInput);
                  if (parsed) {
                    setStartDate(parsed);
                  } else {
                    setStartDateInput(formatDateDMY(startDate));
                  }
                }}
                className="w-full bg-slate-50 border rounded-xl py-1.5 pl-3 pr-9 text-[11px] font-bold"
                placeholder="dd/mm/yyyy"
              />
              <input
                ref={startDatePickerRef}
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="absolute pointer-events-none opacity-0 w-0 h-0"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  const el = startDatePickerRef.current;
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
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              To
            </label>
            <div className="relative">
              <input
                type="text"
                value={endDateInput}
                onChange={(e) => setEndDateInput(e.target.value)}
                onBlur={() => {
                  const parsed = parseDMYToISO(endDateInput);
                  if (parsed) {
                    setEndDate(parsed);
                  } else {
                    setEndDateInput(formatDateDMY(endDate));
                  }
                }}
                className="w-full bg-slate-50 border rounded-xl py-1.5 pl-3 pr-9 text-[11px] font-bold"
                placeholder="dd/mm/yyyy"
              />
              <input
                ref={endDatePickerRef}
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="absolute pointer-events-none opacity-0 w-0 h-0"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                onClick={() => {
                  const el = endDatePickerRef.current;
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
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
              <input
                type="checkbox"
                checked={showDetailedNarration}
                onChange={(e) => setShowDetailedNarration(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Show Detailed Narration
            </label>
          </div>
          <div className="flex items-end gap-4">
            <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
              <input
                type="checkbox"
                checked={includeVoid}
                onChange={(e) => setIncludeVoid(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Void
            </label>
            <label className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
              <input
                type="checkbox"
                checked={includeDeleted}
                onChange={(e) => setIncludeDeleted(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
              />
              Deleted
            </label>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden print:rounded-none print:shadow-none print:border-0">
        <div className="hidden print:block px-6 py-4 print:border-0">
          <div className="flex items-start justify-between gap-3 border-b border-black pb-2">
            <h2 className="text-2xl font-black text-slate-900 uppercase">
              {company?.name || "AFTAB AUTOS"}
            </h2>
            <h3 className="text-xl font-black text-slate-900">
              Vendor Ledger Report
            </h3>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="text-[12px] font-bold text-slate-700">
              <p>
                Vendor:{" "}
                {selectedVendor
                  ? `${selectedVendor.vendorCode || selectedVendor.id || ""} - ${selectedVendor.name}`
                  : "All Vendors"}
              </p>
              <p>From: {formatDateDMY(startDate)} To: {formatDateDMY(endDate)}</p>
            </div>
            {company?.logoUrl ? (
              <img src={company.logoUrl} alt="Company Logo" className="h-48 w-auto object-contain" />
            ) : null}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 print:bg-white text-[10px] font-extrabold uppercase text-slate-600 tracking-widest border-b print:border-b-2 print:border-black">
                <th className="px-4 py-3 w-24">Date</th>
                <th className="px-4 py-3 print:w-[48%]">Narration</th>
                <th className="px-4 py-3 w-56 print:w-[18%]">Reference</th>
                <th className="px-4 py-3 text-right w-28">Debit</th>
                <th className="px-4 py-3 text-right w-28">Credit</th>
                <th className="px-4 py-3 text-right w-32 bg-slate-100/30 print:bg-white">
                  Balance
                </th>
                <th className="px-4 py-3 text-center w-20 print:hidden">View</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50 text-[11px] border-b border-slate-200 print:border-slate-400">
                  <td className="px-4 py-1.5 font-medium text-slate-500 italic">
                    {formatDateDMY(entry.date)}
                  </td>
                  <td className="px-4 py-1.5 font-medium uppercase text-slate-900">
                    <p>{entry.description}</p>
                    {showDetailedNarration && entry.detailNarration && (
                      <p className="mt-0.5 whitespace-pre-line text-[9px] normal-case font-medium text-slate-500">
                        {entry.detailNarration}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-1.5 text-[10px] font-medium text-indigo-600 dark:text-indigo-300 uppercase print:text-black">
                    {entry.reference || ""}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium text-orange-600 print:text-black">
                    {entry.debit > 0 ? entry.debit.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium text-emerald-600 print:text-black">
                    {entry.credit > 0 ? entry.credit.toLocaleString() : "-"}
                  </td>
                  <td className="px-4 py-1.5 text-right font-medium bg-slate-50/20 text-slate-900 tracking-tight">
                    {(runningBalances.get(entry.id) || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-center print:hidden">
                    <button
                      type="button"
                      onClick={() => handleViewEntry(entry)}
                      disabled={!entry.viewId}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="View entry"
                    >
                      <FiEye className="text-[13px]" />
                    </button>
                  </td>
                </tr>
              ))}
              {filteredEntries.length === 0 && (
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
            <tfoot>
              <tr className="border-t bg-slate-50/40 print:bg-white text-[11px] font-black uppercase">
                <td className="px-4 py-2" />
                <td className="px-4 py-2" />
                <td className="px-4 py-2 text-slate-500" />
                <td className="px-4 py-2 text-right">
                  <p className="text-orange-600 print:text-black">Rs. {totals.debit.toLocaleString()}</p>
                </td>
                <td className="px-4 py-2 text-right">
                  <p className="text-emerald-600 print:text-black">Rs. {totals.credit.toLocaleString()}</p>
                </td>
                <td className="px-4 py-2 text-right">
                  <p className="text-slate-900">
                    Rs. {Math.abs(closingBalance).toLocaleString()} {closingBalance >= 0 ? "DR" : "CR"}
                  </p>
                </td>
                <td className="px-4 py-2 print:hidden" />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default VendorLedgerPage;
