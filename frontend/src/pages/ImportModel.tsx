
import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { WAREHOUSES } from '../constants';
import type { Vendor } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  entityName: 'Products' | 'Customers' | 'Vendors';
  vendors?: Vendor[];
  onImportComplete: (data: any[]) => void;
}

const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, entityName, vendors = [], onImportComplete }) => {
  const [step, setStep] = useState<'upload' | 'mapping' | 'progress'>('upload');
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvRows, setCsvRows] = useState<string[][]>([]);
  const [mappings, setMappings] = useState<Record<string, number>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Field definitions for each entity
  const entityFields = {
    Products: [
      { key: 'name', label: 'Product Name', required: true },
      { key: 'urduName', label: 'Urdu Name', required: false },
      { key: 'productCode', label: 'Part Number / Code', required: true },
      { key: 'brandName', label: 'Brand Name', required: false },
      { key: 'productType', label: 'Type (Product/Service)', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'vendorId', label: 'Supplier (Name or ID)', required: false },
      { key: 'costPrice', label: 'Purchase Cost', required: true },
      { key: 'price', label: 'Sale Price', required: true },
      { key: 'barcode', label: 'Barcode / EAN', required: false },
      { key: 'unit', label: 'Unit Type (pcs, set)', required: false },
      { key: 'warehouse', label: 'Warehouse Location', required: false },
      { key: 'stock', label: 'Initial Stock', required: false },
      { key: 'reorderPoint', label: 'Alert Level', required: false },
    ],
    Customers: [
      { key: 'customerCode', label: 'Customer Code', required: true },
      { key: 'name', label: 'Full Name', required: true },
      { key: 'openingBalance', label: 'Opening Balance', required: false },
      { key: 'category', label: 'Client Category', required: false },
      { key: 'email', label: 'Email Address', required: false },
      { key: 'phone', label: 'Phone Number', required: false },
      { key: 'address', label: 'Street Address', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'country', label: 'Country', required: false },
    ],
    Vendors: [
      { key: 'vendorCode', label: 'Vendor Code', required: true },
      { key: 'name', label: 'Company Name', required: true },
      { key: 'openingBalance', label: 'Opening Balance', required: false },
      { key: 'category', label: 'Supply Category', required: false },
      { key: 'email', label: 'Contact Email', required: false },
      { key: 'phone', label: 'Phone Number', required: false },
      { key: 'address', label: 'Street Address', required: false },
      { key: 'city', label: 'City', required: false },
      { key: 'state', label: 'State', required: false },
      { key: 'country', label: 'Country', required: false },
    ]
  };

  const currentFields = entityFields[entityName] || [];

  const processData = (headers: string[], rows: string[][]) => {
    setCsvHeaders(headers);
    setCsvRows(rows);

    // Attempt auto-mapping
    const initialMappings: Record<string, number> = {};
    currentFields.forEach(field => {
      const matchIdx = headers.findIndex(h => 
        h.toLowerCase() === field.key.toLowerCase() || 
        h.toLowerCase() === field.label.toLowerCase() ||
        h.toLowerCase().includes(field.key.toLowerCase()) ||
        h.toLowerCase().replace(/\s/g, '').includes(field.label.toLowerCase().replace(/\s/g, ''))
      );
      if (matchIdx !== -1) initialMappings[field.key] = matchIdx;
    });
    setMappings(initialMappings);
    setStep('mapping');
  };

  const handleFileUpload = (file: File) => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    const isCsv = file.name.endsWith('.csv');

    if (!isExcel && !isCsv) {
      alert('Please upload a valid CSV or Excel (.xlsx, .xls) file.');
      return;
    }

    const reader = new FileReader();

    if (isCsv) {
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
        if (lines.length === 0) return alert('The CSV file is empty.');

        const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
        const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim().replace(/"/g, '')));
        processData(headers, rows);
      };
      reader.readAsText(file);
    } else {
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        const jsonData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        if (jsonData.length === 0) return alert('The Excel file is empty.');

        const headers = (jsonData[0] || []).map(h => String(h).trim());
        const rows = jsonData.slice(1).map(row => row.map(cell => String(cell ?? '').trim()));
        processData(headers, rows);
      };
      reader.readAsArrayBuffer(file);
    }
  };

  const handleDownloadTemplate = () => {
    const headers = currentFields.map(f => f.label).join(',');
    const blob = new Blob([headers], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${entityName.toLowerCase()}_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const finalizeImport = () => {
    const missing = currentFields.filter(f => f.required && mappings[f.key] === undefined);
    if (missing.length > 0) {
      alert(`Please map the required fields: ${missing.map(m => m.label).join(', ')}`);
      return;
    }

    setStep('progress');
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) {
        clearInterval(interval);
        
        const importedData = csvRows.map((row, idx) => {
          const obj: any = {};
          
          if (entityName === 'Products') {
            obj.id = `P-IMP-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
            obj.productType = 'Product';
            obj.warehouse = WAREHOUSES[0];
            obj.brandName = 'Generic';
            obj.vendorId = 'V-PENDING'; // Default fallback
          } else if (entityName === 'Vendors') {
            obj.id = `V-IMP-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
            obj.country = 'Pakistan';
            obj.openingBalance = 'Rs. 0.00';
          } else if (entityName === 'Customers') {
            obj.id = `C-IMP-${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
            obj.country = 'Pakistan';
            obj.openingBalance = 'Rs. 0.00';
          }

          currentFields.forEach(field => {
            const colIdx = mappings[field.key];
            if (colIdx !== undefined) {
              let val = row[colIdx];
              
              if (field.key === 'stock' || field.key === 'reorderPoint') {
                obj[field.key] = parseInt(val) || 0;
              } else if (field.key === 'price' || field.key === 'costPrice' || field.key === 'openingBalance') {
                if (typeof val === 'string' && val.trim() !== '') {
                  obj[field.key] = val.startsWith('Rs.') ? val : `Rs. ${val}`;
                } else if (val) {
                  obj[field.key] = `Rs. ${val}`;
                }
              } else if (field.key === 'productType') {
                const normalized = val.toLowerCase();
                obj[field.key] = normalized.includes('service') ? 'Service' : 'Product';
              } else if (field.key === 'vendorId' && entityName === 'Products' && val) {
                // AUTOMATIC VENDOR DETECTION
                const cleanVal = val.trim().toLowerCase();
                // 1. Try to find vendor by exact ID or Code
                let matchedVendor = vendors.find(v => 
                  v.id.toLowerCase() === cleanVal || 
                  (v.vendorCode && v.vendorCode.toLowerCase() === cleanVal)
                );
                
                // 2. Try to find by Company Name if not found by ID
                if (!matchedVendor) {
                  matchedVendor = vendors.find(v => v.name.toLowerCase() === cleanVal);
                }

                // 3. Try partial name match if still not found
                if (!matchedVendor) {
                  matchedVendor = vendors.find(v => v.name.toLowerCase().includes(cleanVal));
                }

                if (matchedVendor) {
                  obj.vendorId = matchedVendor.id;
                } else {
                  // If we can't find it, keep the original string to maybe show a warning later
                  // but for functional ERP we use the fallback
                  obj.vendorId = 'V-PENDING';
                }
              } else {
                obj[field.key] = val;
              }
            }
          });

          if ((entityName === 'Vendors' || entityName === 'Customers') && (!obj.balance || obj.balance === 'Rs. 0.00')) {
            obj.balance = obj.openingBalance;
          }

          return obj;
        });

        onImportComplete(importedData);
        setTimeout(() => {
          onClose();
          resetState();
        }, 800);
      }
    }, 50);
  };

  const resetState = () => {
    setStep('upload');
    setProgress(0);
    setCsvHeaders([]);
    setCsvRows([]);
    setMappings({});
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={onClose}></div>
      
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">
        <div className="p-6 border-b border-slate-50 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Import {entityName}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Multi-Format Ingestion Engine (CSV/XLSX)</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-all text-slate-400 hover:text-rose-500">✕</button>
        </div>

        <div className="p-8">
          {step === 'upload' && (
            <div className="space-y-6">
              <div 
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => { 
                  e.preventDefault(); 
                  setIsDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
                onClick={() => fileInputRef.current?.click()}
                className={`border-4 border-dashed rounded-[2rem] p-16 text-center transition-all cursor-pointer group ${
                  isDragging 
                    ? 'border-orange-500 bg-orange-50/50 dark:bg-orange-950/20 scale-[0.98]' 
                    : 'border-slate-100 dark:border-slate-800 hover:border-orange-400 dark:hover:border-orange-800 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".csv, .xlsx, .xls" 
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])} 
                />
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-3xl flex items-center justify-center mx-auto mb-6 text-4xl group-hover:scale-110 transition-transform">
                  📂
                </div>
                <h4 className="text-lg font-black text-slate-900 dark:text-white mb-2">Drop CSV or Excel to Begin</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Supporting multiple business formats for seamless entry.</p>
                <button className="mt-8 px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 group-hover:text-orange-600 transition-colors">Select File</button>
              </div>
              <div className="flex items-center justify-between p-5 bg-orange-50 dark:bg-orange-950/20 rounded-2xl border border-orange-100 dark:border-orange-900/30">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">📋</span>
                  <div>
                    <p className="text-xs font-black text-orange-800 dark:text-orange-400 uppercase tracking-widest">Standard Format</p>
                    <p className="text-[10px] text-orange-600/70 dark:text-orange-500 font-medium">Use our template for verified cross-system compatibility.</p>
                  </div>
                </div>
                <button 
                  onClick={handleDownloadTemplate}
                  className="text-[10px] font-black uppercase tracking-widest bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-all active:scale-95 shadow-lg shadow-orange-600/20"
                >
                  Template
                </button>
              </div>
            </div>
          )}

          {step === 'mapping' && (
            <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider">Configure Attributes</h4>
                  <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5">Map ERP fields to your uploaded columns</p>
                </div>
                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-widest">{csvRows.length} Records Found</span>
              </div>
              
              <div className="space-y-2 max-h-[320px] overflow-y-auto pr-2 custom-scrollbar py-1">
                {currentFields.map((field) => (
                  <div key={field.key} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-slate-700 hover:border-orange-200 dark:hover:border-orange-900 transition-all group">
                    <div className="flex flex-col">
                      <span className="text-[8px] font-black text-slate-400 uppercase tracking-tight mb-0.5">ERP Property</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-black text-slate-900 dark:text-white">{field.label}</span>
                        {field.required && <span className="w-1 h-1 rounded-full bg-rose-500" title="Required Field"></span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-slate-300 dark:text-slate-600 text-base group-hover:text-orange-400">→</span>
                      <select 
                        value={mappings[field.key] ?? ''}
                        onChange={(e) => setMappings({...mappings, [field.key]: parseInt(e.target.value)})}
                        className={`bg-white dark:bg-slate-900 border rounded-lg py-1.5 px-3 text-[10px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 min-w-[160px] transition-all ${
                          mappings[field.key] !== undefined ? 'border-emerald-500/50 text-emerald-600' : 'border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <option value="">Select Column...</option>
                        {csvHeaders.map((header, idx) => (
                          <option key={idx} value={idx}>{header}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-3 pt-4">
                <button onClick={() => setStep('upload')} className="flex-1 py-3 font-black text-[9px] uppercase tracking-widest text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all">Back to Upload</button>
                <button 
                  onClick={finalizeImport} 
                  className="flex-[2] py-3.5 bg-slate-900 dark:bg-orange-600 hover:bg-orange-700 text-white font-black rounded-xl shadow-xl shadow-orange-600/10 transition-all active:scale-95 text-[10px] uppercase tracking-[0.2em]"
                >
                  Finalize Injection
                </button>
              </div>
            </div>
          )}

          {step === 'progress' && (
            <div className="text-center py-12 animate-in zoom-in-95 duration-300">
              <div className="mb-10">
                <div className="w-24 h-24 bg-orange-50 dark:bg-orange-950/40 rounded-[2rem] flex items-center justify-center mx-auto mb-6 relative">
                   <div className="absolute inset-0 border-2 border-orange-500/20 rounded-[2rem] animate-ping"></div>
                   <span className="text-5xl animate-bounce">📦</span>
                </div>
                <h4 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Processing Records</h4>
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium mt-2">Integrating data into the enterprise directory.</p>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-4 mb-3 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-orange-500 to-orange-600 h-full transition-all duration-300 ease-out shadow-[0_0_20px_rgba(234,88,12,0.4)]" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">{progress}% READY</span>
                <span className="text-[10px] font-black text-emerald-50 uppercase tracking-[0.3em]">VALIDATED</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportModal;
