import React from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

interface SalesReturnPageProps {
  invoices: SalesInvoice[];
  onAddClick: () => void;
  onEditClick: (invoice: SalesInvoice) => void;
  onDelete: (id: string) => void;
}

const SalesReturnPage: React.FC<SalesReturnPageProps> = ({
  invoices,
  onAddClick,
  onEditClick,
  onDelete,
}) => {
  return (
    <SalesInvoicePage
      invoices={invoices}
      onAddClick={onAddClick}
      onEditClick={onEditClick}
      onDelete={onDelete}
      pageTitle="Sales Return"
      pageSubtitle="Customer return records"
      addButtonLabel="Add Sales Return"
    />
  );
};

export default SalesReturnPage;
