
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Customer, Product, SalesInvoice, SalesInvoiceItem } from "../types";

interface SalesInvoiceFormPageProps {
  invoice?: SalesInvoice;
  products: Product[];
  customers: Customer[];
  onBack: () => void;
  onSave: (invoice: SalesInvoice, stayOnPage: boolean) => void;
}

const SalesInvoiceFormPage: React.FC<SalesInvoiceFormPageProps> = ({
  invoice,
  products,
  customers,
  onBack,
  onSave,
}) => {
  const isEdit = !!invoice;

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
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [customerSelectedIndex, setCustomerSelectedIndex] = useState(0);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overallDiscRef = useRef<HTMLInputElement>(null);
  const amountReceivedRef = useRef<HTMLInputElement>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const productListContainerRef = useRef<HTMLDivElement>(null);
  const productItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearching(false);
      }
      if (customerSearchContainerRef.current && !customerSearchContainerRef.current.contains(target)) {
        setIsCustomerSearching(false);
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

    const netTotal = itemsSubtotal - (formData.overallDiscount || 0);
    const balanceDue = netTotal - (formData.amountReceived || 0);
    return { itemsSubtotal, netTotal, balanceDue };
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
      const selectedId = selected.id || "";
      if (!selectedId) return;
      setFormData({ ...formData, customerId: selectedId });
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

  const reorderItem = (dragId: string, dropId: string) => {
    if (dragId === dropId) return;
    const fromIndex = formData.items.findIndex((i) => i.productId === dragId);
    const toIndex = formData.items.findIndex((i) => i.productId === dropId);
    if (fromIndex === -1 || toIndex === -1) return;
    const nextItems = [...formData.items];
    const [moved] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, moved);
    setFormData({ ...formData, items: nextItems });
  };

  const toggleSelectItem = (id: string) => {
    const next = new Set(selectedItemIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedItemIds(next);
  };

  const toggleSelectAll = () => {
    if (selectedItemIds.size === formData.items.length && formData.items.length > 0) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(formData.items.map((i) => i.productId)));
    }
  };

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => i.productId !== id),
    });
    if (selectedItemIds.has(id)) {
      const next = new Set(selectedItemIds);
      next.delete(id);
      setSelectedItemIds(next);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItemIds.size === 0) return;
    setFormData({
      ...formData,
      items: formData.items.filter((i) => !selectedItemIds.has(i.productId)),
    });
    setSelectedItemIds(new Set());
  };

  const handlePrintSelected = () => {
    if (selectedItemIds.size === 0) return;
    window.print();
  };

  const handleSubmit = (status: string, stayOnPage: boolean = false) => {
    if (!formData.customerId) {
      alert("Required: Please select a Customer Account.");
      customerInputRef.current?.focus();
      return;
    }

    if (formData.items.length === 0) {
      alert("Empty invoice: Add at least one item.");
      searchInputRef.current?.focus();
      return;
    }

    const zeroQtyItems = formData.items.filter((item) => item.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      alert("Invalid quantity: There are items with 0 qty.");
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
    <div className="max-w-7xl mx-auto animate-in fade-in duration-300 pb-12 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm transition-all active:scale-95"
          >
            <span className="text-lg">←</span>
          </button>
          <div>
            <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              {isEdit ? "Edit Invoice" : "New Sales Invoice"}
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              Operational Module v4.0
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3 border-r border-slate-200 dark:border-slate-800 pr-4">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                className="w-full bg-transparent text-base font-black text-slate-900 dark:text-white outline-none focus:text-orange-600 transition-colors"
                placeholder="INV-XXXXXX"
                onKeyDown={(e) => onEnterMoveTo(e, customerInputRef)}
              />
              <span className="text-[8px] font-bold uppercase text-emerald-500 mt-1 block">Auto-ID</span>
            </div>

            <div className="md:col-span-5 relative" ref={customerSearchContainerRef}>
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Customer Account
              </label>
              <div className="relative group">
                <input
                  ref={customerInputRef}
                  type="text"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-400"
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 p-1"
                  >
                    ✕
                  </button>
                )}
              </div>

              {formData.customerId && currentCustomer && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Account Ledger Balance:
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                    {currentCustomer.balance || "Rs. 0.00"}
                  </span>
                </div>
              )}

              {isCustomerSearching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl z-[60] overflow-hidden">
                  <div className="max-h-[250px] overflow-y-auto">
                    {availableCustomers.length > 0 ? (
                      availableCustomers.map((c, idx) => (
                        <button
                          key={c.id || idx}
                          onClick={() => {
                            const selectedId = c.id || "";
                            if (!selectedId) return;
                            setFormData({ ...formData, customerId: selectedId });
                            setCustomerSearchTerm(c.name);
                            setIsCustomerSearching(false);
                            setTimeout(() => dateInputRef.current?.focus(), 10);
                          }}
                          onMouseEnter={() => setCustomerSelectedIndex(idx)}
                          className={`w-full text-left p-2.5 flex justify-between items-center transition-colors border-b last:border-0 dark:border-slate-800 ${
                            customerSelectedIndex === idx
                              ? "bg-orange-600 text-white"
                              : "hover:bg-orange-50 dark:hover:bg-slate-800"
                          }`}
                        >
                          <div>
                            <p className={`text-[10px] font-black ${customerSelectedIndex === idx ? "text-white" : "text-slate-900 dark:text-white"}`}>{c.name}</p>
                            <div className="flex gap-2 mt-0.5">
                              <span className={`text-[7px] font-bold ${customerSelectedIndex === idx ? "text-orange-100" : "text-slate-400"}`}>
                                Code: {c.customerCode || "N/A"}
                              </span>
                              <span className={`text-[7px] font-bold ${customerSelectedIndex === idx ? "text-orange-100" : "text-slate-400"}`}>
                                • {c.category || "General"}
                              </span>
                            </div>
                          </div>
                          <span className={`text-[8px] font-bold ${customerSelectedIndex === idx ? "text-orange-200" : "text-slate-400"}`}>{c.phone || ""}</span>
                        </button>
                      ))
                    ) : (
                      <div className="p-5 text-center">
                        <p className="text-[10px] font-bold text-slate-400">No customers found</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="md:col-span-4 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                  Posting Date
                </label>
                <input
                  ref={dateInputRef}
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                  onKeyDown={(e) => onEnterMoveTo(e, dueDateInputRef)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                  Due Date
                </label>
                <input
                  ref={dueDateInputRef}
                  type="date"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  onKeyDown={(e) => onEnterMoveTo(e, vehicleInputRef)}
                />
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100 dark:bg-slate-800 w-full"></div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-6">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Vehicle Number
              </label>
              <input
                ref={vehicleInputRef}
                type="text"
                placeholder="REG-1234 (Optional)..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all uppercase"
                value={formData.vehicleNumber}
                onChange={(e) => setFormData({ ...formData, vehicleNumber: e.target.value.toUpperCase() })}
                onKeyDown={(e) => onEnterMoveTo(e, refInputRef)}
              />
            </div>

            <div className="md:col-span-6">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Reference / PO Number
              </label>
              <input
                ref={refInputRef}
                type="text"
                placeholder="Customer Reference or PO ID..."
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                onKeyDown={(e) => onEnterMoveTo(e, searchInputRef)}
              />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-10 overflow-visible">
          <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight border-b border-slate-200 dark:border-slate-700">
                  <th className="px-4 py-3 w-10 text-center">
                    <button
                      onClick={toggleSelectAll}
                      className={`w-4 h-4 rounded border flex items-center justify-center mx-auto ${
                        selectedItemIds.size === formData.items.length && formData.items.length > 0
                          ? "bg-orange-600 border-orange-600"
                          : "border-slate-300 dark:border-slate-600"
                      }`}
                    >
                      {selectedItemIds.size === formData.items.length && formData.items.length > 0 && (
                        <span className="text-white text-[8px]">✓</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 w-8 text-center">#</th>
                  <th className="px-3 py-3 w-20">Code</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3 w-16 text-center">Qty</th>
                  <th className="px-3 py-3 w-24 text-right">Unit Price</th>
                  <th className="px-3 py-3 w-32 text-right">Discount</th>
                  <th className="px-3 py-3 w-28 text-right">Net</th>
                  <th className="px-3 py-3 w-12 text-center">Move</th>
                  <th className="px-3 py-3 w-14 text-center">Remove</th>
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
                    <tr
                      key={item.productId}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                        draggingId === item.productId ? "bg-orange-50/60 dark:bg-orange-950/20" : ""
                      }`}
                      draggable
                      onDragStart={(e) => {
                        setDraggingId(item.productId);
                        e.dataTransfer.setData("text/plain", item.productId);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const dragId = e.dataTransfer.getData("text/plain");
                        reorderItem(dragId, item.productId);
                        setDraggingId(null);
                      }}
                      onDragEnd={() => setDraggingId(null)}
                    >
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => toggleSelectItem(item.productId)}
                          className={`w-4 h-4 rounded border flex items-center justify-center mx-auto ${
                            selectedItemIds.has(item.productId)
                              ? "bg-orange-600 border-orange-600"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {selectedItemIds.has(item.productId) && (
                            <span className="text-white text-[8px]">✓</span>
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-center text-[10px] font-black text-slate-500">{index + 1}</td>
                      <td className="px-3 py-2">
                        <div className="text-[9px] font-black uppercase text-slate-600 dark:text-slate-300">
                          {item.productCode || "N/A"}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="text-[10px] font-black text-slate-900 dark:text-white">{item.productName}</div>
                        <div className="text-[8px] text-slate-400">{item.productCode || ""}</div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input
                          id={`qty-${item.productId}`}
                          type="number"
                          className="w-12 bg-slate-50 dark:bg-slate-800/50 rounded-md text-center font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(item.productId, "quantity", Math.max(0, parseInt(e.target.value) || 0))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          id={`price-${item.productId}`}
                          type="number"
                          className="w-16 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all"
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemField(item.productId, "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <input
                            type="number"
                            className="w-12 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all"
                            value={item.discountValue || 0}
                            onChange={(e) =>
                              updateItemField(item.productId, "discountValue", Math.max(0, parseFloat(e.target.value) || 0))
                            }
                          />
                          <select
                            className="bg-transparent text-[9px] font-black text-slate-400"
                            value={item.discountType}
                            onChange={(e) => updateItemField(item.productId, "discountType", e.target.value as any)}
                          >
                            <option value="fixed">Rs</option>
                            <option value="percent">%</option>
                          </select>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right text-[10px] font-black text-slate-900 dark:text-white">
                        Rs. {netAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div
                          className="w-7 h-7 mx-auto flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-md text-slate-400 cursor-grab active:cursor-grabbing"
                          title="Drag to reorder"
                          onMouseDown={() => setDraggingId(item.productId)}
                        >
                          ⋮⋮
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-orange-50/10 dark:bg-orange-950/10 border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 text-center">+</td>
                  <td colSpan={9} className="px-3 py-3">
                    <div className="relative z-[120]" ref={searchContainerRef}>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search SKU or product name..."
                        className="w-full bg-transparent outline-none text-[11px] font-black text-slate-900 dark:text-white placeholder:text-slate-400 tracking-tight"
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsSearching(true);
                        }}
                        onFocus={() => setIsSearching(true)}
                        onKeyDown={handleProductSearchKeyDown}
                      />

                      {isSearching && searchTerm && (
                        <div className="absolute top-full left-0 right-0 mt-2 w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl z-[9999] overflow-hidden">
                          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                            <div>
                              <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Products</div>
                              <div className="text-[9px] text-slate-400">
                                {availableProducts.length} result{availableProducts.length === 1 ? "" : "s"}
                              </div>
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                              Enter to add
                            </div>
                          </div>
                          <div ref={productListContainerRef} className="max-h-[360px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {availableProducts.length > 0 ? (
                              availableProducts.map((p, idx) => (
                                <button
                                  key={p.id}
                                  ref={(el) => {
                                    productItemRefs.current[idx] = el;
                                  }}
                                  onClick={() => handleAddItem(p)}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all ${
                                    selectedIndex === idx ? "bg-orange-600 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black ${
                                      selectedIndex === idx ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                                    }`}>
                                      {p.image ? (
                                        <img src={p.image} alt={p.name} className="w-full h-full object-cover rounded-lg" />
                                      ) : (
                                        "PR"
                                      )}
                                    </div>
                                    <div>
                                      <div className={`text-[11px] font-black uppercase tracking-tight ${
                                        selectedIndex === idx ? "text-white" : "text-slate-900 dark:text-white"
                                      }`}>{p.name}</div>
                                      <div className={`text-[9px] ${
                                        selectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                      }`}>
                                        SKU: {p.productCode || p.id} • {p.category || "General"}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-[10px] font-black ${
                                      selectedIndex === idx ? "text-white" : "text-orange-600"
                                    }`}>
                                      {p.price}
                                    </div>
                                    <div className={`text-[9px] ${
                                      selectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                    }`}>
                                      Stock: {p.stock} {p.unit}
                                    </div>
                                  </div>
                                </button>
                              ))
                            ) : (
                              <div className="px-6 py-8 text-center">
                                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  No matching products
                                </div>
                                <div className="text-[9px] text-slate-400 mt-1">
                                  Try another keyword or SKU.
                                </div>
                              </div>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-0">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-3">
                Internal Memo & Ledger Remarks
              </label>
              <textarea
                rows={3}
                className="w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-lg p-3 text-[10px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/5 focus:border-orange-500/20 placeholder:text-slate-400 resize-none transition-all"
                placeholder="Record terms, warranty data, or logistics notes..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              ></textarea>
            </div>
          </div>

          <div className="lg:col-span-1 bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">Items Subtotal</span>
              <span className="text-[10px] font-black text-slate-700 dark:text-slate-300">
                Rs. {totals.itemsSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="flex justify-between items-center px-1 py-2 border-y border-slate-100 dark:border-slate-800">
              <span className="text-[10px] font-black text-slate-900 dark:text-slate-100">Overall Discount</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-bold">Rs.</span>
                <input
                  ref={overallDiscRef}
                  type="number"
                  className="w-20 bg-transparent text-right font-black text-[11px] outline-none text-rose-500 focus:border-b focus:border-rose-500"
                  value={formData.overallDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, overallDiscount: parseFloat(e.target.value) || 0 })
                  }
                />
              </div>
            </div>

            <div className="flex justify-between items-center px-1 pt-2">
              <span className="text-[11px] font-black text-slate-900 dark:text-white uppercase tracking-tight">(Total)</span>
              <span className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Rs. {totals.netTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div className="bg-orange-50 dark:bg-orange-500/5 p-3 rounded-lg border border-orange-100 dark:border-orange-500/10 mt-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-orange-700 dark:text-orange-400 uppercase tracking-tight">
                  Cash Received
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-orange-600 font-black">Rs.</span>
                  <input
                    ref={amountReceivedRef}
                    type="number"
                    className="w-20 bg-transparent text-right font-black text-[11px] outline-none text-orange-700 dark:text-orange-400 focus:border-b focus:border-orange-500"
                    value={formData.amountReceived}
                    onChange={(e) =>
                      setFormData({ ...formData, amountReceived: parseFloat(e.target.value) || 0 })
                    }
                  />
                </div>
              </div>
            </div>

            <div
              className={`p-3 rounded-lg border mt-2 transition-colors ${
                totals.balanceDue > 0
                  ? "bg-rose-50 dark:bg-rose-500/5 border-rose-100 dark:border-rose-500/10"
                  : "bg-emerald-50 dark:bg-emerald-500/5 border-emerald-100 dark:border-emerald-800"
              }`}
            >
              <div className="flex justify-between items-center">
                <span
                  className={`text-[10px] font-black uppercase tracking-tight ${
                    totals.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  Balance Due
                </span>
                <span
                  className={`text-[14px] font-black tracking-tight ${
                    totals.balanceDue > 0 ? "text-rose-700" : "text-emerald-700"
                  }`}
                >
                  Rs. {totals.balanceDue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 pt-6">
          <button
            onClick={onBack}
            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-rose-600 transition-colors"
          >
            Discard
          </button>

          <div className="flex items-center gap-3">
            <button
              onClick={() => handleSubmit("Draft", true)}
              className="flex items-center gap-2 px-4 py-2 bg-orange-600 border border-orange-500 rounded-lg text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all active:scale-95 shadow-sm"
            >
              Save & Edit
            </button>
            <button
              onClick={() => handleSubmit("Paid", false)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-900 rounded-lg text-white font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
            >
              Save & Approve
            </button>
          </div>
        </div>
      </div>

      {selectedItemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200]">
          <div className="bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl border border-white/10 flex items-center gap-6">
            <div className="flex items-center gap-3 border-r border-white/10 pr-6">
              <div className="w-8 h-8 bg-orange-600 rounded-full flex items-center justify-center text-[11px] font-black">
                {selectedItemIds.size}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest leading-none">Items Selected</p>
                <p className="text-[8px] font-bold text-slate-400 uppercase mt-1">Bulk Actions Ready</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handlePrintSelected}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
              >
                Print Selected
              </button>
              <button
                onClick={handleDeleteSelected}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedItemIds(new Set())}
                className="text-slate-300 hover:text-white font-black text-[9px] uppercase tracking-widest transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesInvoiceFormPage;
