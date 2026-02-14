import React, { useMemo } from "react";
import type { Company, Customer, Product, SalesInvoice } from "../types";
import SalesInvoiceFormPage from "./SalesInvoiceForm";
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
        paymentStatus: "Paid",
        reference: "",
        notes: row.notes || "",
        items: [],
        totalAmount: Number(row.totalAmount || 0),
        amountReceived: Number(row.totalAmount || 0),
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
      paymentStatus: "Paid",
      reference: "",
      notes: doc.notes || "",
      items: [],
      totalAmount: Number(doc.totalAmount || 0),
      amountReceived: Number(doc.totalAmount || 0),
    };
  }, [doc]);

  return (
    <SalesInvoiceFormPage
      invoice={editingInvoice}
      idPrefix="RP"
      showSavePrices={false}
      invoices={invoices}
      products={products}
      customers={customers}
      company={company}
      onBack={onBack}
      formTitleNew="New Receive Payment"
      formTitleEdit="Edit Receive Payment"
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

export default ReceivePaymentFormPage;
