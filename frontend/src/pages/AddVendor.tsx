import React, { useState, useRef, useEffect } from 'react';
import type { Vendor, Category } from '../types';

interface AddVendorPageProps {
  vendor?: Vendor;
  categories: Category[];
  onBack: () => void;
  onSave: (vendor: Vendor, stayOnPage: boolean) => void;
  onAddCategory: (category: Category) => void;
}

const AddVendorPage: React.FC<AddVendorPageProps> = ({ vendor, categories, onBack, onSave, onAddCategory }) => {
  const isEdit = !!vendor;
  const [formData, setFormData] = useState({
    name: vendor?.name || '',
    vendorCode: vendor?.vendorCode || '',
    email: vendor?.email || '',
    phone: vendor?.phone || '',
    address: vendor?.address || '',
    city: vendor?.city || '',
    state: vendor?.state || '',
    country: vendor?.country || 'Pakistan',
    category: vendor?.category || '',
    payableBalance: vendor?.payableBalance ? String(vendor.payableBalance) : 'Rs. 0.00',
    notes: vendor?.notes || '',
    image: vendor?.image || ''
  });

  const [isQuickAddingCategory, setIsQuickAddingCategory] = useState(false);
  const [quickInput, setQuickInput] = useState('');

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const vendorCategories = categories.filter(c => c.type === 'vendor');

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const generateVendorCode = () => {
    const randomCode = `VEN-${Math.floor(1000 + Math.random() * 9000)}`;
    setFormData({ ...formData, vendorCode: randomCode });
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.vendorCode.trim()) newErrors.vendorCode = 'Code is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAction = (stayOnPage: boolean) => {
    if (!validate()) return;
    const payload: Vendor = {
      ...vendor,
      ...formData,
      balance: isEdit ? vendor?.balance : formData.payableBalance
    } as Vendor;
    onSave(payload, stayOnPage);
    if (stayOnPage && !isEdit) {
      setFormData({ 
        name: '', vendorCode: '', email: '', phone: '', address: '', 
        city: '', state: '', country: 'Pakistan', category: '', 
        payableBalance: 'Rs. 0.00', notes: '', image: '' 
      });
      setIsDropdownOpen(false);
    } else if (stayOnPage && isEdit) {
      setIsDropdownOpen(false);
    }
  };

  const handleQuickAddCategory = () => {
    if (!quickInput.trim()) {
      setIsQuickAddingCategory(false);
      return;
    }
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: quickInput.trim(),
      type: 'vendor',
      itemCount: 0
    };
    onAddCategory(newCat);
    setFormData({ ...formData, category: newCat.name });
    setQuickInput('');
    setIsQuickAddingCategory(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 1024) {
        alert("Image size must be under 1MB.");
        return;
      }
      const reader = new FileReader();
      reader.onload = (event) => {
        setFormData({ ...formData, image: event.target?.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="erp-compact animate-in slide-in-from-right-4 duration-300 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-orange-600 transition-all hover:scale-105 active:scale-95 shadow-sm"
          title="Go Back"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6 9 12l6 6"/></svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Supplier' : 'Add New Supplier'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {isEdit ? `Updating info for ${vendor?.name}` : 'Fill in the details to add a new supplier.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">🏢</span> Business & Identity
                </h3>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Supplier Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="Business name or supplier company"
                    className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                  {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.name}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Vendor Code <span className="text-rose-500">*</span></label>
                    <button type="button" onClick={generateVendorCode} className="text-orange-600 hover:text-orange-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105">⚡ Auto-Gen</button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="VEN-1234"
                    className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.vendorCode ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                    value={formData.vendorCode}
                    onChange={(e) => setFormData({...formData, vendorCode: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Payable Balance</label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-4 flex items-center text-slate-400 font-bold text-sm">Rs.</span>
                    <input 
                      type="text" 
                      placeholder="0.00"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-bold"
                      value={formData.payableBalance.replace('Rs. ', '')}
                      onChange={(e) => setFormData({...formData, payableBalance: `Rs. ${e.target.value}`})}
                    />
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Supplier Category</label>
                    <button 
                      type="button" 
                      onClick={() => { setIsQuickAddingCategory(!isQuickAddingCategory); setQuickInput(''); }}
                      className="text-orange-600 hover:text-orange-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                    >
                      {isQuickAddingCategory ? '✕ Cancel' : '⊕ Quick Add'}
                    </button>
                  </div>
                  {!isQuickAddingCategory ? (
                    <select 
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                      value={formData.category}
                      onChange={(e) => setFormData({...formData, category: e.target.value})}
                    >
                      <option value="">No Category</option>
                      {vendorCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text"
                        autoFocus
                        placeholder="New category..."
                        className="flex-1 bg-white dark:bg-slate-800 border-2 border-orange-500 rounded-xl py-2 px-4 outline-none dark:text-white text-sm font-bold"
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddCategory()}
                      />
                      <button type="button" onClick={handleQuickAddCategory} className="px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition-all">Add</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Email</label>
                  <input 
                    type="email" 
                    placeholder="supplier@email.com"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Phone Number</label>
                  <input 
                    type="text" 
                    placeholder="+92 3XX XXXXXXX"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-bold"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">📍</span> Location Details
                </h3>
              </div>
              <div className="p-8 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Full Address</label>
                  <textarea 
                    rows={3}
                    placeholder="Street, Area, Plot..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white resize-none"
                    value={formData.address}
                    onChange={(e) => setFormData({...formData, address: e.target.value})}
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">City</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Lahore"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-bold"
                      value={formData.city}
                      onChange={(e) => setFormData({...formData, city: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Province</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Punjab"
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-bold"
                      value={formData.state}
                      onChange={(e) => setFormData({...formData, state: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Country</label>
                    <input 
                      type="text" 
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-bold"
                      value={formData.country}
                      onChange={(e) => setFormData({...formData, country: e.target.value})}
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Notes</label>
                  <textarea 
                    rows={2}
                    placeholder="Extra info about this supplier..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white resize-none"
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  ></textarea>
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden sticky top-32">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                <span className="text-orange-500">📸</span> Supplier Logo/Image
              </h3>
            </div>
            <div className="p-8">
              <div className="relative group aspect-square rounded-[2rem] bg-slate-50 dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 overflow-hidden flex flex-col items-center justify-center transition-all hover:border-orange-500/50">
                {formData.image ? (
                  <>
                    <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                       <button 
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="p-3 bg-white text-slate-900 rounded-xl font-bold shadow-xl hover:bg-orange-50 transition-all"
                       >
                         Replace
                       </button>
                       <button 
                        type="button"
                        onClick={() => setFormData({...formData, image: ''})}
                        className="p-3 bg-rose-600 text-white rounded-xl font-bold shadow-xl hover:bg-rose-700 transition-all"
                       >
                         Remove
                       </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 pointer-events-none">
                    <div className="w-16 h-16 bg-orange-100 dark:bg-orange-950/40 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 text-orange-600">
                      🏢
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Upload Logo</p>
                    <p className="text-[10px] text-slate-400 mt-2 font-medium">JPEG, PNG up to 1MB</p>
                  </div>
                )}
                <input 
                  type="file" 
                  ref={imageInputRef} 
                  className="hidden" 
                  accept="image/*" 
                  onChange={handleImageUpload} 
                />
                {!formData.image && (
                  <button 
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-4 pt-8 max-w-4xl">
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
            {isEdit ? 'Update Info' : 'Save Supplier'}
          </button>
          <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold px-3 py-3 rounded-r-xl shadow-lg transition-all flex items-center justify-center"
          >
            <span className={`text-[10px] transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`}><svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button 
                type="button"
                onClick={() => handleAction(true)}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/></svg> {isEdit ? 'Save and Stay' : 'Save and Add Another'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddVendorPage;

