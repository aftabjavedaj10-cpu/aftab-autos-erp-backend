import React, { useMemo } from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

export interface SalesOrderDoc {
  id: string;
  customerName: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
}

interface SalesOrderPageProps {
  docs: SalesOrderDoc[];
  onAddClick: () => void;
  onEditClick: (doc: SalesOrderDoc) => void;
  onDelete: (id: string) => void;
  statusFilterPreset?: string;
  statusFilterPresetTick?: number;
}

const SalesOrderPage: React.FC<SalesOrderPageProps> = ({
  docs,
  onAddClick,
  onEditClick,
  onDelete,
  statusFilterPreset,
  statusFilterPresetTick,
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

  const mapBack = (invoice: SalesInvoice): SalesOrderDoc => ({
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
      pageTitle="Sales Order"
      pageSubtitle="Confirmed customer orders"
      addButtonLabel="Add Sales Order"
      statusFilterPreset={statusFilterPreset}
      statusFilterPresetTick={statusFilterPresetTick}
    />
  );
};

export default SalesOrderPage;
