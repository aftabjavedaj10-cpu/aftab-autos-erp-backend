import React, { useState } from "react";
import type { UnitMaster } from "../types";

interface AddUnitFormPageProps {
  unit?: UnitMaster;
  onBack: () => void;
  onSave: (unit: UnitMaster, stayOnPage: boolean) => void;
}

const AddUnitFormPage: React.FC<AddUnitFormPageProps> = ({ unit, onBack, onSave }) => {
  const isEdit = Boolean(unit?.id);
  const [name, setName] = useState(unit?.name || "");
  const [description, setDescription] = useState(unit?.description || "");
  const [isActive, setIsActive] = useState(unit?.isActive !== false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = (stayOnPage: boolean) => {
    if (!name.trim()) {
      setError("Unit name is required.");
      return;
    }
    setError(null);
    onSave(
      {
        ...unit,
        id: unit?.id || `unit_${Date.now()}`,
        name: name.trim(),
        description: description.trim(),
        isActive,
      },
      stayOnPage
    );

    if (stayOnPage && !isEdit) {
      setName("");
      setDescription("");
      setIsActive(true);
    }
  };

  return (
    <div className="erp-compact animate-in fade-in duration-500 pb-10">
      <div className="mb-5 flex items-center gap-3">
        <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">Back</button>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Setup</p>
          <h1 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">{isEdit ? "Edit Unit" : "Add Unit Form"}</h1>
        </div>
      </div>

      <div className="max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Unit Name</span>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter unit name..." className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>

          <label className="block md:col-span-2">
            <span className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-slate-500">Description</span>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description..." className="w-full resize-none rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </label>

          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-orange-600" />
            Active
          </label>
        </div>

        {error && <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-300">{error}</div>}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => handleSave(true)} className="rounded-xl border border-orange-300 bg-orange-50 px-4 py-2 text-xs font-black uppercase tracking-widest text-orange-700 hover:bg-orange-100 dark:border-orange-900/50 dark:bg-orange-950/40 dark:text-orange-300">Save and Add Another</button>
          <button type="button" onClick={() => handleSave(false)} className="rounded-xl bg-orange-600 px-5 py-2 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-orange-600/30 hover:bg-orange-700">{isEdit ? "Update Unit" : "Save Unit"}</button>
        </div>
      </div>
    </div>
  );
};

export default AddUnitFormPage;
