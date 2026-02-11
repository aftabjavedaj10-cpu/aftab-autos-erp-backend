import React, { useMemo, useState } from 'react';
import { hasPermission } from '../services/supabaseAuth';
import {
  FiBarChart2,
  FiCpu,
  FiSettings,
  FiShoppingBag,
  FiShoppingCart,
  FiPackage,
  FiHelpCircle,
  FiClipboard,
  FiChevronDown,
  FiChevronLeft,
  FiChevronRight,
  FiX,
} from 'react-icons/fi';

const SidebarItem: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  active?: boolean; 
  isCollapsed: boolean;
  onClick?: () => void 
}> = ({ icon, label, active, isCollapsed, onClick }) => (
  <div 
    onClick={onClick}
    className={`flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-all duration-200 
      ${active 
        ? 'bg-orange-600 text-white shadow-md' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-orange-200/50 dark:hover:bg-slate-800 hover:text-orange-800 dark:hover:text-white'} 
      ${isCollapsed ? 'justify-center px-0' : ''}`}
    title={isCollapsed ? label : ''}
  >
    <span className="text-xl shrink-0">{icon}</span>
    {!isCollapsed && <span className="font-bold flex-1 truncate">{label}</span>}
  </div>
);

const SidebarDropdown: React.FC<{ 
  icon: React.ReactNode; 
  label: string; 
  items: { label: string; value: string }[]; 
  activeValue?: string;
  isOpen: boolean; 
  isCollapsed: boolean;
  toggle: () => void;
  onItemClick: (value: string) => void;
}> = ({ icon, label, items, activeValue, isOpen, isCollapsed, toggle, onItemClick }) => (
  <div className="space-y-1">
    <div 
      onClick={isCollapsed ? undefined : toggle}
      className={`flex items-center space-x-3 px-4 py-3 rounded-lg cursor-pointer transition-all 
        ${isCollapsed ? 'justify-center px-0' : ''} 
        ${(isOpen || items.some(i => i.value === activeValue)) && !isCollapsed 
          ? 'text-orange-700 dark:text-white font-bold' 
          : 'text-slate-600 dark:text-slate-400 hover:bg-orange-200/50 dark:hover:bg-slate-800 hover:text-orange-800 dark:hover:text-white'}`}
      title={isCollapsed ? label : ''}
    >
      <span className="text-xl shrink-0">{icon}</span>
      {!isCollapsed && (
        <>
          <span className="font-bold flex-1 truncate">{label}</span>
          <span className={`text-[10px] transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
            <FiChevronDown />
          </span>
        </>
      )}
    </div>
    {isOpen && !isCollapsed && (
      <div className="pl-12 space-y-1 overflow-hidden animate-in slide-in-from-top-2 duration-200">
        {items.map((item, idx) => (
          <div 
            key={idx} 
            onClick={() => onItemClick(item.value)}
            className={`py-2 text-sm font-bold cursor-pointer transition-colors ${activeValue === item.value ? 'text-orange-700' : 'text-slate-500 dark:text-slate-500 hover:text-orange-600 dark:hover:text-orange-400'}`}
          >
            {item.label}
          </div>
        ))}
      </div>
    )}
  </div>
);

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  isCollapsed: boolean;
  onToggle: () => void;
  isMobileOpen: boolean;
  onMobileClose: () => void;
  companyLogo?: string | null;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  onTabChange, 
  isCollapsed, 
  onToggle, 
  isMobileOpen,
  onMobileClose,
  companyLogo
}) => {
  const [setupOpen, setSetupOpen] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [salesOpen, setSalesOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  const effectiveCollapsed = isMobileOpen ? false : isCollapsed;
  const permissionFlags = useMemo(() => ({
    dashboard: hasPermission('dashboard.view'),
    products: hasPermission('products.read'),
    customers: hasPermission('customers.read'),
    vendors: hasPermission('vendors.read'),
    categories: hasPermission('categories.read'),
    settings: hasPermission('settings.view'),
  }), []);

  const setupItems = useMemo(() => {
    const items: { label: string; value: string }[] = [];
    if (permissionFlags.products) items.push({ label: "Products", value: "products" });
    if (permissionFlags.customers) items.push({ label: "Customers", value: "customers" });
    if (permissionFlags.vendors) items.push({ label: "Vendors", value: "vendors" });
    if (permissionFlags.categories) items.push({ label: "Categories", value: "categories" });
    return items;
  }, [permissionFlags]);

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 flex flex-col bg-sidebar-warm dark:bg-slate-950 border-r border-orange-200 dark:border-slate-900 p-4 space-y-8 overflow-y-auto sidebar-scroll transition-all duration-300 ease-in-out
      lg:sticky lg:h-screen lg:translate-x-0 print:hidden
      ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full lg:translate-x-0'}
      ${effectiveCollapsed ? 'lg:w-20' : 'lg:w-64'}
    `}>
      <div className={`flex items-center justify-between px-2 flex-shrink-0 ${effectiveCollapsed ? 'flex-col space-y-4' : 'space-x-2'}`}>
        <div className="flex items-center space-x-2 overflow-hidden">
          <div className="w-10 h-10 bg-orange-600 rounded-xl flex items-center justify-center font-black text-white shrink-0 shadow-lg overflow-hidden">
            {companyLogo ? (
              <img src={companyLogo} alt="L" className="w-full h-full object-cover" />
            ) : 'A'}
          </div>
          {!effectiveCollapsed && <span className="text-xl font-black text-slate-900 dark:text-white tracking-tighter uppercase truncate">AFTAB AUTOS</span>}
        </div>
        
        <button 
          onClick={onToggle}
          className="hidden lg:block p-1.5 rounded-lg bg-orange-100/50 dark:bg-slate-900 text-orange-700 dark:text-slate-400 hover:bg-orange-200 dark:hover:text-white transition-colors"
          title={effectiveCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
        >
          {effectiveCollapsed ? <FiChevronRight /> : <FiChevronLeft />}
        </button>

        <button 
          onClick={onMobileClose}
          className="lg:hidden p-1.5 rounded-lg bg-orange-100/50 dark:bg-slate-900 text-orange-700 dark:text-slate-400 hover:bg-orange-200 dark:hover:text-white transition-colors"
        >
          <FiX />
        </button>
      </div>

      <nav className="flex-1 space-y-2">
        {!effectiveCollapsed && <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 px-4">Main Menu</p>}
        
        {permissionFlags.dashboard && (
          <SidebarItem 
            icon={<FiBarChart2 />} 
            label="Dashboard" 
            isCollapsed={effectiveCollapsed}
            active={activeTab === 'dashboard'} 
            onClick={() => onTabChange('dashboard')} 
          />
        )}

        <SidebarDropdown 
          icon={<FiCpu />} 
          label="POS" 
          isCollapsed={effectiveCollapsed}
          isOpen={posOpen}
          toggle={() => setPosOpen(!posOpen)}
          activeValue={activeTab}
          onItemClick={(val) => onTabChange(val)}
          items={[
            { label: "POS Terminal", value: "pos" },
            { label: "Manage Terminals", value: "pos_terminals" }
          ]}
        />

        {setupItems.length > 0 && (
          <SidebarDropdown 
            icon={<FiPackage />} 
            label="Setup" 
            isCollapsed={effectiveCollapsed}
            isOpen={setupOpen}
            toggle={() => setSetupOpen(!setupOpen)}
            activeValue={activeTab}
            onItemClick={(val) => onTabChange(val)}
            items={setupItems}
          />
        )}
        
        <SidebarDropdown 
          icon={<FiShoppingCart />} 
          label="Sales" 
          isCollapsed={effectiveCollapsed}
          isOpen={salesOpen}
          toggle={() => setSalesOpen(!salesOpen)}
          activeValue={activeTab}
          onItemClick={(val) => onTabChange(val)}
          items={[
            { label: "Quotation", value: "quotation" },
            { label: "Sales Order", value: "sales_order" },
            { label: "Sales Invoice", value: "sales_invoice" },
            { label: "Sales Return", value: "sales_return" },
            { label: "Receive Payment", value: "receive_payment" }
          ]}
        />
        
        <SidebarDropdown 
          icon={<FiShoppingBag />} 
          label="Purchase" 
          isCollapsed={effectiveCollapsed}
          isOpen={purchaseOpen}
          toggle={() => setPurchaseOpen(!purchaseOpen)}
          activeValue={activeTab}
          onItemClick={(val) => onTabChange(val)}
          items={[
            { label: "Purchase Order", value: "purchase_order" },
            { label: "Purchase Invoice", value: "purchase_invoice" },
            { label: "Purchase Return", value: "purchase_return" },
            { label: "Make Payment", value: "make_payment" }
          ]}
        />

        <SidebarDropdown
          icon={<FiPackage />}
          label="Inventory"
          isCollapsed={effectiveCollapsed}
          isOpen={inventoryOpen}
          toggle={() => setInventoryOpen(!inventoryOpen)}
          activeValue={activeTab}
          onItemClick={(val) => onTabChange(val)}
          items={[
            { label: "Stock Adjustment", value: "stock_adjustment" },
          ]}
        />

        <SidebarItem 
          icon={<FiClipboard />} 
          label="Reports" 
          isCollapsed={effectiveCollapsed}
          active={activeTab === 'reports'} 
          onClick={() => onTabChange('reports')} 
        />
        
        {!effectiveCollapsed && <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-8 mb-4 px-4">Support</p>}
        {permissionFlags.settings && (
          <SidebarItem 
            icon={<FiSettings />} 
            label="Settings" 
            isCollapsed={effectiveCollapsed} 
            active={activeTab === 'settings'}
            onClick={() => onTabChange('settings')}
          />
        )}
        <SidebarItem icon={<FiHelpCircle />} label="Help Center" isCollapsed={effectiveCollapsed} />
      </nav>
    </div>
  );
};

export default Sidebar;
