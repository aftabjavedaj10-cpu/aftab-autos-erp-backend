import React, { useState, useMemo, useEffect, useRef } from "react";
import type { SalesInvoice } from "../types";
import Pagination from "../components/Pagination";
import { formatDateDMY } from "../services/dateFormat";

const STATUS_FILTERS = [
  "All Status",
  "Draft",
  "Pending",
  "Approved",
  "Void",
  "Deleted",
  "Paid",
  "Unpaid",
  "Partial",
];

const parseDMYToDate = (value: string): Date | null => {
  if (!value) return null;
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  parsed.setHours(0, 0, 0, 0);
  return parsed;
};

const isoToDMY = (iso: string): string => {
  if (!iso) return "";
  const [year, month, day] = iso.split("-");
  if (!year || !month || !day) return "";
  return `${day}/${month}/${year}`;
};

interface SalesInvoicePageProps {
  invoices: SalesInvoice[];
  onAddClick: () => void;
  onEditClick: (invoice: SalesInvoice) => void;
  onDelete: (id: string) => void;
  pageTitle?: string;
  pageSubtitle?: string;
  addButtonLabel?: string;
  showBalanceColumn?: boolean;
  referenceColumnLabel?: string;
  showAgainstInvoiceColumn?: boolean;
  againstInvoiceColumnLabel?: string;
  getAgainstInvoiceValue?: (invoice: SalesInvoice) => string;
  entityColumnLabel?: string;
  searchPlaceholder?: string;
  statusFilterPreset?: string;
  statusFilterPresetTick?: number;
}

