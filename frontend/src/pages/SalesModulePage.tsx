import React, { useMemo, useState } from "react";
import { formatDateDMY } from "../services/dateFormat";

export interface SalesModuleDoc {
  id: string;
  customerName: string;
  date: string;
  status: string;
  totalAmount: number;
  notes?: string;
}

interface SalesModulePageProps {
  moduleTitle: string;
  moduleSubtitle: string;
  addButtonLabel: string;
  docs: SalesModuleDoc[];
  onAddClick: () => void;
  onEditClick: (doc: SalesModuleDoc) => void;
  onDelete: (id: string) => void;
}

const SalesModulePage: React.FC<SalesModulePageProps> = ({
  moduleTitle,
  moduleSubtitle,
  addButtonLabel,
  docs,
  onAddClick,
  onEditClick,
  onDelete,
}) => {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return docs;
    return docs.filter(
      (d) => d.id.toLowerCase().includes(q) || d.customerName.toLowerCase().includes(q)
    );
  }, [docs, search]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {moduleTitle}
          </h1>
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
            {moduleSubtitle}
          </p>
        </div>
        <button
          onClick={onAddClick}
          className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest"
        >
          {addButtonLabel}
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-3 border-b border-slate-100 dark:border-slate-800">
          <input
            type="text"
            placeholder="Search by # or customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/60 dark:bg-slate-800/40 text-[9px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-800">
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filtered.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/30">
                  <td className="px-4 py-3 text-[10px] font-black text-orange-600">{doc.id}</td>
                  <td className="px-4 py-3 text-[11px] font-bold text-slate-900 dark:text-white">
                    {doc.customerName}
                  </td>
                  <td className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300">
                    {formatDateDMY(doc.date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 rounded border text-[8px] font-black uppercase tracking-wider bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700">
                      {doc.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-[10px] font-black text-slate-900 dark:text-white">
                    Rs. {Number(doc.totalAmount || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onEditClick(doc)}
                        className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-orange-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => onDelete(doc.id)}
                        className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-widest rounded border border-rose-200 text-rose-600 hover:bg-rose-50"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default SalesModulePage;

