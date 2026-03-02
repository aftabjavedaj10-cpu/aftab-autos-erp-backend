import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Product, SalesInvoice, Vendor } from "../types";
import type { MakePaymentDoc } from "./MakePayment";
import {
  buildPaymentPrintHtml,
  normalizePrintMode,
  openPrintWindow,
  type PrintMode,
} from "../services/printEngine";
import { getPrintTemplateSettings } from "../services/printSettings";
interface MakePaymentFormPageProps {
  docs: MakePaymentDoc[];
  vendors: Vendor[];
  products: Product[];
  purchaseInvoices: SalesInvoice[];
  purchaseReturns: SalesInvoice[];
  company?: Company;
  doc?: MakePaymentDoc;
  onBack: () => void;
  onSave: (doc: MakePaymentDoc, stayOnPage?: boolean) => void;
}

type SaveStatus = "Draft" | "Pending" | "Approved" | "Void";

const formatDateDdMmYyyy = (value: string) => {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value || "");
};

const parseDdMmYyyyToIso = (value: string) => {
  const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() + 1 !== mm || dt.getUTCDate() !== dd) return null;
  return iso;
};

const MakePaymentFormPage: React.FC<MakePaymentFormPageProps> = ({
  docs,
  vendors,
  products: _products,
  purchaseInvoices,
  purchaseReturns,
  company,
  doc,
  onBack,
  onSave,
}) => {
  const isEdit = Boolean(doc?.id);
  const currentStatus = String(doc?.status || "Draft");
  const isApproved = currentStatus === "Approved";
  const isPending = currentStatus === "Pending";
  const isVoid = currentStatus === "Void";
  const isDeleted = currentStatus === "Deleted";
  const isLinkedPayment =
    Boolean(String(doc?.invoiceId || "").trim()) ||
    /^PI-\d+$/i.test(String(doc?.reference || "").trim());
  const canVoid = isEdit && !isLinkedPayment && (isApproved || isPending);

  const [paymentNo, setPaymentNo] = useState(doc?.id || "");
  const [paymentDate, setPaymentDate] = useState(
    doc?.date || new Date().toISOString().slice(0, 10)
  );
  const [paymentDateText, setPaymentDateText] = useState(
    formatDateDdMmYyyy(doc?.date || new Date().toISOString().slice(0, 10))
  );
  const [invoiceId, setInvoiceId] = useState(doc?.invoiceId || "");
  const [reference, setReference] = useState(doc?.reference || "");
  const [vendorSearch, setVendorSearch] = useState(doc?.vendorName || "");
  const [selectedVendorName, setSelectedVendorName] = useState(doc?.vendorName || "");
  const [selectedVendorId, setSelectedVendorId] = useState<string>("");
  const [showVendorList, setShowVendorList] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [amountInput, setAmountInput] = useState(
    doc?.totalAmount !== undefined ? String(doc.totalAmount) : "0"
  );
  const [notes, setNotes] = useState(doc?.notes || "");
  const [printSettings, setPrintSettings] = useState(() => getPrintTemplateSettings());
  const [error, setError] = useState<string | null>(null);

  const vendorBoxRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);
  const paymentDatePickerProxyRef = useRef<HTMLInputElement>(null);

  const parseNumber = (value?: string | number) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalized = String(value || "").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const amountValue = useMemo(() => parseNumber(amountInput), [amountInput]);

  const nextPaymentNo = useMemo(() => {
    const maxNo = docs.reduce((max, row) => {
      const match = String(row.id || "").match(/^MP-(\d{6})$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);
    return `MP-${String(maxNo + 1).padStart(6, "0")}`;
  }, [docs]);

  useEffect(() => {
    if (!isEdit) setPaymentNo(nextPaymentNo);
  }, [isEdit, nextPaymentNo]);

  useEffect(() => {
    setPaymentDateText(formatDateDdMmYyyy(paymentDate));
  }, [paymentDate]);

  useEffect(() => {
    if (doc?.vendorId) {
      setSelectedVendorId(String(doc.vendorId));
    }
  }, [doc?.vendorId]);

  useEffect(() => {
    if (!doc) return;
    setInvoiceId(doc.invoiceId || (/^PI-\d+$/i.test(String(doc.reference || "")) ? String(doc.reference) : ""));
  }, [doc]);

  useEffect(() => {
    if (!selectedVendorName) {
      setSelectedVendorId("");
      return;
    }
    const match = vendors.find(
      (v) => String(v.name || "").toLowerCase() === String(selectedVendorName || "").toLowerCase()
    );
    setSelectedVendorId(String(match?.id || ""));
  }, [selectedVendorName, vendors]);

  useEffect(() => {
    setPrintSettings(getPrintTemplateSettings());
  }, []);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (vendorBoxRef.current && !vendorBoxRef.current.contains(event.target as Node)) {
        setShowVendorList(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(event.target as Node)) {
        setShowSaveMenu(false);
      }
      if (printMenuRef.current && !printMenuRef.current.contains(event.target as Node)) {
        setShowPrintMenu(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const filteredVendors = useMemo(() => {
    const q = vendorSearch.trim().toLowerCase();
    if (!q) return vendors.slice(0, 30);
    return vendors
      .filter((v) => {
        const name = String(v.name || "").toLowerCase();
        const code = String(v.vendorCode || "").toLowerCase();
        const phone = String(v.phone || "").toLowerCase();
        return name.includes(q) || code.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  }, [vendorSearch, vendors]);

  const selectedVendor = useMemo(
    () =>
      vendors.find(
        (v) => String(v.id || "") === selectedVendorId || v.name === selectedVendorName
      ),
    [vendors, selectedVendorId, selectedVendorName]
  );

  const ledgerBalance = useMemo(() => {
    const isVisible = (status: unknown) => {
      const normalized = String(status || "").trim().toLowerCase();
      return normalized !== "void" && normalized !== "deleted";
    };
    const opening = parseNumber(selectedVendor?.payableBalance ?? selectedVendor?.balance ?? 0);
    const currentDocId = String(doc?.id || "").toUpperCase();
    const matchByVendor = (vendorId?: string, vendorName?: string) => {
      const byId =
        selectedVendorId &&
        vendorId &&
        String(vendorId) === String(selectedVendorId);
      const byName =
        String(vendorName || "").toLowerCase() ===
          String(selectedVendorName || "").toLowerCase();
      return Boolean(byId || byName);
    };

    const visiblePayments = docs.filter((p) => {
      if (!isVisible((p as any).status)) return false;
      return matchByVendor(p.vendorId, p.vendorName);
    });

    const invoiceDebit = purchaseInvoices
      .filter((inv) => isVisible((inv as any).status))
      .filter((inv) => matchByVendor(inv.customerId, inv.customerName))
      .reduce((sum, inv) => sum + parseNumber(inv.totalAmount), 0);

    const returnCredit = purchaseReturns
      .filter((ret) => isVisible((ret as any).status))
      .filter((ret) => matchByVendor(ret.customerId, ret.customerName))
      .reduce((sum, ret) => sum + parseNumber(ret.totalAmount), 0);

    const paymentCredit = visiblePayments
      .filter((p) => String(p.id || "").toUpperCase() !== currentDocId)
      .reduce((sum, p) => sum + parseNumber(p.totalAmount), 0);

    const draftPaymentCredit = selectedVendorName ? parseNumber(amountValue) : 0;
    const net = opening + invoiceDebit - returnCredit - paymentCredit - draftPaymentCredit;

    return { amount: Math.abs(net), side: net >= 0 ? "DR" : "CR" };
  }, [
    amountValue,
    doc?.id,
    selectedVendor,
    selectedVendorId,
    selectedVendorName,
    purchaseInvoices,
    purchaseReturns,
    docs,
  ]);

  const quickTotals = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const todayTotal = docs
      .filter((d) => d.date === today)
      .reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
    const monthPrefix = today.slice(0, 7);
    const monthTotal = docs
      .filter((d) => String(d.date || "").startsWith(monthPrefix))
      .reduce((sum, d) => sum + Number(d.totalAmount || 0), 0);
    return { todayTotal, monthTotal };
  }, [docs]);

  const handleSave = (status: SaveStatus) => {
    if (status === "Void" && isLinkedPayment) {
      setError("Linked payments are controlled by purchase invoice and cannot be voided manually.");
      return;
    }
    if (!paymentNo.trim()) {
      setError("Payment number is required.");
      return;
    }
    if (!selectedVendorName.trim()) {
      setError("Vendor is required.");
      return;
    }
    if (!paymentDate) {
      setError("Payment date is required.");
      return;
    }
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    setError(null);
    onSave({
      id: paymentNo.trim(),
      vendorId: selectedVendorId || undefined,
      vendorName: selectedVendorName.trim(),
      invoiceId: invoiceId.trim() || undefined,
      reference: reference.trim(),
      date: paymentDate,
      status,
      totalAmount: amountValue,
      notes: notes.trim(),
    });
  };

  const printHtml = (mode: PrintMode) => {
    const modeTitle =
      mode === "receipt" ? "Payment Receipt" : mode === "a5" ? "A5 Payment Slip" : mode === "token" ? "Payment Token" : "Payment Invoice";
    return buildPaymentPrintHtml({
      mode,
      modeTitle,
      no: paymentNo,
      reference,
      date: formatDateDdMmYyyy(paymentDate),
      partyLabel: "Vendor",
      partyName: selectedVendorName,
      ledgerAmount: ledgerBalance.amount,
      ledgerSide: ledgerBalance.side,
      amount: amountValue,
      notes,
      company,
      settings: printSettings,
    });
  };

  const handlePrint = (mode: PrintMode) => {
    openPrintWindow(printHtml(mode));
  };

  const defaultPrintMode = normalizePrintMode(printSettings.defaultTemplate, "receipt");

  const preventNumberWheelStep = (e: React.WheelEvent) => {
    const target = e.target as HTMLInputElement | null;
    if (!target || target.tagName !== "INPUT" || target.type !== "number") return;
    target.blur();
    e.preventDefault();
  };

  const preventNumberArrowStep = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLInputElement | null;
    if (!target || target.tagName !== "INPUT" || target.type !== "number") return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  return (
    <div
      className="animate-in fade-in duration-500 pb-10"
      onWheelCapture={preventNumberWheelStep}
      onKeyDownCapture={preventNumberArrowStep}
    >
      <div className="mb-5 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title="Back"
        >
          <span className="text-sm">&#8592;</span>
        </button>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Payment Desk
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {isEdit ? "Edit Make Payment" : "New Make Payment"}
          </h1>
          {(isApproved || isPending || isVoid || isDeleted) && (
            <div className="pt-1">
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${
                  isDeleted
                    ? "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-600"
                    : isVoid
                    ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-300 dark:border-rose-800"
                    : isPending
                    ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-300 dark:border-emerald-800"
                }`}
              >
                {isDeleted ? "Void Deleted" : isVoid ? "Void" : isPending ? "Pending" : "Approved"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="relative rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            {(isApproved || isPending || isVoid || isDeleted) && (
              <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center overflow-hidden rounded-3xl">
                <span
                  className={`select-none text-5xl font-black tracking-[0.25em] uppercase rotate-[-18deg] opacity-[0.10] ${
                    isDeleted
                      ? "text-slate-600 dark:text-slate-300"
                      : isVoid
                      ? "text-rose-600 dark:text-rose-300"
                      : isPending
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {isDeleted ? "Void Deleted" : isVoid ? "Void" : isPending ? "Pending" : "Approved"}
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Payment #
                </span>
                <input
                  type="text"
                  value={paymentNo}
                  onChange={(e) => setPaymentNo(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black uppercase tracking-wide text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="MP-000001"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Payment Date
                </span>
                <div className="relative">
                  <input
                    type="text"
                    value={paymentDateText}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setPaymentDateText(raw);
                      const iso = parseDdMmYyyyToIso(raw);
                      if (iso) setPaymentDate(iso);
                    }}
                    onBlur={() => setPaymentDateText(formatDateDdMmYyyy(paymentDate))}
                    placeholder="dd/mm/yyyy"
                    className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 pr-9 text-[13px] font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                  <input
                    ref={paymentDatePickerProxyRef}
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="absolute -z-10 h-0 w-0 opacity-0"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const picker = paymentDatePickerProxyRef.current as any;
                      if (!picker) return;
                      if (typeof picker.showPicker === "function") picker.showPicker();
                      else picker.click();
                    }}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-orange-600"
                    title="Open calendar"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  </button>
                </div>
              </label>

              <div className="md:col-span-2" ref={vendorBoxRef}>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Vendor Search
                </span>
                <input
                  type="text"
                  value={vendorSearch}
                  onFocus={() => setShowVendorList(true)}
                  onChange={(e) => {
                    setVendorSearch(e.target.value);
                    setSelectedVendorName("");
                    setSelectedVendorId("");
                    setShowVendorList(true);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Type vendor name, code, or phone..."
                />
                {showVendorList && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    {filteredVendors.length === 0 && (
                      <p className="px-4 py-3 text-[11px] font-bold text-slate-400">No vendors found</p>
                    )}
                    {filteredVendors.map((v) => (
                      <button
                        key={`${v.id}-${v.name}`}
                        type="button"
                        onClick={() => {
                          setVendorSearch(v.name);
                          setSelectedVendorName(v.name);
                          setSelectedVendorId(String(v.id || ""));
                          setShowVendorList(false);
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <p className="text-[12px] font-black uppercase text-slate-900 dark:text-white">{v.name}</p>
                        <p className="text-[9px] font-bold uppercase text-slate-400">{v.vendorCode || v.phone || v.id || "-"}</p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Invoice #
                </span>
                <input
                  type="text"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black uppercase tracking-wide text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="PI-000001 (optional)"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Reference
                </span>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Manual reference (optional)"
                />
              </label>

              <div className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Ledger Balance
                </span>
                <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {selectedVendorName
                    ? `Rs. ${ledgerBalance.amount.toLocaleString()} ${ledgerBalance.side}`
                    : "Select vendor"}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Paid Amount
                </span>
                <input
                  type="number"
                  value={amountInput}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setAmountInput(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="0"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-28 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Optional memo for this payment..."
                />
              </label>
            </div>

            {error && (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">
                {error}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>

              {canVoid && (
                <button
                  type="button"
                  onClick={() => handleSave("Void")}
                  className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 dark:border-rose-800 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/30"
                >
                  Void
                </button>
              )}

              <div className="relative" ref={printMenuRef}>
                <div className="inline-flex">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false);
                      handlePrint(defaultPrintMode);
                    }}
                    className="rounded-l-xl border border-slate-300 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    Print
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPrintMenu((prev) => !prev)}
                    className="rounded-r-xl border border-l-0 border-slate-300 bg-white px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <span aria-hidden="true">&#9660;</span>
                  </button>
                </div>
                {showPrintMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-40 rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <button type="button" onClick={() => { setShowPrintMenu(false); handlePrint("invoice"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Invoice</button>
                    <button type="button" onClick={() => { setShowPrintMenu(false); handlePrint("receipt"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Receipt</button>
                    <button type="button" onClick={() => { setShowPrintMenu(false); handlePrint("a5"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">A5</button>
                    <button type="button" onClick={() => { setShowPrintMenu(false); handlePrint("token"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Token</button>
                  </div>
                )}
              </div>

              <div className="relative" ref={saveMenuRef}>
                <div className="inline-flex">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveMenu(false);
                      handleSave("Approved");
                    }}
                    className="rounded-l-xl bg-orange-600 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/30 hover:bg-orange-700"
                  >
                    Save & Approved
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveMenu((prev) => !prev)}
                    className="rounded-r-xl border-l border-orange-500 bg-orange-600 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/30 hover:bg-orange-700"
                  >
                    <span aria-hidden="true">&#9660;</span>
                  </button>
                </div>
                {showSaveMenu && (
                  <div className="absolute bottom-full right-0 mb-2 w-48 rounded-xl border border-slate-200 bg-white p-1 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    <button type="button" onClick={() => { setShowSaveMenu(false); handleSave("Draft"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Save & Draft</button>
                    <button type="button" onClick={() => { setShowSaveMenu(false); handleSave("Pending"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Save & Pending</button>
                    <button type="button" onClick={() => { setShowSaveMenu(false); handleSave("Approved"); }} className="w-full rounded-lg px-3 py-2 text-left text-[10px] font-black uppercase tracking-wider text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800">Save & Approved</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-orange-600 p-4 text-white shadow-xl dark:border-slate-700">
            <p className="text-[10px] font-black uppercase tracking-widest text-orange-100/80">
              Current Entry
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              Rs. {amountValue.toLocaleString()}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-orange-100/90">
              {selectedVendorName || "No vendor selected"}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Today</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                Rs. {quickTotals.todayTotal.toLocaleString()}
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">This Month</p>
              <p className="mt-1 text-lg font-black text-slate-900 dark:text-white">
                Rs. {quickTotals.monthTotal.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MakePaymentFormPage;








