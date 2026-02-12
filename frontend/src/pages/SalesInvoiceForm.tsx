
import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Company, Customer, Product, SalesInvoice, SalesInvoiceItem } from "../types";

interface SalesInvoiceFormPageProps {
  invoice?: SalesInvoice;
  forceNewMode?: boolean;
  invoices: SalesInvoice[];
  products: Product[];
  customers: Customer[];
  company?: Company;
  onBack: () => void;
  onSave: (invoice: SalesInvoice, stayOnPage: boolean, savePrices: boolean) => void;
  onNavigate?: (invoice: SalesInvoice) => void;
  onNavigateNew?: () => void;
  formTitleNew?: string;
  formTitleEdit?: string;
}

type PrintMode = "invoice" | "receipt" | "a5" | "token";

const SalesInvoiceFormPage: React.FC<SalesInvoiceFormPageProps> = ({
  invoice,
  forceNewMode = false,
  invoices,
  products,
  customers,
  company,
  onBack,
  onSave,
  onNavigate,
  onNavigateNew,
  formTitleNew = "New Sales Invoice",
  formTitleEdit = "Edit Invoice",
}) => {
  const isEdit = !!invoice && !forceNewMode;

  const formatInvoiceId = (num: number) => `SI-${String(num).padStart(6, "0")}`;
  const getInvoiceNumber = (id?: string) => {
    if (!id) return -1;
    const match = id.match(/^SI-(\d{6})$/);
    return match ? Number(match[1]) : -1;
  };

  const buildReceiptBarcodePattern = (value: string) => {
    const safe = (value || "").toUpperCase();
    const startStop = "101011";
    const chunks = safe.split("").map((ch) => {
      const code = ch.charCodeAt(0);
      const bits = code.toString(2).padStart(8, "0");
      return `10${bits}01`;
    });
    return `${startStop}${chunks.join("11")}${startStop}`;
  };

  const nextInvoiceId = useMemo(() => {
    const maxNum = invoices
      .map((inv) => getInvoiceNumber(inv.id))
      .filter((num) => num >= 0)
      .reduce((max, num) => (num > max ? num : max), 0);
    return formatInvoiceId(maxNum + 1);
  }, [invoices]);

  const [formData, setFormData] = useState({
    id: invoice?.id || nextInvoiceId,
    customerId: invoice?.customerId || "",
    reference: invoice?.reference || "",
    vehicleNumber: invoice?.vehicleNumber || "",
    date: invoice?.date || new Date().toISOString().split("T")[0],
    dueDate:
      invoice?.dueDate ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    status: invoice?.status || "Draft",
    paymentStatus: invoice?.paymentStatus || "Unpaid",
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
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [isSaveMenuOpen, setIsSaveMenuOpen] = useState(false);
  const [isPrintMenuOpen, setIsPrintMenuOpen] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [savePrices, setSavePrices] = useState(true);
  const [printMode, setPrintMode] = useState<PrintMode>("invoice");
  const [printItems, setPrintItems] = useState<SalesInvoiceItem[]>([]);
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);

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
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearching(false);
      }
      if (customerSearchContainerRef.current && !customerSearchContainerRef.current.contains(target)) {
        setIsCustomerSearching(false);
      }
      if (saveMenuRef.current && !saveMenuRef.current.contains(target)) {
        setIsSaveMenuOpen(false);
      }
      if (printMenuRef.current && !printMenuRef.current.contains(target)) {
        setIsPrintMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPreviewImage(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
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
      const unit = (item.unit || "PC").toUpperCase();
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
    if (!dragId || dragId === dropId) return;
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
    const selected = formData.items.filter((i) => selectedItemIds.has(i.productId));
    setPrintItems(selected);
    setPrintMode("token");
    setTimeout(() => window.print(), 50);
  };

  const handlePrintMode = (mode: PrintMode) => {
    if (mode === "token") {
      setPrintItems(formData.items);
    } else {
      setPrintItems([]);
    }
    setPrintMode(mode);
    setTimeout(() => window.print(), 50);
  };

  const computePaymentStatus = () => {
    const total = totals.netTotal;
    const received = formData.amountReceived || 0;
    if (received <= 0) return "Unpaid";
    if (received < total) return "Partial";
    return "Paid";
  };

  const isApproved = formData.status === "Approved";
  const isLocked = isApproved && !isRevising;

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
    const finalPaymentStatus = computePaymentStatus();
    const finalStatus = status === "Draft" ? "Draft" : status;
    const invoiceData: SalesInvoice = {
      ...formData,
      status: finalStatus,
      paymentStatus: finalPaymentStatus,
      customerName: customer?.name || "Unknown",
      totalAmount: totals.netTotal,
    };
    onSave(invoiceData, stayOnPage, savePrices);
  };

  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.id === formData.customerId);
  }, [formData.customerId, customers]);

  useEffect(() => {
    if (currentCustomer) {
      setCustomerSearchTerm(currentCustomer.name);
    }
  }, [formData.customerId, currentCustomer]);

  useEffect(() => {
    if (invoice) {
      setFormData({
        id: invoice.id,
        customerId: invoice.customerId || "",
        reference: invoice.reference || "",
        vehicleNumber: invoice.vehicleNumber || "",
        date: invoice.date || new Date().toISOString().split("T")[0],
        dueDate:
          invoice.dueDate ||
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        status: invoice.status || "Draft",
        paymentStatus: invoice.paymentStatus || "Unpaid",
        notes: invoice.notes || "",
        overallDiscount: invoice.overallDiscount || 0,
        amountReceived: invoice.amountReceived || 0,
        items: (invoice.items || []) as SalesInvoiceItem[],
      });
    }
  }, [invoice]);

  useEffect(() => {
    if (!invoice && formData.id !== nextInvoiceId) {
      setFormData((prev) => ({ ...prev, id: nextInvoiceId }));
    }
  }, [invoice, nextInvoiceId, formData.id]);

  const sortedInvoices = useMemo(() => {
    return [...invoices].sort((a, b) => {
      const aNum = getInvoiceNumber(a.id);
      const bNum = getInvoiceNumber(b.id);
      if (aNum >= 0 && bNum >= 0) return aNum - bNum;
      return (a.id || "").localeCompare(b.id || "");
    });
  }, [invoices]);

  const currentInvoiceIndex = useMemo(() => {
    if (!invoice?.id) return -1;
    return sortedInvoices.findIndex((inv) => inv.id === invoice.id);
  }, [sortedInvoices, invoice?.id]);

  const fallbackIndex = sortedInvoices.length > 0 ? sortedInvoices.length - 1 : -1;
  const effectiveIndex = currentInvoiceIndex >= 0 ? currentInvoiceIndex : fallbackIndex;

  const prevInvoice =
    effectiveIndex > 0 ? sortedInvoices[effectiveIndex - 1] : undefined;
  const nextInvoice =
    effectiveIndex >= 0 && effectiveIndex < sortedInvoices.length - 1
      ? sortedInvoices[effectiveIndex + 1]
      : undefined;
  const isLatestSaved = !!invoice?.id && sortedInvoices.length > 0 && effectiveIndex === sortedInvoices.length - 1;
  const canGoNext = !!nextInvoice || isLatestSaved;

  const onEnterMoveTo = (e: React.KeyboardEvent, nextRef: React.RefObject<any>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      nextRef.current?.focus();
    }
  };

  return (
    <div className="invoice-editor-root max-w-7xl mx-auto animate-in fade-in duration-300 pb-12 relative">
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
              {isEdit ? formTitleEdit : formTitleNew}
            </h1>
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none mt-1">
              Operational Module v4.0
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-2 py-1">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">Save Prices</span>
            <button
              type="button"
              onClick={() => setSavePrices((prev) => !prev)}
              className={`relative w-10 h-6 rounded-full border overflow-hidden transition-colors ${
                savePrices
                  ? "bg-orange-500 border-orange-500"
                  : "bg-slate-200 border-slate-300 dark:bg-slate-700 dark:border-slate-600"
              }`}
              aria-pressed={savePrices}
              title="When enabled, edited item prices will update product sale prices."
            >
              <span
                className={`absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  savePrices ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
            <span
              className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded ${
                savePrices ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
              }`}
            >
              {savePrices ? "On" : "Off"}
            </span>
          </div>
          <span
            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
              formData.status === "Draft"
                ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800"
                : formData.status === "Approved"
                ? "bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-900/20"
                : "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20"
            }`}
          >
            {formData.status || "Draft"}
          </span>
          <span
            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
              formData.paymentStatus === "Paid"
                ? "bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-900/20"
                : formData.paymentStatus === "Partial"
                ? "bg-amber-50 text-amber-700 border-amber-100 dark:bg-amber-900/20"
                : "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20"
            }`}
          >
            {formData.paymentStatus || "Unpaid"}
          </span>
        </div>
      </div>

      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20 space-y-6">
          {isApproved && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-[56px] sm:text-[72px] font-black uppercase tracking-[0.2em] text-emerald-600/15 rotate-[-12deg]">
                Approved
              </div>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="md:col-span-3 border-r border-slate-200 dark:border-slate-800 pr-4">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                Invoice Number
              </label>
              <div className="inline-flex items-center">
                <button
                  type="button"
                  onClick={() => prevInvoice && onNavigate?.(prevInvoice)}
                  disabled={!prevInvoice}
                  className={`w-8 h-8 flex items-center justify-center border text-[12px] font-black ${
                    prevInvoice
                      ? "border-slate-200 text-slate-600 hover:text-orange-600"
                      : "border-slate-100 text-slate-300"
                  }`}
                >
                  &lt;
                </button>
              <input
                type="text"
                value={formData.id}
                readOnly
                className="w-32 bg-transparent text-base font-black text-slate-900 dark:text-white outline-none text-center tracking-widest border-y border-slate-200 dark:border-slate-800"
                placeholder="SI-000001"
              />
                <button
                  type="button"
                  onClick={() => {
                    if (nextInvoice) {
                      onNavigate?.(nextInvoice);
                    } else if (isLatestSaved) {
                      onNavigateNew?.();
                    }
                  }}
                  disabled={!canGoNext}
                  className={`w-8 h-8 flex items-center justify-center border text-[12px] font-black ${
                    canGoNext
                      ? "border-slate-200 text-slate-600 hover:text-orange-600"
                      : "border-slate-100 text-slate-300"
                  }`}
                >
                  &gt;
                </button>
              </div>
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
                disabled={isLocked}
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-400 ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
                placeholder="Search name, phone, or code..."
                value={customerSearchTerm}
                onChange={(e) => {
                  setCustomerSearchTerm(e.target.value);
                  setIsCustomerSearching(true);
                }}
                onFocus={() => setIsCustomerSearching(true)}
                onKeyDown={handleCustomerKeyDown}
              />
                {formData.customerId && !isLocked && (
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

              {isCustomerSearching && !isLocked && (
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
                  disabled={isLocked}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none ${
                    isLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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
                  disabled={isLocked}
                  className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none ${
                    isLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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
                disabled={isLocked}
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all uppercase ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
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
                disabled={isLocked}
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
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
                  <th className="px-3 py-3 w-16 text-center">Unit</th>
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
                      data-row-id={item.productId}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                        draggingId === item.productId
                          ? "bg-orange-50/60 dark:bg-orange-950/20"
                          : dropTargetId === item.productId
                          ? "bg-orange-50/40 dark:bg-orange-950/10"
                          : ""
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (draggingId && draggingId !== item.productId) {
                          setDropTargetId(item.productId);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                      }}
                      onDragEnd={() => {
                        if (draggingId && dropTargetId) {
                          reorderItem(draggingId, dropTargetId);
                        }
                        setDraggingId(null);
                        setDropTargetId(null);
                      }}
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
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                          {item.unit || "PC"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                        <input
                          id={`qty-${item.productId}`}
                          type="number"
                          disabled={isLocked}
                          className={`w-12 bg-slate-50 dark:bg-slate-800/50 rounded-md text-center font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(item.productId, "quantity", Math.max(0, parseInt(e.target.value) || 0))
                          }
                        />
                          <span className="text-[9px] font-black text-slate-400 uppercase">
                            {item.unit || "PC"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          id={`price-${item.productId}`}
                          type="number"
                          disabled={isLocked}
                          className={`w-16 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
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
                            disabled={isLocked}
                            className={`w-12 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                              isLocked ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                            value={item.discountValue || 0}
                            onChange={(e) =>
                              updateItemField(item.productId, "discountValue", Math.max(0, parseFloat(e.target.value) || 0))
                            }
                          />
                          <select
                            disabled={isLocked}
                            className={`bg-transparent text-[9px] font-black text-slate-400 ${isLocked ? "opacity-60" : ""}`}
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
                          className="w-7 h-7 mx-auto flex items-center justify-center border border-slate-200 dark:border-slate-700 rounded-md text-slate-400 cursor-grab active:cursor-grabbing select-none"
                          title="Drag to reorder"
                          draggable
                          onDragStart={(e) => {
                            setDraggingId(item.productId);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", item.productId);
                          }}
                        >
                          ⋮⋮
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(item.productId)}
                          disabled={isLocked}
                          className={`p-1 text-slate-300 transition-colors ${
                            isLocked ? "opacity-50 cursor-not-allowed" : "hover:text-rose-500"
                          }`}
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-orange-50/10 dark:bg-orange-950/10 border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 text-center">+</td>
                  <td colSpan={10} className="px-3 py-3">
                    <div className="relative z-[120]" ref={searchContainerRef}>
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search SKU or product name..."
                        disabled={isLocked}
                        className={`w-full bg-transparent outline-none text-[11px] font-black text-slate-900 dark:text-white placeholder:text-slate-400 tracking-tight ${
                          isLocked ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setIsSearching(true);
                        }}
                        onFocus={() => setIsSearching(true)}
                        onKeyDown={handleProductSearchKeyDown}
                      />

                      {isSearching && searchTerm && !isLocked && (
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
                                        <img
                                          src={p.image}
                                          alt={p.name}
                                          className="w-full h-full object-cover rounded-lg cursor-zoom-in"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setPreviewImage({ src: p.image || "", name: p.name });
                                          }}
                                        />
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
                                      Stock: {p.stockOnHand ?? p.stock} {p.unit} (Avail: {p.stockAvailable ?? p.stock})
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
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between gap-6">
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">Total Quantity</div>
                <div className="text-[9px] text-slate-400 mt-0.5">By unit</div>
              </div>
              <div className="flex items-center gap-4 flex-wrap justify-end">
                {Object.keys(totals.unitBreakdown).length > 0 ? (
                  Object.entries(totals.unitBreakdown).map(([unit, qty]) => (
                    <div key={unit} className="text-right">
                      <div className="text-2xl font-black text-orange-600 leading-none">{qty}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">{unit}</div>
                    </div>
                  ))
                ) : (
                  <div className="text-2xl font-black text-orange-600">{totals.totalQty}</div>
                )}
                <div className="text-right border-l border-slate-100 dark:border-slate-800 pl-4">
                  <div className="text-2xl font-black text-slate-900 dark:text-white leading-none">{totals.totalQty}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Total</div>
                </div>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
              <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-3">
                Internal Memo & Ledger Remarks
              </label>
              <textarea
                rows={3}
                disabled={isLocked}
                className={`w-full bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700 rounded-lg p-3 text-[10px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/5 focus:border-orange-500/20 placeholder:text-slate-400 resize-none transition-all ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
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
                  disabled={isLocked}
                  className={`w-20 bg-transparent text-right font-black text-[11px] outline-none text-rose-500 focus:border-b focus:border-rose-500 ${
                    isLocked ? "opacity-60 cursor-not-allowed" : ""
                  }`}
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
                    disabled={isLocked}
                    className={`w-20 bg-transparent text-right font-black text-[11px] outline-none text-orange-700 dark:text-orange-400 focus:border-b focus:border-orange-500 ${
                      isLocked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
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

        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 transition-colors"
          >
            Cancel
          </button>

          <div className="relative" ref={printMenuRef}>
            <div className="inline-flex">
              <button
                type="button"
                onClick={() => {
                  setIsPrintMenuOpen(false);
                  handlePrintMode("invoice");
                }}
                disabled={isLocked}
                className={`px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-l-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-orange-600 transition-colors ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setIsPrintMenuOpen((prev) => !prev)}
                disabled={isLocked}
                className={`w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-lg text-[10px] font-black text-slate-500 hover:text-orange-600 ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                ▴
              </button>
            </div>
            {isPrintMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg overflow-hidden z-[300]">
                <button
                  onClick={() => {
                    setIsPrintMenuOpen(false);
                    handlePrintMode("invoice");
                  }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Invoice
                </button>
                <button
                  onClick={() => {
                    setIsPrintMenuOpen(false);
                    handlePrintMode("receipt");
                  }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Receipt
                </button>
                <button
                  onClick={() => {
                    setIsPrintMenuOpen(false);
                    handlePrintMode("a5");
                  }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  A5
                </button>
                <button
                  onClick={() => {
                    setIsPrintMenuOpen(false);
                    handlePrintMode("token");
                  }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Product Token
                </button>
              </div>
            )}
          </div>

          <div className="relative" ref={saveMenuRef}>
            <div className="inline-flex">
              <button
                type="button"
                onClick={() => setIsSaveMenuOpen((prev) => !prev)}
                disabled={isLocked}
                className={`px-4 py-2 bg-orange-600 border border-orange-500 rounded-l-lg text-white font-black text-[10px] uppercase tracking-widest hover:bg-orange-700 transition-all ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setIsSaveMenuOpen((prev) => !prev)}
                disabled={isLocked}
                className={`w-8 h-8 flex items-center justify-center bg-orange-600 border border-l-0 border-orange-500 rounded-r-lg text-white text-[10px] font-black ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                ▴
              </button>
            </div>
            {isSaveMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl rounded-lg overflow-hidden z-[300]">
                <button
                  onClick={() => { setIsSaveMenuOpen(false); handleSubmit("Draft", true); }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Save & Edit
                </button>
                <button
                  onClick={() => { setIsSaveMenuOpen(false); handleSubmit("Pending", false); }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Save & Pending
                </button>
                <button
                  onClick={() => { setIsSaveMenuOpen(false); handleSubmit("Approved", false); }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Save & Approved
                </button>
              </div>
            )}
          </div>

          {isApproved && (
            <button
              type="button"
              onClick={() => setIsRevising(true)}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-orange-600 transition-colors"
            >
              Revise
            </button>
          )}
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

      {previewImage && (
        <div
          className="fixed inset-0 z-[10000] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 print:hidden"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 truncate pr-4">
                {previewImage.name}
              </div>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="w-8 h-8 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600"
                aria-label="Close image preview"
              >
                ✕
              </button>
            </div>
            <div className="bg-slate-50 dark:bg-slate-950/40 p-3">
              <img
                src={previewImage.src}
                alt={previewImage.name}
                className="w-full max-h-[75vh] object-contain rounded-md"
              />
            </div>
          </div>
        </div>
      )}

      <div className="invoice-print-root hidden print:block text-black bg-white">
        {printMode === "invoice" && (
          <div className="print-sheet-a4 bg-white p-6 text-black">
            <div className="text-center mb-7">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt="Company logo"
                  className="h-24 mx-auto object-contain mb-2"
                />
              ) : null}
              <div className="text-3xl leading-none mb-2">|</div>
              <h1 className="text-[40px] tracking-wide font-serif font-semibold leading-none">INVOICE</h1>
            </div>

            <div className="grid grid-cols-4 gap-4 border-b border-black/30 pb-3 mb-4">
              <div>
                <p className="text-[12px] font-semibold">Issued to:</p>
                <p className="text-[11px] mt-1">{currentCustomer?.name || "-"}</p>
                <p className="text-[11px]">{currentCustomer?.address || "-"}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold">Invoice No.</p>
                <p className="text-[11px] mt-1">{formData.id}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold">Date</p>
                <p className="text-[11px] mt-1">{formData.date}</p>
              </div>
              <div>
                <p className="text-[12px] font-semibold">Issued from:</p>
                <p className="text-[11px] mt-1">{company?.name || "Aftab Autos ERP"}</p>
                <p className="text-[11px]">{company?.address || "Pakistan"}</p>
              </div>
            </div>

            <table className="w-full border-collapse text-[12px] mb-6">
              <thead>
                <tr className="border-b border-black/50">
                  <th className="text-left py-2 font-semibold">Description</th>
                  <th className="text-right py-2 font-semibold w-24">Price</th>
                  <th className="text-right py-2 font-semibold w-20">Qty</th>
                  <th className="text-right py-2 font-semibold w-24">Total</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item) => (
                  <tr key={item.productId} className="border-b border-black/10">
                    <td className="py-2">{item.productName}</td>
                    <td className="text-right py-2">{item.unitPrice.toFixed(2)}</td>
                    <td className="text-right py-2">{item.quantity}</td>
                    <td className="text-right py-2">
                      {(item.quantity * item.unitPrice).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="grid grid-cols-2 gap-6 border-t border-black/30 pt-4">
              <div>
                <p className="text-[13px] font-semibold mb-1">Payment Method:</p>
                <p className="text-[12px]">Cash / Card</p>
                <p className="text-[11px] text-black/70 mt-6 font-semibold">Terms & Conditions:</p>
                <p className="text-[11px] leading-relaxed mt-1">
                  {formData.notes?.trim()
                    ? formData.notes
                    : "Goods once sold cannot be returned without prior approval."}
                </p>
              </div>
              <div className="text-right">
                <div className="flex justify-between text-[12px] mb-1">
                  <span>Subtotal:</span>
                  <span>{totals.itemsSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-[12px] mb-1">
                  <span>Tax (%):</span>
                  <span>0.00</span>
                </div>
                <div className="flex justify-between text-[13px] font-semibold bg-black/5 px-3 py-1.5">
                  <span>Total:</span>
                  <span>{totals.netTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
        {printMode === "receipt" && (
          <div className="receipt-print print-sheet-80mm px-1 py-2 text-[11px] leading-tight flex flex-col min-h-[250mm]">
            <div className="text-center border-b border-black pb-2 mb-2">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt="Company logo"
                  className="h-40 mx-auto object-contain mb-1"
                />
              ) : null}
              <p className="text-[18px] font-black uppercase tracking-wide">{company?.name || "AFTAB AUTOS"}</p>
              <p className="text-[10px] mt-1">{company?.address || "Main National Highway, Opp Quaid-e-Azam Park, Steel Town"}</p>
              <p className="text-[10px]">{company?.phone ? `Tel: ${company.phone}` : "Tel: 0334-3704587"}</p>
            </div>

            <div className="bg-black text-white text-center text-[12px] font-black py-1 mb-2 uppercase">
              Sale Receipt
            </div>

            <div className="space-y-1 mb-2 text-[11px]">
              <p><span className="font-semibold">Receipt No :</span> <span className="font-black">{formData.id}</span></p>
              <p><span className="font-semibold">Date :</span> <span className="font-black">{formData.date}</span></p>
              <p><span className="font-semibold">Time :</span> <span className="font-black">{new Date().toLocaleTimeString()}</span></p>
              <p><span className="font-semibold">Operator Name :</span> <span className="font-black">Administrator</span></p>
              <p><span className="font-semibold">Customer Name :</span> <span className="font-black">{currentCustomer?.name || "-"}</span></p>
              <p><span className="font-semibold">Payment Type :</span> <span className="font-black">{(formData.amountReceived || 0) > 0 ? "Cash/Card" : "-"}</span></p>
            </div>

            <table className="w-full text-[10px] border-y border-black mb-2">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-1 font-black">Description</th>
                  <th className="text-right py-1 font-black w-10">Qty</th>
                  <th className="text-right py-1 font-black w-12">Price</th>
                  <th className="text-right py-1 font-black w-10">Dis</th>
                  <th className="text-right py-1 font-black w-12">Total</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item) => {
                  const gross = item.quantity * item.unitPrice;
                  const lineDiscount = item.discountType === "percent"
                    ? (gross * (item.discountValue || 0)) / 100
                    : (item.discountValue || 0);
                  const lineNet = gross - lineDiscount;
                  return (
                    <React.Fragment key={item.productId}>
                      <tr className="border-b border-black/20">
                        <td className="py-1 font-semibold" colSpan={5}>{item.productName}</td>
                      </tr>
                      <tr className="border-b border-black/20">
                        <td className="py-1" />
                        <td className="text-right py-1">{item.quantity}</td>
                        <td className="text-right py-1">{item.unitPrice.toFixed(0)}</td>
                        <td className="text-right py-1">{lineDiscount.toFixed(0)}</td>
                        <td className="text-right py-1">{lineNet.toFixed(0)}</td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            <div className="flex justify-between text-[11px] border-b border-black pb-1 mb-1">
              <span>Item(s) {formData.items.length}</span>
              <span>Total Qty {totals.totalQty.toFixed(2)}</span>
            </div>

            <div className="space-y-1 text-[12px]">
              <p className="flex justify-end gap-1"><span className="font-semibold">Gross Total :</span><span className="font-black min-w-[70px] text-right">{totals.itemsSubtotal.toFixed(2)}</span></p>
              <p className="flex justify-end gap-1"><span className="font-semibold">Discount :</span><span className="font-black min-w-[70px] text-right">{(formData.overallDiscount || 0).toFixed(2)}</span></p>
              <p className="text-[14px] border-t border-black pt-1 flex justify-end gap-1"><span className="font-black">Net Total PKR :</span><span className="font-black min-w-[70px] text-right">{totals.netTotal.toFixed(2)}</span></p>
              <p className="flex justify-end gap-1"><span className="font-semibold">Amount Received :</span><span className="font-black min-w-[70px] text-right">{(formData.amountReceived || 0).toFixed(2)}</span></p>
              <p className="flex justify-end gap-1"><span className="font-semibold">Cash Back PKR :</span><span className="font-black min-w-[70px] text-right">{Math.max(0, totals.balanceDue * -1).toFixed(2)}</span></p>
            </div>

            <div className="mt-2 border-t border-b border-black py-1">
              <svg
                className="w-[58%] h-12 block mx-auto"
                viewBox={`0 0 ${buildReceiptBarcodePattern(formData.id).length} 48`}
                preserveAspectRatio="none"
                aria-label="Receipt barcode"
              >
                {buildReceiptBarcodePattern(formData.id)
                  .split("")
                  .map((bit, idx) =>
                    bit === "1" ? <rect key={`${formData.id}-bar-${idx}`} x={idx} y={0} width={1} height={48} fill="black" /> : null
                  )}
              </svg>
              <p className="text-center text-[10px] tracking-[0.2em] mt-1 font-semibold">{formData.id}</p>
            </div>

            <div className="mt-0 pt-0">
              <p className="text-center font-black tracking-wide">*Thanks For Your Visit*</p>
            </div>
          </div>
        )}
        {printMode === "a5" && (
          <div className="max-w-[148mm] mx-auto p-5 text-sm">
            <div className="flex justify-between border-b border-black pb-2 mb-3">
              <h1 className="font-black">A5 Invoice</h1>
              <span>{formData.id}</span>
            </div>
            <p>Customer: {currentCustomer?.name || "-"}</p>
            <p>Date: {formData.date}</p>
            <table className="w-full mt-3 text-[11px]">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left">Product</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item) => (
                  <tr key={item.productId}>
                    <td>{item.productName}</td>
                    <td className="text-right">{item.quantity}</td>
                    <td className="text-right">{(item.quantity * item.unitPrice).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {printMode === "token" && (
          <div className="p-4">
            <div className="max-w-[80mm] mx-auto border-2 border-black p-3">
              <div className="flex justify-between border-b border-black pb-1 mb-2">
                <span className="font-black text-sm">PRODUCT TOKEN</span>
                <span className="text-xs">{formData.id}</span>
              </div>
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b border-black">
                    <th className="text-left py-1 font-black">Product</th>
                    <th className="text-left py-1 font-black">Code</th>
                    <th className="text-right py-1 font-black">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(printItems.length > 0 ? printItems : formData.items).map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`} className="border-b border-black/20">
                      <td className="py-1">{item.productName}</td>
                      <td className="py-1">{item.productCode || "-"}</td>
                      <td className="text-right py-1 font-black">{item.quantity} {item.unit || "PC"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-[10px] mt-2">Total Items: {(printItems.length > 0 ? printItems : formData.items).length}</p>
            </div>
          </div>
        )}
      </div>
      <style>{`
        @media print {
          @page {
            margin: 0;
            size: auto;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body * {
            visibility: hidden !important;
          }
          .invoice-print-root,
          .invoice-print-root * {
            visibility: visible !important;
          }
          .invoice-print-root {
            position: fixed !important;
            inset: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
            overflow: hidden !important;
            background: #fff !important;
            z-index: 999999 !important;
          }
          .print-sheet-a4 {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #fff !important;
            page-break-after: always;
          }
          .print-sheet-80mm {
            width: 72mm !important;
            margin: 0 !important;
            box-sizing: border-box !important;
            background: #fff !important;
          }
        }
      `}</style>
    </div>
  );
};

export default SalesInvoiceFormPage;
