import React, { useState, useMemo, useEffect } from 'react';
import type { Category } from '../types';
import { hasPermission } from '../services/supabaseAuth';
import ImportModal from '../components/ImportModal';

interface CategoriesPageProps {
  categories: Category[];
  onAddClick: () => void;
  onEditClick: (category: Category) => void;
  onDelete: (id: string) => void;
  onImportComplete: (data: Category[]) => void;
}

const CATEGORY_TYPES = ['All Types', 'product', 'customer', 'vendor'];

const CategoriesPage: React.FC<CategoriesPageProps> = ({ categories, onAddClick, onEditClick, onDelete, onImportComplete }) => {
  const canRead = hasPermission('categories.read');
  const canWrite = hasPermission('categories.write');
  const canDelete = hasPermission('categories.delete');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('All Types');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const handleImport = (data: any[]) => {
    onImportComplete(data);
    setSuccessMsg(`Successfully imported ${data.length} categories.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const filteredCategories = useMemo(() => {
    return categories.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = selectedType === 'All Types' || c.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [categories, searchQuery, selectedType]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, selectedType]);

  const paginatedCategories = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredCategories.slice(start, start + rowsPerPage);
  }, [filteredCategories, currentPage, rowsPerPage]);

  const paginatedIds = useMemo(() => paginatedCategories.map(c => c.id).filter(Boolean) as string[], [paginatedCategories]);

  const toggleSelectAll = () => {
    const ids = paginatedIds;
    if (selectedIds.size === ids.length && ids.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(ids));
    }
  };

  const toggleSelectRow = (id?: string) => {
    if (!id) return;
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete(id));
    setSuccessMsg(`Successfully deleted ${selectedIds.size} categories.`);
    setSelectedIds(new Set());
    setIsConfirmModalOpen(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div className="erp-compact animate-in fade-in duration-500 relative">
      {!canRead && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-2xl font-bold text-sm">
          You do not have permission to view categories.
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Categories</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Organize products, customers, and suppliers into categories.</p>
        </div>
        <div className="flex items-center gap-3" style={{ display: canWrite ? 'flex' : 'none' }}>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="min-w-[170px] h-[48px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black py-3 px-6 rounded-2xl transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
          >
            <span>📥</span> Import Excel
          </button>
          <button 
            onClick={onAddClick}
            className="min-w-[170px] h-[48px] bg-orange-600 hover:bg-orange-700 text-white font-black py-3 px-6 rounded-2xl shadow-xl shadow-orange-600/20 transition-all active:scale-95 flex items-center justify-center gap-2 text-[11px] uppercase tracking-widest"
          >
            <span>➕</span> Add Category
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          </div>
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            </span>
            <input 
              type="text" 
              placeholder="Search categories..." 
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm dark:text-white font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white min-w-[180px] appearance-none"
          >
            {CATEGORY_TYPES.map(type => (
              <option key={type} value={type}>{type === 'All Types' ? type : type.charAt(0).toUpperCase() + type.slice(1) + ' Categories'}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-hidden">
          {paginatedCategories.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-slate-500 dark:text-slate-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 6a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" /></svg>
              </div>
              <p className="text-slate-600 dark:text-slate-400 font-bold mb-2">No categories found</p>
              <p className="text-slate-500 dark:text-slate-500 text-sm">Create a new category to get started</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse table-fixed">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                  <th className="px-6 py-5 w-20">
                    <div className="flex items-center gap-3" style={{ display: canWrite ? 'flex' : 'none' }}>
                      <button 
                        onClick={toggleSelectAll}
                        className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${selectedIds.size === paginatedIds.length && paginatedIds.length > 0 ? 'bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/30' : 'border-slate-300 dark:border-slate-700'}`}
                      >
                        {selectedIds.size === paginatedIds.length && paginatedIds.length > 0 && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                      </button>
                      {selectedIds.size > 0 && (
                        <button onClick={() => setSelectedIds(new Set())} className="text-[8px] text-orange-600 hover:underline">DESELECT</button>
                      )}
                    </div>
                  </th>
                  <th className="px-4 py-5">Category Name</th>
                  <th className="px-8 py-5">Type</th>
                  <th className="px-8 py-5">Item Count</th>
                  <th className="px-8 py-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {paginatedCategories.map((category) => (
                <tr 
                  key={category.id} 
                  className={`transition-all duration-300 group relative ${selectedIds.has(category.id || '') ? 'bg-orange-500/5 dark:bg-orange-500/[0.03]' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-orange-600 transition-opacity duration-300 ${selectedIds.has(category.id || '') ? 'opacity-100' : 'opacity-0'}`}></div>
                      <button 
                        onClick={() => toggleSelectRow(category.id)}
                        className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${category.id && selectedIds.has(category.id) ? 'bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/20' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        {category.id && selectedIds.has(category.id) && (
                          <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <p className="font-black text-slate-900 dark:text-white text-xs leading-tight uppercase tracking-tight">{category.name}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-900/40">
                      {category.type.charAt(0).toUpperCase() + category.type.slice(1)}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-black text-slate-600 dark:text-slate-400">{category.itemCount || 0}</td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: (canWrite || canDelete) ? 'flex' : 'none' }}>
                      <button 
                        onClick={() => onEditClick(category)}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-orange-600 transition-all shadow-sm"
                        title="Edit"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z" /></svg>
                      </button>
                      <button 
                        onClick={() => { if (category.id) { setSelectedIds(new Set([category.id])); setIsConfirmModalOpen(true); } }}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-rose-600 transition-all shadow-sm"
                        title="Delete"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        <div className="px-8 py-4 border-t border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/30">
          <div className="text-[11px] font-bold text-slate-600 dark:text-slate-400">
            Showing {filteredCategories.length === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1} to {Math.min(currentPage * rowsPerPage, filteredCategories.length)} of {filteredCategories.length} categories
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Previous
            </button>
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 px-2">
              Page {filteredCategories.length === 0 ? 0 : currentPage} of {Math.ceil(filteredCategories.length / rowsPerPage) || 1}
            </span>
            <button 
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage * rowsPerPage >= filteredCategories.length}
              className="px-3 py-1.5 text-[10px] font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-600 dark:text-slate-400 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Simplified Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[50] animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
             <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center text-[12px] font-black shadow-lg">{selectedIds.size}</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">Categories Selected</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ready to delete</p>
                </div>
             </div>
             <div className="flex items-center gap-5">
                <button 
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex items-center gap-2 group"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18m-2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                  Delete Selected
                </button>
                <button 
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-400 hover:text-white font-black text-[10px] uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Simplified Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsConfirmModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="bg-rose-600 h-1.5 w-full"></div>
             <div className="p-10 text-center">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-rose-100 dark:border-rose-900/40">
                  <svg className="w-9 h-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3l-8.47-14.14a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" /></svg>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Delete Categories?</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-4">
                  Are you sure you want to delete <span className="text-rose-600 font-black">{selectedIds.size} categories</span>? This action cannot be undone.
                </p>
                <div className="flex gap-3">
                   <button 
                    onClick={() => setIsConfirmModalOpen(false)}
                    className="flex-1 py-3.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all"
                   >
                     Cancel
                   </button>
                   <button 
                    onClick={handleBulkDelete}
                    className="flex-1 py-3.5 bg-rose-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-600/20 hover:bg-rose-700 transition-all"
                   >
                     Delete Now
                   </button>
                </div>
             </div>
          </div>
        </div>
      )}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        entityName="Categories"
        onImportComplete={handleImport}
      />
    </div>
  );
};

export default CategoriesPage;




