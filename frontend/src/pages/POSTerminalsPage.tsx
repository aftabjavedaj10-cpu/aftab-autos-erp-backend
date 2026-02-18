import React, { useEffect, useMemo, useState } from "react";
import type { POSTerminal, User } from "../types";
import Pagination from "../components/Pagination";

interface POSTerminalsPageProps {
  terminals: POSTerminal[];
  users: User[];
  onSave: (terminal: POSTerminal) => void;
  onDelete: (id: string) => void;
}

const POSTerminalsPage: React.FC<POSTerminalsPageProps> = ({
  terminals,
  users,
  onSave,
  onDelete,
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<POSTerminal>>({
    name: "",
    location: "",
    status: "Active",
    assignedUserId: users[0]?.id || "",
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    if (currentPage > 1 && (currentPage - 1) * rowsPerPage >= terminals.length) {
      setCurrentPage(1);
    }
  }, [terminals.length, currentPage, rowsPerPage]);

  const paginatedTerminals = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return terminals.slice(start, start + rowsPerPage);
  }, [terminals, currentPage, rowsPerPage]);

  const handleEdit = (terminal: POSTerminal) => {
    setFormData(terminal);
    setEditingId(terminal.id);
    setShowForm(true);
  };

  const handleAddNew = () => {
    const next = terminals.length + 1;
    setFormData({
      id: `TERM-${String(next).padStart(3, "0")}`,
      name: "",
      location: "",
      status: "Active",
      assignedUserId: users[0]?.id || "",
      lastSynced: "Never",
    });
    setEditingId(null);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name || !formData.location) return;
    onSave({
      id: formData.id,
      name: formData.name,
      location: formData.location,
      status: (formData.status as "Active" | "Inactive") || "Active",
      assignedUserId: formData.assignedUserId || "",
      lastSynced: formData.lastSynced || "Never",
    });
    setShowForm(false);
  };

  const getUserName = (id: string) =>
    users.find((u) => String(u.id) === String(id))?.name || "Unassigned";

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">
            POS Terminals
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            Manage hardware checkout nodes and assigned personnel.
          </p>
        </div>
        <button
          onClick={handleAddNew}
          className="bg-orange-600 hover:bg-orange-700 text-white font-black py-3 px-8 rounded-2xl shadow-xl shadow-orange-600/20 transition-all active:scale-95 flex items-center gap-2 text-xs uppercase tracking-widest"
        >
          <span>+</span> Add New Terminal
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                  {paginatedTerminals.map((term) => (
                    <tr
                      key={term.id}
                      className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-xl shadow-inner">
                            D
                          </div>
                          <div>
                            <div className="flex items-center gap-3">
                              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight text-xs">
                                {term.name}
                              </h3>
                              <span
                                className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                  term.status === "Active"
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-slate-100 text-slate-400"
                                }`}
                              >
                                {term.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                              LOC: {term.location} | NODE ID: {term.id} | USER: {getUserName(term.assignedUserId || "")}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleEdit(term)}
                            className="p-2 bg-white dark:bg-slate-800 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => onDelete(term.id)}
                            className="p-2 bg-white dark:bg-slate-800 border border-slate-100 rounded-lg text-slate-400 hover:text-rose-600 shadow-sm"
                          >
                            Del
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Pagination
              totalItems={terminals.length}
              currentPage={currentPage}
              rowsPerPage={rowsPerPage}
              onPageChange={setCurrentPage}
              onRowsPerPageChange={setRowsPerPage}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          {showForm ? (
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-orange-500/20 shadow-2xl sticky top-32 animate-in slide-in-from-bottom-4 duration-300">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tight">
                  {editingId ? "Modify Terminal" : "Register Terminal"}
                </h3>
                <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-rose-500">
                  X
                </button>
              </div>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Terminal Description
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none"
                    placeholder="e.g. Front Desk Station"
                    value={formData.name || ""}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Physical Location
                  </label>
                  <input
                    type="text"
                    required
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none"
                    placeholder="e.g. Showroom Floor"
                    value={formData.location || ""}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Assigned User
                  </label>
                  <select
                    value={formData.assignedUserId || ""}
                    onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border rounded-2xl py-3.5 px-5 text-sm font-bold dark:text-white outline-none"
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-slate-900 dark:bg-orange-600 text-white font-black py-4 rounded-2xl transition-all shadow-lg text-[10px] uppercase tracking-[0.2em]"
                >
                  {editingId ? "Commit Changes" : "Initialize Node"}
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-slate-900/5 dark:bg-white/5 border border-dashed border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-12 text-center sticky top-32">
              <p className="text-sm font-bold text-slate-400 italic">Select a terminal to modify.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default POSTerminalsPage;

