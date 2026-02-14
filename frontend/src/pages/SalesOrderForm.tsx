import React, { useMemo } from "react";
import type { Company, Customer, Product, SalesInvoice } from "../types";
import SalesInvoiceFormPage from "./SalesInvoiceForm";
import type { SalesOrderDoc } from "./SalesOrder";

interface SalesOrderFormPageProps {
  docs: SalesOrderDoc[];
  customers: Customer[];
  products: Product[];
  company?: Company;
  doc?: SalesOrderDoc;
  onBack: () => void;
  onSave: (doc: SalesOrderDoc) => void;
}

const SalesOrderFormPage: React.FC<SalesOrderFormPageProps> = ({
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
      idPrefix="SO"
      showSavePrices={false}
      invoices={invoices}
      products={products}
      customers={customers}
      company={company}
      onBack={onBack}
      formTitleNew="New Sales Order"
      formTitleEdit="Edit Sales Order"
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

export default SalesOrderFormPage;
