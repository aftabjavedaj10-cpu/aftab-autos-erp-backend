import React, { useMemo, useState } from "react";
import type { Customer, SalesInvoice } from "../types";
import type { ReceivePaymentDoc } from "./ReceivePayment";

interface CustomerBalanceReportPageProps {
  onBack: () => void;
  onOpenCustomerLedger?: (customerId?: string) => void;
  customers: Customer[];
  salesInvoices: SalesInvoice[];
  salesReturns: SalesInvoice[];
  receivePayments: ReceivePaymentDoc[];
}

type BalanceSideFilter = "All" | "DR" | "CR" | "Zero";

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const isVisibleStatus = (status: unknown) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized !== "void" && normalized !== "deleted";
};

const inDateRange = (dateValue: unknown, startDate: string, endDate: string) => {
  const date = String(dateValue || "").slice(0, 10);
  if (!date) return false;
  return date >= startDate && date <= endDate;
};

const CustomerBalanceReportPage: React.FC<CustomerBalanceReportPageProps> = ({
  onBack,
  onOpenCustomerLedger,
  customers,
  salesInvoices,
  salesReturns,
  receivePayments,
}) => {
  const today = new Date().toISOString().slice(0, 10);
  const oneMonthAgo = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const [search, setSearch] = useState("");
  const [sideFilter, setSideFilter] = useState<BalanceSideFilter>("All");
  const [startDate, setStartDate] = useState(oneMonthAgo);
  const [endDate, setEndDate] = useState(today);

  const rows = useMemo(() => {
    const customerByName = new Map<string, string>();
    customers.forEach((c) => {
      const key = String(c.name || "").trim().toLowerCase();
      if (key && c.id) customerByName.set(key, String(c.id));
    });

    return customers
      .map((customer) => {
        const customerId = String(customer.id || "");
        const customerName = String(customer.name || "");
        const opening = toNumber(customer.openingBalance);

        const sales = salesInvoices
          .filter((inv) => isVisibleStatus((inv as any).status))
          .filter((inv) => inDateRange(inv.date, startDate, endDate))
          .filter(
            (inv) =>
              String(inv.customerId || "") === customerId ||
              String(inv.customerName || "").trim().toLowerCase() === customerName.trim().toLowerCase()
          )
          .reduce((sum, inv) => sum + toNumber(inv.totalAmount), 0);

        const returns = salesReturns
          .filter((inv) => isVisibleStatus((inv as any).status))
          .filter((inv) => inDateRange(inv.date, startDate, endDate))
          .filter(
            (inv) =>
              String(inv.customerId || "") === customerId ||
              String(inv.customerName || "").trim().toLowerCase() === customerName.trim().toLowerCase()
          )
          .reduce((sum, inv) => sum + toNumber(inv.totalAmount), 0);

        const receipts = receivePayments
          .filter((pay) => isVisibleStatus((pay as any).status))
          .filter((pay) => inDateRange(pay.date, startDate, endDate))
          .filter((pay) => {
            const byId = customerId && String(pay.customerId || "") === customerId;
            const byName = String(pay.customerName || "").trim().toLowerCase() === customerName.trim().toLowerCase();
            const fallbackIdByName = customerByName.get(String(pay.customerName || "").trim().toLowerCase()) || "";
            return byId || byName || (customerId && fallbackIdByName === customerId);
          })
          .reduce((sum, pay) => sum + toNumber(pay.totalAmount), 0);

        const closing = opening + sales - returns - receipts;
        const side = closing > 0 ? "DR" : closing < 0 ? "CR" : "Zero";

        return {
          id: customerId,
          name: customerName,
          customerCode: String(customer.customerCode || ""),
          opening,
          sales,
          returns,
          receipts,
          closing,
          side,
        };
      })
      .filter((row) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
          row.name.toLowerCase().includes(q) ||
          row.customerCode.toLowerCase().includes(q) ||
          row.id.toLowerCase().includes(q)
        );
      })
      .filter((row) => sideFilter === "All" || row.side === sideFilter)
      .sort((a, b) => Math.abs(b.closing) - Math.abs(a.closing));
  }, [customers, salesInvoices, salesReturns, receivePayments, search, sideFilter, startDate, endDate]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.opening += row.opening;
        acc.sales += row.sales;
        acc.returns += row.returns;
        acc.receipts += row.receipts;
        acc.closing += row.closing;
        if (row.closing > 0) acc.totalDebit += row.closing;
        if (row.closing < 0) acc.totalCredit += Math.abs(row.closing);
        return acc;
      },
      {
        opening: 0,
        sales: 0,
        returns: 0,
        receipts: 0,
        closing: 0,
        totalDebit: 0,
        totalCredit: 0,
      }
    );
  }, [rows]);

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <button
              onClick={onBack}
              className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm active:scale-95"
            >
              <span className="text-sm">←</span>
            </button>
            <h1 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
              Customer Balance Report
            </h1>
          </div>
          <p className="text-slate-500 text-[8px] uppercase tracking-widest">Financial Summary</p>
        </div>
        <button
          onClick={() => onOpenCustomerLedger?.()}
          className="bg-slate-900 text-white font-black py-2 px-4 rounded-xl text-[10px] uppercase tracking-widest shadow-md"
        >
          Open Customer Ledger
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-800 p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Search Customer
            </label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all"
              placeholder="Name, code, or id..."
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Balance Side
            </label>
            <select
              value={sideFilter}
              onChange={(e) => setSideFilter(e.target.value as BalanceSideFilter)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[12px] font-bold"
            >
              <option value="All">All</option>
              <option value="DR">Debit (DR)</option>
              <option value="CR">Credit (CR)</option>
              <option value="Zero">Zero</option>
            </select>
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              From Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[12px] font-bold"
            />
          </div>
          <div>
            <label className="block text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">
              To Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border rounded-xl py-2 px-3 text-[12px] font-bold"
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Opening</p>
          <p className="text-lg font-black text-slate-900 dark:text-white">{totals.opening.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Sales</p>
          <p className="text-lg font-black text-orange-600">{totals.sales.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Total Receipts</p>
          <p className="text-lg font-black text-emerald-600">{totals.receipts.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 p-3">
          <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Net Receivable (DR)</p>
          <p className="text-lg font-black text-rose-600">{totals.totalDebit.toLocaleString()}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-[10px] font-extrabold uppercase text-slate-600 tracking-widest border-b">
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3 text-right">Opening</th>
                <th className="px-4 py-3 text-right">Sales</th>
                <th className="px-4 py-3 text-right">Returns</th>
                <th className="px-4 py-3 text-right">Receipts</th>
                <th className="px-4 py-3 text-right">Closing</th>
                <th className="px-4 py-3 text-center w-28">Side</th>
                <th className="px-4 py-3 text-center w-28">Ledger</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id || row.name} className="hover:bg-slate-50 text-[11px] border-b border-slate-200">
                  <td className="px-4 py-1.5">
                    <p className="font-black text-slate-900 uppercase">{row.name || "-"}</p>
                    <p className="text-[9px] font-bold text-slate-500 uppercase">
                      {row.customerCode || row.id || "-"}
                    </p>
                  </td>
                  <td className="px-4 py-1.5 text-right font-bold">{row.opening.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-bold text-orange-600">{row.sales.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-bold text-indigo-600">{row.returns.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-bold text-emerald-600">{row.receipts.toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-right font-black">{Math.abs(row.closing).toLocaleString()}</td>
                  <td className="px-4 py-1.5 text-center">
                    <span
                      className={`inline-flex px-2 py-1 rounded-md text-[9px] font-black uppercase ${
                        row.side === "DR"
                          ? "bg-rose-100 text-rose-700"
                          : row.side === "CR"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {row.side}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-center">
                    <button
                      onClick={() => onOpenCustomerLedger?.(row.id)}
                      className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-[9px] font-black uppercase tracking-widest text-slate-700"
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-[11px] font-black text-slate-400 uppercase tracking-widest">
                    No customer balances found for selected filters.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50/70 border-t-2 border-slate-200 text-[11px] font-black">
                <td className="px-4 py-2 uppercase">Total</td>
                <td className="px-4 py-2 text-right">{totals.opening.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-orange-700">{totals.sales.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-indigo-700">{totals.returns.toLocaleString()}</td>
                <td className="px-4 py-2 text-right text-emerald-700">{totals.receipts.toLocaleString()}</td>
                <td className="px-4 py-2 text-right">{Math.abs(totals.closing).toLocaleString()}</td>
                <td className="px-4 py-2 text-center">{totals.closing > 0 ? "DR" : totals.closing < 0 ? "CR" : "Zero"}</td>
                <td className="px-4 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerBalanceReportPage;
