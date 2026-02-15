import React, { useMemo, useRef, useEffect, useState } from "react";
import type { Customer, SalesInvoice } from "../types";
import type { ReceivePaymentDoc } from "./ReceivePayment";
import { formatDateDMY } from "../services/dateFormat";
import type { Company } from "../types";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import { FiEye } from "react-icons/fi";

interface LedgerEntry {
  id: string;
  date: string;
  postedAt?: string;
  orderHint?: number;
  viewKind?: "sales_invoice" | "sales_return" | "receive_payment";
  viewId?: string;
  description: string;
  detailNarration?: string;
  reference: string;
  type: "Invoice" | "Receipt" | "Return";
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
  Invoice: 1,
  Return: 2,
  Receipt: 3,
};

const isLedgerVisibleStatus = (status: unknown) => {
  const normalized = String(status || "").trim().toLowerCase();
  return normalized !== "void" && normalized !== "deleted";
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

const TRANSACTION_TYPES = ["All Types", "Invoice", "Receipt", "Return"];

interface CustomerLedgerPageProps {
  onBack: () => void;
  customers: Customer[];
  salesInvoices: SalesInvoice[];
  salesReturns: SalesInvoice[];
  receivePayments: ReceivePaymentDoc[];
  company?: Company;
  onViewSalesInvoice?: (id: string) => void;
  onViewSalesReturn?: (id: string) => void;
  onViewReceivePayment?: (id: string) => void;
}

const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({
  onBack,
  customers,
  salesInvoices,
  salesReturns,
  receivePayments,
  company,
  onViewSalesInvoice,
  onViewSalesReturn,
  onViewReceivePayment,
}) => {
  const defaultEndDate = new Date().toISOString().split("T")[0];
  const defaultStartDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split("T")[0];
  })();

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [showDetailedNarration, setShowDetailedNarration] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchRef = useRef<HTMLDivElement>(null);
  const ledgerTemplateRef = useRef<HTMLDivElement>(null);

  const selectedCustomer = useMemo(
    () => customers.find((c) => String(c.id || "") === String(selectedCustomerId || "")),
    [selectedCustomerId, customers]
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

  const filteredCustomerList = useMemo(() => {
    if (!customerSearch || selectedCustomer?.name === customerSearch)
      return customers;
    return customers.filter(
      (c) => {
        const name = String(c.name || "").toLowerCase();
        const id = String(c.id || "").toLowerCase();
        const query = customerSearch.toLowerCase();
        return name.includes(query) || id.includes(query);
      }
    );
  }, [customerSearch, selectedCustomer, customers]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [customerSearch, showResults]);

  const rawEntries = useMemo(() => {
    const entries: LedgerEntry[] = [];
    const customerId = selectedCustomerId;
    const customer = customers.find((c) => String(c.id || "") === String(customerId || ""));
    const openingRaw = Number(customer?.openingBalance || 0);
    if (!Number.isNaN(openingRaw) && openingRaw !== 0) {
      entries.push({
        id: `open-${customerId}`,
        date: "2023-10-01",
        postedAt: "2023-10-01T00:00:00.000Z",
        orderHint: -100,
        description: "Opening Balance",
        reference: "-",
        type: "Invoice",
        debit: openingRaw > 0 ? openingRaw : 0,
        credit: openingRaw < 0 ? Math.abs(openingRaw) : 0,
      });
    }

    const customerInvoices = salesInvoices
      .filter(
        (inv) =>
          String(inv.customerId || "") === String(customerId || "") &&
          isLedgerVisibleStatus((inv as any).status)
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id).localeCompare(String(b.id));
      });

    customerInvoices.forEach((inv) => {
        const manualRef = String(inv.reference || "").trim();
        entries.push({
          id: `inv-${inv.id}`,
          date: inv.date,
          postedAt: String((inv as any).createdAt || (inv as any).updatedAt || inv.date || ""),
          orderHint: 10,
          viewKind: "sales_invoice",
          viewId: String(inv.id || ""),
          description: `Credit Sales - ${inv.id}`,
          detailNarration: buildItemsNarration(inv.items || []),
          reference: manualRef,
          type: "Invoice",
          debit: Number(inv.totalAmount || 0),
          credit: 0,
        });
        const received = Number(inv.amountReceived || 0);
        if (received > 0) {
          entries.push({
            id: `rcp-${inv.id}`,
            date: inv.date,
            postedAt: String((inv as any).createdAt || (inv as any).updatedAt || inv.date || ""),
            orderHint: 20,
            viewKind: "sales_invoice",
            viewId: String(inv.id || ""),
            description: "Payment Received",
            detailNarration: buildItemsNarration(inv.items || []),
            reference: manualRef,
            type: "Receipt",
            debit: 0,
            credit: received,
          });
        }
      });

    const customerReturns = salesReturns
      .filter(
        (ret) =>
          String(ret.customerId || "") === String(customerId || "") &&
          isLedgerVisibleStatus((ret as any).status)
      )
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id).localeCompare(String(b.id));
      });

    customerReturns.forEach((ret) => {
      const manualRef = String(ret.reference || "").trim();
      entries.push({
        id: `ret-${ret.id}`,
        date: ret.date,
        postedAt: String((ret as any).createdAt || (ret as any).updatedAt || ret.date || ""),
        orderHint: 30,
        viewKind: "sales_return",
        viewId: String(ret.id || ""),
        description: `Sales Return - ${ret.id}`,
        detailNarration: buildItemsNarration(ret.items || []),
        reference: manualRef,
        type: "Return",
        debit: 0,
        credit: Number(ret.totalAmount || 0),
      });
    });

    const customerPayments = receivePayments
      .filter((pay) => {
        const statusOk = isLedgerVisibleStatus((pay as any).status);
        const byId =
          selectedCustomerId &&
          pay.customerId &&
          String(pay.customerId) === String(selectedCustomerId);
        const byName =
          String(pay.customerName || "").toLowerCase() ===
          String(selectedCustomer?.name || "").toLowerCase();
        return statusOk && Boolean(byId || byName);
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return String(a.id).localeCompare(String(b.id));
      });

    customerPayments.forEach((pay) => {
      entries.push({
        id: `pay-${pay.id}`,
        date: pay.date,
        postedAt: String(pay.createdAt || pay.updatedAt || pay.date || ""),
        orderHint: 40,
        viewKind: "receive_payment",
        viewId: String(pay.id || ""),
        description: "Payment Received",
        reference: String(pay.reference || "").trim(),
        type: "Receipt",
        debit: 0,
        credit: Number(pay.totalAmount || 0),
      });
    });

    // Modern ERP ledger pattern: Opening first, then oldest to newest.
    entries.sort(compareLedgerEntries);

    return entries;
  }, [customers, salesInvoices, salesReturns, receivePayments, selectedCustomerId, selectedCustomer]);

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

  const handleSelectCustomer = (customer: Customer) => {
    if (!customer.id) return;
    setSelectedCustomerId(String(customer.id));
    setCustomerSearch(customer.name);
    setShowResults(false);
  };

  const handleCustomerSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        Math.min(prev + 1, Math.max(filteredCustomerList.length - 1, 0))
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
      const target = filteredCustomerList[highlightedIndex];
      if (target) handleSelectCustomer(target);
      return;
    }
    if (e.key === "Escape") {
      setShowResults(false);
    }
  };

  const handleViewEntry = (entry: LedgerEntry) => {
    if (!entry.viewId || !entry.viewKind) return;
    if (entry.viewKind === "sales_invoice") return onViewSalesInvoice?.(entry.viewId);
    if (entry.viewKind === "sales_return") return onViewSalesReturn?.(entry.viewId);
    if (entry.viewKind === "receive_payment") return onViewReceivePayment?.(entry.viewId);
  };

  const handleDownloadPdf = async () => {
    if (!ledgerTemplateRef.current) return;
    const canvas = await html2canvas(ledgerTemplateRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      onclone: (clonedDoc) => {
        clonedDoc.querySelectorAll<HTMLElement>(".print\\:hidden").forEach((el) => {
          el.style.display = "none";
        });
        clonedDoc
          .querySelectorAll<HTMLElement>(".hidden.print\\:block, .print\\:block")
          .forEach((el) => {
            el.style.display = "block";
          });
      },
    });

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const imgData = canvas.toDataURL("image/png");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const imgHeight = (canvas.height * usableWidth) / canvas.width;

    let heightLeft = imgHeight;
    let y = margin;

    doc.addImage(imgData, "PNG", margin, y, usableWidth, imgHeight);
    heightLeft -= usableHeight;

    while (heightLeft > 0) {
      doc.addPage();
      y = margin - (imgHeight - heightLeft);
      doc.addImage(imgData, "PNG", margin, y, usableWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    const safeCustomer = String(selectedCustomer?.customerCode || selectedCustomer?.id || selectedCustomer?.name || "all").replace(/[^\w-]+/g, "_");
    doc.save(`customer_ledger_${safeCustomer}_${startDate}_to_${endDate}.pdf`);
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="bg-slate-900 text-white font-black py-2 px-6 rounded-xl text-[9px] uppercase tracking-widest shadow-md"
          >
            Print Statement
          </button>
          <button
            onClick={handleDownloadPdf}
            className="bg-orange-600 text-white font-black py-2 px-6 rounded-xl text-[9px] uppercase tracking-widest shadow-md"
          >
            Download PDF
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
                value={customerSearch}
                onFocus={() => setShowResults(true)}
                onChange={(e) => {
                  setCustomerSearch(e.target.value);
                  setShowResults(true);
                }}
                onKeyDown={handleCustomerSearchKeyDown}
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-500 transition-all placeholder:text-slate-400"
                placeholder="Search customer..."
              />
            </div>
            {showResults && (
              <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                {filteredCustomerList.map((c, idx) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelectCustomer(c)}
                    className={`w-full text-left px-4 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      highlightedIndex === idx
                        ? "bg-orange-50 dark:bg-slate-800"
                        : "hover:bg-orange-50 dark:hover:bg-slate-800"
                    }`}
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
        </div>
      </div>

      <div ref={ledgerTemplateRef} className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden print:rounded-none print:shadow-none print:border-0">
        <div className="hidden print:block px-6 py-4 print:border-0">
          <div className="flex items-start justify-between gap-3 border-b border-black pb-2">
            <h2 className="text-2xl font-black text-slate-900 uppercase">
              {company?.name || "AFTAB AUTOS"}
            </h2>
            <h3 className="text-xl font-black text-slate-900">
              Customer Ledger Report
            </h3>
          </div>
          <div className="mt-2 flex items-start justify-between gap-3">
            <div className="text-[12px] font-bold text-slate-700">
              <p>
                Customer:{" "}
                {selectedCustomer
                  ? `${selectedCustomer.customerCode || selectedCustomer.id || ""} - ${selectedCustomer.name}`
                  : "All Customers"}
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
                      disabled={!entry.viewId || !entry.viewKind}
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

export default CustomerLedgerPage;
