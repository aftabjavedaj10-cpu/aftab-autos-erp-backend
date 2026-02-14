import React, { useMemo } from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

export interface SalesReturnDoc {
  id: string;
  customerName: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
}

interface SalesReturnPageProps {
  docs: SalesReturnDoc[];
  onAddClick: () => void;
  onEditClick: (doc: SalesReturnDoc) => void;
  onDelete: (id: string) => void;
}

const SalesReturnPage: React.FC<SalesReturnPageProps> = ({
  docs,
  onAddClick,
  onEditClick,
  onDelete,
}) => {
  const mappedInvoices = useMemo<SalesInvoice[]>(
    () =>
      docs.map((doc) => ({
        id: doc.id,
        customerName: doc.customerName,
        date: doc.date,
        dueDate: doc.date,
        status: doc.status,
        paymentStatus: "Unpaid",
        reference: "",
        notes: doc.notes || "",
        items: [],
        totalAmount: Number(doc.totalAmount || 0),
        amountReceived: 0,
      })),
    [docs]
  );

  const mapBack = (invoice: SalesInvoice): SalesReturnDoc => ({
    id: invoice.id,
    customerName: invoice.customerName,
    date: invoice.date,
    status: String(invoice.status || "Draft"),
    totalAmount: Number(invoice.totalAmount || 0),
    notes: invoice.notes || "",
  });

  return (
    <SalesInvoicePage
      invoices={mappedInvoices}
      onAddClick={onAddClick}
      onEditClick={(invoice) => onEditClick(mapBack(invoice))}
      onDelete={onDelete}
      pageTitle="Sales Return"
      pageSubtitle="Customer return records"
      addButtonLabel="Add Sales Return"
    />
  );
};

export default SalesReturnPage;

