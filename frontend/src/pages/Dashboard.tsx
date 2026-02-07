import React, { useState, useMemo, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import StatCard from "../components/StatCard";
import ProductsPage from "./Products";
import AddProducts from "./AddProducts";
import CustomersPage from "./CustomersPage";
import AddCustomerPage from "./AddCustomer";
import VendorsPage from "./Vendors";
import AddVendorPage from "./AddVendor";
import CategoriesPage from "./Categories";
import AddCategoryPage from "./AddCategory";
import SettingsPage from "./Settings";
import type { Product, Category, Vendor, Customer } from "../types";
import { productAPI, customerAPI, vendorAPI, categoryAPI } from "../services/apiService";
import { getSession } from "../services/supabaseAuth";

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [editingCustomer, setEditingCustomer] = useState<Customer | undefined>(undefined);
  const [editingProduct, setEditingProduct] = useState<Product | undefined>(undefined);
  const [editingVendor, setEditingVendor] = useState<Vendor | undefined>(undefined);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>(undefined);

  // Fetch initial data from API
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const [productsData, customersData, vendorsData, categoriesData] = await Promise.all([
          productAPI.getAll(),
          customerAPI.getAll(),
          vendorAPI.getAll(),
          categoryAPI.getAll(),
        ]);

        setProducts(Array.isArray(productsData) ? productsData : productsData.data || []);
        setCustomers(Array.isArray(customersData) ? customersData : customersData.data || []);
        setVendors(Array.isArray(vendorsData) ? vendorsData : vendorsData.data || []);
        setCategories(Array.isArray(categoriesData) ? categoriesData : categoriesData.data || []);
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

  const handleDeleteProduct = (id: string) => {
    productAPI.delete(id).then(() => {
      setProducts(products.filter(p => p.id !== id));
    }).catch(err => {
      setError("Failed to delete product");
      console.error(err);
    });
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

  const lowStockCount = useMemo(() => {
    return products.filter(p => p.stock <= p.reorderPoint).length;
  }, [products]);

  const userLabel = useMemo(() => {
    const session = getSession();
    return session?.user?.email || "Admin";
  }, []);

  return (
    <div className="min-h-screen flex bg-[#fcf8f2] dark:bg-[#020617]">
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
        />

        <div className="p-6">
        {loading && (
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
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
