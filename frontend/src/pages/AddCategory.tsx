import React, { useState, useRef, useEffect } from 'react';
import type { Category } from '../types';

interface AddCategoryPageProps {
  category?: Category;
  onBack: () => void;
  onSave: (category: Category, stayOnPage: boolean) => void;
}

const CATEGORY_TYPES = ['product', 'customer', 'vendor'];

const AddCategoryPage: React.FC<AddCategoryPageProps> = ({ category, onBack, onSave }) => {
  const isEdit = !!category;
  const [formData, setFormData] = useState({
    name: category?.name || '',
    type: category?.type || 'product' as 'product' | 'customer' | 'vendor',
    description: category?.description || ''
  });

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Category name is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAction = (stayOnPage: boolean) => {
    if (!validate()) return;
    const payload: Category = {
      ...category,
      ...formData,
      id: category?.id || `cat_${Date.now()}`
    } as Category;
    onSave(payload, stayOnPage);
    if (stayOnPage && !isEdit) {
      setFormData({ 
        name: '', 
        type: 'product', 
        description: '' 
      });
      setIsDropdownOpen(false);
    } else if (stayOnPage && isEdit) {
      setIsDropdownOpen(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-right-4 duration-300 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-orange-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
          title="Go Back"
        >
          <span className="text-xl">←</span>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Category' : 'Add New Category'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {isEdit ? `Updating ${category?.name}` : 'Create a new category for products, customers, or suppliers.'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl">
        <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                <span className="text-orange-500">📂</span> Category Information
              </h3>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input 
                  type="text" 
                  placeholder="e.g., Engine Parts, Wholesale Retailers, Engine Suppliers..."
                  className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
                {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Category Type <span className="text-rose-500">*</span></label>
                <select 
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white font-bold"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value as 'product' | 'customer' | 'vendor'})}
                >
                  {CATEGORY_TYPES.map(type => (
                    <option key={type} value={type}>{type.charAt(0).toUpperCase() + type.slice(1)}</option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-2 font-medium">
                  Select whether this category is for organizing Products, Customers, or Vendors.
                </p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                <textarea 
                  rows={4}
                  placeholder="Optional: Add details about this category..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white resize-none"
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                ></textarea>
              </div>
            </div>
          </div>
        </form>

        <div className="flex items-center justify-end gap-4 pt-8">
          <button 
            type="button" 
            onClick={onBack}
            className="px-8 py-3 font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all"
          >
            Cancel
          </button>

          <div className="relative inline-flex" ref={dropdownRef}>
            <button 
              type="button"
              onClick={() => handleAction(false)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-8 py-3 rounded-l-xl shadow-lg transition-all border-r border-orange-500"
            >
              {isEdit ? 'Update Category' : 'Save Category'}
            </button>
            <button 
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-3 rounded-r-xl shadow-lg transition-all flex items-center justify-center"
            >
              <span className={`text-[10px] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 bottom-full mb-2 w-56 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                <button 
                  type="button"
                  onClick={() => handleAction(true)}
                  className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                >
                  💾 {isEdit ? 'Save and Stay' : 'Save and Add Another'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCategoryPage;
