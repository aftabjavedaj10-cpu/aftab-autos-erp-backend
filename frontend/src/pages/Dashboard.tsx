import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import StatCard from "../components/StatCard";
import ProductsPage from "./Products";
import ReportsPage from "./Reports";
import CustomerLedgerPage from "./CustomerLedger";
import VendorLedgerPage from "./VendorLedger";
import StockLedgerPage from "./StockLedger";
import StockAdjustmentPage from "./StockAdjustment";
import AddStockAdjustmentPage from "./AddStockAdjustment";
import AddProducts from "./AddProducts";
import CustomersPage from "./CustomersPage";
import AddCustomerPage from "./AddCustomer";
import VendorsPage from "./Vendors";
import AddVendorPage from "./AddVendor";
import CategoriesPage from "./Categories";
import AddCategoryFormPage from "./AddCategoryForm";
import SettingsPage from "./Settings";
import SalesInvoicePage from "./SalesInvoice";
import SalesInvoiceFormPage from "./SalesInvoiceForm";
import PurchaseInvoicePage from "./PurchaseInvoice";
import PurchaseInvoiceFormPage from "./PurchaseInvoiceForm";
import PurchaseOrderPage from "./PurchaseOrder";
import PurchaseOrderFormPage from "./PurchaseOrderForm";
import PurchaseReturnPage from "./PurchaseReturn";
import PurchaseReturnFormPage from "./PurchaseReturnForm";
import QuotationPage from "./Quotation";
import QuotationFormPage from "./QuotationForm";
import SalesOrderPage, { type SalesOrderDoc } from "./SalesOrder";
import SalesOrderFormPage from "./SalesOrderForm";
import SalesReturnPage from "./SalesReturn";
import SalesReturnFormPage from "./SalesReturnForm";
import ReceivePaymentPage, { type ReceivePaymentDoc } from "./ReceivePayment";
import ReceivePaymentFormPage from "./ReceivePaymentForm";
import MakePaymentPage, { type MakePaymentDoc } from "./MakePayment";
import MakePaymentFormPage from "./MakePaymentForm";
import { ALL_REPORTS } from "../constants";
import type { Product, Category, Vendor, Customer, SalesInvoice, StockLedgerEntry, Company } from "../types";
import { productAPI, customerAPI, vendorAPI, categoryAPI, companyAPI, permissionAPI, purchaseInvoiceAPI, purchaseOrderAPI, purchaseReturnAPI, quotationAPI, receivePaymentAPI, makePaymentAPI, salesInvoiceAPI, salesReturnAPI, stockLedgerAPI } from "../services/apiService";
import { getActiveCompanyId, getSession, getUserId, setActiveCompanyId, setPermissions } from "../services/supabaseAuth";

