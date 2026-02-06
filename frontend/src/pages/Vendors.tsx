import React, { useState, useMemo, useEffect } from 'react';
import type { Vendor, Category } from '../types';
import ImportModal from '../components/ImportModal';
import Pagination from '../components/Pagination';

interface VendorsPageProps {
  vendors: Vendor[];
  categories: Category[];
  onAddClick: () => void;
  onEditClick: (vendor: Vendor) => void;
  onDelete: (id: string) => void;
  onImportComplete: (data: Vendor[]) => void;
}

const VendorsPage: React.FC<VendorsPageProps> = ({ vendors, categories, onAddClick, onEditClick, onDelete, onImportComplete }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Dynamic Categories for Search Filter
  const vendorCategories = useMemo(() => {
    const list = categories
      .filter(c => c.type === 'vendor')
      .map(c => c.name)
      .sort((a, b) => a.localeCompare(b));
    return ['All Categories', 'No Category', ...list];
  }, [categories]);

  const handleImport = (data: any[]) => {
    onImportComplete(data);
    setSuccessMsg(`Successfully added ${data.length} supplier records.`);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  const filteredVendors = useMemo(() => {
    return vendors.filter(v => {
      const matchesSearch = 
        v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (v.vendorCode?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
        (v.phone || '').includes(searchQuery);
      
      let matchesCategory = true;
      if (selectedCategory === 'All Categories') {
        matchesCategory = true;
      } else if (selectedCategory === 'No Category') {
        matchesCategory = !v.category;
      } else {
        matchesCategory = v.category === selectedCategory;
      }
      
      return matchesSearch && matchesCategory;
    });
  }, [vendors, searchQuery, selectedCategory]);

  // Reset selection and pagination when search changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set());
  }, [searchQuery, selectedCategory]);

  const paginatedVendors = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredVendors.slice(start, start + rowsPerPage);
  }, [filteredVendors, currentPage, rowsPerPage]);

  const paginatedIds = useMemo(() => paginatedVendors.map(v => v.id).filter(Boolean) as string[], [paginatedVendors]);

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
    setSuccessMsg(`Successfully deleted ${selectedIds.size} suppliers.`);
    setSelectedIds(new Set());
    setIsConfirmModalOpen(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div className="animate-in fade-in duration-500 relative">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Supplier Directory</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your parts suppliers and their contact info.</p>
        </div>
        <div className="flex items-center gap-3">
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
            <span>➕</span> Add Supplier
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs">✓</div>
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden relative">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 flex flex-col md:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">🔍</span>
            <input 
              type="text" 
              placeholder="Search by name, email or code..." 
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 pl-12 pr-4 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm dark:text-white font-bold"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <select 
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white min-w-[180px] appearance-none"
          >
            {vendorCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-hidden">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-5 w-20">
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={toggleSelectAll}
                      className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${selectedIds.size === paginatedIds.length && paginatedIds.length > 0 ? 'bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/30' : 'border-slate-300 dark:border-slate-700'}`}
                    >
                      {selectedIds.size === paginatedIds.length && paginatedIds.length > 0 && (
                        <span className="text-white text-[10px]">✓</span>
                      )}
                    </button>
                    {selectedIds.size > 0 && (
                      <button onClick={() => setSelectedIds(new Set())} className="text-[8px] text-orange-600 hover:underline">DESELECT</button>
                    )}
                  </div>
                </th>
                <th className="px-4 py-5">Supplier Profile</th>
                <th className="px-8 py-5">Primary Contact</th>
                <th className="px-8 py-5">Classification</th>
                <th className="px-8 py-5">Location</th>
                <th className="px-8 py-5">Payable Balance</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paginatedVendors.map((vendor) => (
                <tr 
                  key={vendor.id} 
                  className={`transition-all duration-300 group relative ${selectedIds.has(vendor.id || '') ? 'bg-orange-500/5 dark:bg-orange-500/[0.03]' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-orange-600 transition-opacity duration-300 ${selectedIds.has(vendor.id || '') ? 'opacity-100' : 'opacity-0'}`}></div>
                      <button 
                        onClick={() => toggleSelectRow(vendor.id)}
                        className={`w-5 h-5 rounded-lg border-2 transition-all flex items-center justify-center ${vendor.id && selectedIds.has(vendor.id) ? 'bg-orange-600 border-orange-600 shadow-lg shadow-orange-600/20' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        {vendor.id && selectedIds.has(vendor.id) && (
                          <span className="text-white text-[10px]">✓</span>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-lg shadow-inner border border-orange-100 dark:border-orange-900/30 overflow-hidden shrink-0">
                        {vendor.image ? (
                          <img src={vendor.image} alt={vendor.name} className="w-full h-full object-cover" />
                        ) : (
                          <span className="opacity-50 text-sm">{vendor.name.charAt(0)}</span>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-xs leading-tight uppercase tracking-tight">{vendor.name}</p>
                        <p className="text-[8px] text-slate-400 font-black tracking-widest mt-1 uppercase">Code: {vendor.vendorCode || vendor.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">{vendor.email || 'No Email'}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">{vendor.phone || 'No Phone'}</p>
                  </td>
                  <td className="px-8 py-5">
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {vendor.category || 'No Category'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate max-w-[120px]">{vendor.city || 'N/A'}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">{vendor.country || 'N/A'}</p>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-black text-rose-600 dark:text-rose-500">{vendor.balance || 'Rs. 0.00'}</td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => onEditClick(vendor)}
                        className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-orange-600 transition-all shadow-sm"
                        title="Edit"
                      >
                        <span className="text-xs">✏️</span>
                      </button>
                      <button 
                        onClick={() => { if (vendor.id) { setSelectedIds(new Set([vendor.id])); setIsConfirmModalOpen(true); } }}
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
        </div>
        
        <Pagination 
          totalItems={filteredVendors.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>

      {/* Simplified Floating Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[50] animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
             <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center text-[12px] font-black shadow-lg">{selectedIds.size}</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">Suppliers Selected</p>
                  <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Ready to delete</p>
                </div>
             </div>
             <div className="flex items-center gap-5">
                <button 
                  onClick={() => setIsConfirmModalOpen(true)}
                  className="bg-rose-600 hover:bg-rose-700 text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex items-center gap-2 group"
                >
                  <span>🗑️</span> Delete Selected
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
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 border border-rose-100 dark:border-rose-900/40">⚠️</div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Delete Suppliers?</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-4">
                  Are you sure you want to delete <span className="text-rose-600 font-black">{selectedIds.size} suppliers</span>? This action cannot be undone.
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

      <ImportModal isOpen={isImportModalOpen} onClose={() => setIsImportModalOpen(false)} entityName="Vendors" onImportComplete={handleImport} />
    </div>
  );
};

export default VendorsPage;
