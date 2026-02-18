import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Customer, Product, SalesInvoice } from "../types";

interface POSPageProps {
  products: Product[];
  customers: Customer[];
  terminalName?: string;
  onCompleteSale: (invoice: SalesInvoice) => void;
  onExit?: () => void;
  onOpenNewProduct?: () => void;
  onOpenTerminals?: () => void;
}

interface CartItem {
  productId: string;
  productName: string;
  productCode?: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
}

const parseMoney = (value: string | number | undefined) => {
  const num =
    typeof value === "number"
      ? value
      : Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(num) ? num : 0;
};

const POSPage: React.FC<POSPageProps> = ({
  products,
  customers,
  terminalName,
  onCompleteSale,
  onExit,
  onOpenNewProduct,
  onOpenTerminals,
}) => {
  const [view, setView] = useState<"catalog" | "payment">("catalog");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("guest");
  const [paymentMode, setPaymentMode] = useState<"Cash" | "Card" | "Digital">("Cash");
  const [cashReceivedInput, setCashReceivedInput] = useState<string>("0");
  const [totalDiscountInput, setTotalDiscountInput] = useState<string>("0");
  const [showReceipt, setShowReceipt] = useState<SalesInvoice | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (view === "catalog") {
      searchInputRef.current?.focus();
    }
  }, [view, cart.length, showReceipt]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter((p) => {
      return (
        String(p.name || "").toLowerCase().includes(q) ||
        String(p.productCode || "").toLowerCase().includes(q) ||
        String(p.barcode || "").toLowerCase().includes(q)
      );
    });
  }, [products, searchQuery]);

  const addToCart = (product: Product) => {
    const productId = String(product.id);
    const unitPrice = parseMoney(product.price);
    setCart((prev) => {
      const exists = prev.find((item) => item.productId === productId);
      if (exists) {
        return prev.map((item) => {
          if (item.productId !== productId) return item;
          const quantity = item.quantity + 1;
          const subtotal = quantity * item.unitPrice;
          return { ...item, quantity, total: subtotal - (subtotal * item.discount) / 100 };
        });
      }
      return [
        ...prev,
        {
          productId,
          productName: product.name,
          productCode: product.productCode,
          quantity: 1,
          unitPrice,
          discount: 0,
          total: unitPrice,
        },
      ];
    });
    setSearchQuery("");
  };

  const updateItem = (id: string, updates: Partial<CartItem>) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.productId !== id) return item;
        const next = { ...item, ...updates };
        next.quantity = Math.max(1, Number(next.quantity || 1));
        next.unitPrice = Number(next.unitPrice || 0);
        next.discount = Math.max(0, Number(next.discount || 0));
        const subtotal = next.quantity * next.unitPrice;
        next.total = subtotal - (subtotal * next.discount) / 100;
        return next;
      })
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== id));
  };

  const totals = useMemo(() => {
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const afterItemDiscount = cart.reduce((sum, item) => sum + item.total, 0);
    const tax = afterItemDiscount * 0.17;
    const beforeGlobalDiscount = afterItemDiscount + tax;
    const globalDiscount = Number(totalDiscountInput) || 0;
    const total = Math.max(0, beforeGlobalDiscount - globalDiscount);
    const cashReceived = Number(cashReceivedInput) || 0;
    const change = Math.max(0, cashReceived - total);
    return { subtotal, tax, total, change, globalDiscount };
  }, [cart, cashReceivedInput, totalDiscountInput]);

  const handleFinalize = () => {
    if (cart.length === 0) return;
    const customer = customers.find((c) => String(c.id) === selectedCustomerId);
    const today = new Date().toISOString().split("T")[0];
    const invoice: SalesInvoice = {
      id: `POS-${Date.now().toString().slice(-6)}`,
      customerId: selectedCustomerId === "guest" ? undefined : selectedCustomerId,
      customerName: customer?.name || "Guest",
      date: today,
      dueDate: today,
      status: "Approved",
      paymentStatus: "Paid",
      items: cart.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        productCode: item.productCode,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        tax: item.total * 0.17,
        total: item.total * 1.17,
      })),
      totalAmount: totals.total,
      notes: `POS ${terminalName || "Main"} | ${paymentMode} | Discount ${totals.globalDiscount}`,
    };
    onCompleteSale(invoice);
    setShowReceipt(invoice);
    setCart([]);
    setCashReceivedInput("0");
    setTotalDiscountInput("0");
    setView("catalog");
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 flex overflow-hidden">
      <div className="flex-1 p-4 border-r border-slate-200 dark:border-slate-800 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-white">
            POS Terminal {terminalName ? `- ${terminalName}` : ""}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={onOpenTerminals}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-700 text-white"
            >
              Terminals
            </button>
            <button
              onClick={onOpenNewProduct}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-orange-600 text-white"
            >
              New Product
            </button>
            <button
              onClick={onExit}
              className="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase bg-slate-200 dark:bg-slate-800"
            >
              Exit
            </button>
          </div>
        </div>

        <input
          ref={searchInputRef}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search product, code, barcode..."
          className="mb-3 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-sm dark:text-white"
          onKeyDown={(e) => {
            if (e.key === "Enter" && filteredProducts.length === 1) {
              addToCart(filteredProducts[0]);
            }
          }}
        />

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {filteredProducts.map((product) => (
            <button
              key={String(product.id)}
              onClick={() => addToCart(product)}
              className="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-orange-500"
            >
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[12px] font-bold text-slate-900 dark:text-white uppercase">
                    {product.name}
                  </p>
                  <p className="text-[10px] text-slate-500 uppercase">
                    {product.productCode || "-"}
                  </p>
                </div>
                <p className="text-[12px] font-black text-orange-600">
                  Rs. {parseMoney(product.price).toLocaleString()}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="w-[480px] max-w-[45vw] min-w-[360px] p-4 flex flex-col bg-white dark:bg-slate-900">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200">
            Current Order
          </h2>
          <button
            onClick={() => setCart([])}
            className="px-2 py-1 rounded text-[10px] font-black uppercase bg-slate-100 dark:bg-slate-800"
          >
            Clear
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2 pr-1">
          {cart.map((item) => (
            <div key={item.productId} className="p-3 border rounded-xl border-slate-200 dark:border-slate-800">
              <div className="flex justify-between mb-2">
                <p className="text-[11px] font-black uppercase text-slate-900 dark:text-white">{item.productName}</p>
                <button onClick={() => removeFromCart(item.productId)} className="text-[11px] font-black text-rose-500">
                  X
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.productId, { quantity: Number(e.target.value) })}
                  className="bg-slate-50 dark:bg-slate-800 border rounded px-2 py-1 text-[11px]"
                />
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.productId, { unitPrice: Number(e.target.value) })}
                  className="bg-slate-50 dark:bg-slate-800 border rounded px-2 py-1 text-[11px]"
                />
                <input
                  type="number"
                  value={item.discount}
                  onChange={(e) => updateItem(item.productId, { discount: Number(e.target.value) })}
                  className="bg-slate-50 dark:bg-slate-800 border rounded px-2 py-1 text-[11px]"
                />
              </div>
              <p className="text-right text-[11px] font-black mt-2 text-orange-600">Rs. {item.total.toLocaleString()}</p>
            </div>
          ))}
        </div>

        <div className="pt-3 mt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-[11px] font-bold"
          >
            <option value="guest">Walk-in Guest</option>
            {customers.map((c) => (
              <option key={String(c.id)} value={String(c.id)}>
                {c.name}
              </option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={totalDiscountInput}
              onChange={(e) => setTotalDiscountInput(e.target.value)}
              placeholder="Discount"
              className="bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-[11px]"
            />
            <input
              type="number"
              value={cashReceivedInput}
              onChange={(e) => setCashReceivedInput(e.target.value)}
              placeholder="Cash received"
              className="bg-slate-50 dark:bg-slate-800 border rounded-xl px-3 py-2 text-[11px]"
            />
          </div>
          <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
            <p>Subtotal: Rs. {totals.subtotal.toLocaleString()}</p>
            <p>Tax: Rs. {totals.tax.toLocaleString()}</p>
            <p>Total: Rs. {totals.total.toLocaleString()}</p>
            <p>Change: Rs. {totals.change.toLocaleString()}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(["Cash", "Card", "Digital"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setPaymentMode(mode)}
                className={`py-2 rounded-xl text-[10px] font-black uppercase ${
                  paymentMode === mode ? "bg-orange-600 text-white" : "bg-slate-100 dark:bg-slate-800"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <button
            onClick={handleFinalize}
            disabled={cart.length === 0 || Number(cashReceivedInput || 0) < totals.total}
            className="w-full py-3 rounded-xl text-[11px] font-black uppercase bg-orange-600 disabled:bg-slate-300 text-white"
          >
            Complete Sale
          </button>
        </div>
      </div>

      {showReceipt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-sm p-5">
            <p className="text-sm font-black uppercase mb-3">Sale completed</p>
            <p className="text-xs mb-1">Invoice: {showReceipt.id}</p>
            <p className="text-xs mb-1">Customer: {showReceipt.customerName}</p>
            <p className="text-xs mb-4">Total: Rs. {showReceipt.totalAmount.toLocaleString()}</p>
            <div className="flex gap-2">
              <button onClick={() => window.print()} className="flex-1 py-2 rounded-xl bg-slate-900 text-white text-[10px] font-black uppercase">
                Print
              </button>
              <button onClick={() => setShowReceipt(null)} className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-[10px] font-black uppercase">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POSPage;
