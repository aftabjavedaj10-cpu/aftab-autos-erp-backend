import React, { useState, useMemo, useEffect } from 'react';
import type { Product, Category, Vendor } from '../types';
import ImportModal from '../components/ImportModal';
import Pagination from '../components/Pagination';
import { hasPermission } from '../services/supabaseAuth';

interface ProductsPageProps {
  products: Product[];
  categories: Category[];
  vendors: Vendor[];
  onAddClick: () => void;
  onEditClick: (product: Product) => void;
  onDelete: (id: string) => void;
  onImportComplete: (data: Product[]) => void;
}

const STOCK_STATUSES = [
  { label: 'All Stock', value: 'all' },
  { label: 'Low Stock', value: 'low' },
  { label: 'In Stock', value: 'in_stock' },
  { label: 'Out of Stock', value: 'out_of_stock' }
];

const ACTIVITY_FILTERS = [
  { label: 'Active Only', value: 'active' },
  { label: 'Inactive Only', value: 'inactive' },
  { label: 'All Status', value: 'all' }
];

const ProductsPage: React.FC<ProductsPageProps> = ({ products, categories, vendors, onAddClick, onEditClick, onDelete, onImportComplete }) => {
  const canRead = hasPermission('products.read');
  const canWrite = hasPermission('products.write');
  const canDelete = hasPermission('products.delete');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All Categories');
  const [selectedVendor, setSelectedVendor] = useState('All Vendors');
  const [selectedStockStatus, setSelectedStockStatus] = useState('all');
  const [selectedActivity, setSelectedActivity] = useState('all');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(50);

  const productCategories = useMemo(() => {
    const list = categories.filter(c => c.type === 'product').map(c => c.name);
    return ['All Categories', 'No Category', ...list];
  }, [categories]);

  const getVendorName = (vendorId: string | number) => {
    const normalized = String(vendorId ?? "");
    return vendors.find(v => String(v.id) === normalized)?.name || 'Unknown Supplier';
  };

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const isActive = p.isActive ?? true;
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        String(p.name ?? "").toLowerCase().includes(query) ||
        String(p.id ?? "").toLowerCase().includes(query) ||
        String(p.productCode ?? "").toLowerCase().includes(query) ||
        String(p.barcode ?? "").toLowerCase().includes(query);
      
      let matchesCategory = true;
      if (selectedCategory === 'All Categories') {
        matchesCategory = true;
      } else if (selectedCategory === 'No Category') {
        matchesCategory = !p.category;
      } else {
        matchesCategory = p.category === selectedCategory;
      }
      
      const matchesVendor =
        selectedVendor === 'All Vendors' || String(p.vendorId ?? '') === selectedVendor;

      let matchesStock = true;
      const availableStock = p.stockAvailable ?? p.stock;
      if (selectedStockStatus === 'low') {
        matchesStock = availableStock <= p.reorderPoint && availableStock > 0;
      } else if (selectedStockStatus === 'out_of_stock') {
        matchesStock = availableStock <= 0;
      } else if (selectedStockStatus === 'in_stock') {
        matchesStock = availableStock > 0;
      }

      let matchesActivity = true;
      if (selectedActivity === 'active') {
        matchesActivity = isActive;
      } else if (selectedActivity === 'inactive') {
        matchesActivity = !isActive;
      }

      return matchesSearch && matchesCategory && matchesVendor && matchesStock && matchesActivity;
    });
  }, [products, searchQuery, selectedCategory, selectedVendor, selectedStockStatus, selectedActivity]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedIds(new Set()); 
  }, [searchQuery, selectedCategory, selectedVendor, selectedStockStatus, selectedActivity]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredProducts.slice(start, start + rowsPerPage);
  }, [filteredProducts, currentPage, rowsPerPage]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map(p => p.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => onDelete(id));
    setSuccessMsg(`Successfully deleted ${selectedIds.size} products.`);
    setSelectedIds(new Set());
    setIsConfirmModalOpen(false);
    setTimeout(() => setSuccessMsg(''), 5000);
  };

  return (
    <div className="erp-compact animate-in fade-in duration-500 relative">
      {!canRead && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 text-amber-700 dark:text-amber-300 rounded-2xl font-bold text-sm">
          You do not have permission to view products.
        </div>
      )}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Product List</h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Manage your car parts and inventory stock.</p>
        </div>
        <div className="flex items-center gap-3" style={{ display: canWrite ? 'flex' : 'none' }}>
          <button 
            onClick={() => setIsImportModalOpen(true)}
            className="min-w-[138px] h-[38px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-black py-2 px-4 rounded-lg transition-all hover:bg-slate-50 dark:hover:bg-slate-800 active:scale-95 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 19h16"/></svg> Import Excel
          </button>
          <button 
            onClick={onAddClick}
            className="min-w-[138px] h-[38px] bg-orange-600 hover:bg-orange-700 text-white font-black py-2 px-4 rounded-lg shadow-md shadow-orange-600/20 transition-all active:scale-95 flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-wide"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg> Add Product
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 rounded-2xl font-bold text-sm animate-in slide-in-from-top-4 duration-300 flex items-center gap-3">
          <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center "><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>
          {successMsg}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mb-6 relative">
        <div className="p-8 border-b border-slate-50 dark:border-slate-800 grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="relative col-span-1 md:col-span-1">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400"><svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg></span>
              <input 
                type="text" 
                placeholder="Search products..." 
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-4 pl-12 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white appearance-none"
            >
              {productCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <select 
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white appearance-none"
            >
              <option value="All Vendors">All Vendors</option>
              {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
            </select>
            <select 
              value={selectedStockStatus}
              onChange={(e) => setSelectedStockStatus(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white appearance-none"
            >
              {STOCK_STATUSES.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <select 
              value={selectedActivity}
              onChange={(e) => setSelectedActivity(e.target.value)}
              className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-2xl py-2.5 px-6 focus:outline-none focus:ring-4 focus:ring-orange-500/10 transition-all text-sm font-bold dark:text-white appearance-none"
            >
              {ACTIVITY_FILTERS.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse table-fixed">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-widest border-b border-slate-100 dark:border-slate-800">
                <th className="px-6 py-5 w-20 text-center">
                  <div className="flex items-center justify-center w-full" style={{ display: canWrite ? 'flex' : 'none' }}>
                    <button 
                      onClick={toggleSelectAll}
                      className={`erp-table-checkbox w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0 ? 'bg-orange-600 border-orange-600 shadow-sm shadow-orange-600/30' : 'border-slate-300 dark:border-slate-700'}`}
                    >
                      {selectedIds.size === paginatedProducts.length && paginatedProducts.length > 0 && (
                        <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                      )}
                    </button>
                  </div>
                </th>
                <th className="px-4 py-5">Product</th>
                <th className="px-8 py-5">Code</th>
                <th className="px-8 py-5">Supplier</th>
                <th className="px-8 py-5">Category</th>
                <th className="px-8 py-5">Price</th>
                <th className="px-8 py-5">Stock</th>
                <th className="px-8 py-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {paginatedProducts.map((product) => (
                <tr 
                  key={product.id} 
                  className={`transition-all duration-300 group relative ${selectedIds.has(product.id) ? 'bg-orange-500/5 dark:bg-orange-500/[0.03]' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'}`}
                >
                  <td className="px-6 py-5">
                    <div className="flex items-center justify-center">
                      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-orange-600 transition-opacity duration-300 ${selectedIds.has(product.id) ? 'opacity-100' : 'opacity-0'}`}></div>
                      <button 
                        onClick={() => toggleSelectRow(product.id)}
                        className={`erp-table-checkbox w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${selectedIds.has(product.id) ? 'bg-orange-600 border-orange-600 shadow-sm shadow-orange-600/20' : 'border-slate-200 dark:border-slate-700'}`}
                      >
                        {selectedIds.has(product.id) && (
                          <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                        )}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-5">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center text-lg shadow-inner border border-orange-100 dark:border-orange-900/30 overflow-hidden shrink-0">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <svg className="w-4 h-4 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 3h2l.6 2a7 7 0 0 1 1.7.7l1.8-1.1 1.4 1.4-1.1 1.8c.3.5.5 1.1.7 1.7l2 .6v2l-2 .6a7 7 0 0 1-.7 1.7l1.1 1.8-1.4 1.4-1.8-1.1a7 7 0 0 1-1.7.7l-.6 2h-2l-.6-2a7 7 0 0 1-1.7-.7l-1.8 1.1-1.4-1.4 1.1-1.8a7 7 0 0 1-.7-1.7l-2-.6v-2l2-.6c.2-.6.4-1.2.7-1.7L4.6 6l1.4-1.4 1.8 1.1c.5-.3 1.1-.5 1.7-.7z"/><circle cx="12" cy="12" r="2.5"/></svg>
                        )}
                      </div>
                      <div>
                        <p className="font-black text-slate-900 dark:text-white text-xs leading-tight uppercase tracking-tight">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border ${((product.isActive ?? true) ? 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-900/40' : 'bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700')}`}>
                            {(product.isActive ?? true) ? 'Active' : 'Inactive'}
                          </span>
                          <span className="text-[8px] text-slate-400 font-black tracking-widest uppercase">ID: {product.barcode}</span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className="text-[9px] font-black uppercase bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded border border-amber-100 dark:border-amber-900/30">
                      {product.productCode}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-[11px] font-bold text-slate-600 dark:text-slate-400">{getVendorName(product.vendorId)}</td>
                  <td className="px-8 py-5">
                    <span className="text-[9px] font-black uppercase tracking-tighter text-slate-400">
                      {product.category || 'No Category'}
                    </span>
                  </td>
                  <td className="px-8 py-5">
                    <p className="text-[11px] font-black text-slate-900 dark:text-white">Sale: {product.price}</p>
                    <p className="text-[8px] text-slate-400 font-bold uppercase mt-0.5">Cost: {product.costPrice}</p>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-black ${((product.stockAvailable ?? product.stock) <= product.reorderPoint) ? 'text-rose-600 animate-pulse' : 'text-emerald-600'}`}>
                          On-hand: {product.stockOnHand ?? product.stock} {product.unit}
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-400">
                        Available: {product.stockAvailable ?? product.stock} {product.unit}
                      </span>
                      <div className="w-12 bg-slate-100 dark:bg-slate-800 h-1 rounded-full mt-1.5 overflow-hidden">
                         <div
                           className={`${((product.stockAvailable ?? product.stock) <= product.reorderPoint) ? 'bg-rose-500' : 'bg-emerald-500'} h-full`}
                           style={{ width: `${Math.min(100, ((product.stockAvailable ?? product.stock) / (product.reorderPoint * 2)) * 100)}%` }}
                         ></div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <div className="flex items-center justify-end space-x-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ display: (canWrite || canDelete) ? 'flex' : 'none' }}>
                      <button onClick={() => onEditClick(product)} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-orange-600 transition-all shadow-sm text-xs" title="Edit"><svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/></svg></button>
                      <button onClick={() => { setSelectedIds(new Set([product.id])); setIsConfirmModalOpen(true); }} className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg text-slate-400 hover:text-rose-600 transition-all shadow-sm text-xs" title="Delete">
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
          totalItems={filteredProducts.length}
          currentPage={currentPage}
          rowsPerPage={rowsPerPage}
          onPageChange={setCurrentPage}
          onRowsPerPageChange={setRowsPerPage}
        />
      </div>


      {/* Simplified Floating Bulk Action Bar */}
      {canDelete && selectedIds.size > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[50] animate-in slide-in-from-bottom-12 fade-in duration-500">
          <div className="bg-slate-900/95 dark:bg-slate-800/95 text-white px-8 py-4 rounded-[2.5rem] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-xl">
             <div className="flex items-center gap-4 border-r border-white/10 pr-8">
                <div className="w-9 h-9 bg-orange-600 rounded-full flex items-center justify-center text-[12px] font-black shadow-lg">{selectedIds.size}</div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest leading-none">Items Selected</p>
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
      {canDelete && isConfirmModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setIsConfirmModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
             <div className="bg-rose-600 h-1.5 w-full"></div>
             <div className="p-10 text-center">
                <div className="w-20 h-20 bg-rose-50 dark:bg-rose-950/30 text-rose-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-6 border border-rose-100 dark:border-rose-900/40">⚠️</div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Delete Products?</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium leading-relaxed mb-8 px-4">
                  Are you sure you want to delete <span className="text-rose-600 font-black">{selectedIds.size} items</span>? This action cannot be undone.
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
        entityName="Products" 
        vendors={vendors}
        onImportComplete={(data: Product[]) => {
          onImportComplete(data);
          setSuccessMsg(`Successfully imported ${data.length} products.`);
          setTimeout(() => setSuccessMsg(''), 5000);
        }} 
      />
    </div>
  );
};

export default ProductsPage;







