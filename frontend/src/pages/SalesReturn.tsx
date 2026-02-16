import React from "react";
import type { SalesInvoice } from "../types";
import SalesInvoicePage from "./SalesInvoice";

interface SalesReturnPageProps {
  invoices: SalesInvoice[];
  onAddClick: () => void;
  onEditClick: (invoice: SalesInvoice) => void;
  onDelete: (id: string) => void;
  statusFilterPreset?: string;
  statusFilterPresetTick?: number;
}

const SalesReturnPage: React.FC<SalesReturnPageProps> = ({
  invoices,
  onAddClick,
  onEditClick,
  onDelete,
  statusFilterPreset,
  statusFilterPresetTick,
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
      statusFilterPreset={statusFilterPreset}
      statusFilterPresetTick={statusFilterPresetTick}
    />
  );
};

export default SalesReturnPage;
