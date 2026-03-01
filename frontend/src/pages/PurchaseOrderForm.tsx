
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiMove } from "react-icons/fi";
import type { Company, Customer, Product, SalesInvoice, SalesInvoiceItem, Vendor } from "../types";
import { getPrintTemplateSettings } from "../services/printSettings";
import { getEmbeddedInvoicePrintCss, normalizePrintMode } from "../services/printEngine";

interface PurchaseOrderFormPageProps {
  invoice?: SalesInvoice;
  forceNewMode?: boolean;
  invoices: SalesInvoice[];
  products: Product[];
  vendors: Vendor[];
  company?: Company;
  onBack: () => void;
  onSave: (
    invoice: SalesInvoice,
    stayOnPage: boolean,
    savePrices: boolean,
    salesPriceUpdates?: Record<string, number>
  ) => void;
  onConvertToPurchaseInvoice?: (invoice: SalesInvoice) => void;
  onNavigate?: (invoice: SalesInvoice) => void;
  onNavigateNew?: () => void;
  formTitleNew?: string;
  formTitleEdit?: string;
}

type PrintMode = "invoice" | "receipt" | "a5" | "token" | "list";
type ProductPackagingOption = {
  id: string;
  name: string;
  urduName?: string;
  code?: string;
  displayName?: string;
  displayCode?: string;
  factor: number;
  salePrice?: number;
  costPrice?: number;
  isDefault?: boolean;
  isActive?: boolean;
};
type ProductSearchOption = {
  product: Product;
  packaging: ProductPackagingOption;
  searchLabel: string;
  searchCode: string;
  searchStr: string;
};

const formatDateDdMmYyyy = (value: string) => {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(value || "");
};

