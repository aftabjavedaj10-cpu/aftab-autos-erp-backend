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
import AddCategoryPage from "./AddCategory";
import SettingsPage from "./Settings";
import SalesInvoicePage from "./SalesInvoice";
import SalesInvoiceFormPage from "./SalesInvoiceForm";
import type { Product, Category, Vendor, Customer, SalesInvoice, StockLedgerEntry } from "../types";
import { productAPI, customerAPI, vendorAPI, categoryAPI, companyAPI, permissionAPI, salesInvoiceAPI, stockLedgerAPI } from "../services/apiService";
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
  const [editingSalesInvoice, setEditingSalesInvoice] = useState<SalesInvoice | undefined>(undefined);
  const [stockLedger, setStockLedger] = useState<StockLedgerEntry[]>([]);
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
        const [productsData, customersData, vendorsData, categoriesData, salesInvoicesData, ledgerData] = await Promise.all([
          productAPI.getAll().catch(() => []),
          customerAPI.getAll().catch(() => []),
          vendorAPI.getAll().catch(() => []),
          categoryAPI.getAll().catch(() => []),
          salesInvoiceAPI.getAll().catch(() => []),
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
      } catch (err) {
        console.error("Failed to fetch data:", err);
        setError("Failed to load data from server. Please refresh the page.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
    setActiveTab("add_sales_invoice");
  };

  const handleAddStockAdjustment = () => {
    setActiveTab("add_stock_adjustment");
  };

  const handleEditSalesInvoice = (invoice: SalesInvoice) => {
    setEditingSalesInvoice(invoice);
    setActiveTab("add_sales_invoice");
  };

  const lowStockCount = useMemo(() => {
    return products.filter(p => (p.stockAvailable ?? p.stock) <= p.reorderPoint).length;
  }, [products]);

  const userLabel = useMemo(() => {
    const session = getSession();
    return session?.user?.email || "Admin";
  }, []);

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
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
            {error}
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
          <AddCategoryPage
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

        {activeTab === "sales_invoice" && (
          <SalesInvoicePage
            invoices={salesInvoices}
            onAddClick={handleAddSalesInvoice}
            onEditClick={handleEditSalesInvoice}
            onDelete={(id) => {
              salesInvoiceAPI.delete(id).then(() => {
                setSalesInvoices((prev) => prev.filter((inv) => inv.id !== id));
              });
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
          />
        )}

        {activeTab === "add_stock_adjustment" && (
          <AddStockAdjustmentPage
            products={products}
            onBack={() => setActiveTab("stock_adjustment")}
            onSave={async (payload) => {
              try {
                await stockLedgerAPI.createAdjustment(payload);
                const companyId = getActiveCompanyId();
                const ledgerData = companyId
                  ? await stockLedgerAPI.listRecent(companyId, 5000)
                  : [];
                const normalizedLedger = Array.isArray(ledgerData) ? ledgerData : [];
                setStockLedger(normalizedLedger);
                setProducts((prev) => mergeStockToProducts(prev, normalizedLedger));
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
          />
        )}

        {activeTab === "report_vendor_ledger" && (
          <VendorLedgerPage
            onBack={() => setActiveTab("reports")}
            vendors={vendors}
          />
        )}

        {activeTab === "add_sales_invoice" && (
          <SalesInvoiceFormPage
            invoice={editingSalesInvoice}
            invoices={salesInvoices}
            products={products}
            customers={customers}
            onBack={() => {
              setEditingSalesInvoice(undefined);
              setActiveTab("sales_invoice");
            }}
            onNavigate={(inv) => {
              setEditingSalesInvoice(inv);
              setActiveTab("add_sales_invoice");
            }}
            onNavigateNew={() => {
              setEditingSalesInvoice(undefined);
              setActiveTab("add_sales_invoice");
            }}
            onSave={(invoiceData, stayOnPage) => {
              const action = editingSalesInvoice
                ? salesInvoiceAPI.update(invoiceData.id, invoiceData)
                : salesInvoiceAPI.create(invoiceData);

              action
                .then((saved) => {
                  setSalesInvoices((prev) => {
                    const exists = prev.find((inv) => inv.id === saved.id);
                    if (exists) {
                      return prev.map((inv) => (inv.id === saved.id ? saved : inv));
                    }
                    return [saved, ...prev];
                  });
                  if (!stayOnPage) {
                    setEditingSalesInvoice(undefined);
                    setActiveTab("sales_invoice");
                  }
                })
                .catch((err) => {
                  setError(err?.message || "Failed to save sales invoice");
                });
            }}
          />
        )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
