import React, { useState } from "react";
import type { POSTerminal, User } from "../types";

interface POSTerminalFormPageProps {
  users: User[];
  terminal?: POSTerminal;
  onBack: () => void;
  onSave: (terminal: POSTerminal) => void;
}

const POSTerminalFormPage: React.FC<POSTerminalFormPageProps> = ({
  users,
  terminal,
  onBack,
  onSave,
}) => {
  const isEdit = !!terminal;
  const [formData, setFormData] = useState<POSTerminal>({
    id: terminal?.id || `TERM-${Math.floor(100 + Math.random() * 899)}`,
    name: terminal?.name || "",
    location: terminal?.location || "",
    status: terminal?.status || "Active",
    assignedUserId: terminal?.assignedUserId || users[0]?.id || "",
    lastSynced: terminal?.lastSynced || "Never",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.location.trim()) return;
    onSave(formData);
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500"
        >
          ←
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            {isEdit ? "Edit POS Terminal" : "New POS Terminal"}
          </h1>
          <p className="text-xs text-slate-500">Configure terminal information</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Terminal Name
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3 px-4 text-sm font-bold dark:text-white"
              placeholder="e.g. Front Desk"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
              Location
            </label>
            <input
              type="text"
              required
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3 px-4 text-sm font-bold dark:text-white"
              placeholder="e.g. Showroom Counter"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as "Active" | "Inactive" })}
                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3 px-4 text-sm font-bold dark:text-white"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Assigned User
              </label>
              <select
                value={formData.assignedUserId || ""}
                onChange={(e) => setFormData({ ...formData, assignedUserId: e.target.value })}
                className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl py-3 px-4 text-sm font-bold dark:text-white"
              >
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onBack}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-xs font-black uppercase"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-orange-600 text-white text-xs font-black uppercase"
            >
              {isEdit ? "Update Terminal" : "Save Terminal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default POSTerminalFormPage;