const parseDdMmYyyyToIso = (value: string) => {
  const m = String(value || "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getUTCFullYear() !== yyyy || dt.getUTCMonth() + 1 !== mm || dt.getUTCDate() !== dd) return null;
  return iso;
};

const PurchaseOrderFormPage: React.FC<PurchaseOrderFormPageProps> = ({
  invoice,
  forceNewMode = false,
  invoices,
  products,
  vendors,
  company,
  onBack,
  onSave,
  onConvertToPurchaseInvoice,
  onNavigate,
  onNavigateNew,
  formTitleNew = "New Purchase Order",
  formTitleEdit = "Edit Purchase Order",
}) => {
  const idPrefix = "PO";
  const partyLabel = "Vendor Account";
  const partySearchPlaceholder = "Search vendor name, phone, or code...";
  const partyEmptyText = "No vendors found";
  const partyCodeLabel = "Vendor";
  const isEdit = !!invoice && !forceNewMode;
  const isPurchaseMode = true;

  const customers = useMemo<Customer[]>(
    () =>
      vendors.map((v) => ({
        id: String(v.id),
        name: v.name,
        customerCode: v.vendorCode || "",
        phone: v.phone || "",
        email: v.email || "",
      })),
    [vendors]
  );

  const formatInvoiceId = (num: number) => `${idPrefix}-${String(num).padStart(6, "0")}`;
  const getInvoiceNumber = (id?: string) => {
    if (!id) return -1;
    const match = id.match(new RegExp(`^${idPrefix}-(\\d{6})$`));
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
    customerId: invoice?.customerId ? String(invoice.customerId) : "",
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
    amountReceived: 0,
    items: (invoice?.items || []) as SalesInvoiceItem[],
  });
  const [dateText, setDateText] = useState(formatDateDdMmYyyy(invoice?.date || new Date().toISOString().split("T")[0]));
  const [dueDateText, setDueDateText] = useState(
    formatDateDdMmYyyy(
      invoice?.dueDate ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    )
  );

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
  const [printMode, setPrintMode] = useState<PrintMode>("invoice");
  const [printItems, setPrintItems] = useState<SalesInvoiceItem[]>([]);
  const [printSettings, setPrintSettings] = useState(() => getPrintTemplateSettings());
  const defaultPrintMode = normalizePrintMode(printSettings.defaultTemplate, "invoice");
  const [previewImage, setPreviewImage] = useState<{ src: string; name: string } | null>(null);
  const [salesPriceByProductId, setSalesPriceByProductId] = useState<Record<string, number>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const COPY_SEED_KEY = "purchase-order-copy-seed";
  const createLineId = () => `tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const rowKeyOf = (item: SalesInvoiceItem) => String((item as any).id ?? item.productId);

  const customerInputRef = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);
  const dueDateInputRef = useRef<HTMLInputElement>(null);
  const datePickerProxyRef = useRef<HTMLInputElement>(null);
  const dueDatePickerProxyRef = useRef<HTMLInputElement>(null);
  const vehicleInputRef = useRef<HTMLInputElement>(null);
  const refInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const overallDiscRef = useRef<HTMLInputElement>(null);

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const productListContainerRef = useRef<HTMLDivElement>(null);
  const productItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const customerSearchContainerRef = useRef<HTMLDivElement>(null);
  const saveMenuRef = useRef<HTMLDivElement>(null);
  const printMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPrintSettings(getPrintTemplateSettings());
  }, []);

  useEffect(() => {
    setDateText(formatDateDdMmYyyy(formData.date));
  }, [formData.date]);

  useEffect(() => {
    setDueDateText(formatDateDdMmYyyy(formData.dueDate));
  }, [formData.dueDate]);

  const getPrintableProductLabel = (item: SalesInvoiceItem) => {
    const english = String(item.productName || "").trim();
    const matched = products.find((p) => String(p.id) === String(item.productId));
    const description = String(item.description ?? (matched as any)?.description ?? "").trim();
    if (!printSettings.showUrduName && !description) return english;
    const matchedPack = Array.isArray((matched as any)?.packagings)
      ? (matched as any).packagings.find(
          (pk: any) => String(pk?.id ?? "") === String((item as any)?.packagingId ?? "")
        )
      : null;
    const urdu = String((matchedPack as any)?.urduName || (matched as any)?.urduName || "").trim();
    if (!urdu && !description) return english;
    return (
      <span className="inline-flex flex-col gap-0.5">
        <span>{english}</span>
        {description ? <span className="text-[10px] leading-tight">{description}</span> : null}
        {urdu ? (
          <span dir="rtl" className="font-urdu text-right">
            {urdu}
          </span>
        ) : null}
      </span>
    );
  };

  const getProductDescription = (item: SalesInvoiceItem) => {
    return String(item.description ?? "").trim();
  };

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

  const getProductPackagingOptions = (product: Product): ProductPackagingOption[] => {
    const rows = Array.isArray((product as any)?.packagings) ? (product as any).packagings : [];
    const mapped = rows
      .map((row: any) => ({
        id: String(row.id ?? ""),
        name: String(row.name ?? "").trim(),
        urduName: String(row.urduName ?? row.urdu_name ?? "").trim(),
        code: String(row.code ?? "").trim(),
        displayName: String(row.displayName ?? row.display_name ?? "").trim(),
        displayCode: String(row.displayCode ?? row.display_code ?? "").trim(),
        factor: Number(row.factor ?? 1),
        salePrice: Number(row.salePrice ?? row.sale_price ?? product.price ?? 0),
        costPrice: Number(row.costPrice ?? row.cost_price ?? product.costPrice ?? 0),
        isDefault: Boolean(row.isDefault ?? row.is_default),
        isActive: (row.isActive ?? row.is_active ?? true) !== false,
      }))
      .filter((row: ProductPackagingOption) => row.id && row.name && Number.isFinite(row.factor) && row.factor > 0 && row.isActive !== false);
    const baseDefault: ProductPackagingOption = {
      id: "",
      name: String(product.unit || "Piece"),
      code: String(product.productCode || "").trim(),
      factor: 1,
      salePrice: Number(product.price ?? 0),
      costPrice: Number(product.costPrice ?? 0),
      isDefault: true,
    };
    if (mapped.length > 0) {
      return [baseDefault, ...mapped];
    }
    return [baseDefault];
  };

  const getDefaultPackaging = (product: Product): ProductPackagingOption => {
    const options = getProductPackagingOptions(product);
    return options.find((x) => x.isDefault) || options[0];
  };

  const searchableProducts = useMemo(() => {
    const rows: ProductSearchOption[] = [];
    products.forEach((product) => {
      getProductPackagingOptions(product).forEach((packaging) => {
        const searchLabel = packaging.displayName || product.name;
        const searchCode = packaging.isDefault
          ? product.productCode || ""
          : packaging.code || product.productCode || "";
        rows.push({
          product,
          packaging,
          searchLabel,
          searchCode,
          searchStr: `${searchLabel} ${searchCode} ${packaging.name || ""} ${product.name} ${product.productCode || ""} ${product.brandName || ""} ${product.category || ""} ${product.barcode || ""} ${product.id}`.toLowerCase(),
        });
      });
    });
    return rows;
  }, [products]);

  const availableProducts = useMemo(() => {
    const query = searchTerm.toLowerCase().trim();
    if (!query) return [];
    const keywords = query.split(/\s+/);
    return searchableProducts
      .filter((item) => keywords.every((kw) => item.searchStr.includes(kw)))
      .sort((a, b) => {
        const aStarts = a.searchLabel.toLowerCase().startsWith(query);
        const bStarts = b.searchLabel.toLowerCase().startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (bStarts && !aStarts) return 1;
        return a.searchLabel.localeCompare(b.searchLabel);
      })
      .slice(0, 30);
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
    return { itemsSubtotal, netTotal, totalQty, unitBreakdown };
  }, [formData.items, formData.overallDiscount]);

  const handleAddItem = (choice: ProductSearchOption) => {
    const product = choice.product;
    const selectedPackaging = choice.packaging || getDefaultPackaging(product);
    const selectedName = choice.searchLabel || product.name;
    const selectedCode = choice.searchCode || product.productCode;
    const sourceUnitPrice = isPurchaseMode
      ? selectedPackaging.costPrice ?? product.costPrice
      : selectedPackaging.salePrice ?? product.price;
    const rawUnitPrice =
      typeof sourceUnitPrice === "string" ? sourceUnitPrice : `${sourceUnitPrice ?? 0}`;
    const cleanUnitPrice = rawUnitPrice.replace(/Rs\./i, "").replace(/,/g, "").trim();
    const unitPrice = parseFloat(cleanUnitPrice) || 0;

    const newItem: SalesInvoiceItem = {
      id: createLineId(),
      productId: product.id,
      productCode: selectedCode,
      productName: selectedName,
      description: String((product as any)?.description || "").trim(),
      unit: selectedPackaging.name || product.unit,
      quantity: 1,
      packagingId: selectedPackaging.id || undefined,
      packagingName: selectedPackaging.name,
      packFactor: Number(selectedPackaging.factor || 1),
      qtyPack: 1,
      qtyBase: Number(selectedPackaging.factor || 1),
      unitPrice: unitPrice,
      tax: 0,
      discountValue: 0,
      discountType: "fixed",
      total: unitPrice,
    };
    setFormData({ ...formData, items: [...formData.items, newItem] });

    if (isPurchaseMode) {
      const rawSalesPrice = typeof product.price === "string" ? product.price : `${product.price ?? 0}`;
      const cleanSalesPrice = rawSalesPrice.replace(/Rs\./i, "").replace(/,/g, "").trim();
      const parsedSalesPrice = parseFloat(cleanSalesPrice) || 0;
      setSalesPriceByProductId((prev) => ({ ...prev, [String(product.id)]: parsedSalesPrice }));
    }

    setSearchTerm("");
    setIsSearching(false);
    setSelectedIndex(0);

    requestAnimationFrame(() => {
      const qtyInput = document.getElementById(`qty-${(newItem as any).id}`) as HTMLInputElement;
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
      items: formData.items.map((i) => {
        if (rowKeyOf(i) !== id) return i;
        if (field === "quantity") {
          const qtyPack = Number(value || 0);
          const factor = Number(i.packFactor || 1);
          return { ...i, quantity: qtyPack, qtyPack, qtyBase: qtyPack * factor };
        }
        if (field === "packagingId") {
          const product = products.find((p) => String(p.id) === String(i.productId));
          if (!product) return { ...i, packagingId: value as string };
          const options = getProductPackagingOptions(product);
          const selected = options.find((p) => p.id === String(value)) || options[0];
          const qtyPack = Number(i.qtyPack ?? i.quantity ?? 0);
          const factor = Number(selected?.factor || 1);
          return {
            ...i,
            packagingId: selected?.id || undefined,
            packagingName: selected?.name,
            packFactor: factor,
            qtyPack,
            quantity: qtyPack,
            qtyBase: qtyPack * factor,
            unitPrice:
              selected && isPurchaseMode && selected.costPrice != null && Number.isFinite(Number(selected.costPrice))
                ? Number(selected.costPrice)
                : selected?.salePrice != null && Number.isFinite(Number(selected.salePrice))
                ? Number(selected.salePrice)
                : i.unitPrice,
          };
        }
        return { ...i, [field]: value };
      }),
    });
  };

  const reorderItem = (dragId: string, dropId: string) => {
    if (!dragId || dragId === dropId) return;
    const fromIndex = formData.items.findIndex((i) => rowKeyOf(i) === dragId);
    const toIndex = formData.items.findIndex((i) => rowKeyOf(i) === dropId);
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
      setSelectedItemIds(new Set(formData.items.map((i) => rowKeyOf(i))));
    }
  };

  const handleRemoveItem = (id: string) => {
    setFormData({
      ...formData,
      items: formData.items.filter((i) => rowKeyOf(i) !== id),
    });
    if (selectedItemIds.has(id)) {
      const next = new Set(selectedItemIds);
      next.delete(id);
      setSelectedItemIds(next);
    }
    if (isPurchaseMode) {
      setSalesPriceByProductId((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleDeleteSelected = () => {
    if (selectedItemIds.size === 0) return;
    setFormData({
      ...formData,
      items: formData.items.filter((i) => !selectedItemIds.has(rowKeyOf(i))),
    });
    if (isPurchaseMode) {
      setSalesPriceByProductId((prev) => {
        const next = { ...prev };
        selectedItemIds.forEach((id) => {
          delete next[id];
        });
        return next;
      });
    }
    setSelectedItemIds(new Set());
  };

  const handlePrintSelected = () => {
    if (selectedItemIds.size === 0) return;
    const selected = formData.items.filter((i) => selectedItemIds.has(rowKeyOf(i)));
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

  const computePaymentStatus = () => "Unpaid";

  const isApproved = formData.status === "Approved";
  const isPending = formData.status === "Pending";
  const isVoid = formData.status === "Void";
  const isDeleted = formData.status === "Deleted";
  const isLocked = (isApproved && !isRevising) || isVoid || isDeleted;
  const canVoid = isEdit && (formData.status === "Pending" || formData.status === "Approved");
  const canCopy = isEdit && (isVoid || isDeleted);

  const handleSubmit = (status: string, stayOnPage: boolean = false) => {
    if (!formData.customerId) {
      setFormError(`Required: Please select a ${partyLabel}.`);
      customerInputRef.current?.focus();
      return;
    }

    if (formData.items.length === 0) {
      setFormError("Empty invoice: Add at least one item.");
      searchInputRef.current?.focus();
      return;
    }

    const zeroQtyItems = formData.items.filter((item) => item.quantity <= 0);
    if (zeroQtyItems.length > 0) {
      setFormError("Invalid quantity: There are items with 0 qty.");
      const firstInvalidId = zeroQtyItems[0].productId;
      const qtyInput = document.getElementById(`qty-${firstInvalidId}`) as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
      }
      return;
    }

    const customer = customers.find((c) => String(c.id) === String(formData.customerId));
    const finalPaymentStatus = computePaymentStatus();
    const finalStatus = status === "Draft" ? "Draft" : status;
    const invoiceData: SalesInvoice = {
      ...formData,
      amountReceived: 0,
      status: finalStatus,
      paymentStatus: finalPaymentStatus,
      customerName: customer?.name || "Unknown",
      totalAmount: totals.netTotal,
    };
    onSave(invoiceData, stayOnPage, false, isPurchaseMode ? salesPriceByProductId : undefined);
  };

  const handleVoid = () => {
    if (!canVoid) return;
    const confirmed = window.confirm(
      `Void purchase order ${formData.id}? This will reverse stock effect and keep document for audit.`
    );
    if (!confirmed) return;
    handleSubmit("Void", true);
  };

  const handleReviseAction = () => {
    if (!isApproved) return;
    if (!isRevising) {
      setIsRevising(true);
      return;
    }
    handleSubmit("Approved", true);
    setIsRevising(false);
  };

  const handleCopyInvoice = () => {
    if (!canCopy) return;
    const today = new Date().toISOString().split("T")[0];
    const copySeed = {
      ...formData,
      id: nextInvoiceId,
      status: "Draft",
      paymentStatus: "Unpaid",
      amountReceived: 0,
      date: today,
      dueDate: today,
    };
    try {
      window.sessionStorage.setItem(COPY_SEED_KEY, JSON.stringify(copySeed));
    } catch {
      // Ignore session storage errors
    }
    onNavigateNew?.();
  };

  const handleConvertToPurchaseInvoice = () => {
    if (!isApproved) return;
    const customer = customers.find((c) => String(c.id) === String(formData.customerId));
    const draftInvoice: SalesInvoice = {
      ...formData,
      status: "Draft",
      paymentStatus: "Unpaid",
      amountReceived: 0,
      customerName: customer?.name || "Unknown",
      totalAmount: totals.netTotal,
    };
    onConvertToPurchaseInvoice?.(draftInvoice);
  };

  const currentCustomer = useMemo(() => {
    return customers.find((c) => String(c.id) === String(formData.customerId));
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
        customerId: invoice.customerId ? String(invoice.customerId) : "",
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
        amountReceived: 0,
        items: (invoice.items || []) as SalesInvoiceItem[],
      });
      return;
    }
  }, [invoice]);

  useEffect(() => {
    if (invoice) return;
    try {
      const rawSeed = window.sessionStorage.getItem(COPY_SEED_KEY);
      if (!rawSeed) return;
      window.sessionStorage.removeItem(COPY_SEED_KEY);
      const parsedSeed = JSON.parse(rawSeed);
      setFormData((prev) => ({
        ...prev,
        ...parsedSeed,
        id: nextInvoiceId,
        status: "Draft",
        paymentStatus: "Unpaid",
        amountReceived: 0,
      }));
    } catch {
      // Ignore seed parse/storage errors
    }
  }, [invoice, nextInvoiceId]);

  useEffect(() => {
    if (!isPurchaseMode) return;
    const nextSalesPriceMap: Record<string, number> = {};
    formData.items.forEach((item) => {
      const product = products.find((p) => String(p.id) === String(item.productId));
      if (!product) return;
      const rawSalesPrice = typeof product.price === "string" ? product.price : `${product.price ?? 0}`;
      const cleanSalesPrice = rawSalesPrice.replace(/Rs\./i, "").replace(/,/g, "").trim();
      nextSalesPriceMap[String(item.productId)] = parseFloat(cleanSalesPrice) || 0;
    });
    setSalesPriceByProductId(nextSalesPriceMap);
  }, [isPurchaseMode, formData.items, products]);

  useEffect(() => {
    if (!invoice && formData.id !== nextInvoiceId) {
      setFormData((prev) => ({ ...prev, id: nextInvoiceId }));
    }
  }, [invoice, nextInvoiceId, formData.id]);

  useEffect(() => {
    if (!formError) return;
    const timer = window.setTimeout(() => setFormError(null), 4500);
    return () => window.clearTimeout(timer);
  }, [formError]);

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

  const preventNumberWheelStep = (e: React.WheelEvent) => {
    const target = e.target as HTMLInputElement | null;
    if (!target || target.tagName !== "INPUT" || target.type !== "number") return;
    target.blur();
    e.preventDefault();
  };

  const preventNumberArrowStep = (e: React.KeyboardEvent) => {
    const target = e.target as HTMLInputElement | null;
    if (!target || target.tagName !== "INPUT" || target.type !== "number") return;
    if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  };

  return (
    <div
      className="invoice-editor-root max-w-7xl mx-auto animate-in fade-in duration-300 pb-12 relative"
      onWheelCapture={preventNumberWheelStep}
      onKeyDownCapture={preventNumberArrowStep}
    >
      {formError && (
        <div className="fixed top-20 right-6 z-[12000] max-w-md w-full">
          <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 shadow-2xl rounded-2xl overflow-hidden">
            <div className="h-1.5 bg-rose-600" />
            <div className="p-4 flex items-start gap-3">
              <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center text-xs font-black">
                !
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">
                  Validation Error
                </p>
                <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 break-words">{formError}</p>
              </div>
              <button
                onClick={() => setFormError(null)}
                className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 text-sm"
                aria-label="Dismiss validation popup"
              >
                ×
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm transition-all active:scale-95"
          >
            <span className="text-lg">?</span>
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
          <span
            className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest border ${
              formData.status === "Draft"
                ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800"
                : formData.status === "Void"
                ? "bg-rose-50 text-rose-700 border-rose-100 dark:bg-rose-900/20"
                : formData.status === "Deleted"
                ? "bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-700 dark:text-slate-200"
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
        <div
          className={`bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-20 space-y-6 transition-all ${
            isLocked ? "blur-[1.2px] opacity-75" : ""
          }`}
        >
          {(isApproved || isPending || isVoid || isDeleted) && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`text-[56px] sm:text-[72px] font-black uppercase tracking-[0.2em] rotate-[-12deg] ${
                  isDeleted
                    ? "text-slate-600/20"
                    : isVoid
                    ? "text-rose-600/15"
                    : isPending
                    ? "text-amber-600/15"
                    : "text-emerald-600/15"
                }`}
              >
                {isDeleted ? "Void Deleted" : isVoid ? "Void" : isPending ? "Pending" : "Approved"}
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
                placeholder={`${idPrefix}-000001`}
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
                {partyLabel}
              </label>
              <div className="relative group">
              <input
                ref={customerInputRef}
                type="text"
                disabled={isLocked}
                className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 text-[11px] font-bold dark:text-white outline-none focus:ring-4 focus:ring-orange-500/10 transition-all placeholder:text-slate-400 ${
                  isLocked ? "opacity-60 cursor-not-allowed" : ""
                }`}
                placeholder={partySearchPlaceholder}
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
                    x
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
                                {partyCodeLabel}: {c.customerCode || "N/A"}
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
                        <p className="text-[10px] font-bold text-slate-400">{partyEmptyText}</p>
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
                <div className="relative">
                  <input
                    ref={dateInputRef}
                    type="text"
                    disabled={isLocked}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 pr-9 text-[11px] font-bold dark:text-white outline-none ${
                      isLocked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder="dd/mm/yyyy"
                    value={dateText}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDateText(raw);
                      const iso = parseDdMmYyyyToIso(raw);
                      if (iso) setFormData({ ...formData, date: iso });
                    }}
                    onBlur={() => setDateText(formatDateDdMmYyyy(formData.date))}
                    onKeyDown={(e) => onEnterMoveTo(e, dueDateInputRef)}
                  />
                  <input
                    ref={datePickerProxyRef}
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    className="absolute -z-10 h-0 w-0 opacity-0"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      const picker = datePickerProxyRef.current as any;
                      if (!picker) return;
                      if (typeof picker.showPicker === "function") picker.showPicker();
                      else picker.click();
                    }}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-orange-600 disabled:opacity-40"
                    title="Open calendar"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-900 dark:text-slate-100 tracking-tight mb-2">
                  Due Date
                </label>
                <div className="relative">
                  <input
                    ref={dueDateInputRef}
                    type="text"
                    disabled={isLocked}
                    className={`w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-2 px-3 pr-9 text-[11px] font-bold dark:text-white outline-none ${
                      isLocked ? "opacity-60 cursor-not-allowed" : ""
                    }`}
                    placeholder="dd/mm/yyyy"
                    value={dueDateText}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setDueDateText(raw);
                      const iso = parseDdMmYyyyToIso(raw);
                      if (iso) setFormData({ ...formData, dueDate: iso });
                    }}
                    onBlur={() => setDueDateText(formatDateDdMmYyyy(formData.dueDate))}
                    onKeyDown={(e) => onEnterMoveTo(e, vehicleInputRef)}
                  />
                  <input
                    ref={dueDatePickerProxyRef}
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="absolute -z-10 h-0 w-0 opacity-0"
                    tabIndex={-1}
                  />
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() => {
                      const picker = dueDatePickerProxyRef.current as any;
                      if (!picker) return;
                      if (typeof picker.showPicker === "function") picker.showPicker();
                      else picker.click();
                    }}
                    className="absolute inset-y-0 right-2 flex items-center text-slate-500 hover:text-orange-600 disabled:opacity-40"
                    title="Open calendar"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>
                  </button>
                </div>
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

        <div
          className={`bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm relative z-10 overflow-visible transition-all ${
            isLocked ? "blur-[1.2px] opacity-75" : ""
          }`}
        >
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
                        <span className="text-white text-[8px]">?</span>
                      )}
                    </button>
                  </th>
                  <th className="px-3 py-3 w-8 text-center">#</th>
                  <th className="px-3 py-3 w-20">Code</th>
                  <th className="px-3 py-3">Product</th>
                  <th className="px-3 py-3 w-16 text-center">Unit</th>
                  <th className="px-3 py-3 w-16 text-center">Qty</th>
                  <th className="px-3 py-3 w-24 text-right">{isPurchaseMode ? "Unit Cost" : "Unit Price"}</th>
                  {isPurchaseMode && <th className="px-3 py-3 w-24 text-right">Sales Price</th>}
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
                      key={rowKeyOf(item)}
                      data-row-id={rowKeyOf(item)}
                      className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 ${
                        draggingId === rowKeyOf(item)
                          ? "bg-orange-50/60 dark:bg-orange-950/20"
                          : dropTargetId === rowKeyOf(item)
                          ? "bg-orange-50/40 dark:bg-orange-950/10"
                          : ""
                      }`}
                      onDragEnter={(e) => {
                        e.preventDefault();
                        if (draggingId && draggingId !== rowKeyOf(item)) {
                          setDropTargetId(rowKeyOf(item));
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
                          onClick={() => toggleSelectItem(rowKeyOf(item))}
                          className={`w-4 h-4 rounded border flex items-center justify-center mx-auto ${
                            selectedItemIds.has(rowKeyOf(item))
                              ? "bg-orange-600 border-orange-600"
                              : "border-slate-300 dark:border-slate-600"
                          }`}
                        >
                          {selectedItemIds.has(rowKeyOf(item)) && (
                            <span className="text-white text-[8px]">?</span>
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
                        <input
                          type="text"
                          disabled={isLocked}
                          className={`mt-1 w-full rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-[9px] text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-400 ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          placeholder="Description"
                          value={getProductDescription(item)}
                          onChange={(e) => updateItemField(rowKeyOf(item), "description", e.target.value)}
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase">
                          {item.unit || "PC"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                        <input
                          id={`qty-${rowKeyOf(item)}`}
                          type="number"
                          step="0.001"
                          disabled={isLocked}
                          className={`w-12 bg-slate-50 dark:bg-slate-800/50 rounded-md text-center font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemField(rowKeyOf(item), "quantity", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                        />
                          <span className="text-[9px] font-black text-slate-400 uppercase">
                            {item.unit || "PC"}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <input
                          id={`price-${rowKeyOf(item)}`}
                          type="number"
                          disabled={isLocked}
                          className={`w-16 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                            isLocked ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateItemField(rowKeyOf(item), "unitPrice", Math.max(0, parseFloat(e.target.value) || 0))
                          }
                        />
                      </td>
                      {isPurchaseMode && (
                        <td className="px-3 py-2 text-right">
                          <input
                            id={`sale-price-${item.productId}`}
                            type="number"
                            disabled={isLocked}
                            className={`w-16 bg-slate-50 dark:bg-slate-800/50 rounded-md text-right font-black text-[10px] focus:outline-none dark:text-white border border-transparent focus:border-orange-500 py-1 transition-all ${
                              isLocked ? "opacity-60 cursor-not-allowed" : ""
                            }`}
                            value={salesPriceByProductId[String(item.productId)] ?? 0}
                            onChange={(e) =>
                              setSalesPriceByProductId((prev) => ({
                                ...prev,
                                [String(item.productId)]: Math.max(0, parseFloat(e.target.value) || 0),
                              }))
                            }
                          />
                        </td>
                      )}
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
                              updateItemField(rowKeyOf(item), "discountValue", Math.max(0, parseFloat(e.target.value) || 0))
                            }
                          />
                          <select
                            disabled={isLocked}
                            className={`bg-transparent text-[9px] font-black text-slate-400 ${isLocked ? "opacity-60" : ""}`}
                            value={item.discountType}
                            onChange={(e) => updateItemField(rowKeyOf(item), "discountType", e.target.value as any)}
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
                            setDraggingId(rowKeyOf(item));
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.setData("text/plain", rowKeyOf(item));
                          }}
                        >
                          <FiMove size={13} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          onClick={() => handleRemoveItem(rowKeyOf(item))}
                          disabled={isLocked}
                          className={`p-1 text-slate-300 transition-colors ${
                            isLocked ? "opacity-50 cursor-not-allowed" : "hover:text-rose-500"
                          }`}
                        >
                          x
                        </button>
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-orange-50/10 dark:bg-orange-950/10 border-t border-slate-200 dark:border-slate-700">
                  <td className="px-4 py-3 text-center">+</td>
                  <td colSpan={isPurchaseMode ? 11 : 10} className="px-3 py-3">
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
                              availableProducts.map((option, idx) => {
                                const p = option.product;
                                const pack = option.packaging;
                                return (
                                <button
                                  key={`${p.id}-${pack.id || pack.name}-${idx}`}
                                  ref={(el) => {
                                    productItemRefs.current[idx] = el;
                                  }}
                                  onClick={() => handleAddItem(option)}
                                  onMouseEnter={() => setSelectedIndex(idx)}
                                  className={`w-full text-left px-4 py-3 flex items-center justify-between transition-all ${
                                    selectedIndex === idx ? "bg-orange-600 text-white" : "hover:bg-slate-50 dark:hover:bg-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className={`relative group/image w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black ${
                                      selectedIndex === idx ? "bg-white/20" : "bg-slate-100 dark:bg-slate-800"
                                    }`}>
                                      {p.image ? (
                                        <>
                                          <img
                                            src={p.image}
                                            alt={option.searchLabel}
                                            className="w-full h-full object-cover rounded-lg cursor-pointer transition-transform duration-200 group-hover/image:scale-105"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setPreviewImage({ src: p.image || "", name: option.searchLabel });
                                            }}
                                          />
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setPreviewImage({ src: p.image || "", name: option.searchLabel });
                                            }}
                                            className="absolute bottom-0.5 right-0.5 w-5 h-5 rounded-md bg-white/90 text-slate-800 border border-slate-200 shadow-sm opacity-0 group-hover/image:opacity-100 transition-all flex items-center justify-center"
                                            title="View image"
                                            aria-label="View image"
                                          >
                                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                              <circle cx="11" cy="11" r="6" />
                                              <path d="m20 20-3.5-3.5" />
                                              <path d="M11 8v6M8 11h6" />
                                            </svg>
                                          </button>
                                        </>
                                      ) : (
                                        "PR"
                                      )}
                                    </div>
                                    <div>
                                      <div className={`text-[11px] font-black uppercase tracking-tight ${
                                        selectedIndex === idx ? "text-white" : "text-slate-900 dark:text-white"
                                      }`}>{option.searchLabel}</div>
                                      <div className={`text-[9px] ${
                                        selectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                      }`}>
                                        SKU: {option.searchCode || p.id} • Unit: {pack.name || p.unit}
                                      </div>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <div className={`text-[10px] font-black ${
                                      selectedIndex === idx ? "text-white" : "text-orange-600"
                                    }`}>
                                      {isPurchaseMode ? (pack.costPrice ?? p.costPrice) : (pack.salePrice ?? p.price)}
                                    </div>
                                    <div className={`text-[9px] ${
                                      selectedIndex === idx ? "text-orange-100" : "text-slate-400"
                                    }`}>
                                      Stock: {p.stockOnHand ?? p.stock} {p.unit} (Avail: {p.stockAvailable ?? p.stock})
                                    </div>
                                  </div>
                                </button>
                              )})
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

        <div
          className={`grid grid-cols-1 lg:grid-cols-3 gap-4 relative z-0 transition-all ${
            isLocked ? "blur-[1.2px] opacity-75" : ""
          }`}
        >
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

          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-6">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-rose-600 transition-colors"
          >
            Cancel
          </button>
          {canVoid && (
            <button
              type="button"
              onClick={handleVoid}
              className="px-4 py-2 bg-rose-600 border border-rose-500 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-rose-700 transition-colors"
            >
              Void
            </button>
          )}
          {canCopy && (
            <button
              type="button"
              onClick={handleCopyInvoice}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-orange-600 transition-colors"
            >
              Copy
            </button>
          )}

          <div className="relative" ref={printMenuRef}>
            <div className="inline-flex">
              <button
                type="button"
                onClick={() => {
                  setIsPrintMenuOpen(false);
                  handlePrintMode(defaultPrintMode);
                }}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-l-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-orange-600 transition-colors"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setIsPrintMenuOpen((prev) => !prev)}
                className="w-8 h-8 flex items-center justify-center bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-lg text-[10px] font-black text-slate-500 hover:text-orange-600"
              >
                <FiChevronDown size={13} />
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
                <button
                  onClick={() => {
                    setIsPrintMenuOpen(false);
                    handlePrintMode("list");
                  }}
                  className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 hover:bg-orange-50 dark:hover:bg-slate-800"
                >
                  Product List (Name + Qty)
                </button>
              </div>
            )}
          </div>

          {!isApproved && !isVoid && !isDeleted && (
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
                  <FiChevronDown size={13} />
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
          )}

          {isApproved && (
            <>
              <button
                type="button"
                onClick={handleConvertToPurchaseInvoice}
                className="px-4 py-2 bg-orange-600 border border-orange-500 rounded-lg text-[10px] font-black uppercase tracking-widest text-white hover:bg-orange-700 transition-colors"
              >
                Convert To Purchase Invoice
              </button>
              <button
                type="button"
                onClick={handleReviseAction}
                className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-600 hover:text-orange-600 transition-colors"
              >
                {isApproved && isRevising ? "Save Revision" : "Revise"}
              </button>
            </>
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
                x
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
                <p className="text-[11px] mt-1">{formatDateDdMmYyyy(formData.date)}</p>
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
                    <td className="py-2">{getPrintableProductLabel(item)}</td>
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
              <p><span className="font-semibold">Date :</span> <span className="font-black">{formatDateDdMmYyyy(formData.date)}</span></p>
              <p><span className="font-semibold">Time :</span> <span className="font-black">{new Date().toLocaleTimeString()}</span></p>
              <p><span className="font-semibold">Operator Name :</span> <span className="font-black">Administrator</span></p>
              <p><span className="font-semibold">Customer Name :</span> <span className="font-black">{currentCustomer?.name || "-"}</span></p>
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
                        <td className="py-1 font-semibold" colSpan={5}>{getPrintableProductLabel(item)}</td>
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
            <p>Date: {formatDateDdMmYyyy(formData.date)}</p>
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
                    <td>{getPrintableProductLabel(item)}</td>
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
                      <td className="py-1">{getPrintableProductLabel(item)}</td>
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
        {printMode === "list" && (
          <div className="print-sheet-a4 bg-white p-6 text-black">
            <div className="mb-5 border-b border-black pb-3">
              <h1 className="text-2xl font-black uppercase tracking-wide">Purchase Order List</h1>
              <div className="mt-2 text-[12px] flex flex-wrap gap-x-6 gap-y-1">
                <p><span className="font-semibold">PO No:</span> {formData.id}</p>
                <p><span className="font-semibold">Date:</span> {formatDateDdMmYyyy(formData.date)}</p>
                <p><span className="font-semibold">Vendor:</span> {currentCustomer?.name || "-"}</p>
              </div>
            </div>
            <table className="w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-black">
                  <th className="text-left py-2 font-black">Product Name</th>
                  <th className="text-right py-2 font-black w-32">Qty</th>
                </tr>
              </thead>
              <tbody>
                {formData.items.map((item, idx) => (
                  <tr key={`${item.productId}-${idx}`} className="border-b border-black/20">
                    <td className="py-2">{getPrintableProductLabel(item)}</td>
                    <td className="text-right py-2 font-semibold">
                      {item.quantity} {item.packagingName || item.unit || ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <style>{getEmbeddedInvoicePrintCss(printMode)}</style>
    </div>
  );
};

export default PurchaseOrderFormPage;







