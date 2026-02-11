import React, { useMemo, useState } from "react";
import type { Product } from "../types";

interface AddStockAdjustmentPageProps {
  products: Product[];
  onBack: () => void;
  onSave: (payload: {
    productId: string;
    qty: number;
    direction: "IN" | "OUT";
    reason: string;
    sourceRef: string;
  }) => Promise<void> | void;
}

const AddStockAdjustmentPage: React.FC<AddStockAdjustmentPageProps> = ({
  products,
  onBack,
  onSave,
}) => {
  const [productSearch, setProductSearch] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [qty, setQty] = useState(1);
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [reason, setReason] = useState("manual_adjustment");
  const [sourceRef, setSourceRef] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return products.slice(0, 30);
    return products
      .filter((p) => {
        const name = String(p.name || "").toLowerCase();
        const code = String((p as any).productCode || "").toLowerCase();
        const id = String(p.id || "").toLowerCase();
        return name.includes(query) || code.includes(query) || id.includes(query);
      })
      .slice(0, 30);
  }, [products, productSearch]);

  const selectedProduct = useMemo(
    () => products.find((p) => String(p.id) === String(selectedProductId)),
    [products, selectedProductId]
  );

  const handleSave = async () => {
    if (!selectedProductId) {
      alert("Select product first.");
      return;
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }
    setSubmitting(true);
    try {
      await onSave({
        productId: selectedProductId,
        qty,
        direction,
        reason: reason.trim() || "manual_adjustment",
        sourceRef: sourceRef.trim(),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-in fade-in duration-500">
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-1.5 bg-white dark:bg-slate-900 border border-slate-100 rounded-lg text-slate-400 hover:text-orange-600 shadow-sm active:scale-95"
        >
          <span className="text-sm">&larr;</span>
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tight">
            Add Adjustment
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest text-[10px]">
            Inventory correction entry
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
              Product Search
            </label>
            <input
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Search product by name/code..."
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
            />
            <div className="mt-2 border border-slate-100 dark:border-slate-800 rounded-xl max-h-56 overflow-y-auto">
              {filteredProducts.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedProductId(String(p.id));
                    setProductSearch(p.name);
                  }}
                  className={`w-full text-left px-3 py-2 border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                    String(selectedProductId) === String(p.id)
                      ? "bg-orange-50 dark:bg-slate-800"
                      : "hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <div className="text-[11px] font-black text-slate-900 dark:text-white uppercase">
                    {p.name}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 uppercase">
                    {(p as any).productCode || p.id}
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && (
                <div className="px-3 py-3 text-[10px] font-bold text-slate-400">No products found</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Selected Product
              </label>
              <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-black text-slate-900 dark:text-white">
                {selectedProduct?.name || "None"}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Direction
                </label>
                <select
                  value={direction}
                  onChange={(e) => setDirection(e.target.value as "IN" | "OUT")}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white"
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                  Quantity
                </label>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value || 1)))}
                  className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Reason
              </label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="manual_adjustment"
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
                Reference
              </label>
              <input
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
                placeholder="Optional reference..."
                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-[11px] font-bold dark:text-white outline-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={submitting}
            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
          >
            {submitting ? "Saving..." : "Save Adjustment"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStockAdjustmentPage;

