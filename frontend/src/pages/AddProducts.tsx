import React, { useState, useRef, useEffect } from 'react';
import type { Product, Category, Vendor, ProductPackaging } from '../types';
import { WAREHOUSES } from '../constants';

interface ProductFormPageProps {
  product?: Product;
  categories: Category[];
  vendors: Vendor[];
  nextProductCode: string;
  onBack: () => void;
  onSave: (product: any, stayOnPage: boolean) => void;
  onAddCategory: (category: Category) => void;
}

const DEFAULT_UNITS = ['Piece', 'Pair', 'Set', 'Bottle', 'Litre', 'Box'];

const createDefaultPackaging = (base: {
  unit?: string;
  price?: number | string;
  costPrice?: number | string;
}): ProductPackaging => ({
  name: String(base.unit || "Piece"),
  code: "",
  displayName: "",
  displayCode: "",
  factor: 1,
  salePrice: Number(base.price || 0),
  costPrice: Number(base.costPrice || 0),
  isDefault: true,
});

const AddProducts: React.FC<ProductFormPageProps> = ({ product, categories, vendors, nextProductCode, onBack, onSave, onAddCategory }) => {
  const isEdit = !!product;
  const [formData, setFormData] = useState({
    name: product?.name || '',
    urduName: (product as any)?.urduName || '',
    productCode: product?.productCode || nextProductCode,
    brandName: product?.brandName || '',
    productType: product?.productType || 'Product' as 'Product' | 'Service',
    warehouse: product?.warehouse || WAREHOUSES[0],
    category: product?.category || '',
    price: product?.price || '',
    costPrice: product?.costPrice || '',
    barcode: product?.barcode || '',
    vendorId: product?.vendorId || vendors[0]?.id || '',
    stock: product?.stock || 0,
    unit: product?.unit || 'Piece',
    reorderPoint: product?.reorderPoint || 10,
    reorderQty: (product as any)?.reorderQty || 1,
    description: product?.description || '',
    image: product?.image || '',
    isActive: product?.isActive ?? true
  });
  const [packagingEnabled, setPackagingEnabled] = useState<boolean>(
    Boolean((product as any)?.packagingEnabled || ((product as any)?.packagings?.length ?? 0) > 0)
  );
  const [packagings, setPackagings] = useState<ProductPackaging[]>(
    Array.isArray((product as any)?.packagings) && (product as any).packagings.length > 0
      ? (product as any).packagings.map((p: any) => ({
          id: p.id,
          name: p.name || "",
          code: p.code || "",
          displayName: p.displayName ?? p.display_name ?? "",
          displayCode: p.displayCode ?? p.display_code ?? "",
          factor: Number(p.factor || 1),
          salePrice: Number((p.salePrice ?? p.sale_price ?? formData.price) || 0),
          costPrice: Number((p.costPrice ?? p.cost_price ?? formData.costPrice) || 0),
          isDefault: Boolean(p.isDefault ?? p.is_default),
        }))
      : [createDefaultPackaging({ unit: formData.unit, price: formData.price, costPrice: formData.costPrice })]
  );

  const [units, setUnits] = useState(DEFAULT_UNITS);
  const [isQuickAddingCategory, setIsQuickAddingCategory] = useState(false);
  const [isQuickAddingUnit, setIsQuickAddingUnit] = useState(false);
  const [quickInput, setQuickInput] = useState('');
  const [isProductCodeTouched, setIsProductCodeTouched] = useState(false);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const productCategories = categories.filter(c => c.type === 'product');

  useEffect(() => {
    if (!formData.category && productCategories.length > 0 && !isEdit) {
       // Only auto-select first if not editing and nothing selected
    }
  }, [productCategories]);

  useEffect(() => {
    if (isEdit || isProductCodeTouched) return;
    setFormData((prev) => ({ ...prev, productCode: nextProductCode }));
  }, [isEdit, isProductCodeTouched, nextProductCode]);

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
    if (!formData.name.trim()) newErrors.name = 'Please enter a product name';
    if (!formData.productCode.trim()) newErrors.productCode = 'Part number/code is required';
    if (!formData.price.toString().trim()) newErrors.price = 'Enter a sale price';
    if (!formData.costPrice.toString().trim()) newErrors.costPrice = 'Enter a purchase price';
    if (!formData.vendorId) newErrors.vendorId = 'Select a supplier';
    if (packagingEnabled) {
      const hasDefault = packagings.some((p) => p.isDefault);
      if (!hasDefault) newErrors.packagingDefault = 'Select one default packaging';
      if (packagings.length === 0) newErrors.packagings = 'Add at least one packaging row';
      const invalidRow = packagings.find((p) => !String(p.name || "").trim() || Number(p.factor) <= 0);
      if (invalidRow) newErrors.packagings = 'Packaging name and factor (> 0) are required';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAction = (stayOnPage: boolean) => {
    if (!validate()) return;
    const sanitizedPackagings = packagingEnabled
      ? packagings.map((p, idx) => ({
          ...p,
          name: String(p.name || "").trim(),
          factor: Number(p.factor || 1),
          displayName: String(p.displayName || "").trim(),
          displayCode: String(p.displayCode || "").trim(),
          salePrice: Number(p.salePrice || 0),
          costPrice: Number(p.costPrice || 0),
          isDefault: packagings.some((x) => x.isDefault) ? Boolean(p.isDefault) : idx === 0,
        }))
      : [];
    onSave({ ...product, ...formData, packagingEnabled, packagings: sanitizedPackagings }, stayOnPage);
    if (stayOnPage && !isEdit) {
      setFormData({ 
        name: '', urduName: '', productCode: nextProductCode, brandName: '', productType: 'Product', warehouse: WAREHOUSES[0],
        category: '', price: '', costPrice: '', barcode: '', 
        vendorId: vendors[0]?.id || '', stock: 0, unit: 'Piece', 
        reorderPoint: 10, reorderQty: 1, description: '', image: '', isActive: true
      });
      setPackagingEnabled(false);
      setPackagings([createDefaultPackaging({ unit: "Piece", price: 0, costPrice: 0 })]);
      setIsProductCodeTouched(false);
      setIsDropdownOpen(false);
    } else if (stayOnPage && isEdit) {
      setIsDropdownOpen(false);
    }
  };

  const setDefaultPackaging = (index: number) => {
    setPackagings((prev) => prev.map((row, i) => ({ ...row, isDefault: i === index })));
  };

  const updatePackaging = (index: number, key: keyof ProductPackaging, value: any) => {
    setPackagings((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const addPackagingRow = () => {
    setPackagings((prev) => [
      ...prev,
      createDefaultPackaging({ unit: formData.unit, price: formData.price, costPrice: formData.costPrice }),
    ]);
  };

  const removePackagingRow = (index: number) => {
    setPackagings((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        return [createDefaultPackaging({ unit: formData.unit, price: formData.price, costPrice: formData.costPrice })];
      }
      if (!next.some((row) => row.isDefault)) {
        next[0] = { ...next[0], isDefault: true };
      }
      return next;
    });
  };

  const handleQuickAddCategory = () => {
    if (!quickInput.trim()) {
      setIsQuickAddingCategory(false);
      return;
    }
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: quickInput.trim(),
      type: 'product',
      itemCount: 0
    };
    onAddCategory(newCat);
    setFormData({ ...formData, category: newCat.name });
    setQuickInput('');
    setIsQuickAddingCategory(false);
  };

  const handleQuickAddUnit = () => {
    if (!quickInput.trim()) {
      setIsQuickAddingUnit(false);
      return;
    }
    const newUnit = quickInput.trim();
    if (!units.includes(newUnit)) {
      setUnits([...units, newUnit]);
    }
    setFormData({ ...formData, unit: newUnit });
    setQuickInput('');
    setIsQuickAddingUnit(false);
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

  const generateBarcode = () => {
    const randomBarcode = Math.floor(1000000000000 + Math.random() * 9000000000000).toString();
    setFormData({ ...formData, barcode: randomBarcode });
  };

  return (
    <div className="erp-compact animate-in slide-in-from-right-4 duration-300 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <button 
          onClick={onBack}
          className="p-2.5 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl text-slate-400 hover:text-orange-600 transition-all hover:scale-105 active:scale-95"
          title="Go Back"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6 9 12l6 6"/></svg>
        </button>
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            {isEdit ? 'Edit Product Info' : 'Add New Product'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {isEdit ? `Updating details for ${product?.name}` : 'Fill in the information below to add a new part.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <form onSubmit={(e) => e.preventDefault()} className="space-y-8">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">●</span> Product Status
                </h3>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Product Status</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {formData.isActive ? 'Visible in lists and usable in invoices.' : 'Hidden from lists (can be reactivated anytime).'}
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={formData.isActive}
                      onChange={() => setFormData({ ...formData, isActive: !formData.isActive })}
                    />
                    <div className={`w-12 h-6 rounded-full transition-all ${formData.isActive ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                      <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-y-0.5 ${formData.isActive ? 'translate-x-6' : 'translate-x-1'}`}></div>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex justify-between items-center">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">📄</span> Basic Information
                </h3>
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                   <button 
                    type="button" 
                    onClick={() => setFormData({...formData, productType: 'Product'})}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.productType === 'Product' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     Product
                   </button>
                   <button 
                    type="button" 
                    onClick={() => setFormData({...formData, productType: 'Service'})}
                    className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${formData.productType === 'Service' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                     Service
                   </button>
                </div>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Product Name <span className="text-rose-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Front Brake Pads"
                    className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.name ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                  />
                  {errors.name && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.name}</p>}
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Urdu Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="اردو نام"
                    dir="rtl"
                    lang="ur"
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-right focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white font-urdu"
                    value={formData.urduName}
                    onChange={(e) => setFormData({...formData, urduName: e.target.value})}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    Brand Name
                  </label>
                  <input 
                    type="text" 
                    placeholder="e.g. Toyota, Philips..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white"
                    value={formData.brandName}
                    onChange={(e) => setFormData({...formData, brandName: e.target.value})}
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Part Number / Code <span className="text-rose-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({ ...prev, productCode: nextProductCode }));
                        setIsProductCodeTouched(false);
                      }}
                      className="text-orange-600 hover:text-orange-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                    >
                      ⚡ Auto-Next
                    </button>
                  </div>
                  <input 
                    type="text" 
                    placeholder="e.g. P-000001"
                    className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.productCode ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                    value={formData.productCode}
                    onChange={(e) => {
                      setFormData({...formData, productCode: e.target.value});
                      setIsProductCodeTouched(true);
                    }}
                  />
                  {errors.productCode && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.productCode}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Barcode / EAN</label>
                    <button 
                      type="button" 
                      onClick={generateBarcode}
                      className="text-orange-600 hover:text-orange-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                    >
                      ⚡ Auto Generate
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      placeholder="Scan or enter barcode..."
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 pl-10 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white"
                      value={formData.barcode}
                      onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                    />
                    <span className="absolute inset-y-0 left-3.5 flex items-center text-slate-400 font-black tracking-tighter">|||</span>
                  </div>
                </div>

                <div className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Category</label>
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
                      {productCategories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                      <input 
                        type="text"
                        autoFocus
                        placeholder="New category..."
                        className="flex-1 bg-white dark:bg-slate-800 border-2 border-orange-500 rounded-xl py-2.5 px-4 outline-none dark:text-white text-sm font-bold"
                        value={quickInput}
                        onChange={(e) => setQuickInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleQuickAddCategory()}
                      />
                      <button type="button" onClick={handleQuickAddCategory} className="px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition-all">Add</button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Supplier (Vendor) <span className="text-rose-500">*</span></label>
                  <select 
                    className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.vendorId ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                    value={formData.vendorId}
                    onChange={(e) => setFormData({...formData, vendorId: e.target.value})}
                  >
                    <option value="" disabled>Select a supplier</option>
                    {vendors.map(v => (
                      <option key={v.id} value={v.id}>{v.name}</option>
                    ))}
                  </select>
                  {errors.vendorId && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.vendorId}</p>}
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">💰</span> Pricing & Inventory
                </h3>
              </div>
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Purchase Cost <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="$0.00"
                      className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.costPrice ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                      value={formData.costPrice}
                      onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                    />
                    {errors.costPrice && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.costPrice}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Sale Price <span className="text-rose-500">*</span>
                    </label>
                    <input 
                      type="text" 
                      placeholder="$0.00"
                      className={`w-full bg-white dark:bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all dark:text-white ${errors.price ? 'border-rose-500' : 'border-slate-200 dark:border-slate-700'}`}
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                    />
                    {errors.price && <p className="text-xs text-rose-500 mt-1 font-medium">{errors.price}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300">Unit Type</label>
                      <button 
                        type="button" 
                        onClick={() => { setIsQuickAddingUnit(!isQuickAddingUnit); setQuickInput(''); }}
                        className="text-orange-600 hover:text-orange-700 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 transition-all hover:scale-105"
                      >
                        {isQuickAddingUnit ? '✕ Cancel' : '⊕ Quick'}
                      </button>
                    </div>
                    {!isQuickAddingUnit ? (
                      <select 
                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                        value={formData.unit}
                        onChange={(e) => setFormData({...formData, unit: e.target.value})}
                      >
                        {units.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="flex gap-2 animate-in slide-in-from-top-1 duration-200">
                        <input 
                          type="text"
                          autoFocus
                          placeholder="Unit..."
                          className="flex-1 bg-white dark:bg-slate-800 border-2 border-orange-500 rounded-xl py-2.5 px-4 outline-none dark:text-white text-sm font-bold"
                          value={quickInput}
                          onChange={(e) => setQuickInput(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleQuickAddUnit()}
                        />
                        <button type="button" onClick={handleQuickAddUnit} className="px-4 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold text-xs shadow-md transition-all">Add</button>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Warehouse Location</label>
                    <select 
                      className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                      value={formData.warehouse}
                      onChange={(e) => setFormData({...formData, warehouse: e.target.value})}
                    >
                      {WAREHOUSES.map(wh => (
                        <option key={wh} value={wh}>{wh}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                      Initial Stock {isEdit ? "(Create Only)" : ""}
                    </label>
                    <input 
                      type="number" 
                      disabled={formData.productType === 'Service' || isEdit}
                      className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white ${(formData.productType === 'Service' || isEdit) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={formData.productType === 'Service' ? 0 : formData.stock}
                      onChange={(e) => setFormData({...formData, stock: parseInt(e.target.value) || 0})}
                    />
                    {isEdit && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                        Initial stock is applied only when creating a new product.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Alert Level</label>
                    <input 
                      type="number" 
                      disabled={formData.productType === 'Service'}
                      className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white ${formData.productType === 'Service' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={formData.productType === 'Service' ? 0 : formData.reorderPoint}
                      onChange={(e) => setFormData({...formData, reorderPoint: parseInt(e.target.value) || 0})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Reorder Qty</label>
                    <input 
                      type="number"
                      min={1}
                      disabled={formData.productType === 'Service'}
                      className={`w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white ${formData.productType === 'Service' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      value={formData.productType === 'Service' ? 0 : formData.reorderQty}
                      onChange={(e) => setFormData({...formData, reorderQty: Math.max(1, parseInt(e.target.value) || 1)})}
                    />
                  </div>
                </div>

              </div>
            </div>

            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden mt-6">
              <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
                <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                  <span className="text-orange-500">PK</span> Multi Packaging
                </h3>
              </div>
              <div className="p-6">
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Enable Multiple Packaging</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">If off, system keeps one default packaging with factor 1.</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={packagingEnabled}
                        onChange={() => {
                          const next = !packagingEnabled;
                          setPackagingEnabled(next);
                          if (next && packagings.length === 0) {
                            setPackagings([createDefaultPackaging({ unit: formData.unit, price: formData.price, costPrice: formData.costPrice })]);
                          }
                        }}
                      />
                      <div className={`w-12 h-6 rounded-full transition-all ${packagingEnabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                        <div className={`w-5 h-5 bg-white rounded-full shadow-sm transition-transform translate-y-0.5 ${packagingEnabled ? 'translate-x-6' : 'translate-x-1'}`}></div>
                      </div>
                    </label>
                  </div>

                  {packagingEnabled && (
                    <div className="mt-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">Packaging Rows</p>
                        <button
                          type="button"
                          onClick={addPackagingRow}
                          className="px-3 py-1.5 text-[10px] font-black uppercase rounded-lg bg-orange-600 text-white hover:bg-orange-700 transition-all"
                        >
                          Add Packaging
                        </button>
                      </div>

                      <div className="grid grid-cols-14 gap-2 px-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <div className="col-span-2">Pack Name</div>
                        <div className="col-span-2">Pack Code</div>
                        <div className="col-span-3">Display Name</div>
                        <div className="col-span-2">Display Code</div>
                        <div className="col-span-1">Factor</div>
                        <div className="col-span-1">Sale</div>
                        <div className="col-span-1">Cost</div>
                        <div className="col-span-2">Default / Action</div>
                      </div>

                      {packagings.map((row, idx) => (
                        <div key={`${row.id || "pack"}-${idx}`} className="grid grid-cols-14 gap-2 items-center">
                          <input
                            type="text"
                            placeholder="Name"
                            className="col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.name || ""}
                            onChange={(e) => updatePackaging(idx, "name", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Code"
                            className="col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.code || ""}
                            onChange={(e) => updatePackaging(idx, "code", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Search label"
                            className="col-span-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.displayName || ""}
                            onChange={(e) => updatePackaging(idx, "displayName", e.target.value)}
                          />
                          <input
                            type="text"
                            placeholder="Search code"
                            className="col-span-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.displayCode || ""}
                            onChange={(e) => updatePackaging(idx, "displayCode", e.target.value)}
                          />
                          <input
                            type="number"
                            step="0.001"
                            min="0.001"
                            placeholder="Factor"
                            className="col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.factor ?? 1}
                            onChange={(e) => updatePackaging(idx, "factor", Number(e.target.value || 1))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Sale"
                            className="col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.salePrice ?? 0}
                            onChange={(e) => updatePackaging(idx, "salePrice", Number(e.target.value || 0))}
                          />
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="Cost"
                            className="col-span-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 dark:text-white"
                            value={row.costPrice ?? 0}
                            onChange={(e) => updatePackaging(idx, "costPrice", Number(e.target.value || 0))}
                          />
                          <div className="col-span-2 flex items-center gap-2">
                            <label className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                              <input
                                type="radio"
                                name="defaultPackaging"
                                checked={Boolean(row.isDefault)}
                                onChange={() => setDefaultPackaging(idx)}
                              />
                              Default
                            </label>
                            <button
                              type="button"
                              onClick={() => removePackagingRow(idx)}
                              className="px-2 py-1 text-[10px] font-black uppercase rounded-md bg-rose-100 text-rose-700 hover:bg-rose-200"
                            >
                              Del
                            </button>
                          </div>
                        </div>
                      ))}
                      {(errors.packagings || errors.packagingDefault) && (
                        <p className="text-xs text-rose-500 font-medium">{errors.packagings || errors.packagingDefault}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden sticky top-32">
            <div className="p-6 border-b border-slate-50 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase text-xs tracking-widest">
                <span className="text-orange-500">📸</span> Product Picture
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
                      📷
                    </div>
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-widest">Upload Photo</p>
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

        <div className="relative inline-flex items-stretch" ref={dropdownRef}>
          <button 
            type="button"
            onClick={() => handleAction(false)}
            className="h-10 bg-orange-600 hover:bg-orange-700 text-white font-bold px-6 rounded-l-lg transition-all border-r border-orange-500"
          >
            {isEdit ? 'Update Product' : 'Save Product'}
          </button>
          <button 
            type="button"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="h-10 w-10 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-r-lg transition-all flex items-center justify-center"
          >
            <svg className={`w-3 h-3 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
          </button>

          {isDropdownOpen && (
            <div className="absolute right-0 bottom-full mb-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button 
                type="button"
                onClick={() => handleAction(true)}
                className="w-full text-left px-4 py-3 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-700/50 hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
              >
                <svg className="w-3.5 h-3.5 inline-block mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h13l3 3v13H4z"/><path d="M8 4v6h8V4"/><path d="M8 20v-6h8v6"/></svg> {isEdit ? 'Update and Stay' : 'Save and Add Another'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddProducts;