const SalesInvoicePage: React.FC<SalesInvoicePageProps> = ({
  invoices,
  onAddClick,
  onEditClick,
  onDelete,
  pageTitle = "Sales Invoices",
  pageSubtitle = "Accounts Receivable & Audit Trail",
  addButtonLabel = "Issue New Invoice",
  showBalanceColumn = true,
  referenceColumnLabel = "Reference / PO",
  showAgainstInvoiceColumn = false,
  againstInvoiceColumnLabel = "Against Invoice #",
  getAgainstInvoiceValue,
  entityColumnLabel = "Customer Entity",
  searchPlaceholder = "Invoice # or Customer...",
  statusFilterPreset,
  statusFilterPresetTick,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [refSearch, setRefSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All Status");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const startPickerRef = useRef<HTMLInputElement>(null);
  const endPickerRef = useRef<HTMLInputElement>(null);

  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (statusFilter !== "Deleted" && inv.status === "Deleted") {
        return false;
      }
      if (statusFilter !== "Void" && inv.status === "Void") {
        return false;
      }
      const matchesSearch =
        inv.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRef =
        !refSearch ||
        (inv.reference?.toLowerCase() || "").includes(refSearch.toLowerCase());
      const matchesStatus =
        statusFilter === "All Status" ||
        (["Draft", "Pending", "Approved", "Void", "Deleted"].includes(statusFilter) &&
          inv.status === statusFilter) ||
        (["Paid", "Unpaid", "Partial"].includes(statusFilter) &&
          (inv.paymentStatus === statusFilter || inv.status === statusFilter));
      const invDate = new Date(inv.date);
      invDate.setHours(0, 0, 0, 0);
      const startDateObj = parseDMYToDate(startDate);
      const endDateObj = parseDMYToDate(endDate);
      const matchesStart = !startDateObj || invDate >= startDateObj;
      const matchesEnd = !endDateObj || invDate <= endDateObj;
      const matchesProduct =
        !productSearch ||
        inv.items.some(
          (item) =>
            item.productName.toLowerCase().includes(productSearch.toLowerCase()) ||
            (item.productCode?.toLowerCase() || "").includes(productSearch.toLowerCase())
        );
      return (
        matchesSearch &&
        matchesRef &&
        matchesStatus &&
        matchesStart &&
        matchesEnd &&
        matchesProduct
      );
    });
  }, [invoices, searchQuery, refSearch, productSearch, statusFilter, startDate, endDate]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, refSearch, productSearch, statusFilter, startDate, endDate]);

  useEffect(() => {
    if (!statusFilterPreset) return;
    setStatusFilter(statusFilterPreset);
  }, [statusFilterPreset, statusFilterPresetTick]);

  const paginatedInvoices = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredInvoices.slice(start, start + rowsPerPage);
  }, [filteredInvoices, currentPage, rowsPerPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedInvoices.length && paginatedInvoices.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedInvoices.map((inv) => inv.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    selectedIds.forEach((id) => onDelete(id));
    setSuccessMsg(`Moved ${selectedIds.size} invoices to Deleted status.`);
    setSelectedIds(new Set());
    setIsConfirmModalOpen(false);
    setTimeout(() => setSuccessMsg(""), 5000);
  };

  const resetFilters = () => {
    setSearchQuery("");
    setRefSearch("");
    setProductSearch("");
    setStatusFilter("All Status");
    setStartDate("");
    setEndDate("");
  };

  const openPicker = (ref: React.RefObject<HTMLInputElement | null>) => {
    if (!ref.current) return;
    if (typeof ref.current.showPicker === "function") {
      ref.current.showPicker();
      return;
    }
    ref.current.click();
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none mb-1">
            {pageTitle}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            {pageSubtitle}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-orange-600 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all active:scale-95"
          >
            Reset Filters
          </button>
          <button
            onClick={onAddClick}
            className="bg-orange-600 hover:bg-orange-700 text-white font-black py-2 px-4 rounded-xl shadow-lg shadow-orange-600/20 transition-all active:scale-95 flex items-center gap-2 text-[9px] uppercase tracking-widest"
          >
            <span>➕</span> {addButtonLabel}
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">
            ✓
          </div>
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm mb-4 relative">
        <div className="p-4 border-b border-slate-50 dark:border-slate-800 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
            <div className="md:col-span-3 relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 text-xs">
                🔍
              </span>
              <input
                type="text"
                placeholder={searchPlaceholder}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-11 pr-3 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-[11px] dark:text-white font-bold placeholder:text-slate-400 placeholder:font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 text-xs">
                🔖
              </span>
              <input
                type="text"
                placeholder="Search Reference / PO..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-11 pr-3 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-[11px] dark:text-white font-bold placeholder:text-slate-400 placeholder:font-medium"
                value={refSearch}
                onChange={(e) => setRefSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-3 relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 text-xs">
                📦
              </span>
              <input
                type="text"
                placeholder="Filter by specific product..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-11 pr-3 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-[11px] dark:text-white font-bold placeholder:text-slate-400 placeholder:font-medium"
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
              />
            </div>
            <div className="md:col-span-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-4 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-[11px] font-bold dark:text-white appearance-none"
              >
                {STATUS_FILTERS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center gap-4 pt-3 border-t border-slate-50 dark:border-slate-800/50">
            <div className="flex items-center gap-4 w-full md:w-auto">
              <div className="shrink-0 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                Date Period
              </div>
              <div className="flex items-center gap-2 flex-1 md:flex-none">
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-2 text-[10px] font-bold dark:text-white outline-none"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => openPicker(startPickerRef)}
                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-orange-600 text-[12px]"
                  title="Pick start date"
                >
                  📅
                </button>
                <input
                  ref={startPickerRef}
                  type="date"
                  tabIndex={-1}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  onChange={(e) => setStartDate(isoToDMY(e.target.value))}
                  aria-hidden="true"
                />
                <span className="text-slate-300 font-bold">to</span>
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-2 text-[10px] font-bold dark:text-white outline-none"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => openPicker(endPickerRef)}
                  className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-500 hover:text-orange-600 text-[12px]"
                  title="Pick end date"
                >
                  📅
                </button>
                <input
                  ref={endPickerRef}
                  type="date"
                  tabIndex={-1}
                  className="absolute opacity-0 pointer-events-none w-0 h-0"
                  onChange={(e) => setEndDate(isoToDMY(e.target.value))}
                  aria-hidden="true"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[9px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3 w-10">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={toggleSelectAll}
                      className={`w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${
                        selectedIds.size === paginatedInvoices.length && paginatedInvoices.length > 0
                          ? "bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/30"
                          : "border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {selectedIds.size === paginatedInvoices.length && paginatedInvoices.length > 0 && (
                        <span className="text-white text-[9px]">✓</span>
                      )}
                    </button>
                    {selectedIds.size > 0 && (
                      <button
                        onClick={() => setSelectedIds(new Set())}
                        className="text-[8px] text-orange-600 hover:underline"
                      >
                        DESELECT
                      </button>
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Document #</th>
                <th className="px-4 py-3">{entityColumnLabel}</th>
                {showAgainstInvoiceColumn && (
                  <th className="px-4 py-3">{againstInvoiceColumnLabel}</th>
                )}
                <th className="px-4 py-3">{referenceColumnLabel}</th>
                <th className="px-4 py-3">Date / Due</th>
                <th className="px-4 py-3">Total Amount</th>
                {showBalanceColumn && <th className="px-4 py-3">Balance Amount</th>}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paginatedInvoices.map((inv) => (
                <tr
                  key={inv.id}
                  className={`transition-all duration-300 group relative ${
                    selectedIds.has(inv.id)
                      ? "bg-orange-500/5 dark:bg-orange-500/[0.03]"
                      : "hover:bg-slate-50/50 dark:hover:bg-slate-800/30"
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center">
                      <div
                        className={`absolute left-0 top-0 bottom-0 w-1 bg-orange-600 transition-opacity duration-300 ${
                          selectedIds.has(inv.id) ? "opacity-100" : "opacity-0"
                        }`}
                      ></div>
                      <button
                        onClick={() => toggleSelectRow(inv.id)}
                        className={`w-4 h-4 rounded-md border-2 transition-all flex items-center justify-center ${
                          selectedIds.has(inv.id)
                            ? "bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/20"
                            : "border-slate-200 dark:border-slate-700"
                        }`}
                      >
                        {selectedIds.has(inv.id) && <span className="text-white text-[9px]">✓</span>}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-black text-orange-600 dark:text-orange-500 text-[10px] mb-0.5">
                      {inv.id}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[11px] font-bold text-slate-900 dark:text-white leading-tight uppercase tracking-tight">
                      {inv.customerName}
                    </p>
                  </td>
                  {showAgainstInvoiceColumn && (
                    <td className="px-4 py-3">
                      <span className="text-[9px] font-black uppercase bg-slate-50 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                        {(getAgainstInvoiceValue?.(inv) || "").trim() || "-"}
                      </span>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span className="text-[9px] font-black uppercase bg-slate-50 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                      {inv.reference || "No Ref"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-[10px] text-slate-600 dark:text-slate-400 font-bold">
                      {formatDateDMY(inv.date)}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-black text-slate-900 dark:text-white text-[10px]">
                      Rs. {inv.totalAmount.toLocaleString()}
                    </p>
                  </td>
                  {showBalanceColumn && (
                    <td className="px-4 py-3">
                      <p className="font-black text-slate-900 dark:text-white text-[10px]">
                        Rs. {Math.max(0, (inv.totalAmount || 0) - (inv.amountReceived || 0)).toLocaleString()}
                      </p>
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border ${
                        inv.status === "Deleted"
                          ? "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300"
                          : inv.status === "Void"
                          ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20"
                          : inv.status === "Paid"
                          ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {inv.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEditClick(inv)}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-orange-600 transition-all shadow-sm"
                      >
                        <span className="text-xs">👁️</span>
                      </button>
                      <button
                        onClick={() => {
                          setSelectedIds(new Set([inv.id]));
                          setIsConfirmModalOpen(true);
                        }}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-rose-600 transition-all shadow-sm"
                      >
                        <svg
                          className="w-3.5 h-3.5"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedInvoices.length === 0 && (
                <tr>
                  <td
                    colSpan={
                      8 +
                      (showAgainstInvoiceColumn ? 1 : 0) +
                      (showBalanceColumn ? 1 : 0)
                    }
                    className="px-8 py-20 text-center text-slate-400 font-bold uppercase tracking-widest italic opacity-40"
                  >
                    No invoices found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination
          totalItems={filteredInvoices.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[50] animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
            <div className="flex items-center gap-4 border-r border-white/10 pr-8">
              <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center text-[12px] font-black shadow-lg">
                {selectedIds.size}
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest leading-none">
                  Invoices Selected
                </p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ready to delete</p>
              </div>
            </div>
            <div className="flex items-center gap-5">
              <button
                onClick={() => setIsConfirmModalOpen(true)}
                className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex items-center gap-2 group"
              >
                <span>🗑️</span> Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setIsConfirmModalOpen(false)}
          ></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="bg-rose-600 h-1.5 w-full"></div>
            <div className="p-10 text-center">
              <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 border border-rose-100 dark:border-rose-900/40">
                ⚠️
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">
                Mark As Deleted?
              </h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-4">
                Are you sure you want to set{" "}
                <span className="text-rose-600 font-black">{selectedIds.size} invoices</span> to
                Deleted status? Invoices must be Void first and will remain in database.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setIsConfirmModalOpen(false)}
                  className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                >
                  Set Deleted
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoicePage;
