import React, { useMemo } from "react";
import type { Company, Customer, Product, SalesInvoice } from "../types";
import SalesInvoiceFormPage from "./SalesInvoiceForm";
import type { SalesReturnDoc } from "./SalesReturn";

interface SalesReturnFormPageProps {
  docs: SalesReturnDoc[];
  customers: Customer[];
  products: Product[];
  company?: Company;
  doc?: SalesReturnDoc;
  onBack: () => void;
  onSave: (doc: SalesReturnDoc) => void;
}

const SalesReturnFormPage: React.FC<SalesReturnFormPageProps> = ({
  docs,
  customers,
  products,
  company,
  doc,
  onBack,
  onSave,
}) => {
  const invoices = useMemo<SalesInvoice[]>(
    () =>
      docs.map((row) => ({
        id: row.id,
        customerName: row.customerName,
        date: row.date,
        dueDate: row.date,
        status: row.status,
        paymentStatus: "Unpaid",
        reference: "",
        notes: row.notes || "",
        items: [],
        totalAmount: Number(row.totalAmount || 0),
        amountReceived: 0,
      })),
    [docs]
  );

  const editingInvoice = useMemo<SalesInvoice | undefined>(() => {
    if (!doc) return undefined;
    return {
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
    };
  }, [doc]);

  return (
    <SalesInvoiceFormPage
      invoice={editingInvoice}
      idPrefix="SR"
      showSavePrices={false}
      invoices={invoices}
      products={products}
      customers={customers}
      company={company}
      onBack={onBack}
      formTitleNew="New Sales Return"
      formTitleEdit="Edit Sales Return"
      onSave={(invoice) =>
        onSave({
          id: invoice.id,
          customerName: invoice.customerName,
          date: invoice.date,
          status: String(invoice.status || "Draft"),
          totalAmount: Number(invoice.totalAmount || 0),
          notes: invoice.notes || "",
        })
      }
    />
  );
};

export default SalesReturnFormPage;
