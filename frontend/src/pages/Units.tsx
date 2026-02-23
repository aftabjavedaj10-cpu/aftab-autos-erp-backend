import React, { useMemo, useState } from "react";
import type { UnitMaster } from "../types";

interface UnitsPageProps {
  units: UnitMaster[];
  onAddClick: () => void;
  onEditClick: (unit: UnitMaster) => void;
  onDelete: (id: string) => void;
}

const UnitsPage: React.FC<UnitsPageProps> = ({ units, onAddClick, onEditClick, onDelete }) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return units;
    return units.filter((u) => `${u.name} ${u.description || ""}`.toLowerCase().includes(q));
  }, [units, searchQuery]);

  return (
    <div className="erp-compact animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Units</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage units used in products and packaging.</p>
        </div>
        <button
          onClick={onAddClick}
          className="min-w-[138px] h-[38px] bg-orange-600 hover:bg-orange-700 text-white font-black py-2 px-4 rounded-lg shadow-md shadow-orange-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide"
        >
          Add Unit
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800">
          <input
            type="text"
            placeholder="Search units..."
            className="w-full max-w-md bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-4 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm dark:text-white font-bold"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="overflow-x-hidden">
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-slate-600 dark:text-slate-400 font-bold mb-2">No units found</p>
              <p className="text-slate-500 dark:text-slate-500 text-sm">Create a new unit to get started</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-5">Unit Name</th>
                  <th className="px-8 py-5">Description</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {filtered.map((unit) => (
                  <tr key={unit.id} className="transition-all duration-300 group hover:bg-slate-50/50 dark:hover:bg-slate-800/50">
                    <td className="px-8 py-5 font-black text-slate-900 dark:text-white text-xs uppercase">{unit.name}</td>
                    <td className="px-8 py-5 text-[11px] font-semibold text-slate-600 dark:text-slate-400">{unit.description || "-"}</td>
                    <td className="px-8 py-5">
                      <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase ${unit.isActive !== false ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                        {unit.isActive !== false ? "Active" : "Non Active"}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEditClick(unit)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-orange-600 transition-all shadow-sm" title="Edit">Edit</button>
                        <button onClick={() => onDelete(unit.id)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-rose-600 transition-all shadow-sm" title="Delete">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default UnitsPage;
