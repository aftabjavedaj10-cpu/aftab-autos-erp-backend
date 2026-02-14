import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Customer, Product } from "../types";
import type { ReceivePaymentDoc } from "./ReceivePayment";

interface ReceivePaymentFormPageProps {
  docs: ReceivePaymentDoc[];
  customers: Customer[];
  products: Product[];
  company?: Company;
  doc?: ReceivePaymentDoc;
  onBack: () => void;
  onSave: (doc: ReceivePaymentDoc) => void;
}

const ReceivePaymentFormPage: React.FC<ReceivePaymentFormPageProps> = ({
  docs,
  customers,
  products: _products,
  company,
  doc,
  onBack,
  onSave,
}) => {
  const isEdit = Boolean(doc?.id);
  const [paymentNo, setPaymentNo] = useState(doc?.id || "");
  const [paymentDate, setPaymentDate] = useState(
    doc?.date || new Date().toISOString().slice(0, 10)
  );
  const [status, setStatus] = useState(doc?.status || "Approved");
  const [customerSearch, setCustomerSearch] = useState(doc?.customerName || "");
  const [selectedCustomerName, setSelectedCustomerName] = useState(doc?.customerName || "");
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [amount, setAmount] = useState(Number(doc?.totalAmount || 0));
  const [notes, setNotes] = useState(doc?.notes || "");
  const [error, setError] = useState<string | null>(null);
  const customerBoxRef = useRef<HTMLDivElement>(null);

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
    const onDocClick = (event: MouseEvent) => {
      if (!customerBoxRef.current) return;
      if (!customerBoxRef.current.contains(event.target as Node)) {
        setShowCustomerList(false);
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

  const handleSave = () => {
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
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Amount must be greater than zero.");
      return;
    }
    setError(null);
    onSave({
      id: paymentNo.trim(),
      customerName: selectedCustomerName.trim(),
      date: paymentDate,
      status: status || "Approved",
      totalAmount: Number(amount),
      notes: notes.trim(),
    });
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            Payment Desk
          </p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">
            {isEdit ? "Edit Receive Payment" : "New Receive Payment"}
          </h1>
          <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Capture incoming customer payment with a fast, focused entry screen.
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300">
            Company
          </p>
          <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
            {company?.name || "Active Company"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-800 dark:bg-slate-900">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Payment #
                </span>
                <input
                  type="text"
                  value={paymentNo}
                  onChange={(e) => setPaymentNo(e.target.value.toUpperCase())}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black uppercase tracking-wide text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    setShowCustomerList(true);
                  }}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-bold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                          setShowCustomerList(false);
                        }}
                        className="block w-full border-b border-slate-100 px-4 py-2 text-left last:border-0 hover:bg-emerald-50 dark:border-slate-800 dark:hover:bg-slate-800"
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

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Received Amount
                </span>
                <input
                  type="number"
                  value={Number.isFinite(amount) ? amount : 0}
                  onWheel={(e) => (e.target as HTMLInputElement).blur()}
                  onChange={(e) => setAmount(Number(e.target.value || 0))}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[14px] font-black text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="0"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Status
                </span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] font-black uppercase text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="Draft">Draft</option>
                  <option value="Pending">Pending</option>
                  <option value="Approved">Approved</option>
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="h-28 w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-[12px] font-semibold text-slate-900 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
              <button
                type="button"
                onClick={handleSave}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-[11px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-600/30 hover:bg-emerald-700"
              >
                Save Payment
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-700 p-4 text-white shadow-xl dark:border-slate-700">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-100/80">
              Current Entry
            </p>
            <p className="mt-1 text-2xl font-black tracking-tight">
              Rs. {Number(amount || 0).toLocaleString()}
            </p>
            <p className="mt-2 text-[11px] font-semibold text-emerald-100/90">
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

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-slate-500">
              Recent Payments
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {docs.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/50"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-black uppercase text-slate-900 dark:text-white">
                      {item.id}
                    </p>
                    <p className="text-[11px] font-black text-emerald-600 dark:text-emerald-400">
                      Rs. {Number(item.totalAmount || 0).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                    {item.customerName} • {item.date}
                  </p>
                </div>
              ))}
              {docs.length === 0 && (
                <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-[11px] font-bold text-slate-400 dark:border-slate-700">
                  No payment entries yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceivePaymentFormPage;
