import React, { useState, useMemo, useRef, useEffect } from "react";
import type { SalesInvoice, SalesInvoiceItem, Product, Customer } from "../types";

interface SalesInvoiceFormPageProps {
  invoice?: SalesInvoice;
  products: Product[];
  customers: Customer[];
  onBack: () => void;
  onSave: (invoice: SalesInvoice, stayOnPage: boolean) => void;
}

type PrintMode = "invoice" | "receipt" | "a5" | "item_slip";

const SalesInvoiceFormPage: React.FC<SalesInvoiceFormPageProps> = ({
  invoice,
  products,
  customers,
  onBack,
  onSave,
}) => {
  const isEdit = !!invoice;
  const [savePrices, setSavePrices] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode>("invoice");
  const [printingItems, setPrintingItems] = useState<SalesInvoiceItem[]>([]);
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    id: invoice?.id || `INV-${Math.floor(100000 + Math.random() * 900000)}`,
    customerId: invoice?.customerId || "",
    reference: invoice?.reference || "",
    vehicleNumber: invoice?.vehicleNumber || "",
    date: invoice?.date || new Date().toISOString().split("T")[0],
    dueDate:
      invoice?.dueDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: invoice?.status || "Unpaid",
    notes: invoice?.notes || "",
    overallDiscount: invoice?.overallDiscount || 0,
    amountReceived: invoice?.amountReceived || 0,
    items: (invoice?.items || []) as SalesInvoiceItem[],
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [customerSearchTerm, setCustomerSearchTerm] = useState("");
  const [isCustomerSearching, setIsCustomerSearching] = useState(false);
  const [isSaveDropdownOpen, setIsSaveDropdownOpen] = useState(false);
  const [isPrintDropdownOpen, setIsPrintDropdownOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customerSelectedIndex, setCustomerSelectedIndex] = useState(0);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overallDiscRef = useRef<HTMLInputElement>(null);
  const amountReceivedRef = useRef<HTMLInputElement>(null);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const productListContainerRef = useRef<HTMLDivElement>(null);
  const productItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);
  const saveDropdownRef = useRef<HTMLDivElement>(null);
  const printDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearching(false);
      }
      if (customerSearchContainerRef.current && !customerSearchContainerRef.current.contains(target)) {
        setIsCustomerSearching(false);
      }
      if (saveDropdownRef.current && !saveDropdownRef.current.contains(target)) {
        setIsSaveDropdownOpen(false);
      }
      if (printDropdownRef.current && !printDropdownRef.current.contains(target)) {
        setIsPrintDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const searchableProducts = useMemo(() => {
    return products.map((p) => ({
      product: p,
      searchStr: `${p.name} ${p.productCode || ""} ${p.brandName || ""} ${p.category || ""} ${p.barcode || ""} ${p.id}`.toLowerCase(),
    }));
  }, [products]);

  const availableProducts = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return [];

    const keywords = query.split(/\s+/);

    const results = searchableProducts
      .filter((item) => keywords.every((kw) => item.searchStr.includes(kw)))
      .map((item) => item.product);

    return results
      .sort((a, b) => {
        const aName = a.name.toLowerCase();
        const bName = b.name.toLowerCase();
        const aStarts = aName.startsWith(query);
        const bStarts = bName.startsWith(query);

        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return aName.localeCompare(bName);
      })
      .slice(0, 20);
  }, [searchTerm, searchableProducts]);

  const availableCustomers = useMemo(() => {
    const query = customerSearchTerm.toLowerCase().trim();
    if (!query) return customers;
    const keywords = query.split(/\s+/);
    return customers.filter((c) => {
      const searchableText = `${c.name} ${c.customerCode || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
      return keywords.every((kw) => searchableText.includes(kw));
    });
  }, [customerSearchTerm, customers]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [availableProducts]);

  useEffect(() => {
    if (isSearching && productItemRefs.current[selectedIndex]) {
      productItemRefs.current[selectedIndex]?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex, isSearching]);

  useEffect(() => {
    setCustomerSelectedIndex(0);
  }, [availableCustomers]);

  const totals = useMemo(() => {
    const itemsSubtotal = formData.items.reduce((sum, item) => {
      const gross = item.unitPrice * item.quantity;
      let discount = 0;
      if (item.discountType === "percent") {
        discount = (gross * (item.discountValue || 0)) / 100;
      } else {
        discount = item.discountValue || 0;
      }
      return sum + (gross - discount);
    }, 0);

    const totalQty = formData.items.reduce((sum, item) => sum + item.quantity, 0);

    const unitBreakdown = formData.items.reduce((acc, item) => {
      const unit = item.unit || "PC";
      acc[unit] = (acc[unit] || 0) + item.quantity;
      return acc;
    }, {} as Record<string, number>);

    const netTotal = itemsSubtotal - (formData.overallDiscount || 0);
    const balanceDue = netTotal - (formData.amountReceived || 0);
    return { itemsSubtotal, netTotal, balanceDue, totalQty, unitBreakdown };
  }, [formData.items, formData.overallDiscount, formData.amountReceived]);

  const handleAddItem = (product: Product) => {
    const rawPrice = typeof product.price === "string" ? product.price : `${product.price ?? 0}`;
    const cleanPrice = rawPrice.replace(/Rs\./i, "").replace(/,/g, "").trim();
    const unitPrice = parseFloat(cleanPrice) || 0;

    const existingIndex = formData.items.findIndex((i) => i.productId === product.id);

    if (existingIndex > -1) {
      const newItems = [...formData.items];
      newItems[existingIndex].quantity += 1;
      setFormData({ ...formData, items: newItems });
    } else {
      const newItem: SalesInvoiceItem = {
        productId: product.id,
        productCode: product.productCode,
        productName: product.name,
        unit: product.unit,
        quantity: 1,
        unitPrice: unitPrice,
        tax: 0,
        discountValue: 0,
        discountType: "fixed",
        total: unitPrice,
      };
      setFormData({ ...formData, items: [...formData.items, newItem] });
    }
    setSearchTerm("");
    setIsSearching(false);
    setSelectedIndex(0);

    requestAnimationFrame(() => {
      const qtyInput = document.getElementById(`qty-${product.id}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
    });
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedLineIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedLineIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedLineIds.size === formData.items.length && formData.items.length > 0) {
      setSelectedLineIds(new Set());
    } else {
      setSelectedLineIds(new Set(formData.items.map((i) => i.productId)));
    }
  };

  const handleCustomerKeyDown = (e: React.KeyboardEvent) => {
    if (!isCustomerSearching || availableCustomers.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        dateInputRef.current?.focus();
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCustomerSelectedIndex((prev) => (prev < availableCustomers.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCustomerSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = availableCustomers[customerSelectedIndex];
      setFormData({ ...formData, customerId: selected.id });
      setCustomerSearchTerm(selected.name);
      setIsCustomerSearching(false);
      setTimeout(() => dateInputRef.current?.focus(), 10);
    } else if (e.key === "Escape") {
      setIsCustomerSearching(false);
    }
  };

  const handleProductSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (isSearching && availableProducts.length > 0) {
        e.preventDefault();
        handleAddItem(availableProducts[selectedIndex]);
      } else if (!searchTerm) {
        e.preventDefault();
        overallDiscRef.current?.focus();
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < availableProducts.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
    } else if (e.key === "Escape") {
      setIsSearching(false);
    }
  };

  const updateItemField = (id: string, field: keyof SalesInvoiceItem, value: any) => {
    setFormData({
      ...formData,
      items: formData.items.map((i) => (i.productId === id ? { ...i, [field]: value } : i)),
    });
  };

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.productId !== id),
    });
    const next = new Set(selectedLineIds);
    next.delete(id);
    setSelectedLineIds(next);
  };

  const handlePrint = (mode: PrintMode, item?: SalesInvoiceItem | SalesInvoiceItem[]) => {
    setPrintMode(mode);
    if (Array.isArray(item)) {
      setPrintingItems(item);
    } else if (item) {
      setPrintingItems([item]);
    } else {
      setPrintingItems([]);
    }
    setIsPrintDropdownOpen(false);
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleBulkPrintSlips = () => {
    const itemsToPrint = formData.items.filter((i) => selectedLineIds.has(i.productId));
    if (itemsToPrint.length === 0) return;
    handlePrint("item_slip", itemsToPrint);
  };

  const handleSubmit = (status: string, stayOnPage: boolean = false) => {
    if (!formData.customerId) {
      alert("?? REQUIRED FIELD: Please select a Customer Account to proceed with this invoice.");
      customerInputRef.current?.focus();
      return;
    }

    if (formData.items.length === 0) {
      alert("?? EMPTY INVOICE: No products have been added. Please search and add parts to the grid.");
      searchInputRef.current?.focus();
      return;
    }

    const zeroQtyItems = formData.items.filter((item) => item.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      alert(`?? INVALID QUANTITY: You have ${zeroQtyItems.length} item(s) with zero or invalid quantity.`);
      const firstInvalidId = zeroQtyItems[0].productId;
      const qtyInput = document.getElementById(`qty-${firstInvalidId}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
      return;
    }

    const customer = customers.find((c) => c.id === formData.customerId);
    const invoiceData: SalesInvoice = {
      ...formData,
      status,
      customerName: customer?.name || "Unknown",
      totalAmount: totals.netTotal,
    };
    onSave(invoiceData, stayOnPage);
    if (stayOnPage) {
      setIsSaveDropdownOpen(false);
    }
  };

  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === formData.customerId);
  }, [formData.customerId, customers]);

  useEffect(() => {
    if (currentCustomer) {
      setCustomerSearchTerm(currentCustomer.name);
    }
  }, [formData.customerId, currentCustomer]);

  const onEnterMoveTo = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-20 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-orange-600 shadow-sm transition-all active:scale-95"
          >
            <span className="text-xl">?</span>
          </button>
          <div>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter italic">
              {isEdit ? "Edit Invoice" : "New Sales Invoice"}
            </h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              Operational Module v4.0
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
          <label className="flex items-center gap-3 cursor-pointer group select-none">
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-widest leading-none">
                Save Prices
              </p>
              <p className="text-[8px] font-bold text-slate-400 uppercase mt-0.5 leading-none">
                Manual Control
              </p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={savePrices}
                onChange={() => setSavePrices(!savePrices)}
              />
              <div
                className={`w-12 h-6 rounded-full transition-all duration-300 border ${
                  savePrices
                    ? "bg-orange-600 border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.3)]"
                    : "bg-slate-200 dark:bg-slate-800 border-slate-300 dark:border-slate-700"
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-300 shadow-sm ${
                    savePrices ? "translate-x-6" : "translate-x-0"
                  }`}
                ></div>
              </div>
            </div>
          </label>
        </div>
      </div>

      <div className="space-y-4 print:hidden">
        <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-3 border-r border-slate-200 dark:border-slate-800 pr-6">
              <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full bg-transparent text-lg font-black text-slate-900 dark:text-white outline-none focus:text-orange-600 transition-colors"
                placeholder="INV-XXXXXX"
                onKeyDown={(e) => onEnterMoveTo(e, customerInputRef)}
              />
              <span className="text-[9px] font-bold uppercase text-emerald-500 mt-1 block">? Auto-ID</span>
            </div>

            <div className="md:col-span-5 relative" ref={customerSearchContainerRef}>
              <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                Customer Account
              </label>
              <div className="relative group">
                <input
                  ref={customerInputRef}
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-400"
                  placeholder="Search name, phone, or code..."
                  value={customerSearchTerm}
                  onChange={(e) => {
                    setCustomerSearchTerm(e.target.value);
                    setIsCustomerSearching(true);
                  }}
                  onFocus={() => setIsCustomerSearching(true)}
                  onKeyDown={handleCustomerKeyDown}
                />
                {formData.customerId && (
                  <button
                    onClick={() => {
                      setFormData({ ...formData, customerId: "" });
                      setCustomerSearchTerm("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                  >
                    ?
                  </button>
                )}
              </div>

              {formData.customerId && currentCustomer && (
                <div className="mt-2 flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-300">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                    Account Ledger Balance:
                  </span>
                  <span
                    className={`text-[11px] font-black px-2 py-0.5 rounded-lg border transition-colors ${
                      parseFloat((currentCustomer.balance || "0").toString().replace(/[^0-9.-]+/g, "")) > 0
                        ? "text-rose-600 dark:text-rose-500 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800"
                        : "text-emerald-600 dark:text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800"
                    }`}
                  >
                    {currentCustomer.balance || "Rs. 0.00"}
                  </span>
                </div>
              )}

              {isCustomerSearching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-[60] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="max-h-[250px] overflow-y-auto">
                    {availableCustomers.length > 0 ? (
                      availableCustomers.map((c, idx) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setFormData({ ...formData, customerId: c.id });
                            setCustomerSearchTerm(c.name);
                            setIsCustomerSearching(false);
                            setTimeout(() => dateInputRef.current?.focus(), 10);
                          }}
                          onMouseEnter={() => setCustomerSelectedIndex(idx)}
                          className={`w-full text-left p-3.5 flex justify-between items-center transition-colors border-b last:border-0 dark:border-slate-800 ${
                            customerSelectedIndex === idx
                              ? "bg-orange-600 text-white"
                              : "hover:bg-orange-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div>
                            <p
                              className={`text-[11px] font-black ${
                                customerSelectedIndex === idx ? "text-white" : "text-slate-900 dark:text-white"
                              }`}
                            >
                              {c.name}
                            </p>
                            <div className="flex gap-2 mt-0.5">
                              <span
                                className={`text-[8px] font-bold ${
                                  customerSelectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                }`}
                              >
                                Code: {c.customerCode || "N/A"}
                              </span>
                              <span
                                className={`text-[8px] font-bold ${
                                  customerSelectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                }`}
                              >
                                • {c.category || "General"}
                              </span>
                            </div>
                          </div>
                          <span
                            className={`text-[9px] font-bold ${
                              customerSelectedIndex === idx ? "text-orange-200" : "text-slate-400"
                            }`}
                          >
                            {c.phone || ""}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="p-5 text-center">
                        <p className="text-[11px] font-bold text-slate-400">No customers found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                  Posting Date
                </label>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[12px] font-bold dark:text-white outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  onKeyDown={(e) => onEnterMoveTo(e, dueDateInputRef)}
                />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                  Due Date
                </label>
                <input
                  ref={dueDateInputRef}
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[12px] font-bold dark:text-white outline-none"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  onKeyDown={(e) => onEnterMoveTo(e, vehicleInputRef)}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                Vehicle Number
              </label>
              <input
                ref={vehicleInputRef}
                type="text"
                placeholder="REG-1234 (Optional)..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all uppercase"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                onKeyDown={(e) => onEnterMoveTo(e, refInputRef)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2.5">
                Reference / PO Number
              </label>
              <input
                ref={refInputRef}
                type="text"
                placeholder="Customer Reference or PO ID..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-3 px-4 text-[12px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                onKeyDown={(e) => onEnterMoveTo(e, searchInputRef)}
              />
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-10 overflow-visible">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight border-b border-slate-200 dark:border-slate-700">
                  <th className="px-6 py-4 w-10 text-center">#</th>
                  <th className="px-4 py-4">Product</th>
                  <th className="px-4 py-4 w-20 text-center">Qty</th>
                  <th className="px-4 py-4 w-32 text-right">Unit Price</th>
                  <th className="px-4 py-4 w-32 text-right">Net</th>
                  <th className="px-4 py-4 w-16 text-center">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {formData.items.map((item, index) => {
                  const grossAmount = item.unitPrice * item.quantity;
                  let discountAmt = 0;
                  if (item.discountType === "percent") {
                    discountAmt = (grossAmount * (item.discountValue || 0)) / 100;
                  } else {
                    discountAmt = item.discountValue || 0;
                  }
                  const netAmount = grossAmount - discountAmt;
                  return (
                    <tr key={item.productId} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                      <td className="px-6 py-3 text-center text-[11px] font-bold text-slate-500">{index + 1}</td>
                      <td className="px-4 py-3">
                        <div className="text-[11px] font-black text-slate-900 dark:text-white">{item.productName}</div>
                        <div className="text-[9px] text-slate-400">{item.productCode || ""}</div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input
                          id={`qty-${item.productId}`}
                          type="number"
                          className="w-16 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-center font-black text-[11px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1.5 transition-all"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(item.productId, "quantity", Math.max(0, parseInt(e.target.value) || 0))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <input
                          id={`price-${item.productId}`}
                          type="number"
                          className="w-24 bg-slate-50 dark:bg-slate-800/50 rounded-lg text-right font-black text-[11px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1.5 transition-all"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemField(item.productId, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                        />
                      </td>
                      <td className="px-4 py-3 text-right text-[11px] font-black text-slate-900 dark:text-white">
                        Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          ?
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-orange-50/10 dark:bg-orange-950/10 border-t border-slate-200 dark:border-slate-700">
                  <td className="px-6 py-4 text-center">+</td>
                  <td colSpan={5} className="px-4 py-4">
                    <div className="relative" ref={searchContainerRef}>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search SKU or product name..."
                        className="w-full bg-transparent outline-none text-[12px] font-black text-slate-900 dark:text-white placeholder:text-slate-400 tracking-tight"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsSearching(true);
                        }}
                        onFocus={() => setIsSearching(true)}
                        onKeyDown={handleProductSearchKeyDown}
                      />

                      {isSearching && searchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-3 w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl z-[100] overflow-hidden">
                          <div ref={productListContainerRef} className="max-h-[400px] overflow-y-auto p-2 space-y-1">
                            {availableProducts.length > 0 ? (
                              availableProducts.map((p, idx) => (
                                <button
                                  key={p.id}
                                  ref={(el) => {
                                    productItemRefs.current[idx] = el;
                                  }}
                                  onClick={() => handleAddItem(p)}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`w-full text-left py-2 px-3.5 rounded-xl flex justify-between items-center transition-all duration-75 ${
                                    selectedIndex === idx ? "bg-orange-600 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <div>
                                    <p className="text-[11px] font-black uppercase">{p.name}</p>
                                    <p className="text-[9px] text-slate-400">SKU: {p.productCode || p.id}</p>
                                  </div>
                                  <div className="text-xs font-black">{p.price}</div>
                                </button>
                              ))
                            ) : (
                              <div className="p-6 text-center text-[10px] font-black text-slate-400">No matching parts</div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-0">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <label className="block text-[11px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-4">
                Internal Memo & Ledger Remarks
              </label>
              <textarea
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-xl p-5 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/5 focus:border-orange-500/20 placeholder:text-slate-400 resize-none transition-all"
                placeholder="Record terms, warranty data, or logistics notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              ></textarea>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-8 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <div className="flex justify-between items-center px-1">
              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">Items Subtotal</span>
              <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                Rs. {totals.itemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center px-1 py-3 border-y border-slate-100 dark:border-slate-800">
              <span className="text-[11px] font-black text-slate-900 dark:text-slate-100">Overall Discount</span>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400 font-bold">Rs.</span>
                <input
                  ref={overallDiscRef}
                  type="number"
                  className="w-24 bg-transparent text-right font-black text-[12px] outline-none text-rose-500 focus:border-b focus:border-rose-500"
                  value={formData.overallDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, overallDiscount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex justify-between items-center px-1 pt-2">
              <span className="text-[12px] font-black text-slate-900 dark:text-white uppercase tracking-tight">(Total)</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter">
                Rs. {totals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-orange-50 dark:bg-orange-500/5 p-4 rounded-xl border border-orange-100 dark:border-orange-500/10 mt-6">
              <div className="flex justify-between items-center">
                <span className="text-[11px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-tight">
                  Cash Received
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-orange-600 font-black">Rs.</span>
                  <input
                    ref={amountReceivedRef}
                    type="number"
                    className="w-24 bg-transparent text-right font-black text-[13px] outline-none text-orange-700 dark:text-orange-400 focus:border-b focus:border-orange-500"
                    value={formData.amountReceived}
                    onChange={(e) =>
                      setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            <div
              className={`p-4 rounded-xl border mt-2 transition-colors ${
                totals.balanceDue > 0
                  ? "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10"
                  : "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-800"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[11px] font-black uppercase tracking-tight ${
                    totals.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  Balance Due
                </span>
                <span
                  className={`text-[16px] font-black tracking-tight ${
                    totals.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  Rs. {totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-6 pt-10">
          <button
            onClick={onBack}
            className="text-[11px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors"
          >
            Discard
          </button>

          <div className="flex items-center gap-3">
            <div className="relative inline-flex h-12 group" ref={saveDropdownRef}>
              <button
                ref={saveBtnRef}
                onClick={() => handleSubmit("Draft", true)}
                className="flex items-center gap-3 pl-6 pr-4 bg-orange-600 border border-orange-500 rounded-2xl text-white font-black text-[11px] uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-95 shadow-lg"
              >
                <span>??</span> Save & Edit
              </button>
              {isSaveDropdownOpen && (
                <div className="absolute bottom-full right-0 mb-4 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        handleSubmit("Paid", false);
                        setIsSaveDropdownOpen(false);
                      }}
                      className="w-full text-left px-5 py-3.5 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 hover:text-emerald-600 transition-all flex items-center gap-4 rounded-xl"
                    >
                      <span>?</span> Save & Approve
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesInvoiceFormPage;
