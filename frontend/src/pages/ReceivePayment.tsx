import React, { useMemo } from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

export interface ReceivePaymentDoc {
  id: string;
  customerId?: string;
  customerName: string;
  invoiceId?: string;
  reference?: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ReceivePaymentPageProps {
  docs: ReceivePaymentDoc[];
  onAddClick: () => void;
  onEditClick: (doc: ReceivePaymentDoc) => void;
  onDelete: (id: string) => void;
}

const ReceivePaymentPage: React.FC<ReceivePaymentPageProps> = ({
  docs,
  onAddClick,
  onEditClick,
  onDelete,
}) => {
  const mappedInvoices = useMemo<SalesInvoice[]>(
    () =>
      docs.map((doc) => ({
        id: doc.id,
        customerId: doc.customerId,
        customerName: doc.customerName,
        reference: doc.invoiceId || doc.reference || "",
        date: doc.date,
        dueDate: doc.date,
        status: doc.status,
        paymentStatus: "Paid",
        notes: doc.notes || "",
        items: [],
        totalAmount: Number(doc.totalAmount || 0),
        amountReceived: Number(doc.totalAmount || 0),
      })),
    [docs]
  );

  const mapBack = (invoice: SalesInvoice): ReceivePaymentDoc => ({
    id: invoice.id,
    customerId: invoice.customerId,
    customerName: invoice.customerName,
    invoiceId: /^SI-\d+$/i.test(String(invoice.reference || "")) ? String(invoice.reference) : "",
    reference: invoice.reference || "",
    date: invoice.date,
    status: String(invoice.status || "Draft"),
    totalAmount: Number(invoice.totalAmount || 0),
    notes: invoice.notes || "",
    createdAt: (invoice as any).createdAt,
    updatedAt: (invoice as any).updatedAt,
  });

  return (
    <SalesInvoicePage
      invoices={mappedInvoices}
      onAddClick={onAddClick}
      onEditClick={(invoice) => onEditClick(mapBack(invoice))}
      onDelete={onDelete}
      pageTitle="Receive Payment"
      pageSubtitle="Customer payment entries"
      addButtonLabel="Add Payment"
      showBalanceColumn={false}
    />
  );
};

export default ReceivePaymentPage;
