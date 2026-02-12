import React, { useMemo, useState } from "react";
import type { Customer } from "../types";
import type { SalesModuleDoc } from "./SalesModulePage";

interface AddSalesModulePageProps {
  moduleTitle: string;
  prefix: string;
  docs: SalesModuleDoc[];
  customers: Customer[];
  doc?: SalesModuleDoc;
  onBack: () => void;
  onSave: (doc: SalesModuleDoc) => void;
}

const nextDocId = (prefix: string, docs: SalesModuleDoc[]) => {
  const maxNo = docs.reduce((max, row) => {
    const match = String(row.id || "").match(new RegExp(`^${prefix}-(\\d{6})$`));
    const value = match ? Number(match[1]) : 0;
    return value > max ? value : max;
  }, 0);
  return `${prefix}-${String(maxNo + 1).padStart(6, "0")}`;
};

const AddSalesModulePage: React.FC<AddSalesModulePageProps> = ({
  moduleTitle,
  prefix,
  docs,
  customers,
  doc,
  onBack,
  onSave,
}) => {
  const generatedId = useMemo(() => nextDocId(prefix, docs), [prefix, docs]);

  const [form, setForm] = useState<SalesModuleDoc>({
    id: doc?.id || generatedId,
    customerName: doc?.customerName || "",
    date: doc?.date || new Date().toISOString().slice(0, 10),
    status: doc?.status || "Draft",
    totalAmount: Number(doc?.totalAmount || 0),
    notes: doc?.notes || "",
  });

  return (
    <div className="animate-in fade-in duration-300 max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {doc ? `Edit ${moduleTitle}` : `Add ${moduleTitle}`}
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {prefix} series enabled
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
        >
          Back
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Document No
            </label>
            <input
              type="text"
              value={form.id}
              readOnly
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-black text-orange-600 outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Customer
            </label>
            <select
              value={form.customerName}
              onChange={(e) => setForm((prev) => ({ ...prev, customerName: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
            >
              <option value="">Select customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Status
            </label>
            <select
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
            >
              <option value="Draft">Draft</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
              Total Amount
            </label>
            <input
              type="number"
              value={form.totalAmount}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, totalAmount: Number(e.target.value || 0) }))
              }
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
            Notes
          </label>
          <textarea
            rows={3}
            value={form.notes || ""}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.customerName}
            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-[10px] font-black uppercase tracking-widest"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddSalesModulePage;

