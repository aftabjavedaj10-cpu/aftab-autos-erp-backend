import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Customer, Product, SalesInvoice } from "../types";
import type { ReceivePaymentDoc } from "./ReceivePayment";

interface ReceivePaymentFormPageProps {
  docs: ReceivePaymentDoc[];
  customers: Customer[];
  products: Product[];
  salesInvoices: SalesInvoice[];
  salesReturns: SalesInvoice[];
  company?: Company;
  doc?: ReceivePaymentDoc;
  onBack: () => void;
  onSave: (doc: ReceivePaymentDoc, stayOnPage?: boolean) => void;
}

type SaveStatus = "Draft" | "Pending" | "Approved" | "Void";
type PrintMode = "invoice" | "receipt" | "a5" | "token";

const ReceivePaymentFormPage: React.FC<ReceivePaymentFormPageProps> = ({
  docs,
  customers,
  products: _products,
  salesInvoices,
  salesReturns,
  company: _company,
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
    /^SI-\d+$/i.test(String(doc?.reference || "").trim());
  const canVoid = isEdit && !isLinkedPayment && (isApproved || isPending);
  const [paymentNo, setPaymentNo] = useState(doc?.id || "");
  const [paymentDate, setPaymentDate] = useState(
    doc?.date || new Date().toISOString().slice(0, 10)
  );
  const [invoiceId, setInvoiceId] = useState(doc?.invoiceId || "");
  const [reference, setReference] = useState(doc?.reference || "");
  const [customerSearch, setCustomerSearch] = useState(doc?.customerName || "");
  const [selectedCustomerName, setSelectedCustomerName] = useState(doc?.customerName || "");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [showSaveMenu, setShowSaveMenu] = useState(false);
  const [showPrintMenu, setShowPrintMenu] = useState(false);
  const [amountInput, setAmountInput] = useState(
    doc?.totalAmount !== undefined ? String(doc.totalAmount) : "0"
  );
  const [notes, setNotes] = useState(doc?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);

  const parseNumber = (value?: string | number) => {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    const normalized = String(value || "").replace(/[^0-9.-]/g, "");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const amountValue = useMemo(() => parseNumber(amountInput), [amountInput]);

  const nextPaymentNo = useMemo(() => {
    const maxNo = docs.reduce((max, row) => {
      const match = String(row.id || "").match(/^RP-(\d{6})$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);
    return `RP-${String(maxNo + 1).padStart(6, "0")}`;
  }, [docs]);

  useEffect(() => {
    if (!isEdit) setPaymentNo(nextPaymentNo);
  }, [isEdit, nextPaymentNo]);

  useEffect(() => {
    if (doc?.customerId) {
      setSelectedCustomerId(String(doc.customerId));
    }
  }, [doc?.customerId]);

  useEffect(() => {
    if (!doc) return;
    setInvoiceId(doc.invoiceId || (/^SI-\d+$/i.test(String(doc.reference || "")) ? String(doc.reference) : ""));
  }, [doc]);

  useEffect(() => {
    if (!selectedCustomerName) {
      setSelectedCustomerId("");
      return;
    }
    const match = customers.find(
      (c) => String(c.name || "").toLowerCase() === String(selectedCustomerName || "").toLowerCase()
    );
    setSelectedCustomerId(String(match?.id || ""));
  }, [selectedCustomerName, customers]);

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (customerBoxRef.current && !customerBoxRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
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

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers.slice(0, 30);
    return customers
      .filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const code = String(c.customerCode || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return name.includes(q) || code.includes(q) || phone.includes(q);
      })
      .slice(0, 30);
  }, [customerSearch, customers]);

  const selectedCustomer = useMemo(
    () =>
      customers.find(
        (c) => String(c.id || "") === selectedCustomerId || c.name === selectedCustomerName
      ),
    [customers, selectedCustomerId, selectedCustomerName]
  );

  const ledgerBalance = useMemo(() => {
    const isVisible = (status: unknown) => {
      const normalized = String(status || "").trim().toLowerCase();
      return normalized !== "void" && normalized !== "deleted";
    };
    const opening = parseNumber(selectedCustomer?.openingBalance ?? selectedCustomer?.balance ?? 0);
    const currentDocId = String(doc?.id || "").toUpperCase();
    const matchByCustomer = (customerId?: string, customerName?: string) => {
      const byId =
        selectedCustomerId &&
        customerId &&
        String(customerId) === String(selectedCustomerId);
      const byName =
        String(customerName || "").toLowerCase() ===
          String(selectedCustomerName || "").toLowerCase();
      return Boolean(byId || byName);
    };

    const visiblePayments = docs.filter((p) => {
      if (!isVisible((p as any).status)) return false;
      return matchByCustomer(p.customerId, p.customerName);
    });

    const linkedInvoiceIds = new Set(
      visiblePayments
        .map((p) => {
          const against = String(p.invoiceId || "").trim();
          if (against) return against.toUpperCase();
          const ref = String(p.reference || "").trim();
          return /^SI-\d+$/i.test(ref) ? ref.toUpperCase() : "";
        })
        .filter(Boolean)
    );

    const invoiceDebit = salesInvoices
      .filter((inv) => isVisible((inv as any).status))
      .filter((inv) => matchByCustomer(inv.customerId, inv.customerName))
      .reduce((sum, inv) => sum + parseNumber(inv.totalAmount), 0);
    const invoiceCredits = salesInvoices
      .filter((inv) => isVisible((inv as any).status))
      .filter((inv) => matchByCustomer(inv.customerId, inv.customerName))
      .reduce((sum, inv) => {
        const invoiceId = String(inv.id || "").toUpperCase();
        if (linkedInvoiceIds.has(invoiceId)) return sum;
        return sum + parseNumber(inv.amountReceived);
      }, 0);
    const returnCredits = salesReturns
      .filter((ret) => isVisible((ret as any).status))
      .filter((ret) => matchByCustomer(ret.customerId, ret.customerName))
      .reduce((sum, ret) => sum + parseNumber(ret.totalAmount), 0);
    const paymentCredits = visiblePayments
      .filter((p) => String(p.id || "").toUpperCase() !== currentDocId)
      .reduce((sum, p) => sum + parseNumber(p.totalAmount), 0);

    const draftPaymentCredit = selectedCustomerName ? parseNumber(amountValue) : 0;
    const net =
      opening +
      invoiceDebit -
      invoiceCredits -
      returnCredits -
      paymentCredits -
      draftPaymentCredit;
    return { amount: Math.abs(net), side: net >= 0 ? "DR" : "CR" };
  }, [
    amountValue,
    doc?.id,
    selectedCustomer,
    selectedCustomerId,
    selectedCustomerName,
    salesInvoices,
    salesReturns,
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
    if (!paymentNo.trim()) {
      setError("Payment number is required.");
      return;
    }
    if (!selectedCustomerName.trim()) {
      setError("Customer is required.");
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
      customerId: selectedCustomerId || undefined,
      customerName: selectedCustomerName.trim(),
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
    return `<!doctype html>
<html><head><meta charset="utf-8"/><title>${modeTitle}</title>
<style>
body{font-family:Arial,sans-serif;padding:14px;color:#111}
.box{max-width:${mode === "receipt" || mode === "token" ? "72mm" : mode === "a5" ? "148mm" : "190mm"};margin:0 auto}
.line{display:flex;justify-content:space-between;margin:4px 0}
.head{font-size:20px;font-weight:700;text-align:center;margin-bottom:8px}
.small{font-size:12px}
.row{border-top:1px solid #ddd;padding-top:8px;margin-top:8px}
</style></head>
<body><div class="box">
<div class="head">${modeTitle}</div>
<div class="line"><span>No</span><span>${paymentNo}</span></div>
<div class="line"><span>Reference</span><span>${reference || "-"}</span></div>
<div class="line"><span>Date</span><span>${paymentDate}</span></div>
<div class="line"><span>Customer</span><span>${selectedCustomerName || "-"}</span></div>
<div class="line"><span>Ledger Balance</span><span>Rs. ${ledgerBalance.amount.toLocaleString()} ${ledgerBalance.side}</span></div>
<div class="line"><span>Amount</span><span>Rs. ${amountValue.toLocaleString()}</span></div>
<div class="row small"><strong>Notes:</strong> ${notes || "-"}</div>
</div><script>window.onload=()=>window.print();</script></body></html>`;
  };

  const handlePrint = (mode: PrintMode) => {
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.open();
    w.document.write(printHtml(mode));
    w.document.close();
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="mb-5 flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl border border-slate-200 bg-white p-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          title="Back"
        >
          <span className="text-sm">←</span>
        </button>
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Payment Desk
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {isEdit ? "Edit Receive Payment" : "New Receive Payment"}
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
                  placeholder="RP-000001"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Payment Date
                </span>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Invoice #
                </span>
                <input
                  type="text"
                  value={invoiceId}
                  onChange={(e) => setInvoiceId(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black uppercase tracking-wide text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="SI-000001 (optional)"
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

              <div className="md:col-span-2" ref={customerBoxRef}>
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Customer Search
                </span>
                <input
                  type="text"
                  value={customerSearch}
                  onFocus={() => setShowCustomerList(true)}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerName("");
                    setSelectedCustomerId("");
                    setShowCustomerList(true);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Type customer name, code, or phone..."
                />
                {showCustomerList && (
                  <div className="mt-1 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                    {filteredCustomers.length === 0 && (
                      <p className="px-4 py-3 text-[11px] font-bold text-slate-400">
                        No customers found
                      </p>
                    )}
                    {filteredCustomers.map((c) => (
                      <button
                        key={`${c.id}-${c.name}`}
                        type="button"
                        onClick={() => {
                          setCustomerSearch(c.name);
                          setSelectedCustomerName(c.name);
                          setSelectedCustomerId(String(c.id || ""));
                          setShowCustomerList(false);
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-orange-50 dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <p className="text-[12px] font-black uppercase text-slate-900 dark:text-white">
                          {c.name}
                        </p>
                        <p className="text-[9px] font-bold uppercase text-slate-400">
                          {c.customerCode || c.phone || c.id || "-"}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Ledger Balance
                </span>
                <div className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  {selectedCustomerName
                    ? `Rs. ${ledgerBalance.amount.toLocaleString()} ${ledgerBalance.side}`
                    : "Select customer"}
                </div>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Received Amount
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
                      handlePrint("receipt");
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
                    ▼
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
                    ▼
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
              {selectedCustomerName || "No customer selected"}
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

export default ReceivePaymentFormPage;