interface DashboardProps {
  onLogout: () => void;
  isDarkMode?: boolean;
  onThemeToggle?: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, isDarkMode, onThemeToggle }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [noCompany, setNoCompany] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseInvoices, setPurchaseInvoices] = useState<SalesInvoice[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<SalesInvoice[]>([]);
  const [purchaseReturns, setPurchaseReturns] = useState<SalesInvoice[]>([]);
  const [editingSalesInvoice, setEditingSalesInvoice] = useState<SalesInvoice | undefined>(undefined);
  const [editingPurchaseInvoice, setEditingPurchaseInvoice] = useState<SalesInvoice | undefined>(undefined);
  const [editingPurchaseOrder, setEditingPurchaseOrder] = useState<SalesInvoice | undefined>(undefined);
  const [editingPurchaseReturn, setEditingPurchaseReturn] = useState<SalesInvoice | undefined>(undefined);
  const [salesInvoiceForceNewMode, setSalesInvoiceForceNewMode] = useState(false);
  const [quotationInvoices, setQuotationInvoices] = useState<SalesInvoice[]>([]);
  const [editingQuotationInvoice, setEditingQuotationInvoice] = useState<SalesInvoice | undefined>(undefined);
  const [salesOrders, setSalesOrders] = useState<SalesOrderDoc[]>([]);
  const [salesReturns, setSalesReturns] = useState<SalesInvoice[]>([]);
  const [receivePayments, setReceivePayments] = useState<ReceivePaymentDoc[]>([]);
  const [makePayments, setMakePayments] = useState<MakePaymentDoc[]>([]);
  const [editingSalesOrder, setEditingSalesOrder] = useState<SalesOrderDoc | undefined>(undefined);
  const [editingSalesReturn, setEditingSalesReturn] = useState<SalesInvoice | undefined>(undefined);
  const [editingReceivePayment, setEditingReceivePayment] = useState<ReceivePaymentDoc | undefined>(undefined);
  const [editingMakePayment, setEditingMakePayment] = useState<MakePaymentDoc | undefined>(undefined);
  const [stockLedger, setStockLedger] = useState<StockLedgerEntry[]>([]);
  const [activeCompany, setActiveCompany] = useState<Company | null>(null);
  const [pinnedReportIds, setPinnedReportIds] = useState<number[]>(() => {
    try {
      const stored = localStorage.getItem("pinnedReports");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);
  const [editingStockAdjustment, setEditingStockAdjustment] = useState<StockLedgerEntry | undefined>(undefined);

  const nextAdjustmentNo = useMemo(() => {
    const maxNo = stockLedger
      .filter((row) => String(row.source || "").toLowerCase() === "stock_adjustment")
      .reduce((max, row) => {
        const raw = String(row.sourceId || row.sourceRef || "").trim();
        const match = raw.match(/^ADJ-(\d{6})$/);
        const value = match ? Number(match[1]) : 0;
        return value > max ? value : max;
      }, 0);
    return `ADJ-${String(maxNo + 1).padStart(6, "0")}`;
  }, [stockLedger]);

  const computeStockMap = (ledgerRows: StockLedgerEntry[]) => {
    const map = new Map<string, { onHand: number; reserved: number; entries: number }>();
    ledgerRows.forEach((row) => {
      const entry = map.get(row.productId) || { onHand: 0, reserved: 0, entries: 0 };
      const qty = Number(row.qty || 0);
      const direction = String(row.direction || "").toUpperCase();
      const signed = direction === "OUT" ? -qty : qty;
      entry.onHand += signed;
      if (direction === "OUT" && String(row.reason || "").toLowerCase() === "invoice_pending") {
        entry.reserved += qty;
      }
      entry.entries += 1;
      map.set(row.productId, entry);
    });
    return map;
  };

  const mergeStockToProducts = (productsData: Product[], ledgerRows: StockLedgerEntry[]) => {
    const stockMap = computeStockMap(ledgerRows);
    return productsData.map((product) => {
      const entry = stockMap.get(product.id);
      const baseStock = Number(product.stock || 0);
      const onHand = entry?.entries ? entry.onHand : baseStock;
      const reserved = entry?.entries ? entry.reserved : 0;
      const available = Math.max(0, onHand - reserved);
      return {
        ...product,
        stock: onHand,
        stockOnHand: onHand,
        stockReserved: reserved,
        stockAvailable: available,
      };
    });
  };

  // Fetch initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        setNoCompany(false);

        const existingCompanyId = getActiveCompanyId();
        if (!existingCompanyId) {
          const userId = getUserId();
          if (userId) {
            const membershipRows = await companyAPI.listMyCompanies(userId);
            const firstCompany = membershipRows?.[0]?.companies;
            if (firstCompany?.id) {
              setActiveCompanyId(firstCompany.id);
            } else {
              setNoCompany(true);
              setLoading(false);
              return;
            }
          } else {
            setNoCompany(true);
            setLoading(false);
            return;
          }
        }
        
        const permissions = await permissionAPI.getMyPermissions();
        if (permissions) {
          setPermissions(permissions);
        }

        const companyId = getActiveCompanyId();
        if (companyId) {
          const company = await companyAPI.getById(companyId).catch(() => null);
          setActiveCompany(company);
        }
        const [
          productsData,
          customersData,
          vendorsData,
          categoriesData,
          salesInvoicesData,
          purchaseInvoicesData,
          purchaseOrdersData,
          purchaseReturnsData,
          quotationData,
          salesReturnData,
          receivePaymentData,
          makePaymentData,
          ledgerData,
        ] = await Promise.all([
          productAPI.getAll().catch(() => []),
          customerAPI.getAll().catch(() => []),
          vendorAPI.getAll().catch(() => []),
          categoryAPI.getAll().catch(() => []),
          salesInvoiceAPI.getAll().catch(() => []),
          purchaseInvoiceAPI.getAll().catch(() => []),
          purchaseOrderAPI.getAll().catch(() => []),
          purchaseReturnAPI.getAll().catch(() => []),
          quotationAPI.getAll().catch(() => []),
          salesReturnAPI.getAll().catch(() => []),
          receivePaymentAPI.getAll().catch(() => []),
          makePaymentAPI.getAll().catch(() => []),
          companyId ? stockLedgerAPI.listRecent(companyId, 5000).catch(() => []) : Promise.resolve([]),
        ]);

        const normalizedProducts = Array.isArray(productsData) ? productsData : productsData.data || [];
        const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : ledgerData.data || [];
        setStockLedger(normalizedLedger);
        setProducts(mergeStockToProducts(normalizedProducts, normalizedLedger));
        setCustomers(Array.isArray(customersData) ? customersData : customersData.data || []);
        setVendors(Array.isArray(vendorsData) ? vendorsData : vendorsData.data || []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData.data || []);
        setSalesInvoices(
          Array.isArray(salesInvoicesData) ? salesInvoicesData : salesInvoicesData.data || []
        );
        setPurchaseInvoices(
          Array.isArray(purchaseInvoicesData) ? purchaseInvoicesData : purchaseInvoicesData.data || []
        );
        setPurchaseOrders(
          Array.isArray(purchaseOrdersData) ? purchaseOrdersData : purchaseOrdersData.data || []
        );
        setPurchaseReturns(
          Array.isArray(purchaseReturnsData) ? purchaseReturnsData : purchaseReturnsData.data || []
        );
        setQuotationInvoices(
          Array.isArray(quotationData) ? quotationData : quotationData.data || []
        );
        setSalesReturns(
          Array.isArray(salesReturnData) ? salesReturnData : salesReturnData.data || []
        );
        setReceivePayments(
          Array.isArray(receivePaymentData) ? receivePaymentData : receivePaymentData.data || []
        );
        setMakePayments(
          Array.isArray(makePaymentData) ? makePaymentData : makePaymentData.data || []
        );
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load data from server. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!error) return;
    const timer = window.setTimeout(() => setError(null), 5000);
    return () => window.clearTimeout(timer);
  }, [error]);

  const handleAddProduct = () => {
    setEditingProduct(undefined);
    setActiveTab('add_product');
  };

  const handleAddCustomer = () => {
    setEditingCustomer(undefined);
    setActiveTab('add_customer');
  };

  const handleEditCustomer = (customer: Customer) => {
    setEditingCustomer(customer);
    setActiveTab('add_customer');
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('add_product');
  };

  const handleAddVendor = () => {
    setEditingVendor(undefined);
    setActiveTab('add_vendor');
  };

  const handleEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setActiveTab('add_vendor');
  };

  const handleDeleteVendor = (id: string) => {
    vendorAPI.delete(id).then(() => {
      setVendors(vendors.filter(v => v.id !== id));
    }).catch(err => {
      setError("Failed to delete vendor");
      console.error(err);
    });
  };

  const handleImportVendors = (newVendors: Vendor[]) => {
    vendorAPI.import(newVendors).then(() => {
      setVendors([...vendors, ...newVendors]);
    }).catch(err => {
      setError("Failed to import vendors");
      console.error(err);
    });
  };

  const handleAddCategory = () => {
    setEditingCategory(undefined);
    setActiveTab('categories');
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setActiveTab('add_category');
  };

  const handleDeleteCategory = (id: string) => {
    categoryAPI.delete(id).then(() => {
      setCategories(categories.filter(c => c.id !== id));
    }).catch(err => {
      setError("Failed to delete category");
      console.error(err);
    });
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      const used = await productAPI.isUsed(id);
      if (used) {
        setError("This product is already used in transactions and cannot be deleted. Deactivate it instead.");
        return;
      }
      await productAPI.delete(id);
      setProducts(products.filter(p => p.id !== id));
    } catch (err) {
      setError("Failed to delete product");
      console.error(err);
    }
  };

  const handleImportProducts = (newProducts: Product[]) => {
    productAPI.import(newProducts).then(() => {
      setProducts([...products, ...newProducts]);
    }).catch(err => {
      setError("Failed to import products");
      console.error(err);
    });
  };

  const handleImportCustomers = (newCustomers: Customer[]) => {
    customerAPI.import(newCustomers).then(() => {
      setCustomers([...customers, ...newCustomers]);
    }).catch(err => {
      setError("Failed to import customers");
      console.error(err);
    });
  };

  const handleAddCategoryToState = (category: Category) => {
    // Add category to state - in real app, this would go to backend
    setCategories([...categories, category]);
  };

  const handleAddSalesInvoice = () => {
    setEditingSalesInvoice(undefined);
    setSalesInvoiceForceNewMode(false);
    setActiveTab("add_sales_invoice");
  };

  const handleAddStockAdjustment = () => {
    setEditingStockAdjustment(undefined);
    setActiveTab("add_stock_adjustment");
  };

  const handleEditStockAdjustment = (row: StockLedgerEntry) => {
    setEditingStockAdjustment(row);
    setActiveTab("add_stock_adjustment");
  };

  const handleDeleteStockAdjustment = async (row: StockLedgerEntry) => {
    const ok = window.confirm(
      `Delete adjustment ${row.sourceId || row.sourceRef || row.id}? This cannot be undone.`
    );
    if (!ok) return;
    try {
      await stockLedgerAPI.deleteAdjustment(row.id);
      const companyId = getActiveCompanyId();
      const ledgerData = companyId
        ? await stockLedgerAPI.listRecent(companyId, 5000)
        : [];
      const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
      setStockLedger(normalizedLedger);
      setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
    } catch (err: any) {
      setError(err?.message || "Failed to delete stock adjustment");
      console.error(err);
    }
  };

  const handleEditSalesInvoice = (invoice: SalesInvoice) => {
    setEditingSalesInvoice(invoice);
    setSalesInvoiceForceNewMode(false);
    setActiveTab("add_sales_invoice");
  };

  const handleAddPurchaseInvoice = () => {
    setEditingPurchaseInvoice(undefined);
    setActiveTab("add_purchase_invoice");
  };

  const handleEditPurchaseInvoice = (invoice: SalesInvoice) => {
    setEditingPurchaseInvoice(invoice);
    setActiveTab("add_purchase_invoice");
  };

  const handleAddPurchaseOrder = () => {
    setEditingPurchaseOrder(undefined);
    setActiveTab("add_purchase_order");
  };

  const handleEditPurchaseOrder = (invoice: SalesInvoice) => {
    setEditingPurchaseOrder(invoice);
    setActiveTab("add_purchase_order");
  };

  const handleAddPurchaseReturn = () => {
    setEditingPurchaseReturn(undefined);
    setActiveTab("add_purchase_return");
  };

  const handleEditPurchaseReturn = (invoice: SalesInvoice) => {
    setEditingPurchaseReturn(invoice);
    setActiveTab("add_purchase_return");
  };

  const getNextSalesInvoiceId = () => {
    const maxNo = salesInvoices.reduce((max, row) => {
      const match = String(row.id || "").match(/^SI-(\d{6})$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);
    return `SI-${String(maxNo + 1).padStart(6, "0")}`;
  };

  const upsertSalesModuleDoc = <T extends { id: string }>(
    docs: T[],
    incoming: T
  ): T[] => {
    const exists = docs.some((d) => d.id === incoming.id);
    if (exists) {
      return docs.map((d) => (d.id === incoming.id ? incoming : d));
    }
    return [incoming, ...docs];
  };

  const getNextReceivePaymentId = (docs: ReceivePaymentDoc[]) => {
    const maxNo = docs.reduce((max, row) => {
      const match = String(row.id || "").match(/^RP-(\d{6})$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);
    return `RP-${String(maxNo + 1).padStart(6, "0")}`;
  };

  const getNextMakePaymentId = (docs: MakePaymentDoc[]) => {
    const maxNo = docs.reduce((max, row) => {
      const match = String(row.id || "").match(/^MP-(\d{6})$/);
      const value = match ? Number(match[1]) : 0;
      return value > max ? value : max;
    }, 0);
    return `MP-${String(maxNo + 1).padStart(6, "0")}`;
  };

  const findLinkedReceivePayments = (invoiceId: string) => {
    const target = String(invoiceId || "").toUpperCase();
    if (!target) return [] as ReceivePaymentDoc[];
    return receivePayments.filter((doc) => {
      const against = String(doc.invoiceId || "").toUpperCase();
      const legacyRef = String(doc.reference || "").toUpperCase();
      return against === target || legacyRef === target;
    });
  };

  const findLinkedMakePayments = (invoiceId: string) => {
    const target = String(invoiceId || "").toUpperCase();
    if (!target) return [] as MakePaymentDoc[];
    return makePayments.filter((doc) => {
      const against = String(doc.invoiceId || "").toUpperCase();
      const legacyRef = String(doc.reference || "").toUpperCase();
      return against === target || legacyRef === target;
    });
  };

  const handleAddQuotation = () => {
    setEditingQuotationInvoice(undefined);
    setActiveTab("add_quotation");
  };

  const handleEditQuotation = (invoice: SalesInvoice) => {
    setEditingQuotationInvoice(invoice);
    setActiveTab("add_quotation");
  };

  const handleAddSalesOrder = () => {
    setEditingSalesOrder(undefined);
    setActiveTab("add_sales_order");
  };

  const handleEditSalesOrder = (doc: SalesOrderDoc) => {
    setEditingSalesOrder(doc);
    setActiveTab("add_sales_order");
  };

  const handleAddSalesReturn = () => {
    setEditingSalesReturn(undefined);
    setActiveTab("add_sales_return");
  };

  const handleEditSalesReturn = (invoice: SalesInvoice) => {
    setEditingSalesReturn(invoice);
    setActiveTab("add_sales_return");
  };

  const handleAddReceivePayment = () => {
    setEditingReceivePayment(undefined);
    setActiveTab("add_receive_payment");
  };

  const handleEditReceivePayment = (doc: ReceivePaymentDoc) => {
    setEditingReceivePayment(doc);
    setActiveTab("add_receive_payment");
  };

  const handleAddMakePayment = () => {
    setEditingMakePayment(undefined);
    setActiveTab("add_make_payment");
  };

  const handleEditMakePayment = (doc: MakePaymentDoc) => {
    setEditingMakePayment(doc);
    setActiveTab("add_make_payment");
  };

  const lowStockCount = useMemo(() => {
    return products.filter(p => (p.stockAvailable ?? p.stock) <= p.reorderPoint).length;
  }, [products]);

  const userLabel = useMemo(() => {
    const session = getSession();
    return session?.user?.email || "Admin";
  }, []);

  const pinnedReports = useMemo(
    () => ALL_REPORTS.filter((report) => pinnedReportIds.includes(report.id)),
    [pinnedReportIds]
  );

  const pendingItems = useMemo(() => {
    const countPending = (rows: Array<{ status?: string }>) =>
      rows.filter((row) => String(row?.status || "").trim().toLowerCase() === "pending").length;

    const items = [
      { key: "quotation", label: "Quotations", count: countPending(quotationInvoices), tab: "quotation" },
      { key: "sales_order", label: "Sales Orders", count: countPending(salesOrders as any), tab: "sales_order" },
      { key: "sales_invoice", label: "Sales Invoices", count: countPending(salesInvoices), tab: "sales_invoice" },
      { key: "sales_return", label: "Sales Returns", count: countPending(salesReturns), tab: "sales_return" },
      { key: "receive_payment", label: "Receive Payments", count: countPending(receivePayments as any), tab: "receive_payment" },
      { key: "purchase_order", label: "Purchase Orders", count: countPending(purchaseOrders), tab: "purchase_order" },
      { key: "purchase_invoice", label: "Purchase Invoices", count: countPending(purchaseInvoices), tab: "purchase_invoice" },
      { key: "purchase_return", label: "Purchase Returns", count: countPending(purchaseReturns), tab: "purchase_return" },
      { key: "make_payment", label: "Make Payments", count: countPending(makePayments as any), tab: "make_payment" },
    ];
    return items.filter((item) => item.count > 0);
  }, [
    quotationInvoices,
    salesOrders,
    salesInvoices,
    salesReturns,
    receivePayments,
    purchaseOrders,
    purchaseInvoices,
    purchaseReturns,
    makePayments,
  ]);

  const handleTogglePinReport = (id: number) => {
    setPinnedReportIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      localStorage.setItem("pinnedReports", JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    const refreshStockLedgerOnOpen = async () => {
      if (activeTab !== "report_stock_ledger") return;
      const companyId = getActiveCompanyId();
      if (!companyId) return;
      try {
        const ledgerData = await stockLedgerAPI.listRecent(companyId, 5000);
        const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
        setStockLedger(normalizedLedger);
        setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
      } catch (err) {
        console.error("Failed to refresh stock ledger:", err);
      }
    };
    refreshStockLedgerOnOpen();
  }, [activeTab]);

  return (
    <div className="min-h-screen flex bg-[#FEF3E2] dark:bg-[#020617]">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
        isMobileOpen={isMobileOpen}
        onMobileClose={() => setIsMobileOpen(false)}
      />

      <main className="flex-1 overflow-auto">
        <TopBar
          onMenuClick={() => setIsMobileOpen(true)}
          title={activeTab.replace("_", " ")}
          userLabel={userLabel}
          onLogout={onLogout}
          isDarkMode={isDarkMode}
          onThemeToggle={onThemeToggle}
          onOpenSettings={() => setActiveTab("settings")}
          onOpenProfile={() => setActiveTab("settings")}
          pinnedReports={pinnedReports}
          onSelectPinnedReport={(tab) => setActiveTab(tab)}
          pendingItems={pendingItems}
          onSelectPendingItem={(tab) => setActiveTab(tab)}
        />

        <div className="p-6">
        {noCompany && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 rounded-2xl mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <p className="font-black uppercase text-xs tracking-widest">No Company Found</p>
              <p className="text-sm">Create your company in Settings to start using the app.</p>
            </div>
            <button
              onClick={() => setActiveTab("settings")}
              className="bg-amber-600 hover:bg-amber-700 text-white font-black px-4 py-2 rounded-xl text-xs uppercase tracking-widest"
            >
              Go to Settings
            </button>
          </div>
        )}

        {loading && !noCompany && (
          <div className="text-center py-12">
            <p className="text-slate-500 dark:text-slate-400">Loading data...</p>
          </div>
        )}
        {error && (
          <div className="fixed top-20 right-6 z-[12000] max-w-md w-full">
            <div className="bg-white dark:bg-slate-900 border border-rose-200 dark:border-rose-800 shadow-2xl rounded-2xl overflow-hidden">
              <div className="h-1.5 bg-rose-600" />
              <div className="p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-full bg-rose-100 dark:bg-rose-900/40 text-rose-600 flex items-center justify-center text-xs font-black">
                  !
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-rose-600 mb-1">
                    Action Failed
                  </p>
                  <p className="text-[12px] font-bold text-slate-700 dark:text-slate-200 break-words">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="w-7 h-7 rounded-md border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-rose-600 text-sm"
                  aria-label="Dismiss error popup"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dashboard" && (
          <>
            <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tight mb-2">Dashboard</h1>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Welcome to Aftab Autos ERP System</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard title="Total Products" value={products.length.toString()} icon="📦" />
              <StatCard title="Low Stock" value={lowStockCount.toString()} icon="⚠️" />
              <StatCard title="Total Vendors" value={vendors.length.toString()} icon="🏢" />
              <StatCard title="Categories" value={categories.length.toString()} icon="📂" />
            </div>
          </>
        )}

        {activeTab === "products" && (
          <ProductsPage
            products={products}
            categories={categories}
            vendors={vendors}
            onAddClick={handleAddProduct}
            onEditClick={handleEditProduct}
            onDelete={handleDeleteProduct}
            onImportComplete={handleImportProducts}
          />
        )}

        {activeTab === "customers" && (
          <CustomersPage
            customers={customers}
            categories={categories}
            onAddClick={handleAddCustomer}
            onEditClick={handleEditCustomer}
            onDelete={(id) => {
              customerAPI.delete(id).then(() => {
                setCustomers(customers.filter(x => x.id !== id));
              }).catch(err => {
                setError("Failed to delete customer");
                console.error(err);
              });
            }}
            onImportComplete={handleImportCustomers}
          />
        )}

        {activeTab === "add_product" && (
          <AddProducts
            product={editingProduct}
            categories={categories}
            vendors={vendors}
            onBack={() => { setEditingProduct(undefined); setActiveTab('products'); }}
            onSave={(product, stayOnPage) => {
              const saveProduct = () => {
                if (product.id) {
                  return productAPI.update(product.id, product).then(() => {
                    setProducts(products.map(p => p.id === product.id ? product : p));
                  });
                } else {
                  return productAPI.create(product).then((res: any) => {
                    const newProduct = { ...product, id: res.id || `prod_${Date.now()}` };
                    setProducts([...products, newProduct]);
                  });
                }
              };

              saveProduct().then(() => {
                if (!stayOnPage) {
                  setEditingProduct(undefined);
                  setActiveTab('products');
                }
              }).catch(err => {
                setError("Failed to save product");
                console.error(err);
              });
            }}
            onAddCategory={handleAddCategoryToState}
          />
        )}

        {activeTab === "add_customer" && (
          <AddCustomerPage
            customer={editingCustomer}
            categories={categories}
            onBack={() => { setEditingCustomer(undefined); setActiveTab('customers'); }}
            onSave={(customer, stayOnPage) => {
              const saveCustomer = () => {
                if (customer.id && editingCustomer?.id === customer.id) {
                  return customerAPI.update(customer.id, customer).then(() => {
                    setCustomers(customers.map(c => c.id === customer.id ? customer : c));
                  });
                } else {
                  return customerAPI.create(customer).then((res: any) => {
                    const newCustomer = { ...customer, id: res.id || `cust_${Date.now()}` };
                    setCustomers([...customers, newCustomer]);
                  });
                }
              };

              saveCustomer().then(() => {
                if (!stayOnPage) {
                  setEditingCustomer(undefined);
                  setActiveTab('customers');
                }
              }).catch(err => {
                setError("Failed to save customer");
                console.error(err);
              });
            }}
            onAddCategory={handleAddCategoryToState}
          />
        )}

        {activeTab === "vendors" && (
          <VendorsPage
            vendors={vendors}
            categories={categories}
            onAddClick={handleAddVendor}
            onEditClick={handleEditVendor}
            onDelete={handleDeleteVendor}
            onImportComplete={handleImportVendors}
          />
        )}

        {activeTab === "add_vendor" && (
          <AddVendorPage
            vendor={editingVendor}
            categories={categories}
            onBack={() => { setEditingVendor(undefined); setActiveTab('vendors'); }}
            onSave={(vendor, stayOnPage) => {
              const saveVendor = () => {
                if (vendor.id && editingVendor?.id === vendor.id) {
                  return vendorAPI.update(vendor.id, vendor).then(() => {
                    setVendors(vendors.map(v => v.id === vendor.id ? vendor : v));
                  });
                } else {
                  return vendorAPI.create(vendor).then((res: any) => {
                    const newVendor = { ...vendor, id: res.id || `ven_${Date.now()}` };
                    setVendors([...vendors, newVendor]);
                  });
                }
              };

              saveVendor().then(() => {
                if (!stayOnPage) {
                  setEditingVendor(undefined);
                  setActiveTab('vendors');
                }
              }).catch(err => {
                setError("Failed to save vendor");
                console.error(err);
              });
            }}
            onAddCategory={handleAddCategoryToState}
          />
        )}

        {activeTab === "categories" && (
          <CategoriesPage
            categories={categories}
            onAddClick={handleAddCategory}
            onEditClick={handleEditCategory}
            onDelete={handleDeleteCategory}
          />
        )}

        {activeTab === "add_category" && (
          <AddCategoryFormPage
            category={editingCategory}
            onBack={() => { setEditingCategory(undefined); setActiveTab('categories'); }}
            onSave={(category, stayOnPage) => {
              const saveCategory = () => {
                if (category.id && editingCategory?.id === category.id) {
                  return categoryAPI.update(category.id, category).then(() => {
                    setCategories(categories.map(c => c.id === category.id ? category : c));
                  });
                } else {
                  return categoryAPI.create(category).then((res: any) => {
                    const newCategory = { ...category, id: res.id || `cat_${Date.now()}` };
                    setCategories([...categories, newCategory]);
                  });
                }
              };

              saveCategory().then(() => {
                if (!stayOnPage) {
                  setEditingCategory(undefined);
                  setActiveTab('categories');
                }
              }).catch(err => {
                setError("Failed to save category");
                console.error(err);
              });
            }}
          />
        )}

        {activeTab === "settings" && (
          <SettingsPage />
        )}

        {activeTab === "quotation" && (
          <QuotationPage
            invoices={quotationInvoices}
            onAddClick={handleAddQuotation}
            onEditClick={handleEditQuotation}
            onDelete={(id) => {
              quotationAPI.delete(id).then(() => {
                setQuotationInvoices((prev) => prev.filter((inv) => inv.id !== id));
              }).catch((err) => {
                setError(err?.message || "Failed to delete quotation");
                console.error(err);
              });
            }}
          />
        )}

        {activeTab === "add_quotation" && (
          <QuotationFormPage
            invoice={editingQuotationInvoice}
            invoices={quotationInvoices}
            products={products}
            customers={customers}
            company={activeCompany || undefined}
            onBack={() => {
              setEditingQuotationInvoice(undefined);
              setActiveTab("quotation");
            }}
            onNavigate={(inv) => {
              setEditingQuotationInvoice(inv);
              setActiveTab("add_quotation");
            }}
            onNavigateNew={() => {
              setEditingQuotationInvoice(undefined);
              setActiveTab("add_quotation");
            }}
            onConvertToSalesInvoice={(quotation) => {
              const converted: SalesInvoice = {
                ...quotation,
                id: getNextSalesInvoiceId(),
                status: "Draft",
                paymentStatus: "Unpaid",
                amountReceived: 0,
                reference: quotation.reference || quotation.id,
              };
              setEditingSalesInvoice(converted);
              setSalesInvoiceForceNewMode(true);
              setActiveTab("add_sales_invoice");
            }}
            onSave={async (invoiceData, stayOnPage, savePrices) => {
              try {
                if (savePrices) {
                  const latestPriceByProduct = new Map<string, number>();
                  invoiceData.items.forEach((item) => {
                    latestPriceByProduct.set(String(item.productId), Number(item.unitPrice || 0));
                  });

                  const productsToUpdate = products.filter((p) =>
                    latestPriceByProduct.has(String(p.id))
                  );
                  await Promise.all(
                    productsToUpdate.map(async (p) => {
                      const newPrice = latestPriceByProduct.get(String(p.id));
                      if (newPrice === undefined) return;
                      const currentPrice = Number(String(p.price).replace(/[^0-9.-]/g, "")) || 0;
                      if (Math.abs(currentPrice - newPrice) < 0.0001) return;
                      await productAPI.update(String(p.id), { ...p, price: newPrice });
                    })
                  );

                  setProducts((prev) =>
                    prev.map((p) => {
                      const newPrice = latestPriceByProduct.get(String(p.id));
                      return newPrice === undefined ? p : { ...p, price: newPrice };
                    })
                  );
                }

                const saved = editingQuotationInvoice?.id
                  ? await quotationAPI.update(invoiceData.id, invoiceData)
                  : await quotationAPI.create(invoiceData);

                setQuotationInvoices((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });

                if (!stayOnPage) {
                  setEditingQuotationInvoice(undefined);
                  setActiveTab("quotation");
                }
              } catch (err: any) {
                setError(err?.message || "Failed to save quotation");
              }
            }}
          />
        )}

        {activeTab === "sales_order" && (
          <SalesOrderPage
            docs={salesOrders}
            onAddClick={handleAddSalesOrder}
            onEditClick={handleEditSalesOrder}
            onDelete={(id) => setSalesOrders((prev) => prev.filter((d) => d.id !== id))}
          />
        )}

        {activeTab === "add_sales_order" && (
          <SalesOrderFormPage
            docs={salesOrders}
            customers={customers}
            products={products}
            company={activeCompany || undefined}
            doc={editingSalesOrder}
            onBack={() => {
              setEditingSalesOrder(undefined);
              setActiveTab("sales_order");
            }}
            onSave={(doc) => {
              setSalesOrders((prev) => upsertSalesModuleDoc(prev, doc));
              setEditingSalesOrder(undefined);
              setActiveTab("sales_order");
            }}
          />
        )}

        {activeTab === "sales_return" && (
          <SalesReturnPage
            invoices={salesReturns}
            onAddClick={handleAddSalesReturn}
            onEditClick={handleEditSalesReturn}
            onDelete={async (id) => {
              try {
                await salesReturnAPI.delete(id);
                setSalesReturns((prev) => prev.filter((d) => d.id !== id));
                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
              } catch (err: any) {
                setError(err?.message || "Failed to delete sales return");
              }
            }}
          />
        )}

        {activeTab === "add_sales_return" && (
          <SalesReturnFormPage
            invoices={salesReturns}
            customers={customers}
            products={products}
            company={activeCompany || undefined}
            invoice={editingSalesReturn}
            onBack={() => {
              setEditingSalesReturn(undefined);
              setActiveTab("sales_return");
            }}
            onSave={async (invoiceData) => {
              try {
                const saved = editingSalesReturn?.id
                  ? await salesReturnAPI.update(invoiceData.id, invoiceData)
                  : await salesReturnAPI.create(invoiceData);
                setSalesReturns((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });
                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
                setEditingSalesReturn(undefined);
                setActiveTab("sales_return");
              } catch (err: any) {
                setError(err?.message || "Failed to save sales return");
              }
            }}
          />
        )}

        {activeTab === "receive_payment" && (
          <ReceivePaymentPage
            docs={receivePayments}
            onAddClick={handleAddReceivePayment}
            onEditClick={handleEditReceivePayment}
            onDelete={async (id) => {
              try {
                await receivePaymentAPI.delete(id);
                setReceivePayments((prev) => prev.filter((d) => d.id !== id));
              } catch (err: any) {
                setError(err?.message || "Failed to delete receive payment");
              }
            }}
          />
        )}

        {activeTab === "add_receive_payment" && (
          <ReceivePaymentFormPage
            docs={receivePayments}
            customers={customers}
            products={products}
            salesInvoices={salesInvoices}
            salesReturns={salesReturns}
            company={activeCompany || undefined}
            doc={editingReceivePayment}
            onBack={() => {
              setEditingReceivePayment(undefined);
              setActiveTab("receive_payment");
            }}
            onSave={async (doc, stayOnPage) => {
              try {
                const saved = editingReceivePayment?.id
                  ? await receivePaymentAPI.update(doc.id, doc)
                  : await receivePaymentAPI.create(doc);
                setReceivePayments((prev) => upsertSalesModuleDoc(prev, saved));
                if (stayOnPage) {
                  setEditingReceivePayment(undefined);
                  setActiveTab("add_receive_payment");
                  return;
                }
                setEditingReceivePayment(undefined);
                setActiveTab("receive_payment");
              } catch (err: any) {
                setError(err?.message || "Failed to save receive payment");
              }
            }}
          />
        )}

        {activeTab === "make_payment" && (
          <MakePaymentPage
            docs={makePayments}
            onAddClick={handleAddMakePayment}
            onEditClick={handleEditMakePayment}
            onDelete={async (id) => {
              try {
                await makePaymentAPI.delete(id);
                setMakePayments((prev) => prev.filter((d) => d.id !== id));
              } catch (err: any) {
                setError(err?.message || "Failed to delete make payment");
              }
            }}
          />
        )}

        {activeTab === "add_make_payment" && (
          <MakePaymentFormPage
            docs={makePayments}
            vendors={vendors}
            products={products}
            purchaseInvoices={purchaseInvoices}
            purchaseReturns={purchaseReturns}
            company={activeCompany || undefined}
            doc={editingMakePayment}
            onBack={() => {
              setEditingMakePayment(undefined);
              setActiveTab("make_payment");
            }}
            onSave={async (doc, stayOnPage) => {
              try {
                const saved = editingMakePayment?.id
                  ? await makePaymentAPI.update(doc.id, doc)
                  : await makePaymentAPI.create(doc);
                setMakePayments((prev) => upsertSalesModuleDoc(prev, saved));
                if (stayOnPage) {
                  setEditingMakePayment(undefined);
                  setActiveTab("add_make_payment");
                  return;
                }
                setEditingMakePayment(undefined);
                setActiveTab("make_payment");
              } catch (err: any) {
                setError(err?.message || "Failed to save make payment");
              }
            }}
          />
        )}

        {activeTab === "sales_invoice" && (
          <SalesInvoicePage
            invoices={salesInvoices}
            onAddClick={handleAddSalesInvoice}
            onEditClick={handleEditSalesInvoice}
            onDelete={async (id) => {
              try {
                const current = salesInvoices.find((inv) => inv.id === id);
                if (!current) return;
                if (current.status !== "Void") {
                  setError("Invoice must be set to Void before marking as Deleted.");
                  return;
                }
                const softDeleted = { ...current, status: "Deleted" as const };
                const updated = await salesInvoiceAPI.update(id, softDeleted);
                setSalesInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));

                const linkedPayments = findLinkedReceivePayments(id);
                if (linkedPayments.length > 0) {
                  const paymentUpdates = await Promise.all(
                    linkedPayments.map((doc) =>
                      receivePaymentAPI.update(doc.id, { ...doc, status: "Deleted" })
                    )
                  );
                  setReceivePayments((prev) =>
                    prev.map((doc) => {
                      const next = paymentUpdates.find((row) => row.id === doc.id);
                      return next || doc;
                    })
                  );
                }

                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
              } catch (err: any) {
                setError(err?.message || "Failed to set sales invoice as deleted");
                console.error(err);
              }
            }}
          />
        )}

        {activeTab === "purchase_invoice" && (
          <PurchaseInvoicePage
            invoices={purchaseInvoices}
            onAddClick={handleAddPurchaseInvoice}
            onEditClick={handleEditPurchaseInvoice}
            onDelete={async (id) => {
              try {
                const current = purchaseInvoices.find((inv) => inv.id === id);
                if (!current) return;
                if (current.status !== "Void") {
                  setError("Purchase invoice must be set to Void before marking as Deleted.");
                  return;
                }
                const softDeleted = { ...current, status: "Deleted" as const };
                const updated = await purchaseInvoiceAPI.update(id, softDeleted);
                setPurchaseInvoices((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));

                const linkedPayments = findLinkedMakePayments(id);
                if (linkedPayments.length > 0) {
                  const paymentUpdates = await Promise.all(
                    linkedPayments.map((doc) =>
                      makePaymentAPI.update(doc.id, { ...doc, status: "Deleted" })
                    )
                  );
                  setMakePayments((prev) =>
                    prev.map((doc) => {
                      const next = paymentUpdates.find((row) => row.id === doc.id);
                      return next || doc;
                    })
                  );
                }

                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
              } catch (err: any) {
                setError(err?.message || "Failed to set purchase invoice as deleted");
                console.error(err);
              }
            }}
          />
        )}

        {activeTab === "purchase_order" && (
          <PurchaseOrderPage
            invoices={purchaseOrders}
            onAddClick={handleAddPurchaseOrder}
            onEditClick={handleEditPurchaseOrder}
            onDelete={async (id) => {
              try {
                const current = purchaseOrders.find((inv) => inv.id === id);
                if (!current) return;
                if (current.status !== "Void") {
                  setError("Purchase order must be set to Void before marking as Deleted.");
                  return;
                }
                const updated = await purchaseOrderAPI.update(id, { ...current, status: "Deleted" as const });
                setPurchaseOrders((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
              } catch (err: any) {
                setError(err?.message || "Failed to set purchase order as deleted");
              }
            }}
          />
        )}

        {activeTab === "purchase_return" && (
          <PurchaseReturnPage
            invoices={purchaseReturns}
            onAddClick={handleAddPurchaseReturn}
            onEditClick={handleEditPurchaseReturn}
            onDelete={async (id) => {
              try {
                const current = purchaseReturns.find((inv) => inv.id === id);
                if (!current) return;
                if (current.status !== "Void") {
                  setError("Purchase return must be set to Void before marking as Deleted.");
                  return;
                }
                const updated = await purchaseReturnAPI.update(id, { ...current, status: "Deleted" as const });
                setPurchaseReturns((prev) => prev.map((inv) => (inv.id === id ? updated : inv)));
                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
              } catch (err: any) {
                setError(err?.message || "Failed to set purchase return as deleted");
              }
            }}
          />
        )}

        {activeTab === "reports" && (
          <ReportsPage
            onNavigate={(tab) => setActiveTab(tab)}
            pinnedIds={pinnedReportIds}
            onTogglePin={handleTogglePinReport}
          />
        )}

        {activeTab === "report_stock_ledger" && (
          <StockLedgerPage
            onBack={() => setActiveTab("reports")}
            products={products}
            stockLedger={stockLedger}
          />
        )}

        {activeTab === "stock_adjustment" && (
          <StockAdjustmentPage
            rows={stockLedger}
            products={products}
            onAddClick={handleAddStockAdjustment}
            onEditClick={handleEditStockAdjustment}
            onDeleteClick={handleDeleteStockAdjustment}
          />
        )}

        {activeTab === "add_stock_adjustment" && (
          <AddStockAdjustmentPage
            products={products}
            defaultAdjustmentNo={nextAdjustmentNo}
            onBack={() => {
              setEditingStockAdjustment(undefined);
              setActiveTab("stock_adjustment");
            }}
            adjustment={
              editingStockAdjustment
                ? {
                    id: editingStockAdjustment.id,
                    productId: String(editingStockAdjustment.productId),
                    qty: Number(editingStockAdjustment.qty),
                    direction: String(editingStockAdjustment.direction || "IN"),
                    reason: editingStockAdjustment.reason,
                    sourceRef: editingStockAdjustment.sourceRef,
                    adjustmentNo: editingStockAdjustment.sourceId || editingStockAdjustment.sourceRef,
                    createdAt: editingStockAdjustment.createdAt,
                  }
                : undefined
            }
            onSave={async (payload) => {
              try {
                if (editingStockAdjustment?.id) {
                  await stockLedgerAPI.updateAdjustment(editingStockAdjustment.id, payload);
                } else {
                  await stockLedgerAPI.createAdjustment(payload);
                }
                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
                setEditingStockAdjustment(undefined);
                setActiveTab("stock_adjustment");
              } catch (err: any) {
                setError(err?.message || "Failed to save stock adjustment");
                console.error(err);
              }
            }}
          />
        )}

        {activeTab === "report_customer_ledger" && (
          <CustomerLedgerPage
            onBack={() => setActiveTab("reports")}
            customers={customers}
            salesInvoices={salesInvoices}
            salesReturns={salesReturns}
            receivePayments={receivePayments}
            company={activeCompany || undefined}
            onViewSalesInvoice={(id) => {
              const invoice = salesInvoices.find((inv) => String(inv.id) === String(id));
              if (!invoice) return;
              setEditingSalesInvoice(invoice);
              setSalesInvoiceForceNewMode(false);
              setActiveTab("add_sales_invoice");
            }}
            onViewSalesReturn={(id) => {
              const invoice = salesReturns.find((inv) => String(inv.id) === String(id));
              if (!invoice) return;
              setEditingSalesReturn(invoice);
              setActiveTab("add_sales_return");
            }}
            onViewReceivePayment={(id) => {
              const doc = receivePayments.find((row) => String(row.id) === String(id));
              if (!doc) return;
              setEditingReceivePayment(doc);
              setActiveTab("add_receive_payment");
            }}
          />
        )}

        {activeTab === "report_vendor_ledger" && (
          <VendorLedgerPage
            onBack={() => setActiveTab("reports")}
            vendors={vendors}
            purchaseInvoices={purchaseInvoices}
            purchaseReturns={purchaseReturns}
            makePayments={makePayments}
            company={activeCompany || undefined}
            onViewPurchaseInvoice={(id) => {
              const invoice = purchaseInvoices.find((inv) => String(inv.id) === String(id));
              if (!invoice) return;
              setEditingPurchaseInvoice(invoice);
              setActiveTab("add_purchase_invoice");
            }}
          />
        )}

        {activeTab === "add_sales_invoice" && (
          <SalesInvoiceFormPage
            invoice={editingSalesInvoice}
            forceNewMode={salesInvoiceForceNewMode}
            invoices={salesInvoices}
            salesReturns={salesReturns}
            receivePayments={receivePayments}
            products={products}
            customers={customers}
            company={activeCompany || undefined}
            onBack={() => {
              setEditingSalesInvoice(undefined);
              setSalesInvoiceForceNewMode(false);
              setActiveTab("sales_invoice");
            }}
            onNavigate={(inv) => {
              setEditingSalesInvoice(inv);
              setSalesInvoiceForceNewMode(false);
              setActiveTab("add_sales_invoice");
            }}
            onNavigateNew={() => {
              setEditingSalesInvoice(undefined);
              setSalesInvoiceForceNewMode(false);
              setActiveTab("add_sales_invoice");
            }}
            onSave={async (invoiceData, stayOnPage, savePrices) => {
              try {
                if (savePrices) {
                  const latestPriceByProduct = new Map<string, number>();
                  invoiceData.items.forEach((item) => {
                    latestPriceByProduct.set(String(item.productId), Number(item.unitPrice || 0));
                  });

                  const productsToUpdate = products.filter((p) => latestPriceByProduct.has(String(p.id)));
                  await Promise.all(
                    productsToUpdate.map(async (p) => {
                      const newPrice = latestPriceByProduct.get(String(p.id));
                      if (newPrice === undefined) return;
                      const currentPrice = Number(String(p.price).replace(/[^0-9.-]/g, "")) || 0;
                      if (Math.abs(currentPrice - newPrice) < 0.0001) return;
                      await productAPI.update(String(p.id), { ...p, price: newPrice });
                    })
                  );

                  setProducts((prev) =>
                    prev.map((p) => {
                      const newPrice = latestPriceByProduct.get(String(p.id));
                      return newPrice === undefined ? p : { ...p, price: newPrice };
                    })
                  );
                }

                const saved = editingSalesInvoice && !salesInvoiceForceNewMode
                  ? await salesInvoiceAPI.update(invoiceData.id, invoiceData)
                  : await salesInvoiceAPI.create(invoiceData);

                setSalesInvoices((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });

                // Auto-create/update receive payment from cash received on sales invoice.
                const receivedAmount = Number(saved.amountReceived || 0);
                const linkedPayments = findLinkedReceivePayments(saved.id);
                const linkedPayment = linkedPayments[0];

                if (receivedAmount > 0) {
                  const paymentPayload: ReceivePaymentDoc = {
                    id: linkedPayment?.id || getNextReceivePaymentId(receivePayments),
                    customerId: saved.customerId,
                    customerName: saved.customerName,
                    invoiceId: saved.id,
                    reference: saved.reference || "",
                    date: saved.date,
                    status: saved.status === "Void" || saved.status === "Deleted" ? saved.status : "Approved",
                    totalAmount: receivedAmount,
                    notes: linkedPayment?.notes || `Auto payment from ${saved.id}`,
                  };
                  const paymentSaved = linkedPayment
                    ? await receivePaymentAPI.update(linkedPayment.id, paymentPayload)
                    : await receivePaymentAPI.create(paymentPayload);

                  if (linkedPayments.length > 1) {
                    const duplicates = linkedPayments.slice(1);
                    await Promise.all(duplicates.map((doc) => receivePaymentAPI.delete(doc.id)));
                    const duplicateIds = new Set(duplicates.map((doc) => doc.id));
                    setReceivePayments((prev) =>
                      upsertSalesModuleDoc(
                        prev.filter((doc) => !duplicateIds.has(doc.id)),
                        paymentSaved
                      )
                    );
                  } else {
                    setReceivePayments((prev) => upsertSalesModuleDoc(prev, paymentSaved));
                  }
                } else if (linkedPayments.length > 0) {
                  await Promise.all(linkedPayments.map((doc) => receivePaymentAPI.delete(doc.id)));
                  const idsToDelete = new Set(linkedPayments.map((doc) => doc.id));
                  setReceivePayments((prev) => prev.filter((doc) => !idsToDelete.has(doc.id)));
                }

                if (stayOnPage) {
                  setEditingSalesInvoice(saved);
                  setSalesInvoiceForceNewMode(false);
                }

                if (!stayOnPage) {
                  setEditingSalesInvoice(undefined);
                  setSalesInvoiceForceNewMode(false);
                  setActiveTab("sales_invoice");
                }
              } catch (err: any) {
                setError(err?.message || "Failed to save sales invoice");
              }
            }}
          />
        )}

        {activeTab === "add_purchase_invoice" && (
          <PurchaseInvoiceFormPage
            invoice={editingPurchaseInvoice}
            invoices={purchaseInvoices}
            products={products}
            vendors={vendors}
            company={activeCompany || undefined}
            onBack={() => {
              setEditingPurchaseInvoice(undefined);
              setActiveTab("purchase_invoice");
            }}
            onNavigate={(inv) => {
              setEditingPurchaseInvoice(inv);
              setActiveTab("add_purchase_invoice");
            }}
            onNavigateNew={() => {
              setEditingPurchaseInvoice(undefined);
              setActiveTab("add_purchase_invoice");
            }}
            onSave={async (invoiceData, stayOnPage, savePrices, salesPriceUpdates) => {
              try {
                if (savePrices) {
                  const latestCostByProduct = new Map<string, number>();
                  invoiceData.items.forEach((item) => {
                    latestCostByProduct.set(String(item.productId), Number(item.unitPrice || 0));
                  });

                  const productsToUpdate = products.filter((p) => latestCostByProduct.has(String(p.id)));
                  await Promise.all(
                    productsToUpdate.map(async (p) => {
                      const newCost = latestCostByProduct.get(String(p.id));
                      if (newCost === undefined) return;
                      const currentCost = Number(String(p.costPrice).replace(/[^0-9.-]/g, "")) || 0;
                      const newSale =
                        salesPriceUpdates && Object.prototype.hasOwnProperty.call(salesPriceUpdates, String(p.id))
                          ? Number(salesPriceUpdates[String(p.id)])
                          : undefined;
                      const currentSale = Number(String(p.price).replace(/[^0-9.-]/g, "")) || 0;
                      const costChanged = Math.abs(currentCost - newCost) >= 0.0001;
                      const saleChanged =
                        typeof newSale === "number" && Number.isFinite(newSale)
                          ? Math.abs(currentSale - newSale) >= 0.0001
                          : false;
                      if (!costChanged && !saleChanged) return;
                      await productAPI.update(String(p.id), {
                        ...p,
                        costPrice: newCost,
                        ...(saleChanged ? { price: newSale } : {}),
                      });
                    })
                  );

                  setProducts((prev) =>
                    prev.map((p) => {
                      const newCost = latestCostByProduct.get(String(p.id));
                      if (newCost === undefined) return p;
                      const newSale =
                        salesPriceUpdates && Object.prototype.hasOwnProperty.call(salesPriceUpdates, String(p.id))
                          ? Number(salesPriceUpdates[String(p.id)])
                          : undefined;
                      return {
                        ...p,
                        costPrice: newCost,
                        ...(typeof newSale === "number" && Number.isFinite(newSale)
                          ? { price: newSale }
                          : {}),
                      };
                    })
                  );
                }

                const saved = editingPurchaseInvoice
                  ? await purchaseInvoiceAPI.update(invoiceData.id, invoiceData)
                  : await purchaseInvoiceAPI.create(invoiceData);

                setPurchaseInvoices((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });

                // Auto-create/update make payment from cash paid on purchase invoice.
                const paidAmount = Number(saved.amountReceived || 0);
                const linkedPayments = findLinkedMakePayments(saved.id);
                const linkedPayment = linkedPayments[0];

                if (paidAmount > 0) {
                  const paymentPayload: MakePaymentDoc = {
                    id: linkedPayment?.id || getNextMakePaymentId(makePayments),
                    vendorId: saved.customerId,
                    vendorName: saved.customerName,
                    invoiceId: saved.id,
                    reference: saved.reference || "",
                    date: saved.date,
                    status: saved.status === "Void" || saved.status === "Deleted" ? saved.status : "Approved",
                    totalAmount: paidAmount,
                    notes: linkedPayment?.notes || `Auto payment from ${saved.id}`,
                  };
                  const paymentSaved = linkedPayment
                    ? await makePaymentAPI.update(linkedPayment.id, paymentPayload)
                    : await makePaymentAPI.create(paymentPayload);

                  if (linkedPayments.length > 1) {
                    const duplicates = linkedPayments.slice(1);
                    await Promise.all(duplicates.map((doc) => makePaymentAPI.delete(doc.id)));
                    const duplicateIds = new Set(duplicates.map((doc) => doc.id));
                    setMakePayments((prev) =>
                      upsertSalesModuleDoc(
                        prev.filter((doc) => !duplicateIds.has(doc.id)),
                        paymentSaved
                      )
                    );
                  } else {
                    setMakePayments((prev) => upsertSalesModuleDoc(prev, paymentSaved));
                  }
                } else if (linkedPayments.length > 0) {
                  await Promise.all(linkedPayments.map((doc) => makePaymentAPI.delete(doc.id)));
                  const idsToDelete = new Set(linkedPayments.map((doc) => doc.id));
                  setMakePayments((prev) => prev.filter((doc) => !idsToDelete.has(doc.id)));
                }

                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));

                if (stayOnPage) {
                  setEditingPurchaseInvoice(saved);
                } else {
                  setEditingPurchaseInvoice(undefined);
                  setActiveTab("purchase_invoice");
                }
              } catch (err: any) {
                setError(err?.message || "Failed to save purchase invoice");
              }
            }}
          />
        )}

        {activeTab === "add_purchase_order" && (
          <PurchaseOrderFormPage
            invoice={editingPurchaseOrder}
            invoices={purchaseOrders}
            products={products}
            vendors={vendors}
            company={activeCompany || undefined}
            onBack={() => {
              setEditingPurchaseOrder(undefined);
              setActiveTab("purchase_order");
            }}
            onNavigate={(inv) => {
              setEditingPurchaseOrder(inv);
              setActiveTab("add_purchase_order");
            }}
            onNavigateNew={() => {
              setEditingPurchaseOrder(undefined);
              setActiveTab("add_purchase_order");
            }}
            onSave={async (invoiceData, stayOnPage) => {
              try {
                const saved = editingPurchaseOrder
                  ? await purchaseOrderAPI.update(invoiceData.id, invoiceData)
                  : await purchaseOrderAPI.create(invoiceData);
                setPurchaseOrders((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });

                if (stayOnPage) {
                  setEditingPurchaseOrder(saved);
                } else {
                  setEditingPurchaseOrder(undefined);
                  setActiveTab("purchase_order");
                }
              } catch (err: any) {
                setError(err?.message || "Failed to save purchase order");
              }
            }}
          />
        )}

        {activeTab === "add_purchase_return" && (
          <PurchaseReturnFormPage
            invoice={editingPurchaseReturn}
            invoices={purchaseReturns}
            products={products}
            vendors={vendors}
            company={activeCompany || undefined}
            onBack={() => {
              setEditingPurchaseReturn(undefined);
              setActiveTab("purchase_return");
            }}
            onNavigate={(inv) => {
              setEditingPurchaseReturn(inv);
              setActiveTab("add_purchase_return");
            }}
            onNavigateNew={() => {
              setEditingPurchaseReturn(undefined);
              setActiveTab("add_purchase_return");
            }}
            onSave={async (invoiceData, stayOnPage) => {
              try {
                const saved = editingPurchaseReturn
                  ? await purchaseReturnAPI.update(invoiceData.id, invoiceData)
                  : await purchaseReturnAPI.create(invoiceData);
                setPurchaseReturns((prev) => {
                  const exists = prev.find((inv) => inv.id === saved.id);
                  if (exists) {
                    return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                  }
                  return [saved, ...prev];
                });

                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));

                if (stayOnPage) {
                  setEditingPurchaseReturn(saved);
                } else {
                  setEditingPurchaseReturn(undefined);
                  setActiveTab("purchase_return");
                }
              } catch (err: any) {
                setError(err?.message || "Failed to save purchase return");
              }
            }}
          />
        )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
