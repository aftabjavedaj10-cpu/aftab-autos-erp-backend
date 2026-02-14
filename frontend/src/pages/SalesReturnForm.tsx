import React, { useMemo } from "react";
import type { Company, Customer, Product, SalesInvoice } from "../types";
import SalesInvoiceFormPage from "./SalesInvoiceForm";

interface SalesReturnFormPageProps {
  invoices: SalesInvoice[];
  customers: Customer[];
  products: Product[];
  company?: Company;
  invoice?: SalesInvoice;
  onBack: () => void;
  onSave: (invoice: SalesInvoice) => void;
}

const SalesReturnFormPage: React.FC<SalesReturnFormPageProps> = ({
  invoices,
  customers,
  products,
  company,
  invoice,
  onBack,
  onSave,
}) => {
  const normalizedInvoice = useMemo(() => invoice, [invoice]);

  return (
    <SalesInvoiceFormPage
      invoice={normalizedInvoice}
      idPrefix="SR"
      showSavePrices={false}
      amountReceivedLabel="Cash Returned"
      balanceLabel="Return Balance"
      invoices={invoices}
      products={products}
      customers={customers}
      company={company}
      onBack={onBack}
      formTitleNew="New Sales Return"
      formTitleEdit="Edit Sales Return"
      onSave={(nextInvoice) => onSave(nextInvoice)}
    />
  );
};

export default SalesReturnFormPage;
