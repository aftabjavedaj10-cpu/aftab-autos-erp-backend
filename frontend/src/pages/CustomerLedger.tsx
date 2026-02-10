import React, { useMemo, useRef, useEffect, useState } from "react";
import type { Customer, SalesInvoice } from "../types";
import Pagination from "../components/Pagination";

interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  reference: string;
  type: "Invoice" | "Receipt" | "Return";
  debit: number;
  credit: number;
}

const TRANSACTION_TYPES = ["All Types", "Invoice", "Receipt", "Return"];

interface CustomerLedgerPageProps {
  onBack: () => void;
  customers: Customer[];
  salesInvoices: SalesInvoice[];
}

const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  onBack,
  customers,
  salesInvoices,
}) => {
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    customers[0]?.id || ""
  );
  const [customerSearch, setCustomerSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [startDate, setStartDate] = useState<string>("2023-10-01");
  const [endDate, setEndDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [typeFilter, setTypeFilter] = useState("All Types");
  const searchRef = useRef<HTMLDivElement>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId),
    [selectedCustomerId, customers]
  );

  useEffect(() => {
    if (selectedCustomer) {
      setCustomerSearch(selectedCustomer.name);
    }
  }, [selectedCustomerId, selectedCustomer]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredCustomerList = useMemo(() => {
    if (!customerSearch || selectedCustomer?.name === customerSearch)
      return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
        (c.id || "").toLowerCase().includes(customerSearch.toLowerCase())
    );
  }, [customerSearch, selectedCustomer, customers]);

  const rawEntries = useMemo(() => {
    const entries: LedgerEntry[] = [];
    const customerId = selectedCustomerId;
    const customer = customers.find((c) => c.id === customerId);
    const openingRaw = Number(customer?.openingBalance || 0);
    if (!Number.isNaN(openingRaw) && openingRaw !== 0) {
      entries.push({
        id: `open-${customerId}`,
        date: "2023-10-01",
        description: "Opening Balance",
        reference: "-",
        type: "Invoice",
        debit: openingRaw > 0 ? openingRaw : 0,
        credit: openingRaw < 0 ? Math.abs(openingRaw) : 0,
      });
    }

    salesInvoices
      .filter((inv) => inv.customerId === customerId)
      .forEach((inv) => {
        entries.push({
          id: `inv-${inv.id}`,
          date: inv.date,
          description: `Credit Sales - ${inv.id}`,
          reference: inv.id,
          type: "Invoice",
          debit: Number(inv.totalAmount || 0),
          credit: 0,
        });
        const received = Number(inv.amountReceived || 0);
        if (received > 0) {
          entries.push({
            id: `rcp-${inv.id}`,
            date: inv.date,
            description: "Payment Received",
            reference: `RCP-${inv.id}`,
            type: "Receipt",
            debit: 0,
            credit: received,
          });
        }
      });

    return entries.sort((a, b) => a.date.localeCompare(b.date));
  }, [customers, salesInvoices, selectedCustomerId]);

  const filteredEntries = useMemo(() => {
    return rawEntries.filter((entry) => {
      const matchesDate = entry.date >= startDate && entry.date <= endDate;
      const matchesType = typeFilter === "All Types" || entry.type === typeFilter;
      return matchesDate && matchesType;
    });
  }, [rawEntries, startDate, endDate, typeFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCustomerId, startDate, endDate, typeFilter]);

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
    return filteredEntries.map((entry) => {
      running += entry.debit - entry.credit;
      return running;
    });
  }, [filteredEntries]);

  const handleSelectCustomer = (customer: Customer) => {
    if (!customer.id) return;
    setSelectedCustomerId(customer.id);
    setCustomerSearch(customer.name);
    setShowResults(false);
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
              Customer Ledger
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
            <div className="relative">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 text-[11px]">🔍</span>
              <input
                type="text"
                value={customerSearch}
                onFocus={() => setShowResults(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowResults(true);
                }}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 rounded-xl py-1.5 pl-9 pr-3 text-[11px] font-bold dark:text-white outline-none"
                placeholder="Search customer..."
              />
            </div>
            {showResults && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white border rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {filteredCustomerList.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className="w-full text-left px-4 py-2 hover:bg-orange-50 border-b last:border-0"
                  >
                    <p className="text-[11px] font-black text-slate-900 uppercase">
                      {c.name}
                    </p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase">
                      {c.id}
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
              {paginatedEntries.map((entry, idx) => (
                <tr key={entry.id} className="hover:bg-slate-50 text-[11px]">
                  <td className="px-4 py-2 font-bold text-slate-500 italic">
                    {entry.date}
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
                    {runningBalances[idx]?.toLocaleString() || "0"}
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

        <Pagination
          totalItems={filteredEntries.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
        <div className="grid grid-cols-1 md:grid-cols-4 border-t bg-slate-50/30 text-center">
          <div className="p-4 border-b md:border-b-0 md:border-r">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              Total Sales (Dr)
            </p>
            <p className="text-sm font-black text-orange-600">
              Rs. {totals.debit.toLocaleString()}
            </p>
          </div>
          <div className="p-4 border-b md:border-b-0 md:border-r">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-0.5">
              Total Receipts (Cr)
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
      </div>
    </div>
  );
};

export default CustomerLedgerPage;
