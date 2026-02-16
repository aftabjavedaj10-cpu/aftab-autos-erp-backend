import React, { useMemo, useState } from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

export interface MakePaymentDoc {
  id: string;
  vendorId?: string;
  vendorName: string;
  invoiceId?: string;
  reference?: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface MakePaymentPageProps {
  docs: MakePaymentDoc[];
  onAddClick: () => void;
  onEditClick: (doc: MakePaymentDoc) => void;
  onDelete: (id: string) => void;
  statusFilterPreset?: string;
  statusFilterPresetTick?: number;
}

const isLinkedPayment = (doc: MakePaymentDoc) => {
  const invoiceId = String(doc.invoiceId || "").trim();
  if (invoiceId) return true;
  const legacyRef = String(doc.reference || "").trim();
  return /^PI-\d+$/i.test(legacyRef);
};

const MakePaymentPage: React.FC<MakePaymentPageProps> = ({
  docs,
  onAddClick,
  onEditClick,
  onDelete,
  statusFilterPreset,
  statusFilterPresetTick,
}) => {
  const [sourceFilter, setSourceFilter] = useState<"manual" | "linked" | "all">("manual");

  const visibleDocs = useMemo(() => {
    if (sourceFilter === "all") return docs;
    if (sourceFilter === "linked") return docs.filter((doc) => isLinkedPayment(doc));
    return docs.filter((doc) => !isLinkedPayment(doc));
  }, [docs, sourceFilter]);

  const mappedInvoices = useMemo<SalesInvoice[]>(
    () =>
      visibleDocs.map((doc) => ({
        id: doc.id,
        customerId: doc.vendorId,
        customerName: doc.vendorName,
        reference: doc.reference || "",
        date: doc.date,
        dueDate: doc.date,
        status: doc.status,
        paymentStatus: "Paid",
        notes: doc.notes || "",
        items: [],
        totalAmount: Number(doc.totalAmount || 0),
        amountReceived: Number(doc.totalAmount || 0),
      })),
    [visibleDocs]
  );

  const mapBack = (invoice: SalesInvoice): MakePaymentDoc => ({
    id: invoice.id,
    vendorId: invoice.customerId,
    vendorName: invoice.customerName,
    invoiceId: docs.find((doc) => doc.id === invoice.id)?.invoiceId || "",
    reference: invoice.reference || "",
    date: invoice.date,
    status: String(invoice.status || "Draft"),
    totalAmount: Number(invoice.totalAmount || 0),
    notes: invoice.notes || "",
    createdAt: (invoice as any).createdAt,
    updatedAt: (invoice as any).updatedAt,
  });

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setSourceFilter("manual")}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border ${
            sourceFilter === "manual"
              ? "bg-orange-600 text-white border-orange-600"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          }`}
        >
          Manual Payments
        </button>
        <button
          type="button"
          onClick={() => setSourceFilter("linked")}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border ${
            sourceFilter === "linked"
              ? "bg-orange-600 text-white border-orange-600"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          }`}
        >
          Linked Payments
        </button>
        <button
          type="button"
          onClick={() => setSourceFilter("all")}
          className={`rounded-lg px-3 py-1.5 text-[10px] font-black uppercase tracking-wider border ${
            sourceFilter === "all"
              ? "bg-orange-600 text-white border-orange-600"
              : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700"
          }`}
        >
          All Payments
        </button>
      </div>

      <SalesInvoicePage
        invoices={mappedInvoices}
        onAddClick={onAddClick}
        onEditClick={(invoice) => onEditClick(mapBack(invoice))}
        onDelete={onDelete}
        pageTitle="Make Payment"
        pageSubtitle="Vendor payment entries"
        addButtonLabel="Add Payment"
        showBalanceColumn={false}
        showAgainstInvoiceColumn
        againstInvoiceColumnLabel="Against Invoice #"
        referenceColumnLabel="Reference"
        entityColumnLabel="Vendor Entity"
        searchPlaceholder="Payment # or Vendor..."
        getAgainstInvoiceValue={(invoice) =>
          docs.find((doc) => doc.id === invoice.id)?.invoiceId || ""
        }
        statusFilterPreset={statusFilterPreset}
        statusFilterPresetTick={statusFilterPresetTick}
      />
    </div>
  );
};

export default MakePaymentPage;
